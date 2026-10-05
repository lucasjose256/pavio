import type { AllowedLink, Environment, HistoryEntry, PomodoroConfig, Session, Strictness } from './models';
import { pomodoroState } from './pomodoro';
import type { IdGenerator } from './ports';

export const DURATION_PRESETS_MIN = [25, 50, 90];
export const MIN_DURATION_MIN = 1;
export const MAX_DURATION_MIN = 480;

export function isValidDuration(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= MIN_DURATION_MIN && minutes <= MAX_DURATION_MIN;
}

export interface StartInput {
  environment: Environment;
  minutes: number;
  strictness: Strictness;
  youtubeAllowlist?: AllowedLink[];
  /** Pomodoro automático (pausas que liberam os bloqueios). */
  pomodoro?: PomodoroConfig;
}

export function buildSession(input: StartInput, now: number, newId: IdGenerator): Session {
  if (!isValidDuration(input.minutes)) throw new Error(`Invalid duration: ${input.minutes}`);
  const plannedMs = input.minutes * 60_000;
  return {
    id: newId(),
    // cópia congelada: editar o ambiente depois não altera esta sessão
    environmentSnapshot: structuredClone(input.environment),
    startedAt: now,
    endsAt: now + plannedMs,
    plannedMs,
    strictness: input.strictness,
    youtubeAllowlist: input.youtubeAllowlist ?? [],
    status: 'active',
    blockedAttempts: 0,
    ...(input.pomodoro && { pomodoro: pomodoroState(input.pomodoro, now, now + plannedMs, now) }),
  };
}

export const isExpired = (session: Pick<Session, 'endsAt'>, now: number): boolean => now >= session.endsAt;

/**
 * Linha do histórico. Sessão concluída conta o tempo planejado inteiro e termina em `endsAt`,
 * mesmo que só seja reconciliada depois (navegador fechado).
 */
export function toHistoryEntry(session: Session, outcome: HistoryEntry['outcome'], now: number): HistoryEntry {
  const endedAt = outcome === 'completed' ? session.endsAt : Math.min(now, session.endsAt);
  return {
    sessionId: session.id,
    environmentName: session.environmentSnapshot.name,
    startedAt: session.startedAt,
    endedAt,
    plannedMs: session.plannedMs,
    actualMs: endedAt - session.startedAt,
    outcome,
    blockedAttempts: session.blockedAttempts,
  };
}

/** Tempo restante em ms (nunca negativo). */
export function remainingMs(session: Pick<Session, 'endsAt'>, now: number): number {
  return Math.max(0, session.endsAt - now);
}

/** Fração restante da vela: 1 = acabou de acender, 0 = apagou. */
export function candleProgress(session: Pick<Session, 'endsAt' | 'plannedMs'>, now: number): number {
  if (session.plannedMs <= 0) return 0;
  return Math.min(1, remainingMs(session, now) / session.plannedMs);
}

/** "mm:ss" ou "h:mm:ss". Arredonda para cima, para nunca mostrar 00:00 com vela acesa. */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
