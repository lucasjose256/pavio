import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from './memory-storage';
import type { RoutineSite } from './models';
import { RoutineRepository, UsageRepository } from './repositories';
import { UsageService } from './usage-service';

const min = (n: number) => n * 60_000;
let now: number;
let usage: UsageRepository;
let service: UsageService;

const routine: RoutineSite[] = [
  { id: 'y', domain: 'youtube.com', enabled: true, slots: [], limitMin: 3 },
  { id: 'x', domain: 'x.com', enabled: true, slots: [] }, // sem limite
];

beforeEach(async () => {
  now = new Date(2026, 9, 5, 12).getTime();
  const storage = new MemoryStorage();
  usage = new UsageRepository(storage);
  const routines = new RoutineRepository(storage);
  await routines.save(routine);
  service = new UsageService({ usage, routine: routines, clock: { now: () => now } });
});

describe('UsageService.record', () => {
  it('soma o tempo só de apps com limite (inclusive subdomínios)', async () => {
    expect(await service.record('www.youtube.com', min(1))).toMatchObject({ domain: 'youtube.com', crossed: false });
    expect(await service.record('m.youtube.com', min(1))).toMatchObject({ domain: 'youtube.com' });
    expect((await service.statuses())[0]).toMatchObject({ domain: 'youtube.com', usedMs: min(2) });
  });

  it('ignora o que não deve contar: sem aba de app (host nulo), app sem limite e outros sites', async () => {
    expect(await service.record(null)).toEqual({ crossed: false });
    expect(await service.record('x.com')).toEqual({ crossed: false });
    expect(await service.record('wikipedia.org')).toEqual({ crossed: false });
    expect(await usage.get()).toEqual({});
  });

  it('avisa UMA vez, no minuto em que estoura', async () => {
    await service.record('youtube.com'); // 1
    await service.record('youtube.com'); // 2
    expect((await service.record('youtube.com')).crossed).toBe(true); // 3 = limite
    expect((await service.record('youtube.com')).crossed).toBe(false); // já estourado
  });

  it('não inventa tempo se o alarme veio atrasado (limita a 2 intervalos)', async () => {
    await service.record('youtube.com', min(60));
    expect((await service.statuses())[0]!.usedMs).toBe(min(2));
    await service.record('youtube.com', -5000);
    expect((await service.statuses())[0]!.usedMs).toBe(min(2)); // negativo não conta
  });

  it('no dia seguinte o uso recomeça', async () => {
    await service.record('youtube.com', min(2));
    now = new Date(2026, 9, 6, 9).getTime();
    expect((await service.statuses())[0]).toMatchObject({ usedMs: 0, reached: false });
  });
});

describe('UsageService.extend', () => {
  it('sobe o limite de hoje: de estourado passa a ter 5 minutos de folga', async () => {
    await service.record('youtube.com', min(2));
    await service.record('youtube.com', min(2));
    expect((await service.statuses())[0]!.reached).toBe(true);
    await service.extend('youtube.com');
    expect((await service.statuses())[0]).toMatchObject({ reached: false, extraMin: 5, remainingMs: min(4) }); // 4 usados de 3+5
  });
});
