import { beforeEach, describe, expect, it } from 'vitest';
import { createBuiltinEnvironment, createBuiltinEnvironments } from './environments';
import { IntentService } from './intent-service';
import { MemoryStorage } from './memory-storage';
import type { RoutineSite } from './models';
import { PolicyService, ROUTINE_ALARM } from './policy-service';
import { HistoryRepository, IntentRepository, PolicyRepository, RoutineRepository, SessionRepository, SettingsRepository, UsageRepository, ReleaseRepository } from './repositories';
import { addUsage, extendLimit } from './usage';
import { SESSION_ALARM, SessionService } from './session-service';

const mon = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();
const tue = (h: number) => new Date(2026, 9, 6, h).getTime();
const routine: RoutineSite[] = [
  { id: 'i', domain: 'instagram.com', enabled: true, slots: [{ id: 'a', days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 18 * 60, mode: 'blocked' }] },
  { id: 'r', domain: 'reddit.com', enabled: true, slots: [{ id: 'b', days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 18 * 60, mode: 'restricted', restrictedKind: 'intent' }] },
];

let now: number;
let alarms: Map<string, number>;
let storage: MemoryStorage;
let routines: RoutineRepository;
let settings: SettingsRepository;
let policies: PolicyRepository;
let intents: IntentRepository;
let usage: UsageRepository;
let sessionService: SessionService;
let service: PolicyService;

beforeEach(async () => {
  now = mon(8);
  alarms = new Map();
  storage = new MemoryStorage();
  const clock = { now: () => now };
  const scheduler = { schedule: async (n: string, w: number) => void alarms.set(n, w), cancel: async (n: string) => void alarms.delete(n) };
  const notifier = { sessionCompleted: async () => {}, intentTimeUp: async () => {}, pomodoroPhase: async () => {} };
  routines = new RoutineRepository(storage);
  settings = new SettingsRepository(storage);
  policies = new PolicyRepository(storage);
  intents = new IntentRepository(storage);
  usage = new UsageRepository(storage);
  sessionService = new SessionService({ sessions: new SessionRepository(storage), history: new HistoryRepository(storage), scheduler, notifier, clock, newId: () => 'sid' });
  const intentService = new IntentService({ intents, scheduler, notifier, clock });
  service = new PolicyService({ routine: routines, settings, policies, usage, releases: new ReleaseRepository(storage), sessionService, intentService, scheduler, clock });
  await routines.save(routine);
});

describe('PolicyService.sync', () => {
  it('horários desligados: política vazia e sem alarme', async () => {
    await settings.update({ routineEnabled: false });
    const p = await service.sync();
    expect(p.rules).toEqual([]);
    expect(alarms.has(ROUTINE_ALARM)).toBe(false);
  });

  it('ligada: antes da faixa nada vale e o alarme é para o início; dentro vale e o alarme é para o fim', async () => {
    await settings.update({ routineEnabled: true });
    expect((await service.sync()).rules).toEqual([]);
    expect(alarms.get(ROUTINE_ALARM)).toBe(mon(9));
    now = mon(9, 0);
    const p = await service.sync();
    expect(p.rules.map((r) => r.domain).sort()).toEqual(['instagram.com', 'reddit.com']);
    expect(alarms.get(ROUTINE_ALARM)).toBe(mon(18));
    now = mon(18, 0);
    expect((await service.sync()).rules).toEqual([]);
    expect(alarms.get(ROUTINE_ALARM)).toBe(tue(9));
  });

  it('grava a política e só regrava quando muda', async () => {
    await settings.update({ routineEnabled: true });
    now = mon(10);
    await service.sync();
    const first = await policies.get();
    expect(await policies.set(first!)).toBe(false);
    now = mon(11);
    await service.sync();
    expect((await policies.get())!.rules).toEqual(first!.rules);
  });

  it('junta o Timer: vela acesa fora da rotina vale; ao fim da vela volta a só rotina', async () => {
    await settings.update({ routineEnabled: true });
    now = mon(20);
    await sessionService.start({ environment: createBuiltinEnvironment('builtin-study', 0)!, minutes: 25, strictness: 'focus' });
    const p = await service.sync();
    expect(p.timerActive).toBe(true);
    expect(p.rules.length).toBeGreaterThan(2);
    expect(alarms.get(SESSION_ALARM)).toBe(mon(20, 25));
    now = mon(20, 30);
    const after = await service.sync();
    expect(after.timerActive).toBe(false);
    expect(after.rules).toEqual([]);
  });

  it('descarta permissões de intenção de sites que saíram do modo intenção (fim da faixa)', async () => {
    await settings.update({ routineEnabled: true });
    now = mon(10);
    await service.sync();
    await intents.put({ domain: 'reddit.com', text: 'x', minutes: 5, startedAt: now, endsAt: now + 1 });
    await service.sync();
    expect(await intents.list()).toHaveLength(1); // ainda em intenção
    now = mon(19);
    await service.sync();
    expect(await intents.list()).toEqual([]);
  });
});

