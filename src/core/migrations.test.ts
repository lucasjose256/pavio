import { beforeEach, describe, expect, it } from 'vitest';
import { createBuiltinEnvironments } from './environments';
import { MemoryStorage } from './memory-storage';
import { migrate, routineFromLegacy } from './migrations';
import type { LegacyBlock } from './migrations';
import type { RoutineSite } from './models';
import { KEYS, RoutineRepository, SettingsRepository } from './repositories';

const clock = { now: () => 0 };
let storage: MemoryStorage;
beforeEach(() => void (storage = new MemoryStorage()));

describe('migração v3 (rotina)', () => {
  it('instalação nova: rotina pronta, DESLIGADA', async () => {
    await migrate(storage, clock);
    const routine = await new RoutineRepository(storage).list();
    expect(routine.map((s) => s.domain)).toContain('linkedin.com');
    expect((await new SettingsRepository(storage).get()).routineEnabled).toBe(false);
    expect(await storage.get(KEYS.schemaVersion)).toBe(3);
  });

  it('quem tinha faixas de horário ganha a rotina equivalente, já ligada, e as chaves antigas somem', async () => {
    const envs = createBuiltinEnvironments(0);
    await storage.set(KEYS.environments, envs);
    await storage.set(KEYS.schemaVersion, 2);
    await storage.set(KEYS.settings, { candleSkin: 'minimal', theme: 'night' });
    const block: LegacyBlock = { id: 'b1', environmentId: 'builtin-study', days: [1, 2], startMin: 540, endMin: 720, enabled: true };
    await storage.set('schedule', [block]);
    await storage.set('skippedOccurrences', ['b1:2026-10-05']);
    await migrate(storage, clock);

    const routine = await new RoutineRepository(storage).list();
    const insta = routine.find((s) => s.domain === 'instagram.com')!;
    expect(insta.slots[0]).toMatchObject({ days: [1, 2], startMin: 540, endMin: 720, mode: 'blocked' });
    const settings = await new SettingsRepository(storage).get();
    expect(settings).toMatchObject({ routineEnabled: true, candleSkin: 'minimal', theme: 'night' }); // preserva o resto
    expect(await storage.get('schedule')).toBeUndefined();
    expect(await storage.get('skippedOccurrences')).toBeUndefined();
  });

  it('não sobrescreve uma rotina que já existe e é idempotente', async () => {
    const mine: RoutineSite[] = [{ id: 'm', domain: 'meusite.com', enabled: true, slots: [] }];
    await storage.set(KEYS.routine, mine);
    await storage.set(KEYS.schemaVersion, 2);
    await migrate(storage, clock);
    await migrate(storage, clock);
    expect(await new RoutineRepository(storage).list()).toEqual(mine);
  });
});

describe('routineFromLegacy', () => {
  const envs = createBuiltinEnvironments(0);
  it('cada regra bloqueada/restrita do ambiente vira uma faixa naquele site; liberados e faixas desligadas ficam de fora', () => {
    const blocks: LegacyBlock[] = [
      { id: 'a', environmentId: 'builtin-deep-work', days: [1], startMin: 840, endMin: 1080, enabled: true },
      { id: 'b', environmentId: 'builtin-study', days: [2], startMin: 0, endMin: 60, enabled: false },
      { id: 'c', environmentId: 'sumiu', days: [3], startMin: 0, endMin: 60, enabled: true },
    ];
    const routine = routineFromLegacy(blocks, envs);
    expect(routine.find((s) => s.domain === 'youtube.com')!.slots).toEqual([{ id: 'a:youtube.com', days: [1], startMin: 840, endMin: 1080, mode: 'blocked' }]);
    expect(routine.find((s) => s.domain === 'reddit.com')!.slots[0]).toMatchObject({ mode: 'restricted', restrictedKind: 'intent' });
    expect(routine.every((s) => s.slots.every((sl) => sl.days[0] === 1))).toBe(true); // só a faixa "a" entrou
  });
});
