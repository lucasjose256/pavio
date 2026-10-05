import type { AllowedLink, Session } from './models';
import { findRule } from './matching';

/** Id de canal estável: "@handle" (minúsculo), "UCxxxx", "c/nome" ou "user/nome". */
export function channelIdFromPath(pathname: string): string | null {
  const safe = (v: string) => {
    try { return decodeURIComponent(v); } catch { return v; }
  };
  const [first, second] = pathname.split('/').filter(Boolean).map(safe);
  if (!first) return null;
  if (first.startsWith('@')) return first.toLowerCase();
  if (first === 'channel' && second) return second;
  if ((first === 'c' || first === 'user') && second) return `${first}/${second.toLowerCase()}`;
  return null;
}

const stripSubdomain = (host: string) => host.toLowerCase().replace(/^(www|m)\./, '');

/** Entende o que o usuário colou: vídeo, playlist ou canal. Null se não for um link do YouTube reconhecível. */
export function parseYouTubeLink(input: string): AllowedLink | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = stripSubdomain(url.hostname);
  const make = (kind: AllowedLink['kind'], id: string | null | undefined): AllowedLink | null =>
    id ? { kind, id, url: raw } : null;

  if (host === 'youtu.be') return make('video', url.pathname.split('/').filter(Boolean)[0]);
  if (host !== 'youtube.com') return null;

  const segments = url.pathname.split('/').filter(Boolean);
  const v = url.searchParams.get('v');
  const list = url.searchParams.get('list');
  if (segments[0] === 'watch') return v ? make('video', v) : make('playlist', list);
  if (segments[0] === 'playlist') return make('playlist', list);
  if (['shorts', 'embed', 'live'].includes(segments[0] ?? '')) return make('video', segments[1]);
  const channel = channelIdFromPath(url.pathname);
  return channel ? make('channel', channel) : null;
}

/** Uma linha por link. Devolve os válidos e as linhas que não deu para entender. */
export function parseYouTubeLinks(text: string): { links: AllowedLink[]; invalid: string[] } {
  const links: AllowedLink[] = [];
  const invalid: string[] = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const link = parseYouTubeLink(line);
    if (!link) invalid.push(line);
    else if (!links.some((l) => l.kind === link.kind && l.id === link.id)) links.push(link);
  }
  return { links, invalid };
}

export type YouTubeDecision =
  | { action: 'allow' }
  | { action: 'block'; reason: 'shorts' | 'feed' | 'not-allowed' }
  /** Vídeo fora da lista, mas pode ser de um canal permitido: só o DOM sabe (ver content/youtube.ts). */
  | { action: 'check-channel' };

const BLOCKED_FEEDS = ['/feed/subscriptions', '/feed/explore', '/feed/trending'];

export function channelAllowed(href: string, allowlist: AllowedLink[]): boolean {
  let pathname: string;
  try { pathname = new URL(href, 'https://www.youtube.com').pathname; } catch { return false; }
  const id = channelIdFromPath(pathname);
  return id !== null && allowlist.some((l) => l.kind === 'channel' && l.id === id);
}

/**
 * Pode ver esta página do YouTube? Só `pathname` e `search` entram (rodam no navegador e no futuro app).
 * Lista vazia: YouTube "sem feed" (busca e vídeos liberados; Shorts e feeds de descoberta não).
 * Lista com itens: só o que está nela (vídeo, playlist, canal e os vídeos de canais permitidos).
 */
export function youtubeDecision(loc: { pathname: string; search: string }, allowlist: AllowedLink[]): YouTubeDecision {
  const path = loc.pathname.replace(/\/+$/, '') || '/';
  if (path.startsWith('/shorts')) return { action: 'block', reason: 'shorts' };
  if (BLOCKED_FEEDS.some((f) => path.startsWith(f))) return { action: 'block', reason: 'feed' };
  if (allowlist.length === 0) return { action: 'allow' };

  const params = new URLSearchParams(loc.search);
  const has = (kind: AllowedLink['kind'], id: string | null) => !!id && allowlist.some((l) => l.kind === kind && l.id === id);

  if (path === '/watch') {
    if (has('video', params.get('v')) || has('playlist', params.get('list'))) return { action: 'allow' };
    return allowlist.some((l) => l.kind === 'channel') ? { action: 'check-channel' } : { action: 'block', reason: 'not-allowed' };
  }
  if (path === '/playlist') return has('playlist', params.get('list')) ? { action: 'allow' } : { action: 'block', reason: 'not-allowed' };

  const channel = channelIdFromPath(path);
  if (channel && has('channel', channel)) return { action: 'allow' };
  return { action: 'block', reason: 'not-allowed' };
}

/** A sessão pede o modo restrito do YouTube? Devolve a allowlist da sessão, ou null se não. */
export function youtubeRestriction(
  session: Pick<Session, 'status' | 'environmentSnapshot' | 'youtubeAllowlist'> | undefined,
): { allowlist: AllowedLink[] } | null {
  if (session?.status !== 'active') return null;
  const rule = findRule(session.environmentSnapshot, 'www.youtube.com');
  return rule?.mode === 'restricted' && rule.restrictedKind === 'youtube' ? { allowlist: session.youtubeAllowlist } : null;
}
