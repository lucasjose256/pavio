import { beforeEach, describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import { IntentService } from './intent-service';
import { MemoryStorage } from './memory-storage';
import type { RoutineSite } from './models';
import { PolicyService, ROUTINE_ALARM } from './policy-service';
import { HistoryRepository, IntentRepository, PolicyRepository, RoutineRepository, SessionRepository, SettingsRepository } from './repositories';
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
  sessionService = new SessionService({ sessions: new SessionRepository(storage), history: new HistoryRepository(storage), scheduler, notifier, clock, newId: () => 'sid' });
  const intentService = new IntentService({ intents, scheduler, notifier, clock });
  service = new PolicyService({ routine: routines, settings, policies, sessionService, intentService, scheduler, clock });
  await routines.save(routine);
});

describe('PolicyService.sync', () => {
  it('rotina desligada (padrão): política vazia e sem alarme', async () => {
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

describe('RoutineRepository', () => {
  it('recusa rotina inválida e guarda a válida', async () => {
    await expect(routines.save([{ ...routine[0]!, slots: [{ ...routine[0]!.slots[0]!, days: [] }] }])).rejects.toThrow();
    await routines.save([routine[0]!]);
    expect(await routines.list()).toHaveLength(1);
  });
});
