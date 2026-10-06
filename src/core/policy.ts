import { findRule } from './matching';
import { enforcing } from './pomodoro';
import type { Policy, RoutineSite, Session } from './models';
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
}): Policy {
  const { routine, routineEnabled, session, now, usage = {} } = input;
  const timer = session?.status === 'active' ? session : undefined;
  const timerEnforcing = !!timer && enforcing(timer);

  const routineRules = activeRules(routine, routineEnabled, now);
  const limited = limitRules(routine, usage, now);
  const rules = mergeRules(routineRules, limited, timerEnforcing ? timer.environmentSnapshot.rules : []);

  const changes = [
    nextBoundary(routine, routineEnabled, now),
    timer?.endsAt,
    timer?.pomodoro?.phaseEndsAt,
    limited.length ? nextMidnight(now) : undefined, // o limite zera à meia-noite
  ].filter((t): t is number => typeof t === 'number' && t > now);

  return {
    rules,
    youtubeAllowlist: timerEnforcing ? timer.youtubeAllowlist : [],
    nextChange: changes.length ? Math.min(...changes) : undefined,
    routineActive: routineRules.length > 0,
    timerActive: timerEnforcing,
    limitReached: limited.map((r) => r.domain),
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
