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
