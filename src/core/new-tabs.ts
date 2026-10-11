import { enforcing } from './pomodoro';
import type { Session } from './models';

/** Mensagem pela qual uma página do Pavio diz ao service worker "esta aba é minha" (não deve ser fechada). */
export const OWN_TAB_MESSAGE = 'pavio:own-tab';

/**
 * Abas novas ficam fechadas enquanto a vela VALE: ativa, fora da pausa do Pomodoro, ainda dentro do tempo e com a
 * opção ligada naquela vela. Na pausa, ou depois do fim, abrir aba volta ao normal.
 */
export function blocksNewTabs(session: Pick<Session, 'status' | 'endsAt' | 'pomodoro' | 'blockNewTabs'> | undefined, now: number): boolean {
  return !!session?.blockNewTabs && session.status === 'active' && now < session.endsAt && enforcing(session);
}

export interface NewTabFacts {
  /** A aba é uma página do próprio Pavio (opções, "preciso parar", janela da vela…)? */
  own: boolean;
  /** Tipo da janela: `normal` ou `popup` (login com Google/Apple, impressão, janelinhas de sites). */
  windowType: string | undefined;
}

/**
 * Esta aba nova deve ser fechada? Nunca as do próprio Pavio (senão a pessoa não conseguiria nem apagar a vela) nem as
 * janelinhas `popup` (logins e pagamentos abrem assim e quebrariam).
 */
export function shouldCloseNewTab(facts: NewTabFacts): boolean {
  return !facts.own && (facts.windowType === undefined || facts.windowType === 'normal');
}
