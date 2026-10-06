import { trackableHost } from '../../core/usage';
import type { IdleState } from '../../core/usage';

/** Alarme periódico (a cada minuto) que mede o uso dos apps com limite. */
export const USAGE_ALARM = 'usage-tick';
/** Sem mexer no computador por tanto tempo (s) = parado: não conta. */
const IDLE_SECONDS = 60;

/**
 * Qual site está em uso AGORA? Junta o que só o Chrome sabe (computador parado, janela em foco, aba ativa) e deixa
 * a decisão para `trackableHost`. O endereço da aba só é visível para sites a que o Pavio já tem acesso (apps com
 * limite), então não precisa da permissão `tabs`.
 */
export async function observeHost(): Promise<string | null> {
  const [idle, win, tabs] = await Promise.all([
    chrome.idle.queryState(IDLE_SECONDS) as Promise<IdleState>,
    chrome.windows.getLastFocused(),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
  ]);
  return trackableHost({ idle, windowFocused: !!win.focused, url: tabs[0]?.url });
}

/** Liga o alarme só quando há algum app com limite (sem limites, o service worker nem acorda por isso). Idempotente. */
export async function setTracking(on: boolean): Promise<void> {
  const existing = await chrome.alarms.get(USAGE_ALARM);
  if (on && !existing) await chrome.alarms.create(USAGE_ALARM, { periodInMinutes: 1 });
  else if (!on && existing) await chrome.alarms.clear(USAGE_ALARM);
}
