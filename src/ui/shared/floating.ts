/** Janela própria da vela: fica aberta (o popup do Chrome fecha ao perder o foco). Sem permissão extra. */
export const FLOAT_PAGE = 'src/ui/float/index.html';
const SIZE = { width: 290, height: 430 };

export async function openFloatingCandle(): Promise<void> {
  const url = chrome.runtime.getURL(FLOAT_PAGE);
  // Já aberta? Só traz para a frente (uma janela da vela por vez).
  const open = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB], documentUrls: [url] });
  const windowId = open.find((c) => c.windowId >= 0)?.windowId;
  if (windowId !== undefined) {
    await chrome.windows.update(windowId, { focused: true, state: 'normal' });
    return;
  }
  // No canto superior direito da tela (availLeft/availTop existem no Chrome, mas não nos tipos padrão).
  const area = screen as Screen & { availLeft?: number; availTop?: number };
  const left = Math.max(0, Math.round((area.availLeft ?? 0) + area.availWidth - SIZE.width - 24));
  const top = Math.round((area.availTop ?? 0) + 72);
  await chrome.windows.create({ url, type: 'popup', ...SIZE, left, top, focused: true });
}
