import type { BlockPlan, HistoryEntry, IntentGrant, PomodoroPhase, Session } from './models';

/**
 * Ports: o que o domínio precisa do mundo exterior.
 * O Chrome implementa em platform/chrome; o app macOS implementará os seus.
 */

export interface StoragePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export type IdGenerator = () => string;
export const randomId: IdGenerator = () => crypto.randomUUID();

/** Agenda um disparo único (no Chrome: chrome.alarms). Mesmo `name` substitui o anterior. */
export interface SchedulerPort {
  schedule(name: string, when: number): Promise<void>;
  cancel(name: string): Promise<void>;
}

export interface NotifierPort {
  sessionCompleted(entry: HistoryEntry): Promise<void>;
  /** O Pomodoro mudou de fase (`until` = fim da nova fase). */
  pomodoroPhase(session: Session, phase: PomodoroPhase, until: number): Promise<void>;
  /** Aviso gentil: o tempo declarado no modo intenção acabou. */
  intentTimeUp(grant: IntentGrant): Promise<void>;
}

/** Aplica o plano de bloqueio (no Chrome: regras declarativeNetRequest). Idempotente. */
export interface BlockerPort {
  apply(plan: BlockPlan): Promise<void>;
}
