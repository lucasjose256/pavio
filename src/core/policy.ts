import { findRule, hostMatchesDomain } from './matching';
import { enforcing } from './pomodoro';
import type { Policy, Release, RoutineSite, Session } from './models';
import { activeReleases, isReleased } from './release';
import { activeRules, mergeRules, nextBoundary } from './routine';
import { limitRules, nextMidnight } from './usage';
import type { UsageData } from './usage';

/**
 * O que vale agora = regras da rotina (faixas ativas) + regras do Timer (ambiente da vela, fora da pausa).
 * Por site, a mais rigorosa vence. Na pausa do Pomodoro só sai a parte do Timer: a rotina continua firme.
 * Apps que estouraram o limite de tempo de hoje entram como bloqueados até a meia-noite (também fazem parte da
 * rotina: a pausa do timer não os libera).
 */
export function computePolicy(input: {
  routine: RoutineSite[];
  routineEnabled: boolean;
  session: Pick<Session, 'status' | 'environmentSnapshot' | 'youtubeAllowlist' | 'pomodoro' | 'endsAt'> | undefined;
  now: number;
  /** Tempo de uso de hoje (limites de tempo dos apps). */
  usage?: UsageData;
  /** "Preciso disso agora": tiram as regras da rotina e do limite do app até vencerem (as do Timer ficam). */
  releases?: Release[];
}): Policy {
  const { routine, routineEnabled, session, now, usage = {} } = input;
  const releases = activeReleases(input.releases, now);
  const timer = session?.status === 'active' ? session : undefined;
  const timerEnforcing = !!timer && enforcing(timer);
  const timerRules = timerEnforcing ? timer.environmentSnapshot.rules : [];

  const routineRules = activeRules(routine, routineEnabled, now, releases);
  const limited = limitRules(routine, usage, now);
  const notReleased = <T extends { domain: string }>(rules: T[]) => rules.filter((r) => !isReleased(r, releases, now));
  const rules = mergeRules(notReleased(routineRules), notReleased(limited), timerRules);
  // Liberar por um tempo só resolve o que vem da rotina/limite; o que o Timer restringe se resolve apagando a vela.
  const timerRestricts = (domain: string) =>
    timerRules.some((r) => r.mode !== 'allowed' && (hostMatchesDomain(domain, r.domain) || hostMatchesDomain(r.domain, domain)));
  const releasable = [...new Set(mergeRules(routineRules, limited).map((r) => r.domain))].filter((d) => !timerRestricts(d));

  const changes = [
    nextBoundary(routine, routineEnabled, now, releases),
    timer?.endsAt,
    timer?.pomodoro?.phaseEndsAt,
    limited.length ? nextMidnight(now) : undefined, // o limite zera à meia-noite
    ...releases.map((r) => r.until), // a liberação vence e o bloqueio volta
  ].filter((t): t is number => typeof t === 'number' && t > now);

  return {
    rules,
    youtubeAllowlist: timerEnforcing ? timer.youtubeAllowlist : [],
    nextChange: changes.length ? Math.min(...changes) : undefined,
    routineActive: routineRules.length > 0,
    timerActive: timerEnforcing,
    limitReached: notReleased(limited).map((r) => r.domain),
    releasable,
    released: releases,
  };
}

/**
 * A página de bloqueio deste site ainda faz sentido? Site bloqueado pela política, ou site "restrito" por recursos
 * (a página veio de um content script que escondeu uma parte, ex.: Reels). Quando a política já não o restringe
 * (acabou a faixa ou a vela, ou é a pausa do Pomodoro), a página que ficou aberta se libera sozinha.
 */
export function blockStillApplies(policy: Pick<Policy, 'rules'> | undefined, site: string | null, cameFromFeature: boolean): boolean {
  if (!policy || !site) return false;
  const rule = findRule(policy, site);
  return rule?.mode === 'blocked' || (rule?.mode === 'restricted' && cameFromFeature);
}
