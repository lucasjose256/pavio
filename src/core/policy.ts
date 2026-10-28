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
export interface PolicyInput {
  routine: RoutineSite[];
  routineEnabled: boolean;
  /** Horários pausados até este instante (as faixas não valem; bloqueio rápido, partes e limite seguem). */
  routinePausedUntil?: number;
  session: Pick<Session, 'status' | 'environmentSnapshot' | 'youtubeAllowlist' | 'pomodoro' | 'endsAt'> | undefined;
  now: number;
  /** Tempo de uso de hoje (limites de tempo dos apps). */
  usage?: UsageData;
  /** "Preciso disso agora": tiram as regras da rotina e do limite do app até vencerem (as do Timer ficam). */
  releases?: Release[];
}

export function computePolicy(input: PolicyInput): Policy {
  const policy = policyAt(input);
  const unblockAt: Record<string, number> = {};
  const freeAt: Record<string, number> = {};
  for (const rule of policy.rules) {
    if (rule.mode === 'allowed') continue;
    const free = endOfRestriction(input, rule.domain, true);
    if (free !== undefined) freeAt[rule.domain] = free;
    if (rule.mode === 'blocked') {
      const open = endOfRestriction(input, rule.domain, false);
      if (open !== undefined) unblockAt[rule.domain] = open;
    }
  }
  return { ...policy, unblockAt, freeAt };
}

/**
 * Quando a restrição de `domain` acaba DE VERDADE: anda pelas próximas viradas (faixas, fim da vela, meia-noite do
 * limite, fim de uma liberação) e devolve a primeira em que ele já não é restringido. Sem fim à vista (bloqueio rápido,
 * faixa de dia todo, outra faixa logo em seguida…) devolve undefined. `anyRule`: conta também "restrito" (recursos).
 * A pausa do Pomodoro não entra na conta (o horário mostrado é o do fim da vela).
 */
function endOfRestriction(input: PolicyInput, domain: string, anyRule: boolean): number | undefined {
  const { routine, session, usage = {} } = input;
  const routineEnabled = input.routineEnabled;
  const releases = activeReleases(input.releases, input.now);
  const limitActive = limitRules(routine, usage, input.now).length > 0;
  const restricted = (policy: Policy) => {
    const rule = findRule(policy, domain);
    return anyRule ? !!rule && rule.mode !== 'allowed' : rule?.mode === 'blocked';
  };
  let t = input.now;
  for (let step = 0; step < 60; step++) {
    const candidates = [
      nextBoundary(routine, routineEnabled, t, releases),
      input.routinePausedUntil,
      session?.status === 'active' ? session.endsAt : undefined,
      limitActive ? nextMidnight(t) : undefined,
      ...releases.map((r) => r.until),
    ].filter((c): c is number => typeof c === 'number' && c > t);
    if (!candidates.length) return undefined;
    t = Math.min(...candidates);
    const policy = policyAt({ ...input, now: t, session: session && t < session.endsAt ? session : undefined });
    if (!restricted(policy)) return t;
  }
  return undefined;
}

/** Os horários (faixas) valem agora? Ligados e fora de uma pausa temporária. */
export function schedulesOn(input: Pick<PolicyInput, 'routineEnabled' | 'routinePausedUntil'>, now: number): boolean {
  return input.routineEnabled && !(input.routinePausedUntil !== undefined && now < input.routinePausedUntil);
}

/** Quando a tela de bloqueio pode dizer "volta a liberar": o fim da restrição DESTE site (ou recurso), se houver. */
export function returnTimeFor(policy: Pick<Policy, 'rules' | 'unblockAt' | 'freeAt'> | undefined, site: string | null, cameFromFeature: boolean): number | undefined {
  if (!policy || !site) return undefined;
  const rule = findRule(policy, site);
  return rule ? (cameFromFeature ? policy.freeAt : policy.unblockAt)?.[rule.domain] : undefined;
}

function policyAt(input: PolicyInput): Policy {
  const { routine, session, now, usage = {} } = input;
  // Pausados por um tempo, os horários contam como desligados até a pausa vencer.
  const routineEnabled = schedulesOn(input, now);
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
    input.routinePausedUntil, // fim da pausa dos horários
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
