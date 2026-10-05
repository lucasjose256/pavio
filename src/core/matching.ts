import type { Environment, Rule } from './models';

/**
 * Normaliza entrada do usuário ("https://www.YouTube.com/watch?v=1") para
 * um domínio ("youtube.com"). Retorna null se não parecer um domínio.
 */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // protocolo
  value = value.split(/[/?#]/)[0] ?? '';
  value = value.replace(/^[^@]*@/, '').replace(/:\d+$/, ''); // user@ e :porta
  value = value.replace(/^www\./, '').replace(/\.$/, '');
  const valid = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(value);
  return valid ? value : null;
}

/** "m.youtube.com" casa com a regra "youtube.com"; "notyoutube.com" não. */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');
  return h === domain || h.endsWith(`.${domain}`);
}

/** Regra mais específica (domínio mais longo) vence. Sem regra → undefined (liberado). */
export function findRule(env: Environment, host: string): Rule | undefined {
  return env.rules
    .filter((r) => hostMatchesDomain(host, r.domain))
    .sort((a, b) => b.domain.length - a.domain.length)[0];
}
