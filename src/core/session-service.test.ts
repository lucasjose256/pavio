import { beforeEach, describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import { MemoryStorage } from './memory-storage';
import type { HistoryEntry } from './models';
import { HistoryRepository, ScheduleRepository, SessionRepository } from './repositories';
import { SESSION_ALARM, SessionAlreadyActiveError, SessionService } from './session-service';

const env = createBuiltinEnvironment('builtin-study', 0)!;
let now: number;
let alarms: Map<string, number>;
let notified: HistoryEntry[];
let sessions: SessionRepository;
let history: HistoryRepository;
let service: SessionService;

beforeEach(() => {
  now = 1_000_000;
  alarms = new Map();
  notified = [];
  const storage = new MemoryStorage();
  sessions = new SessionRepository(storage);
  history = new HistoryRepository(storage);
  service = new SessionService({
    sessions,
    history,
    schedule: new ScheduleRepository(storage, { now: () => now }),
    clock: { now: () => now },
    newId: () => 'sid',
    scheduler: {
      schedule: async (n, w) => void alarms.set(n, w),
      cancel: async (n) => void alarms.delete(n),
    },
    notifier: { sessionCompleted: async (e) => void notified.push(e), intentTimeUp: async () => {}, scheduledStarted: async () => {} },
  });
});

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
