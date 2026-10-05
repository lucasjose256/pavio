import type { HistoryEntry } from './models';

export const dayKey = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Dia civil local `n` dias antes de `ts` (à prova de horário de verão). */
const daysAgo = (ts: number, n: number): number => {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - n);
  return d.getTime();
};

export interface DaySummary {
  /** Meia-noite local do dia. */
  date: number;
  focusedMs: number;
}

export interface HistorySummary {
  /** "Horas devolvidas": tempo em que a vela esteve acesa (inclui a parte já vivida de sessões encerradas antes). */
  focusedMs: number;
  completed: number;
  abandoned: number;
  /** Tentativas de abrir sites bloqueados durante as sessões. */
  blockedAttempts: number;
  /** Dias seguidos (até hoje, ou até ontem se hoje ainda não teve) com ao menos uma vela concluída. */
  streakDays: number;
  /** Últimos 7 dias, do mais antigo para hoje. */
  last7Days: DaySummary[];
}

export function summarizeHistory(entries: HistoryEntry[], now: number): HistorySummary {
  const perDay = new Map<string, number>();
  const completedDays = new Set<string>();
  let focusedMs = 0, completed = 0, abandoned = 0, blockedAttempts = 0;

  for (const e of entries) {
    focusedMs += e.actualMs;
    blockedAttempts += e.blockedAttempts;
    const key = dayKey(e.endedAt);
    perDay.set(key, (perDay.get(key) ?? 0) + e.actualMs);
    if (e.outcome === 'completed') {
      completed++;
      completedDays.add(key);
    } else abandoned++;
  }

  let streakDays = 0;
  let cursor = completedDays.has(dayKey(now)) ? 0 : 1;
  while (completedDays.has(dayKey(daysAgo(now, cursor)))) {
    streakDays++;
    cursor++;
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgo(now, 6 - i);
    return { date, focusedMs: perDay.get(dayKey(date)) ?? 0 };
  });

  return { focusedMs, completed, abandoned, blockedAttempts, streakDays, last7Days };
}

/** "2 h 05 min", "35 min", "3 h", "menos de 1 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return ms > 0 ? 'menos de 1 min' : '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}
