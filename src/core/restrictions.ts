import type { RestrictedKind, Rule, Session } from './models';
import { findRule, hostMatchesDomain } from './matching';
import { enforcing } from './pomodoro';

export type ServiceKind = Exclude<RestrictedKind, 'intent'>;

/**
 * O que dá para esconder em cada serviço ("recursos"). Só entram coisas que o site realmente tem.
 * `hiddenByDefault`: já vem marcado ao tornar o serviço "restrito". Rótulos em pt-BR: `ui/i18n/pt-BR.ts`.
 */
export const FEATURE_DEFS: Record<ServiceKind, { id: string; hiddenByDefault: boolean }[]> = {
  youtube: [
    { id: 'home', hiddenByDefault: true }, // feed do Início, Inscrições e Em alta
    { id: 'shorts', hiddenByDefault: true },
    { id: 'related', hiddenByDefault: true }, // vídeos recomendados ao lado e no fim do vídeo
    { id: 'comments', hiddenByDefault: true },
  ],
  instagram: [
    { id: 'feed', hiddenByDefault: true },
    { id: 'reels', hiddenByDefault: true },
    { id: 'explore', hiddenByDefault: true },
    { id: 'stories', hiddenByDefault: true },
    { id: 'messages', hiddenByDefault: false }, // mensagens (DMs): liberadas por padrão
    { id: 'posts', hiddenByDefault: false }, // perfis e publicações de outras pessoas
  ],
  x: [
    { id: 'forYou', hiddenByDefault: true }, // aba "Para você"
    { id: 'explore', hiddenByDefault: true }, // página Explorar / tendências
  ],
  linkedin: [
    { id: 'feed', hiddenByDefault: true },
    { id: 'videos', hiddenByDefault: true },
    { id: 'news', hiddenByDefault: true }, // "LinkedIn Notícias"
    { id: 'messages', hiddenByDefault: false },
  ],
};

const SERVICE_DOMAINS: [string, ServiceKind][] = [
  ['youtube.com', 'youtube'],
  ['instagram.com', 'instagram'],
  ['x.com', 'x'],
  ['twitter.com', 'x'],
  ['linkedin.com', 'linkedin'],
];

/** Serviço com restrição própria para este domínio, ou null (→ só modo intenção). */
export function serviceKindFor(domain: string): ServiceKind | null {
  return SERVICE_DOMAINS.find(([d]) => hostMatchesDomain(domain, d))?.[1] ?? null;
}

export function defaultFeatures(kind: RestrictedKind): string[] {
  return kind === 'intent' ? [] : FEATURE_DEFS[kind].filter((f) => f.hiddenByDefault).map((f) => f.id);
}

/** Recursos escondidos por uma regra (ids desconhecidos são ignorados; sem lista = padrão do serviço). */
export function featuresOf(rule: Pick<Rule, 'restrictedKind' | 'features'>): Set<string> {
  const kind = rule.restrictedKind;
  if (!kind || kind === 'intent') return new Set();
  const known = FEATURE_DEFS[kind].map((f) => f.id);
  return new Set((rule.features ?? defaultFeatures(kind)).filter((id) => known.includes(id)));
}

/**
 * O serviço `kind` está restrito agora? Devolve os recursos a esconder, ou null.
 * Só vale com sessão ativa e fora da pausa do Pomodoro. `domains`: os domínios do serviço (ex.: x.com e twitter.com).
 */
export function restrictionFor(
  session: Pick<Session, 'status' | 'environmentSnapshot' | 'pomodoro'> | undefined,
  kind: ServiceKind,
  domains: string[],
): { features: Set<string> } | null {
  if (!session || !enforcing(session)) return null;
  for (const d of domains) {
    const rule = findRule(session.environmentSnapshot, d);
    if (rule?.mode === 'restricted' && rule.restrictedKind === kind) return { features: featuresOf(rule) };
  }
  return null;
}
