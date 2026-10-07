import { hostMatchesDomain } from './matching';
import type { Release, Rule } from './models';
import { nextMidnight } from './usage';

/** "Preciso disso agora": liberar um app (ou recurso) da rotina por um tempo, e o bloqueio volta sozinho. */
export const RELEASE_OPTIONS_MIN = [5, 15, 30] as const;
export const MAX_RELEASE_MIN = 120;

export const isValidRelease = (minutes: number): boolean => Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_RELEASE_MIN;

/** Só as que ainda valem. */
export function activeReleases(list: Release[] | undefined, now: number): Release[] {
  return (list ?? []).filter((r) => r.until > now);
}

/** Pausas oferecidas ao desligar: 5, 15 ou 30 min, ou até o fim do dia. ("Até eu religar" é desligar de vez, na rotina.) */
export const PAUSE_MINUTES = [5, 15, 30] as const;
export type PauseChoice = { kind: 'min'; minutes: number } | { kind: 'day' };

/** Alvo de uma pausa: o app inteiro (`slotId` ausente) ou uma faixa dele. */
export interface PauseTarget {
  domain: string;
  slotId?: string;
}

const sameTarget = (r: Release, t: PauseTarget) => r.domain === t.domain && r.slotId === t.slotId;

/** Instante em que a pausa acaba. `day` = a meia-noite que vem (o dia de hoje inteiro). */
export function pauseUntil(choice: PauseChoice, now: number): number {
  if (choice.kind === 'day') return nextMidnight(now);
  if (!isValidRelease(choice.minutes)) throw new Error(`release:invalid:${choice.minutes}`);
  return now + choice.minutes * 60_000;
}

/** Pausa `target` até `until`, substituindo uma pausa anterior do mesmo alvo. */
export function addPause(list: Release[] | undefined, target: PauseTarget, until: number, now: number): Release[] {
  if (!(until > now)) throw new Error('release:past');
  return [...activeReleases(list, now).filter((r) => !sameTarget(r, target)), { ...target, until }];
}

/** Libera `domain` por `minutes` a partir de agora (substitui uma liberação anterior do mesmo domínio). */
export function addRelease(list: Release[] | undefined, domain: string, minutes: number, now: number): Release[] {
  return addPause(list, { domain }, pauseUntil({ kind: 'min', minutes }, now), now);
}

/** Retoma (tira a pausa de) um alvo. Retomar o app inteiro também tira as pausas de suas faixas. */
export function removePause(list: Release[] | undefined, target: PauseTarget): Release[] {
  return (list ?? []).filter((r) => (target.slotId === undefined ? r.domain !== target.domain : !sameTarget(r, target)));
}

/** Até quando `slotId` (ou o app, sem `slotId`) está pausado agora; undefined se não está. Pausa do app vale para as faixas. */
export function pausedUntil(list: Release[] | undefined, target: PauseTarget, now: number): number | undefined {
  const ends = activeReleases(list, now)
    .filter((r) => hostMatchesDomain(target.domain, r.domain) && (r.slotId === undefined || r.slotId === target.slotId))
    .map((r) => r.until);
  return ends.length ? Math.max(...ends) : undefined;
}

/** A regra (de um domínio, ou subdomínio dele) está liberada agora? Só conta a pausa do app inteiro. */
export function isReleased(rule: Pick<Rule, 'domain'>, list: Release[], now: number): boolean {
  return list.some((r) => r.slotId === undefined && r.until > now && hostMatchesDomain(rule.domain, r.domain));
}
