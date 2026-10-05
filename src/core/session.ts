import type { Session } from './models';

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
