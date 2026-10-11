import { beforeEach, describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import { buildSession } from './session';
import { MemoryStorage } from './memory-storage';
import type { HistoryEntry, Session } from './models';
import { HistoryRepository, SessionRepository } from './repositories';
import { POMODORO_ALARM, SESSION_ALARM, SessionAlreadyActiveError, SessionService } from './session-service';
import { planFor } from './blocking';
import { computePolicy } from './policy';
import { restrictionFor } from './restrictions';

const env = createBuiltinEnvironment('builtin-study', 0)!;
let now: number;
let alarms: Map<string, number>;
let notified: HistoryEntry[];
let phases: string[];
let sessions: SessionRepository;
let history: HistoryRepository;
let service: SessionService;

beforeEach(() => {
  now = 1_000_000;
  alarms = new Map();
  notified = [];
  phases = [];
  const storage = new MemoryStorage();
  sessions = new SessionRepository(storage);
  history = new HistoryRepository(storage);
  service = new SessionService({
    sessions,
    history,
    clock: { now: () => now },
    newId: () => 'sid',
    scheduler: {
      schedule: async (n, w) => void alarms.set(n, w),
      cancel: async (n) => void alarms.delete(n),
    },
    notifier: { sessionCompleted: async (e) => void notified.push(e), intentTimeUp: async () => {}, pomodoroPhase: async (_s, phase) => void phases.push(phase) },
  });
});

const policyOf = (session: Session | undefined) => computePolicy({ routine: [], routineEnabled: false, session, now });
const input = { environment: env, minutes: 25, strictness: 'focus' as const };

describe('SessionService', () => {
  it('start grava a sessão, congela o ambiente e agenda o alarme', async () => {
    const s = await service.start(input);
    expect(s.endsAt).toBe(now + 25 * 60_000);
    expect(alarms.get(SESSION_ALARM)).toBe(s.endsAt);
    expect(await sessions.get()).toEqual(s);
    expect(s.environmentSnapshot).not.toBe(env);
  });

  it('não inicia duas sessões nem duração inválida', async () => {
    await service.start(input);
    await expect(service.start(input)).rejects.toBeInstanceOf(SessionAlreadyActiveError);
    await service.abandon();
    await expect(service.start({ ...input, minutes: 0 })).rejects.toThrow();
    await expect(service.start({ ...input, minutes: 1.5 })).rejects.toThrow();
  });

  it('reconcile antes do fim mantém a sessão e reagenda o alarme', async () => {
    const s = await service.start(input);
    alarms.clear(); // ex.: alarme perdido ao reiniciar o navegador
    now += 60_000;
    expect(await service.reconcile()).toEqual(s);
    expect(alarms.get(SESSION_ALARM)).toBe(s.endsAt);
    expect(notified).toHaveLength(0);
  });

  it('reconcile após o fim conclui, grava histórico, notifica e limpa', async () => {
    const s = await service.start(input);
    now = s.endsAt + 3 * 3_600_000; // navegador ficou fechado por horas
    expect(await service.reconcile()).toBeUndefined();
    expect(await sessions.get()).toBeUndefined();
    expect(alarms.has(SESSION_ALARM)).toBe(false);
    const [entry] = await history.list();
    expect(entry).toMatchObject({ outcome: 'completed', actualMs: 25 * 60_000, endedAt: s.endsAt });
    expect(notified).toEqual([entry]);
    expect(await service.reconcile()).toBeUndefined(); // idempotente
    expect(await history.list()).toHaveLength(1);
  });

  it('abandon registra o tempo real e não notifica', async () => {
    await service.start(input);
    now += 5 * 60_000;
    const entry = await service.abandon();
    expect(entry).toMatchObject({ outcome: 'abandoned', actualMs: 5 * 60_000 });
    expect(notified).toHaveLength(0);
    expect(await service.abandon()).toBeUndefined();
  });

  it('conta tentativas bloqueadas só com sessão ativa', async () => {
    await service.recordBlockedAttempt(); // sem sessão: não faz nada
    await service.start(input);
    await service.recordBlockedAttempt();
    await service.recordBlockedAttempt();
    expect((await sessions.get())?.blockedAttempts).toBe(2);
    now += 60_000;
    const entry = await service.abandon();
    expect(entry?.blockedAttempts).toBe(2);
  });
});

describe('Pomodoro automático', () => {
  const pomo = { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 };
  const startPomo = () => service.start({ ...input, minutes: 90, pomodoro: pomo });

  it('começa em foco, sem notificar, e agenda o alarme da primeira pausa', async () => {
    const s = await startPomo();
    expect(s.pomodoro).toMatchObject({ phase: 'focus', cycle: 1, phaseEndsAt: now + 25 * 60_000 });
    expect(alarms.get(POMODORO_ALARM)).toBe(now + 25 * 60_000);
    expect(phases).toEqual([]);
    expect(planFor(policyOf(s)).block.length).toBeGreaterThan(0); // foco: bloqueando
  });

  it('na hora da pausa: troca a fase, notifica, desliga os bloqueios e agenda a volta', async () => {
    const s = await startPomo();
    now = s.startedAt + 25 * 60_000;
    const during = await service.reconcile();
    expect(during?.pomodoro).toMatchObject({ phase: 'break', phaseEndsAt: s.startedAt + 30 * 60_000 });
    expect(phases).toEqual(['break']);
    expect(alarms.get(POMODORO_ALARM)).toBe(s.startedAt + 30 * 60_000);
    expect(planFor(policyOf(during))).toEqual({ block: [], intent: [], allow: [] });
    expect(restrictionFor(policyOf(during), 'youtube', ['youtube.com'])).toBeNull();
    expect((await sessions.get())?.pomodoro?.phase).toBe('break'); // gravado: content scripts e DNR reagem ao storage
  });

  it('depois da pausa volta ao foco (ciclo 2) e os bloqueios voltam', async () => {
    const s = await startPomo();
    now = s.startedAt + 31 * 60_000;
    const back = await service.reconcile();
    expect(back?.pomodoro).toMatchObject({ phase: 'focus', cycle: 2 });
    expect(planFor(policyOf(back)).block.length).toBeGreaterThan(0);
  });

  it('é idempotente: reconciliar de novo na mesma fase não notifica outra vez', async () => {
    const s = await startPomo();
    now = s.startedAt + 26 * 60_000;
    await service.reconcile();
    await service.reconcile();
    expect(phases).toEqual(['break']);
  });

  it('navegador fechado por várias fases: cai direto na fase certa, com uma notificação', async () => {
    const s = await startPomo();
    now = s.startedAt + 58 * 60_000; // foco 2 termina em 55; pausa 2: 55..60
    const late = await service.reconcile();
    expect(late?.pomodoro).toMatchObject({ phase: 'break', cycle: 2 });
    expect(phases).toEqual(['break']);
  });

  it('sem pomodoro nada muda; ao encerrar o alarme da fase é cancelado', async () => {
    const plain = await service.start(input);
    expect(plain.pomodoro).toBeUndefined();
    expect(alarms.has(POMODORO_ALARM)).toBe(false);
    await service.abandon();
    await startPomo();
    expect(alarms.has(POMODORO_ALARM)).toBe(true);
    await service.abandon();
    expect(alarms.has(POMODORO_ALARM)).toBe(false);
  });

  it('a última fase não agenda alarme de fase (o fim da sessão cuida)', async () => {
    const s = await service.start({ ...input, minutes: 20, pomodoro: pomo }); // sessão menor que o 1º foco
    expect(s.pomodoro?.phaseEndsAt).toBe(s.endsAt);
    expect(alarms.has(POMODORO_ALARM)).toBe(false);
  });
});


describe('blockNewTabs na vela', () => {
  it('a opção escolhida ao acender fica guardada na sessão (e some quando desligada)', async () => {
    const env = createBuiltinEnvironment('builtin-study', 0)!;
    const withTabs = buildSession({ environment: env, minutes: 25, strictness: 'light', blockNewTabs: true }, 1000, () => 'id');
    expect(withTabs.blockNewTabs).toBe(true);
    const without = buildSession({ environment: env, minutes: 25, strictness: 'light', blockNewTabs: false }, 1000, () => 'id');
    expect('blockNewTabs' in without).toBe(false);
  });
});
