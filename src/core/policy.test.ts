import { describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import type { RoutineSite, Session } from './models';
import { blockStillApplies, computePolicy } from './policy';
import { pomodoroState } from './pomodoro';
import { addUsage } from './usage';

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

describe('cenário: o timer bloqueia o YouTube e a rotina também mexe nele', () => {
  const cfg = { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 };
  const timerBlocksYouTube = (): Session => {
    const env = createBuiltinEnvironment('builtin-deep-work', 0)!; // youtube: bloqueado
    const startedAt = mon(10);
    const endsAt = startedAt + min(60);
    return {
      id: 't', status: 'active', startedAt, endsAt, plannedMs: min(60), strictness: 'focus', youtubeAllowlist: [], blockedAttempts: 0,
      environmentSnapshot: env, pomodoro: pomodoroState(cfg, startedAt, endsAt, startedAt),
    };
  };
  const youtubeRule = (p: ReturnType<typeof computePolicy>) => p.rules.find((r) => r.domain === 'youtube.com');
  const onBreak = (s: Session): Session => ({ ...s, pomodoro: { ...s.pomodoro!, phase: 'break', phaseEndsAt: s.startedAt + min(30) } });
  const routineHidesShorts: RoutineSite[] = [{
    id: 'y', domain: 'youtube.com', enabled: true,
    slots: [{ id: 'a', days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 18 * 60, mode: 'restricted', restrictedKind: 'youtube', features: ['shorts'] }],
  }];

  it('rotina esconde só os Shorts: no foco o timer bloqueia tudo; na pausa e no fim volta ao nível da rotina (não some)', () => {
    const timer = timerBlocksYouTube();
    const at = (s: Session | undefined, now: number) => computePolicy({ routine: routineHidesShorts, routineEnabled: true, session: s, now });
    expect(youtubeRule(at(timer, mon(10, 10)))!.mode).toBe('blocked'); // foco: o mais rigoroso (timer)
    const brk = youtubeRule(at(onBreak(timer), mon(10, 27)))!; // pausa: sai só o timer
    expect(brk).toMatchObject({ mode: 'restricted', restrictedKind: 'youtube', features: ['shorts'] }); // a rotina continua
    const after = youtubeRule(at(undefined, mon(11, 5)))!; // fim da vela
    expect(after).toMatchObject({ mode: 'restricted', features: ['shorts'] });
  });

  it('rotina bloqueia o YouTube agora: a pausa do timer NÃO libera (a rotina é firme)', () => {
    const routineBlocks: RoutineSite[] = [{ id: 'y', domain: 'youtube.com', enabled: true, slots: [{ id: 'b', days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 18 * 60, mode: 'blocked' }] }];
    const timer = timerBlocksYouTube();
    const brk = computePolicy({ routine: routineBlocks, routineEnabled: true, session: onBreak(timer), now: mon(10, 27) });
    expect(youtubeRule(brk)!.mode).toBe('blocked');
    const end = computePolicy({ routine: routineBlocks, routineEnabled: true, session: undefined, now: mon(11, 5) });
    expect(youtubeRule(end)!.mode).toBe('blocked');
  });

  it('sem nada na rotina: na pausa e no fim o YouTube fica livre (só havia o timer)', () => {
    const timer = timerBlocksYouTube();
    expect(youtubeRule(computePolicy({ routine: [], routineEnabled: true, session: timer, now: mon(10, 10) }))!.mode).toBe('blocked');
    expect(youtubeRule(computePolicy({ routine: [], routineEnabled: true, session: onBreak(timer), now: mon(10, 27) }))).toBeUndefined();
    expect(youtubeRule(computePolicy({ routine: [], routineEnabled: true, session: undefined, now: mon(11, 5) }))).toBeUndefined();
  });

  it('o timer nunca LIBERA o que a rotina restringe, nem com uma regra "liberado" no ambiente', () => {
    const env = createBuiltinEnvironment('builtin-study', 0)!;
    env.rules = env.rules.map((r) => (r.domain === 'youtube.com' ? { ...r, mode: 'allowed' as const, restrictedKind: undefined } : r));
    const lenient = { ...timerBlocksYouTube(), environmentSnapshot: env };
    const routineBlocks: RoutineSite[] = [{ id: 'y', domain: 'youtube.com', enabled: true, slots: [{ id: 'b', days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 18 * 60, mode: 'blocked' }] }];
    expect(youtubeRule(computePolicy({ routine: routineBlocks, routineEnabled: true, session: lenient, now: mon(10, 10) }))!.mode).toBe('blocked');
  });
});

describe('limite de tempo', () => {
  const sites: RoutineSite[] = [{ id: 'y', domain: 'youtube.com', enabled: true, slots: [], limitMin: 30 }];
  const spent = addUsage({}, 'youtube.com', 30 * 60_000, mon(15));

  it('app que estourou entra como bloqueado, aparece em limitReached e a política muda à meia-noite', () => {
    const p = computePolicy({ routine: sites, routineEnabled: true, session: undefined, now: mon(15), usage: spent });
    expect(p.rules).toEqual([{ id: 'limit:youtube.com', domain: 'youtube.com', mode: 'blocked' }]);
    expect(p.limitReached).toEqual(['youtube.com']);
    expect(p.nextChange).toBe(new Date(2026, 9, 6).getTime());
  });

  it('sem uso, ou no dia seguinte, nada é bloqueado', () => {
    expect(computePolicy({ routine: sites, routineEnabled: true, session: undefined, now: mon(15), usage: {} }).limitReached).toEqual([]);
    expect(computePolicy({ routine: sites, routineEnabled: true, session: undefined, now: mon(15) + 86_400_000, usage: spent }).rules).toEqual([]);
  });

  it('vale com os horários desligados e soma com a rotina (a mais rigorosa vence)', () => {
    expect(computePolicy({ routine: sites, routineEnabled: false, session: undefined, now: mon(15), usage: spent }).rules).toHaveLength(1);
    const withSlot: RoutineSite[] = [{ ...sites[0]!, slots: [{ id: 's', days: [1], startMin: 0, endMin: 1440, mode: 'restricted', restrictedKind: 'youtube' }] }];
    expect(computePolicy({ routine: withSlot, routineEnabled: true, session: undefined, now: mon(15), usage: spent }).rules[0]!.mode).toBe('blocked');
  });
});
