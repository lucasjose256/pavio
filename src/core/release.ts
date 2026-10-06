import { hostMatchesDomain } from './matching';
import type { Release, Rule } from './models';

/** "Preciso disso agora": liberar um app (ou recurso) da rotina por um tempo, e o bloqueio volta sozinho. */
export const RELEASE_OPTIONS_MIN = [5, 15, 30] as const;
export const MAX_RELEASE_MIN = 120;

export const isValidRelease = (minutes: number): boolean => Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_RELEASE_MIN;

/** Só as que ainda valem. */
export function activeReleases(list: Release[] | undefined, now: number): Release[] {
  return (list ?? []).filter((r) => r.until > now);
}

/** Libera `domain` por `minutes` a partir de agora (substitui uma liberação anterior do mesmo domínio). */
export function addRelease(list: Release[] | undefined, domain: string, minutes: number, now: number): Release[] {
  if (!isValidRelease(minutes)) throw new Error(`release:invalid:${minutes}`);
  return [...activeReleases(list, now).filter((r) => r.domain !== domain), { domain, until: now + minutes * 60_000 }];
}

/** A regra (de um domínio, ou subdomínio dele) está liberada agora? */
export function isReleased(rule: Pick<Rule, 'domain'>, list: Release[], now: number): boolean {
  return list.some((r) => r.until > now && hostMatchesDomain(rule.domain, r.domain));
}
