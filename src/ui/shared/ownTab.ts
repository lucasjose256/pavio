import { OWN_TAB_MESSAGE } from '../../core/new-tabs';

/** Chame em páginas que abrem em aba: opções, "preciso parar", janela da vela, bloqueio, intenção… */
export function announceOwnTab(): void {
  try {
    void chrome.runtime.sendMessage({ type: OWN_TAB_MESSAGE }).catch(() => undefined);
  } catch { /* fora de uma extensão (testes): ignora */ }
}
