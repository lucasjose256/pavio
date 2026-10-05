import type { Session } from '../core/models';
import { restrictedKindActive } from '../core/sites';
import { setStyle } from './navigation';
import { classifyXTab, x, xCss } from './selectors';

/**
 * X sem a aba "Para você": esconde a aba e, se ela estiver selecionada, troca para "Seguindo".
 * As abas são achadas por papel (role="tab") + texto, que muda menos que classes do X.
 */

const root = document.documentElement;
let active = false;
let scheduled = false;

function scan() {
  scheduled = false;
  if (!active) return;
  const tabs = [...document.querySelectorAll<HTMLElement>(x.tabs)];
  let forYouSelected = false;
  for (const tab of tabs) {
    if (classifyXTab(tab.textContent ?? '') !== 'for-you') continue;
    (tab.closest('[role="presentation"]') ?? tab).setAttribute(x.hiddenAttr, 'for-you');
    if (tab.getAttribute('aria-selected') === 'true') forYouSelected = true;
  }
  root.classList.toggle('pavio-x-pending', forYouSelected);
  if (forYouSelected) tabs.find((t) => classifyXTab(t.textContent ?? '') === 'following')?.click();
}

const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  setTimeout(scan, 50); // timer (não rAF): também roda em aba aberta em segundo plano
};

function apply(session: Session | undefined) {
  active = restrictedKindActive(session, 'x', ['x.com', 'twitter.com']);
  setStyle('pavio-x-style', active ? xCss() : null);
  if (active) return schedule();
  root.classList.remove('pavio-x-pending');
  document.querySelectorAll(`[${x.hiddenAttr}]`).forEach((el) => el.removeAttribute(x.hiddenAttr));
}

void chrome.storage.local.get('activeSession').then((r) => apply(r.activeSession as Session | undefined));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.activeSession) apply(changes.activeSession.newValue as Session | undefined);
});
// A timeline é montada aos poucos: observa o DOM (agrupando as mudanças para não pesar).
new MutationObserver(schedule).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
