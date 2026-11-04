import type { Session } from './models';

export type ToolbarIcon = 'idle' | 'active';

/**
 * Qual ícone mostrar na barra do Chrome: o "aceso" (fundo âmbar) enquanto há vela acesa e a opção está ligada.
 * A vela conta como acesa durante todo o tempo dela, inclusive nas pausas do Pomodoro.
 */
export function toolbarIconFor(
  session: Pick<Session, 'status' | 'endsAt'> | undefined,
  iconOnCandle: boolean,
  now: number,
): ToolbarIcon {
  return iconOnCandle && session?.status === 'active' && now < session.endsAt ? 'active' : 'idle';
}

export interface CandleBadge {
  /** Texto do selo no ícone ("25m", "1h05"); vazio = sem selo. */
  text: string;
  /** Foco ou pausa do Pomodoro (muda a cor do selo). */
  phase: 'focus' | 'break' | null;
  /** Quando o número muda de novo (para atualizar no minuto certo). */
  nextUpdate?: number;
}

/**
 * Selo com os minutos que faltam para a vela acabar, no ícone do Pavio: "25m", "5m", "1h05" (cabe nos ~4 caracteres
 * do Chrome). Arredonda para cima: com 24 min e 10 s faltando, mostra "25m"; no último minuto, "1m".
 */
export function candleBadge(
  session: Pick<Session, 'status' | 'endsAt' | 'pomodoro'> | undefined,
  enabled: boolean,
  now: number,
): CandleBadge {
  if (!enabled || session?.status !== 'active' || now >= session.endsAt) return { text: '', phase: null };
  const mins = Math.ceil((session.endsAt - now) / 60_000);
  const text = mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : `${mins}m`;
  // O número cai para (mins - 1) quando faltar exatamente (mins - 1) minutos.
  const nextUpdate = mins > 1 ? session.endsAt - (mins - 1) * 60_000 : session.endsAt;
  return { text, phase: session.pomodoro?.phase === 'break' ? 'break' : 'focus', nextUpdate };
}
