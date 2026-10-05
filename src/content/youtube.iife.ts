import type { Session } from '../core/models';
import { channelAllowed, youtubeDecision, youtubeRestriction } from '../core/youtube';
import { youtube, youtubeCss } from './selectors';

/**
 * Modo restrito do YouTube. Só age enquanto há sessão ativa cujo ambiente trata youtube.com como
 * "restrito". Esconde feed/recomendados/Shorts/comentários por CSS e bloqueia páginas fora da lista.
 */

const STYLE_ID = 'pavio-youtube-style';
const root = document.documentElement;
let restriction: ReturnType<typeof youtubeRestriction> = null;
let lastHref = '';
let run = 0; // invalida checagens de canal antigas quando a página muda

function setStyle(features: ReadonlySet<string> | null, feedFree: boolean) {
  const on = features !== null;
  document.getElementById(STYLE_ID)?.remove();
  root.classList.toggle('pavio-yt-feedfree', on && feedFree && features.has('home'));
  if (!on) return void root.classList.remove('pavio-yt-pending');
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = youtubeCss(features);
  root.appendChild(style);
}

const leave = (why: string) =>
  location.replace(chrome.runtime.getURL(`src/ui/blocked/index.html?site=youtube.com&why=${why}`));

const pending = (on: boolean) => root.classList.toggle('pavio-yt-pending', on);
const pauseVideos = () => document.querySelectorAll('video').forEach((v) => v.pause());

/** Espera os links do dono do vídeo ATUAL (não os do vídeo anterior, que o YouTube mantém um instante). */
async function ownerHrefs(videoId: string, token: number, timeoutMs = 6000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && token === run) {
    const page = document.querySelector(youtube.watchPage);
    if (page?.getAttribute(youtube.watchVideoIdAttr) === videoId) {
      const hrefs = youtube.ownerLinks
        .flatMap((selector) => [...document.querySelectorAll<HTMLAnchorElement>(selector)])
        .map((a) => a.getAttribute('href'))
        .filter((h): h is string => !!h);
      if (hrefs.length) return hrefs;
    }
    pauseVideos();
    await new Promise((r) => setTimeout(r, 150));
  }
  return [];
}

async function evaluate() {
  const token = ++run;
  lastHref = location.href;
  if (!restriction) return pending(false);

  const decision = youtubeDecision(location, restriction.allowlist, restriction.features);
  if (decision.action === 'allow') return pending(false);
  if (decision.action === 'block') return leave(decision.reason);

  // Vídeo fora da lista: liberado só se for de um canal permitido.
  pending(true);
  pauseVideos();
  const videoId = new URLSearchParams(location.search).get('v') ?? '';
  const hrefs = await ownerHrefs(videoId, token);
  if (token !== run) return; // a página mudou enquanto esperávamos
  if (hrefs.some((href) => channelAllowed(href, restriction!.allowlist))) pending(false);
  else leave('not-allowed');
}

function apply(session: Session | undefined) {
  restriction = youtubeRestriction(session);
  setStyle(restriction?.features ?? null, restriction?.allowlist.length === 0);
  void evaluate();
}

void chrome.storage.local.get('activeSession').then((r) => apply(r.activeSession as Session | undefined));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.activeSession) apply(changes.activeSession.newValue as Session | undefined);
});

// YouTube é uma SPA: a URL muda sem recarregar. Eventos próprios + verificação leve de segurança.
document.addEventListener('yt-navigate-finish', () => void evaluate());
window.addEventListener('popstate', () => void evaluate());
setInterval(() => {
  if (location.href !== lastHref) void evaluate();
}, 700);
