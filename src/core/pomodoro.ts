import type { PomodoroConfig, PomodoroPhase, PomodoroSession, Session } from './models';

export const DEFAULT_POMODORO: PomodoroConfig = { focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 };

/**
 * Pomodoro sugerido para cada tempo pronto da vela: ciclos que fecham certinho (sem pausa longa).
 * 30 = 25+5 · 45 = 20+5+20 · 1 h = 2×(25+5) · 1h30 = 2×(40+10)+40 · 2 h = 2×(50+10) · 2h30 = 3×(40+10).
 */
export const POMODORO_PRESETS: Record<number, PomodoroConfig> = {
  30: { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 },
  45: { focusMin: 20, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 },
  60: { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 },
  90: { focusMin: 40, breakMin: 10, longBreakMin: 0, cyclesBeforeLong: 4 },
  120: { focusMin: 50, breakMin: 10, longBreakMin: 0, cyclesBeforeLong: 4 },
  150: { focusMin: 40, breakMin: 10, longBreakMin: 0, cyclesBeforeLong: 4 },
};

/** O Pomodoro sugerido para `minutes`: o do tempo pronto igual ou, num tempo livre, o do mais próximo. */
export function pomodoroSuggestionFor(minutes: number): PomodoroConfig {
  const known = Object.keys(POMODORO_PRESETS).map(Number);
  const nearest = known.reduce((best, m) => (Math.abs(m - minutes) < Math.abs(best - minutes) ? m : best), known[0]!);
  return { ...POMODORO_PRESETS[minutes] ?? POMODORO_PRESETS[nearest]! };
}

export const POMODORO_LIMITS = { focus: [1, 180], break: [1, 60], long: [0, 60], cycles: [2, 10] } as const;

const inRange = (n: number, [min, max]: readonly [number, number]) => Number.isInteger(n) && n >= min && n <= max;

/** Código do erro ou null. */
export function validatePomodoro(c: PomodoroConfig): string | null {
  if (!inRange(c.focusMin, POMODORO_LIMITS.focus)) return 'pomodoro:focus';
  if (!inRange(c.breakMin, POMODORO_LIMITS.break)) return 'pomodoro:break';
  if (!inRange(c.longBreakMin, POMODORO_LIMITS.long)) return 'pomodoro:long';
  if (c.longBreakMin > 0 && !inRange(c.cyclesBeforeLong, POMODORO_LIMITS.cycles)) return 'pomodoro:cycles';
  return null;
}

export interface PhaseInfo {
  phase: PomodoroPhase;
  cycle: number;
  long: boolean;
  start: number;
  /** Fim da fase, limitado ao fim da sessão. */
  end: number;
}

/**
 * Em que fase do Pomodoro a sessão está em `now`? Determinístico (só depende dos horários), então o
 * service worker pode recalcular a qualquer momento, inclusive depois de o navegador ficar fechado.
 * Sequência: foco, pausa, foco, pausa… (a cada `cyclesBeforeLong` focos, a pausa é a longa).
 */
export function pomodoroAt(config: PomodoroConfig, startedAt: number, endsAt: number, now: number): PhaseInfo {
  const at = Math.min(Math.max(now, startedAt), endsAt - 1);
  let t = startedAt;
  let cycle = 1;
  for (let i = 0; i < 100_000; i++) {
    const focusEnd = t + config.focusMin * 60_000;
    if (at < focusEnd) return { phase: 'focus', cycle, long: false, start: t, end: Math.min(focusEnd, endsAt) };
    t = focusEnd;
    const long = config.longBreakMin > 0 && cycle % config.cyclesBeforeLong === 0;
    const breakEnd = t + (long ? config.longBreakMin : config.breakMin) * 60_000;
    if (at < breakEnd) return { phase: 'break', cycle, long, start: t, end: Math.min(breakEnd, endsAt) };
    t = breakEnd;
    cycle++;
  }
  return { phase: 'focus', cycle, long: false, start: t, end: endsAt };
}

/** Estado inicial gravado na sessão. */
export function pomodoroState(config: PomodoroConfig, startedAt: number, endsAt: number, now: number): PomodoroSession {
  const info = pomodoroAt(config, startedAt, endsAt, now);
  return { ...config, phase: info.phase, cycle: info.cycle, long: info.long, phaseEndsAt: info.end };
}

/** Na pausa do Pomodoro nada é bloqueado nem restrito. */
export const onBreak = (session: Pick<Session, 'pomodoro'> | undefined): boolean => session?.pomodoro?.phase === 'break';

/** A sessão está valendo (ativa e fora de pausa)? É isso que bloqueios e content scripts consultam. */
export const enforcing = (session: Pick<Session, 'status' | 'pomodoro'> | undefined): boolean =>
  session?.status === 'active' && !onBreak(session);
