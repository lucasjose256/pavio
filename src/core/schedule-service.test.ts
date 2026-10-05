import { beforeEach, describe, expect, it } from 'vitest';
import { createBuiltinEnvironments } from './environments';
import { MemoryStorage } from './memory-storage';
import type { ScheduleBlock, Session } from './models';
import { EnvironmentRepository, HistoryRepository, ScheduleRepository, SessionRepository } from './repositories';
import { SCHEDULE_ALARM, ScheduleService } from './schedule-service';
import { SESSION_ALARM, SessionService } from './session-service';

const mon = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime(); // segunda-feira
const tue = (h: number, m = 0) => new Date(2026, 9, 6, h, m).getTime();

let now: number;
let alarms: Map<string, number>;
let started: Session[];
let sessions: SessionRepository;
let history: HistoryRepository;
let scheduleRepo: ScheduleRepository;
let sessionService: SessionService;
let service: ScheduleService;
let n = 0;

const block = (over: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  id: 'b1', name: 'Manhã de estudo', environmentId: 'builtin-study', days: [1, 2], startMin: 9 * 60, endMin: 12 * 60,
  strictness: 'focus', enabled: true, createdAt: 0, updatedAt: 0, ...over,
});

beforeEach(async () => {
  now = mon(8);
  alarms = new Map();
  started = [];
  const storage = new MemoryStorage();
  const clock = { now: () => now };
  sessions = new SessionRepository(storage);
  history = new HistoryRepository(storage);
  scheduleRepo = new ScheduleRepository(storage, clock);
  const environments = new EnvironmentRepository(storage, clock);
  await storage.set('environments', createBuiltinEnvironments(0));
  const scheduler = {
    schedule: async (name: string, when: number) => void alarms.set(name, when),
    cancel: async (name: string) => void alarms.delete(name),
  };
  sessionService = new SessionService({
    sessions, history, schedule: scheduleRepo, scheduler, clock, newId: () => `s${++n}`,
    notifier: { sessionCompleted: async () => {}, intentTimeUp: async () => {}, scheduledStarted: async (s) => void started.push(s), pomodoroPhase: async () => {} },
  });
  service = new ScheduleService({ schedule: scheduleRepo, environments, sessionService, scheduler, clock });
});

describe('ScheduleService', () => {
  it('antes da faixa: não acende e agenda o alarme para o início', async () => {
    await scheduleRepo.save(block());
    expect(await service.sync()).toBeUndefined();
    expect(alarms.get(SCHEDULE_ALARM)).toBe(mon(9));
  });

  it('na hora da faixa: acende a vela até o fim dela, com o ambiente e a rigidez da faixa', async () => {
    await scheduleRepo.save(block());
    now = mon(9, 0);
    const s = await service.sync();
    expect(s).toMatchObject({ source: 'schedule', scheduleName: 'Manhã de estudo', startedAt: mon(9), endsAt: mon(12), strictness: 'focus' });
    expect(s?.environmentSnapshot.name).toBe('Estudo');
    expect(alarms.get(SESSION_ALARM)).toBe(mon(12));
    expect(started).toHaveLength(1);
    expect(alarms.get(SCHEDULE_ALARM)).toBe(tue(9)); // próxima: amanhã
  });

  it('navegador aberto no meio da faixa: acende com o fim original', async () => {
    await scheduleRepo.save(block());
    now = mon(10, 30);
    expect((await service.sync())?.endsAt).toBe(mon(12));
  });

  it('é idempotente: não acende duas vezes', async () => {
    await scheduleRepo.save(block());
    now = mon(10);
    await service.sync();
    await service.sync();
    expect(started).toHaveLength(1);
  });

  it('não interrompe uma sessão manual em andamento; acende a faixa quando a manual acaba', async () => {
    await scheduleRepo.save(block());
    now = mon(9, 30);
    await sessions.set({ id: 'm', status: 'active', startedAt: mon(9, 30), endsAt: mon(10), plannedMs: 30 * 60_000, strictness: 'light',
      youtubeAllowlist: [], blockedAttempts: 0, environmentSnapshot: createBuiltinEnvironments(0)[2]! });
    expect((await service.sync())?.id).toBe('m');
    expect(started).toHaveLength(0);
    now = mon(10, 1); // a manual venceu: a faixa (que vai até 12h) assume
    expect((await service.sync())?.source).toBe('schedule');
  });

  it('desistir da faixa vale só por hoje: não reacende, e amanhã volta', async () => {
    await scheduleRepo.save(block());
    now = mon(10);
    await service.sync();
    await sessionService.abandon();
    expect(await service.sync()).toBeUndefined();
    expect(alarms.get(SCHEDULE_ALARM)).toBe(tue(9));
    now = tue(9, 1);
    expect((await service.sync())?.source).toBe('schedule');
  });

  it('faixa de ambiente apagado ou desativada não acende nada', async () => {
    now = mon(10);
    await scheduleRepo.save(block({ environmentId: 'sumiu' }));
    expect(await service.sync()).toBeUndefined();
    await scheduleRepo.save(block({ environmentId: 'builtin-study', enabled: false }));
    expect(await service.sync()).toBeUndefined();
  });

  it('sem faixas, cancela o alarme', async () => {
    alarms.set(SCHEDULE_ALARM, 1);
    await service.sync();
    expect(alarms.has(SCHEDULE_ALARM)).toBe(false);
  });

  it('ao fim da faixa a sessão conclui normalmente (histórico marca a origem)', async () => {
    await scheduleRepo.save(block());
    now = mon(9);
    await service.sync();
    now = mon(12, 0);
    expect(await service.sync()).toBeUndefined();
    const [entry] = await history.list();
    expect(entry).toMatchObject({ outcome: 'completed', source: 'schedule', actualMs: 3 * 3_600_000 });
  });
});

describe('faixa com Pomodoro', () => {
  it('a vela da faixa já nasce com pomodoro e, no meio dela, cai na fase certa', async () => {
    await scheduleRepo.save(block({ pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 } }));
    now = mon(9, 27); // faixa começou 09:00; 09:25–09:30 é a primeira pausa
    const s = await service.sync();
    expect(s?.pomodoro).toMatchObject({ phase: 'break', cycle: 1, phaseEndsAt: mon(9, 30) });
    expect(alarms.get('pomodoro-phase')).toBe(mon(9, 30));
  });
});

describe('ScheduleRepository', () => {
  it('valida ao salvar e remove', async () => {
    await expect(scheduleRepo.save(block({ days: [] }))).rejects.toThrow();
    await expect(scheduleRepo.save(block(), ['outro'])).rejects.toThrow();
    await scheduleRepo.save(block());
    await scheduleRepo.remove('b1');
    expect(await scheduleRepo.list()).toEqual([]);
  });
});
