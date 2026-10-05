import { beforeEach, describe, expect, it } from 'vitest';
import { IntentService, intentAlarm, validateIntent, domainFromIntentAlarm } from './intent-service';
import { MemoryStorage } from './memory-storage';
import type { IntentGrant } from './models';
import { IntentRepository } from './repositories';

let now: number;
let alarms: Map<string, number>;
let warned: IntentGrant[];
let repo: IntentRepository;
let service: IntentService;

beforeEach(() => {
  now = 1_000_000;
  alarms = new Map();
  warned = [];
  repo = new IntentRepository(new MemoryStorage());
  service = new IntentService({
    intents: repo,
    clock: { now: () => now },
    scheduler: { schedule: async (n, w) => void alarms.set(n, w), cancel: async (n) => void alarms.delete(n) },
    notifier: { sessionCompleted: async () => {}, intentTimeUp: async (g) => void warned.push(g) },
  });
});

describe('IntentService', () => {
  it('grant grava, agenda o alarme e limpa o texto', async () => {
    const g = await service.grant('reddit.com', '  ver uma dúvida de estudo ', 10);
    expect(g).toMatchObject({ text: 'ver uma dúvida de estudo', endsAt: now + 600_000 });
    expect(alarms.get(intentAlarm('reddit.com'))).toBe(g.endsAt);
    expect(await repo.get('reddit.com')).toEqual(g);
  });

  it('recusa intenção vazia ou duração inválida', async () => {
    await expect(service.grant('reddit.com', '  ', 10)).rejects.toThrow();
    await expect(service.grant('reddit.com', 'x', 0)).rejects.toThrow();
    await expect(service.grant('reddit.com', 'x', 999)).rejects.toThrow();
    expect(validateIntent('x', 15)).toBeNull();
  });

  it('timeUp avisa só depois do fim; antes disso reagenda', async () => {
    const g = await service.grant('reddit.com', 'estudar', 5);
    now = g.endsAt - 60_000;
    await service.timeUp('reddit.com');
    expect(warned).toHaveLength(0);
    now = g.endsAt;
    await service.timeUp('reddit.com');
    expect(warned).toEqual([g]);
  });

  it('extend soma tempo a partir de agora; revoke remove e cancela', async () => {
    const g = await service.grant('reddit.com', 'estudar', 5);
    now = g.endsAt + 30_000; // já passou
    const next = await service.extend('reddit.com');
    expect(next?.endsAt).toBe(now + 300_000);
    expect(alarms.get(intentAlarm('reddit.com'))).toBe(next?.endsAt);
    await service.revoke('reddit.com');
    expect(await repo.get('reddit.com')).toBeUndefined();
    expect(alarms.size).toBe(0);
    expect(await service.extend('reddit.com')).toBeUndefined();
  });

  it('clearAll apaga tudo e cancela alarmes', async () => {
    await service.grant('reddit.com', 'a', 5);
    await service.grant('tiktok.com', 'b', 5);
    await service.clearAll();
    expect(await repo.list()).toEqual([]);
    expect(alarms.size).toBe(0);
  });

  it('extrai o domínio do nome do alarme', () => {
    expect(domainFromIntentAlarm('intent:reddit.com')).toBe('reddit.com');
    expect(domainFromIntentAlarm('session-end')).toBeNull();
  });
});
