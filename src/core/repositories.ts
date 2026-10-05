import { createBuiltinEnvironment, validateEnvironment } from './environments';
import { DEFAULT_SETTINGS } from './models';
import type { Environment, HistoryEntry, IntentGrant, Session, Settings } from './models';
import type { Clock, StoragePort } from './ports';

export const KEYS = {
  schemaVersion: 'schemaVersion',
  environments: 'environments',
  settings: 'settings',
  activeSession: 'activeSession',
  history: 'history',
  intents: 'intents',
} as const;

export const HISTORY_LIMIT = 1000;

export class InvalidEnvironmentError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid environment: ${errors.join(', ')}`);
  }
}

export class EnvironmentRepository {
  constructor(
    private storage: StoragePort,
    private clock: Clock,
  ) {}

  async list(): Promise<Environment[]> {
    return (await this.storage.get<Environment[]>(KEYS.environments)) ?? [];
  }

  async get(id: string): Promise<Environment | undefined> {
    return (await this.list()).find((e) => e.id === id);
  }

  /** Insere ou atualiza. Valida antes de gravar. */
  async save(env: Environment): Promise<Environment> {
    const errors = validateEnvironment(env);
    if (errors.length) throw new InvalidEnvironmentError(errors);
    const all = await this.list();
    const saved: Environment = { ...env, name: env.name.trim(), updatedAt: this.clock.now() };
    const i = all.findIndex((e) => e.id === env.id);
    if (i >= 0) all[i] = saved;
    else all.push(saved);
    await this.storage.set(KEYS.environments, all);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await this.storage.set(KEYS.environments, all.filter((e) => e.id !== id));
  }

  /** Devolve um ambiente de exemplo ao estado original (recria se tiver sido apagado). */
  async restoreBuiltin(id: string): Promise<Environment | undefined> {
    const fresh = createBuiltinEnvironment(id, this.clock.now());
    return fresh ? this.save(fresh) : undefined;
  }
}

export class SettingsRepository {
  constructor(private storage: StoragePort) {}

  async get(): Promise<Settings> {
    return { ...DEFAULT_SETTINGS, ...(await this.storage.get<Settings>(KEYS.settings)) };
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.get()), ...patch };
    await this.storage.set(KEYS.settings, next);
    return next;
  }
}

export class SessionRepository {
  constructor(private storage: StoragePort) {}

  get(): Promise<Session | undefined> {
    return this.storage.get<Session>(KEYS.activeSession);
  }
  set(session: Session): Promise<void> {
    return this.storage.set(KEYS.activeSession, session);
  }
  clear(): Promise<void> {
    return this.storage.remove(KEYS.activeSession);
  }
}

export class HistoryRepository {
  constructor(private storage: StoragePort) {}

  async list(): Promise<HistoryEntry[]> {
    return (await this.storage.get<HistoryEntry[]>(KEYS.history)) ?? [];
  }

  /** Mantém só as HISTORY_LIMIT entradas mais recentes. */
  async append(entry: HistoryEntry): Promise<void> {
    const all = [...(await this.list()), entry];
    await this.storage.set(KEYS.history, all.slice(-HISTORY_LIMIT));
  }
}

/** Permissões do modo intenção da sessão atual. Limpas quando a sessão termina. */
export class IntentRepository {
  constructor(private storage: StoragePort) {}

  async list(): Promise<IntentGrant[]> {
    return (await this.storage.get<IntentGrant[]>(KEYS.intents)) ?? [];
  }
  async get(domain: string): Promise<IntentGrant | undefined> {
    return (await this.list()).find((g) => g.domain === domain);
  }
  async put(grant: IntentGrant): Promise<void> {
    const others = (await this.list()).filter((g) => g.domain !== grant.domain);
    await this.storage.set(KEYS.intents, [...others, grant]);
  }
  async remove(domain: string): Promise<void> {
    await this.storage.set(KEYS.intents, (await this.list()).filter((g) => g.domain !== domain));
  }
  async clear(): Promise<void> {
    await this.storage.remove(KEYS.intents);
  }
}
