import { describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import type { RoutineSite, Session } from './models';
import { blockStillApplies, computePolicy } from './policy';
import { pomodoroState } from './pomodoro';

const min = (n: number) => n * 60_000;
const mon = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();
const routine: RoutineSite[] = [
  { id: 'i', domain: 'instagram.com', enabled: true, slots: [{ id: 'a', days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 18 * 60, mode: 'blocked' }] },
];
const session = (over: Partial<Session> = {}): Session => ({
  id: 's', status: 'active', startedAt: mon(10), endsAt: mon(10) + min(90), plannedMs: min(90), strictness: 'focus', youtubeAllowlist: [], blockedAttempts: 0,
  environmentSnapshot: createBuiltinEnvironment('builtin-study', 0)!, ...over,
});

describe('computePolicy', () => {
  it('só rotina: regras das faixas ativas; sem Timer', () => {
    const p = computePolicy({ routine, routineEnabled: true, session: undefined, now: mon(10) });
    expect(p.rules.map((r) => r.domain)).toEqual(['instagram.com']);
    expect(p).toMatchObject({ routineActive: true, timerActive: false, youtubeAllowlist: [] });
    expect(p.nextChange).toBe(mon(18));
  });
  it('rotina desligada e sem Timer: nada vale', () => {
    const p = computePolicy({ routine, routineEnabled: false, session: undefined, now: mon(10) });
    expect(p).toMatchObject({ rules: [], routineActive: false, timerActive: false, nextChange: undefined });
  });
  it('só Timer: vale o ambiente da vela, mesmo fora das faixas, com a lista do YouTube', () => {
    const link = { kind: 'video' as const, id: 'x', url: 'u' };
    const p = computePolicy({ routine, routineEnabled: true, session: session({ youtubeAllowlist: [link] }), now: mon(20) });
    expect(p.rules.map((r) => r.domain)).toContain('reddit.com'); // do ambiente Estudo
    expect(p).toMatchObject({ routineActive: false, timerActive: true, youtubeAllowlist: [link] });
  });
  it('rotina + Timer: soma, e por site vale a mais rigorosa', () => {
    const env = createBuiltinEnvironment('builtin-study', 0)!; // instagram bloqueado
    env.rules.find((r) => r.domain === 'instagram.com')!.mode = 'restricted';
    env.rules.find((r) => r.domain === 'instagram.com')!.restrictedKind = 'instagram';
    const p = computePolicy({ routine, routineEnabled: true, session: session({ environmentSnapshot: env }), now: mon(10, 30) });
    expect(p.rules.find((r) => r.domain === 'instagram.com')!.mode).toBe('blocked'); // a rotina é mais rigorosa
    expect(p.rules.length).toBeGreaterThan(1);
  });
  it('na pausa do Pomodoro some só a parte do Timer; a rotina continua firme', () => {
    const cfg = { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 };
    const s = session();
    const onBreak = { ...s, pomodoro: { ...pomodoroState(cfg, s.startedAt, s.endsAt, s.startedAt), phase: 'break' as const, phaseEndsAt: s.startedAt + min(30) } };
    const p = computePolicy({ routine, routineEnabled: true, session: onBreak, now: s.startedAt + min(26) });
    expect(p.rules.map((r) => r.domain)).toEqual(['instagram.com']); // só a rotina
    expect(p.timerActive).toBe(false);
    expect(p.nextChange).toBe(s.startedAt + min(30)); // quando o foco volta
  });
  it('nextChange é o primeiro de: fim da faixa, fim da vela, fim da fase', () => {
    expect(computePolicy({ routine, routineEnabled: true, session: session(), now: mon(10, 30) }).nextChange).toBe(mon(11, 30)); // vela acaba antes das 18h
  });
  it('sessão não ativa é ignorada', () => {
    const done = session({ status: 'completed' });
    expect(computePolicy({ routine: [], routineEnabled: false, session: done, now: mon(10) }).rules).toEqual([]);
  });
});

describe('blockStillApplies', () => {
  const policy = { rules: [
    { id: '1', domain: 'tiktok.com', mode: 'blocked' as const },
    { id: '2', domain: 'instagram.com', mode: 'restricted' as const, restrictedKind: 'instagram' as const },
    { id: '3', domain: 'reddit.com', mode: 'restricted' as const, restrictedKind: 'intent' as const },
  ] };
  it('bloqueado vale; restrito por recursos vale quando a página veio de um recurso escondido', () => {
    expect(blockStillApplies(policy, 'tiktok.com', false)).toBe(true);
    expect(blockStillApplies(policy, 'www.tiktok.com', false)).toBe(true);
    expect(blockStillApplies(policy, 'instagram.com', true)).toBe(true);
    expect(blockStillApplies(policy, 'instagram.com', false)).toBe(false);
  });
  it('sem regra (faixa acabou, pausa do Pomodoro) a página libera', () => {
    expect(blockStillApplies({ rules: [] }, 'tiktok.com', false)).toBe(false);
    expect(blockStillApplies(undefined, 'tiktok.com', false)).toBe(false);
    expect(blockStillApplies(policy, null, false)).toBe(false);
  });
});
