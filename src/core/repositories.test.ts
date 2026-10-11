import { beforeEach, describe, expect, it } from 'vitest';
import { HISTORY_MAX_ENTRIES } from './history';
import { createBuiltinEnvironment, createBuiltinEnvironments, createEnvironment, createRule, duplicateEnvironment, ruleCounts, validateEnvironment } from './environments';
import { accessDomains } from './blocking';
import type { HistoryEntry } from './models';
import { MemoryStorage } from './memory-storage';
import { migrate } from './migrations';
import {
  EnvironmentRepository, HistoryRepository, InvalidEnvironmentError,
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
    expect(await storage.get(KEYS.schemaVersion)).toBe(4);

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
  const day = 86_400_000;
  const entry = (id: string, endedAt: number, over: Partial<HistoryEntry> = {}): HistoryEntry =>
    ({ sessionId: id, environmentName: 'E', startedAt: endedAt - 1000, endedAt, plannedMs: 1000, actualMs: 1000, outcome: 'completed', blockedAttempts: 1, ...over });

  it('histórico: passou do limite de sessões, as mais antigas viram total (e nada some do total)', async () => {
    const h = new HistoryRepository(storage);
    const base = Date.UTC(2026, 9, 1);
    for (let i = 0; i < HISTORY_MAX_ENTRIES + 5; i++) await h.append(entry(`s${i}`, base + i * 1000));
    const all = await h.list();
    expect(all).toHaveLength(HISTORY_MAX_ENTRIES);
    expect(all[0]?.sessionId).toBe('s5'); // as 5 mais antigas saíram
    expect(await h.totals()).toMatchObject({ sessions: 5, focusedMs: 5000, completed: 5, blockedAttempts: 5 });
  });
  it('histórico: o que passa de 180 dias vira total, e prune() faz isso sem nova sessão', async () => {
    const h = new HistoryRepository(storage);
    const now = Date.UTC(2026, 9, 1);
    await h.append(entry('velha', now - 200 * day, { outcome: 'abandoned', actualMs: 600_000 }));
    // appendar a velha sozinha já a descarta (a idade conta a partir do fim dela): grava só a recente
    await h.append(entry('nova', now));
    expect((await h.list()).map((e) => e.sessionId)).toEqual(['nova']);
    expect(await h.totals()).toMatchObject({ sessions: 1, abandoned: 1, focusedMs: 600_000 });
    await h.prune(now + 400 * day); // um ano depois, a "nova" também passou do prazo
    expect(await h.list()).toEqual([]);
    expect((await h.totals()).sessions).toBe(2);
  });
  it('histórico: apagar limpa a lista e o total', async () => {
    const h = new HistoryRepository(storage);
    await h.append(entry('a', 1));
    await h.prune(1 + 400 * day);
    expect((await h.totals()).sessions).toBe(1);
    await h.clear();
    expect(await h.list()).toEqual([]);
    expect((await h.totals()).sessions).toBe(0);
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

describe('Settings.releaseOffer', () => {
  it('vem ligado e um settings antigo (sem o campo) também fica ligado', async () => {
    const storage = new MemoryStorage();
    expect((await new SettingsRepository(storage).get()).releaseOffer).toBe(true);
    await storage.set('settings', { candleSkin: 'jar', theme: 'night' });
    const s = await new SettingsRepository(storage).get();
    expect(s).toMatchObject({ candleSkin: 'jar', releaseOffer: true });
    expect((await new SettingsRepository(storage).update({ releaseOffer: false })).releaseOffer).toBe(false);
  });
});
