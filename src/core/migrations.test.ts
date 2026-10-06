import { beforeEach, describe, expect, it } from 'vitest';
import { createBuiltinEnvironments } from './environments';
import { MemoryStorage } from './memory-storage';
import { migrate, routineFromLegacy } from './migrations';
import { defaultSpec } from './restrictions';
import type { LegacyBlock } from './migrations';
import type { RoutineSite } from './models';
import { KEYS, RoutineRepository, SettingsRepository } from './repositories';

const clock = { now: () => 0 };

/** A programação pronta que a v3 instalava. */
const PREFILLED: RoutineSite[] = (() => {
  const work = (domain: string, mode: 'blocked' | 'restricted') => ({ id: `default:${domain}:work`, days: [1, 2, 3, 4, 5], startMin: 540, endMin: 1080, ...defaultSpec(domain, mode) });
  const night = (domain: string, mode: 'blocked' | 'restricted') => ({ id: `default:${domain}:night`, days: [0, 1, 2, 3, 4, 5, 6], startMin: 1320, endMin: 360, ...defaultSpec(domain, mode) });
  const site = (domain: string, ...slots: RoutineSite['slots']): RoutineSite => ({ id: `default:${domain}`, domain, enabled: true, slots });
  return [
    site('youtube.com', work('youtube.com', 'restricted'), night('youtube.com', 'restricted')),
    site('instagram.com', work('instagram.com', 'restricted'), night('instagram.com', 'blocked')),
    site('tiktok.com', work('tiktok.com', 'blocked'), night('tiktok.com', 'blocked')),
    site('x.com', work('x.com', 'restricted'), night('x.com', 'restricted')),
    site('facebook.com', work('facebook.com', 'blocked'), night('facebook.com', 'blocked')),
    site('reddit.com', work('reddit.com', 'restricted'), night('reddit.com', 'blocked')),
    site('linkedin.com', work('linkedin.com', 'restricted')),
  ];
})();
let storage: MemoryStorage;
beforeEach(() => void (storage = new MemoryStorage()));

describe('migração v3/v4 (rotina)', () => {
  it('instalação nova: rotina LIMPA (nada bloqueado) e horários ligados', async () => {
    await migrate(storage, clock);
    expect(await new RoutineRepository(storage).list()).toEqual([]);
    expect((await new SettingsRepository(storage).get()).routineEnabled).toBe(true);
    expect(await storage.get(KEYS.schemaVersion)).toBe(4);
  });

  it('v4: quem ficou com a programação pronta antiga, sem mexer, volta à rotina limpa e ligada', async () => {
    await storage.set(KEYS.routine, JSON.parse(JSON.stringify(PREFILLED)));
    await storage.set(KEYS.settings, { candleSkin: 'minimal', theme: 'night', routineEnabled: false });
    await storage.set(KEYS.schemaVersion, 3);
    await migrate(storage, clock);
    expect(await new RoutineRepository(storage).list()).toEqual([]);
    expect(await new SettingsRepository(storage).get()).toMatchObject({ routineEnabled: true, candleSkin: 'minimal', theme: 'night' });
  });

  it('v4: quem personalizou (ou mudou um horário) não é tocado', async () => {
    const edited = JSON.parse(JSON.stringify(PREFILLED));
    edited[0].slots[0].endMin = 1140; // arrastou a ponta de uma faixa
    await storage.set(KEYS.routine, edited);
    await storage.set(KEYS.schemaVersion, 3);
    await migrate(storage, clock);
    expect(await new RoutineRepository(storage).list()).toEqual(edited);
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
