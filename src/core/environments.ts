import type { Environment, RestrictedKind, Rule, RuleMode } from './models';
import { normalizeDomain } from './matching';
import { defaultFeatures, serviceKindFor } from './restrictions';
import type { IdGenerator } from './ports';

/** Sites populares sugeridos na página de opções. */
export const SUGGESTED_SITES: { name: string; domain: string; restrictedKind: RestrictedKind }[] = [
  { name: 'YouTube', domain: 'youtube.com', restrictedKind: 'youtube' },
  { name: 'Instagram', domain: 'instagram.com', restrictedKind: 'instagram' },
  { name: 'TikTok', domain: 'tiktok.com', restrictedKind: 'intent' },
  { name: 'X', domain: 'x.com', restrictedKind: 'x' },
  { name: 'Facebook', domain: 'facebook.com', restrictedKind: 'intent' },
  { name: 'Reddit', domain: 'reddit.com', restrictedKind: 'intent' },
  { name: 'LinkedIn', domain: 'linkedin.com', restrictedKind: 'linkedin' },
];

type PresetRule = [domain: string, mode: RuleMode, kind?: RestrictedKind];

const PRESETS: { id: string; name: string; rules: PresetRule[] }[] = [
  {
    id: 'builtin-study',
    name: 'Estudo',
    rules: [
      ['youtube.com', 'restricted', 'youtube'],
      ['instagram.com', 'blocked'],
      ['tiktok.com', 'blocked'],
      ['x.com', 'blocked'],
      ['facebook.com', 'blocked'],
      ['reddit.com', 'blocked'],
      ['linkedin.com', 'restricted', 'linkedin'],
    ],
  },
  {
    id: 'builtin-deep-work',
    name: 'Trabalho profundo',
    rules: [
      ['youtube.com', 'blocked'],
      ['instagram.com', 'blocked'],
      ['tiktok.com', 'blocked'],
      ['x.com', 'restricted', 'x'],
      ['facebook.com', 'blocked'],
      ['reddit.com', 'restricted', 'intent'],
      ['linkedin.com', 'restricted', 'linkedin'],
    ],
  },
  {
    id: 'builtin-night',
    name: 'Noite',
    rules: [
      ['youtube.com', 'restricted', 'youtube'],
      ['instagram.com', 'restricted', 'instagram'],
      ['tiktok.com', 'blocked'],
      ['x.com', 'restricted', 'x'],
      ['facebook.com', 'blocked'],
      ['reddit.com', 'restricted', 'intent'],
      ['linkedin.com', 'blocked'],
    ],
  },
];

export function createBuiltinEnvironment(presetId: string, now: number): Environment | undefined {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) return undefined;
  return {
    id: preset.id,
    name: preset.name,
    builtin: true,
    createdAt: now,
    updatedAt: now,
    rules: preset.rules.map(([domain, mode, restrictedKind]) => ({
      id: `${preset.id}:${domain}`,
      domain,
      mode,
      ...(restrictedKind ? { restrictedKind } : {}),
    })),
  };
}

export function createBuiltinEnvironments(now: number): Environment[] {
  return PRESETS.map((p) => createBuiltinEnvironment(p.id, now)!);
}

export function createEnvironment(name: string, now: number, newId: IdGenerator): Environment {
  return { id: newId(), name: name.trim(), rules: [], builtin: false, createdAt: now, updatedAt: now };
}

/** Cria uma regra a partir do que o usuário digitou; null se o domínio for inválido. */
export function createRule(
  input: string,
  mode: RuleMode,
  newId: IdGenerator,
  restrictedKind?: RestrictedKind,
): Rule | null {
  const domain = normalizeDomain(input);
  if (!domain) return null;
  const rule: Rule = { id: newId(), domain, mode };
  if (mode === 'restricted') {
    rule.restrictedKind = restrictedKind ?? defaultRestrictedKind(domain);
    if (rule.restrictedKind !== 'intent') rule.features = defaultFeatures(rule.restrictedKind);
  }
  return rule;
}

/** youtube/instagram/x/linkedin têm tratamento dedicado (recursos); o resto cai no modo intenção. */
export function defaultRestrictedKind(domain: string): RestrictedKind {
  return serviceKindFor(domain) ?? 'intent';
}

/** Retorna lista de erros (vazia = válido). Mensagens técnicas; a UI traduz. */
export function validateEnvironment(env: Environment): string[] {
  const errors: string[] = [];
  if (!env.name.trim()) errors.push('name:empty');
  const seen = new Set<string>();
  for (const rule of env.rules) {
    if (normalizeDomain(rule.domain) !== rule.domain) errors.push(`rule:invalid-domain:${rule.domain}`);
    if (seen.has(rule.domain)) errors.push(`rule:duplicate:${rule.domain}`);
    seen.add(rule.domain);
    if (rule.mode === 'restricted' && !rule.restrictedKind) errors.push(`rule:missing-kind:${rule.domain}`);
    if (rule.mode !== 'restricted' && rule.restrictedKind) errors.push(`rule:unexpected-kind:${rule.domain}`);
  }
  return errors;
}

/** Quantas regras de cada tipo (para os cartões de ambiente). */
export function ruleCounts(env: Environment): Record<RuleMode, number> {
  const counts: Record<RuleMode, number> = { allowed: 0, blocked: 0, restricted: 0 };
  for (const r of env.rules) counts[r.mode]++;
  return counts;
}

/** Cópia editável (ex.: para personalizar um ambiente de exemplo sem perder o original). */
export function duplicateEnvironment(env: Environment, now: number, newId: IdGenerator): Environment {
  return {
    ...structuredClone(env),
    id: newId(),
    name: `${env.name} (cópia)`,
    builtin: false,
    createdAt: now,
    updatedAt: now,
    rules: env.rules.map((r) => ({ ...r, id: newId() })),
  };
}