describe('limite de tempo na política', () => {
  const limited: RoutineSite[] = [{ id: 'y', domain: 'youtube.com', enabled: true, slots: [], limitMin: 30 }];

  it('estourou: o app fica bloqueado até a meia-noite, com o alarme na virada do dia', async () => {
    await routines.save(limited);
    await settings.update({ routineEnabled: false }); // o limite não depende do interruptor dos horários
    now = mon(15);
    await usage.set(addUsage({}, 'youtube.com', 30 * 60_000, now), now);
    const p = await service.sync();
    expect(p.rules).toEqual([{ id: 'limit:youtube.com', domain: 'youtube.com', mode: 'blocked' }]);
    expect(p.limitReached).toEqual(['youtube.com']);
    expect(alarms.get(ROUTINE_ALARM)).toBe(tue(0));
    now = tue(0) + 1000; // virou o dia
    const next = await service.sync();
    expect(next.rules).toEqual([]);
    expect(next.limitReached).toEqual([]);
    expect(alarms.has(ROUTINE_ALARM)).toBe(false);
  });

  it('antes de estourar não bloqueia, e "mais 5 min" libera de novo', async () => {
    await routines.save(limited);
    now = mon(15);
    await usage.set(addUsage({}, 'youtube.com', 29 * 60_000, now), now);
    expect((await service.sync()).rules).toEqual([]);
    await usage.set(addUsage(await usage.get(), 'youtube.com', 60_000, now), now);
    expect((await service.sync()).limitReached).toEqual(['youtube.com']);
    await usage.set(extendLimit(await usage.get(), 'youtube.com', 5, now), now);
    expect((await service.sync()).rules).toEqual([]);
  });

  it('a pausa do Pomodoro (timer) não libera um app que estourou o limite', async () => {
    await routines.save(limited);
    now = mon(15);
    await usage.set(addUsage({}, 'youtube.com', 31 * 60_000, now), now);
    const env = createBuiltinEnvironments(0)[2]!; // Noite
    await sessionService.start({ environment: env, minutes: 60, strictness: 'focus', pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 } });
    now += 26 * 60_000; // pausa
    const p = await service.sync();
    expect(p.timerActive).toBe(false);
    expect(p.rules.find((r) => r.domain === 'youtube.com')?.mode).toBe('blocked');
  });
});

describe('RoutineRepository', () => {
  it('liberação por um tempo: tira a regra, agenda o alarme no fim e limpa a vencida', async () => {
    await settings.update({ routineEnabled: true });
    now = mon(10);
    const releases = new ReleaseRepository(storage);
    await releases.save([{ domain: 'instagram.com', until: mon(10, 15) }, { domain: 'old.com', until: mon(9) }]);
    const p = await service.sync();
    expect(p.rules.map((r) => r.domain)).toEqual(['reddit.com']);
    expect(alarms.get(ROUTINE_ALARM)).toBe(mon(10, 15));
    expect(await releases.list()).toEqual([{ domain: 'instagram.com', until: mon(10, 15) }]);
    now = mon(10, 15);
    expect((await service.sync()).rules.map((r) => r.domain).sort()).toEqual(['instagram.com', 'reddit.com']);
    expect(await releases.list()).toEqual([]);
  });
  it('recusa rotina inválida e guarda a válida', async () => {
    await expect(routines.save([{ ...routine[0]!, slots: [{ ...routine[0]!.slots[0]!, days: [] }] }])).rejects.toThrow();
    await routines.save([routine[0]!]);
    expect(await routines.list()).toHaveLength(1);
  });
});

describe('pausa dos horários no serviço', () => {
  it('agenda o alarme no fim da pausa e volta a valer depois', async () => {
    await settings.update({ routineEnabled: true, routinePausedUntil: mon(10, 30) });
    now = mon(10);
    expect((await service.sync()).rules).toEqual([]);
    expect(alarms.get(ROUTINE_ALARM)).toBe(mon(10, 30));
    now = mon(10, 30);
    expect((await service.sync()).rules.map((r) => r.domain).sort()).toEqual(['instagram.com', 'reddit.com']);
  });
});
