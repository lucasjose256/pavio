import type { Policy, RestrictedKind, RestrictionSpec, Rule } from './models';
import { findRule, hostMatchesDomain } from './matching';

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
 * `domains`: os domínios do serviço (ex.: x.com e twitter.com). Quem decide se vale agora é a `Policy`
 * (rotina + Timer, fora da pausa do Pomodoro), calculada pelo service worker.
 */
export function restrictionFor(
  policy: Pick<Policy, 'rules'> | undefined,
  kind: ServiceKind,
  domains: string[],
): { features: Set<string> } | null {
  if (!policy) return null;
  for (const d of domains) {
    const rule = findRule(policy, d);
    if (rule?.mode === 'restricted' && rule.restrictedKind === kind) return { features: featuresOf(rule) };
  }
  return null;
}

// ---------- como um site é tratado: especificação, rigor e combinação ----------

type SpecLike = Pick<Rule, 'mode' | 'restrictedKind' | 'features'>;

/** Rigor: liberado 0 < intenção 2 < esconder partes do serviço 3 < bloqueado 4. */
export function strictness(spec: SpecLike): number {
  if (spec.mode === 'blocked') return 4;
  if (spec.mode === 'restricted') return spec.restrictedKind && spec.restrictedKind !== 'intent' ? 3 : 2;
  return 0;
}

/** Junta dois tratamentos do mesmo site: vale o mais rigoroso; esconder partes do mesmo serviço soma os recursos. */
export function combineSpecs<T extends SpecLike>(a: T, b: T): T {
  const [ra, rb] = [strictness(a), strictness(b)];
  if (ra !== rb) return ra > rb ? a : b;
  if (ra === 3 && a.restrictedKind === b.restrictedKind) {
    const features = new Set([...featuresOf(a), ...featuresOf(b)]);
    const kind = a.restrictedKind as ServiceKind;
    return { ...a, features: FEATURE_DEFS[kind].map((f) => f.id).filter((id) => features.has(id)) };
  }
  return a;
}

/** Tratamento padrão ao escolher "bloqueado"/"restrito" para um site. */
export function defaultSpec(domain: string, mode: RestrictionSpec['mode']): RestrictionSpec {
  if (mode === 'blocked') return { mode };
  const kind = serviceKindFor(domain) ?? 'intent';
  return kind === 'intent' ? { mode, restrictedKind: kind } : { mode, restrictedKind: kind, features: defaultFeatures(kind) };
}

export function specWithMode(spec: RestrictionSpec, domain: string, mode: RestrictionSpec['mode']): RestrictionSpec {
  return spec.mode === mode ? spec : defaultSpec(domain, mode);
}

/** Troca entre "esconder partes do serviço" e "modo intenção". */
export function specWithKind(_spec: RestrictionSpec, kind: RestrictedKind): RestrictionSpec {
  return kind === 'intent' ? { mode: 'restricted', restrictedKind: 'intent' } : { mode: 'restricted', restrictedKind: kind, features: defaultFeatures(kind) };
}

/** Liga/desliga um recurso escondido. */
export function specToggleFeature(spec: RestrictionSpec, id: string): RestrictionSpec {
  const kind = spec.restrictedKind;
  if (spec.mode !== 'restricted' || !kind || kind === 'intent') return spec;
  const set = featuresOf(spec);
  if (!set.delete(id)) set.add(id);
  return { ...spec, features: FEATURE_DEFS[kind].map((f) => f.id).filter((f) => set.has(f)) };
}
