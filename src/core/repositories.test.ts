import { beforeEach, describe, expect, it } from 'vitest';
import { createBuiltinEnvironment, createBuiltinEnvironments, createEnvironment, createRule, duplicateEnvironment, ruleCounts, validateEnvironment } from './environments';
import { accessDomains } from './blocking';
import { MemoryStorage } from './memory-storage';
import { migrate } from './migrations';
import {
  EnvironmentRepository, HISTORY_LIMIT, HistoryRepository, InvalidEnvironmentError,
  KEYS, SettingsRepository,
} from './repositories';

let n = 0;
const newId = () => `id-${++n}`;
let now = 1000;
const clock = { now: () => now };
let storage: MemoryStorage;
let envs: EnvironmentRepository;

beforeEach(() => {
  storage = new MemoryStorage();
  envs = new EnvironmentRepository(storage, clock);
});

describe('migrate', () => {
  it('semeia 3 ambientes de exemplo e é idempotente', async () => {
    await migrate(storage, clock);
    expect((await envs.list()).map((e) => e.name)).toEqual(['Estudo', 'Trabalho profundo', 'Noite']);
    expect(await storage.get(KEYS.schemaVersion)).toBe(2);

    const edited = (await envs.list())[0]!;
    await envs.save({ ...edited, name: 'Meu estudo' });
    await migrate(storage, clock); // não pode sobrescrever edição do usuário
    expect((await envs.get(edited.id))?.name).toBe('Meu estudo');
  });
});

describe('migração v2 (LinkedIn)', () => {
  it('acrescenta o LinkedIn aos ambientes de exemplo antigos, sem mexer no resto', async () => {
    const old = createBuiltinEnvironments(0).map((e) => ({ ...e, rules: e.rules.filter((r) => r.domain !== 'linkedin.com') }));
    old[0]!.rules.push({ id: 'meu', domain: 'meusite.com', mode: 'blocked' });
    await storage.set(KEYS.environments, old);
    await storage.set(KEYS.schemaVersion, 1);
    await migrate(storage, clock);
    const after = await envs.list();
    for (const e of after) expect(e.rules.some((r) => r.domain === 'linkedin.com')).toBe(true);
    expect(after[0]!.rules.some((r) => r.domain === 'meusite.com')).toBe(true);
    expect(after[0]!.rules.filter((r) => r.domain === 'linkedin.com')).toHaveLength(1);
    await migrate(storage, clock); // idempotente
    expect((await envs.list())[0]!.rules.filter((r) => r.domain === 'linkedin.com')).toHaveLength(1);
  });
});

describe('EnvironmentRepository', () => {
  it('salva, atualiza e remove', async () => {
    const env = createEnvironment('  Leitura ', now, newId);
    now = 2000;
    const saved = await envs.save(env);
    expect(saved.name).toBe('Leitura');
    expect(saved.updatedAt).toBe(2000);
    await envs.save({ ...saved, rules: [createRule('reddit.com', 'blocked', newId)!] });
    expect(await envs.list()).toHaveLength(1);
    await envs.remove(env.id);
    expect(await envs.list()).toHaveLength(0);
  });

  it('recusa ambiente inválido', async () => {
    const env = createEnvironment('', now, newId);
    await expect(envs.save(env)).rejects.toBeInstanceOf(InvalidEnvironmentError);
  });

  it('restaura ambiente de exemplo', async () => {
    await migrate(storage, clock);
    await envs.save({ ...(await envs.get('builtin-study'))!, rules: [] });
    const restored = await envs.restoreBuiltin('builtin-study');
    expect(restored?.rules).toHaveLength(7);
    expect(await envs.restoreBuiltin('nao-existe')).toBeUndefined();
  });
});

describe('validateEnvironment', () => {
  it('detecta duplicados e restrito sem tipo', () => {
    const env = createEnvironment('A', now, newId);
    env.rules = [
      { id: '1', domain: 'x.com', mode: 'blocked' },
      { id: '2', domain: 'x.com', mode: 'restricted' },
    ];
    expect(validateEnvironment(env)).toEqual(['rule:duplicate:x.com', 'rule:missing-kind:x.com']);
  });
  it('presets são válidos', () => {
    for (const e of createBuiltinEnvironments(0)) expect(validateEnvironment(e)).toEqual([]);
  });
});

describe('createRule', () => {
  it('escolhe o tipo restrito certo pelo domínio', () => {
    expect(createRule('https://youtube.com', 'restricted', newId)?.restrictedKind).toBe('youtube');
    expect(createRule('tiktok.com', 'restricted', newId)?.restrictedKind).toBe('intent');
    expect(createRule('foo.com', 'blocked', newId)?.restrictedKind).toBeUndefined();
    expect(createRule('linkedin.com', 'restricted', newId)).toMatchObject({ restrictedKind: 'linkedin', features: ['feed', 'videos', 'news'] });
    expect(createRule('reddit.com', 'restricted', newId)?.features).toBeUndefined();
    expect(createRule('lixo', 'blocked', newId)).toBeNull();
  });
});

describe('Settings e History', () => {
  it('settings tem padrão e aceita patch', async () => {
    const s = new SettingsRepository(storage);
    expect((await s.get()).candleSkin).toBe('classic');
    expect((await s.get()).theme).toBe('cream');
    await storage.set('settings', { candleSkin: 'minimal' }); // dados antigos sem `theme` ganham o padrão
    expect((await s.get()).theme).toBe('cream');
    expect((await s.update({ candleSkin: 'minimal' })).candleSkin).toBe('minimal');
  });
  it('histórico mantém só as últimas entradas', async () => {
    const h = new HistoryRepository(storage);
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      await h.append({ sessionId: `s${i}`, environmentName: 'E', startedAt: 0, endedAt: 1, plannedMs: 1, actualMs: 1, outcome: 'completed', blockedAttempts: 0 });
    }
    const all = await h.list();
    expect(all).toHaveLength(HISTORY_LIMIT);
    expect(all[0]?.sessionId).toBe('s5');
  });
});

describe('helpers de ambiente', () => {
  it('ruleCounts conta por tipo', () => {
    expect(ruleCounts(createBuiltinEnvironment('builtin-study', 0)!)).toEqual({ allowed: 0, blocked: 5, restricted: 2 });
  });
  it('duplicateEnvironment gera cópia editável com ids novos', () => {
    const original = createBuiltinEnvironment('builtin-study', 0)!;
    const copy = duplicateEnvironment(original, 5, newId);
    expect(copy).toMatchObject({ name: 'Estudo (cópia)', builtin: false, createdAt: 5 });
    expect(copy.id).not.toBe(original.id);
    expect(copy.rules.map((r) => r.domain)).toEqual(original.rules.map((r) => r.domain));
    expect(copy.rules[0]!.id).not.toBe(original.rules[0]!.id);
    expect(validateEnvironment(copy)).toEqual([]);
  });
  it('accessDomains pede acesso só ao que o DNR precisa (YouTube/Instagram/X restritos não)', () => {
    expect(accessDomains(createBuiltinEnvironment('builtin-night', 0)!)).toEqual(['facebook.com', 'linkedin.com', 'tiktok.com', 'reddit.com']);
  });
});
