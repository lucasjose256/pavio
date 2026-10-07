import type { Policy } from '../core/models';
import { restrictionFor } from '../core/restrictions';
import { xDecision } from '../core/sites';
import { onNavigate, setStyle } from './navigation';
import { classifyXTab, x, xCss } from './selectors';

/**
 * X por recursos: `forYou` esconde a aba "Para você" (e troca para "Seguindo"); `explore` bloqueia a página
 * Explorar/tendências. As abas são achadas por papel (role="tab") + texto, que muda menos que as classes do X.
 */

const root = document.documentElement;
let features: ReadonlySet<string> | null = null;
let scheduled = false;

function scan() {
  scheduled = false;
  if (!features?.has('forYou')) return;
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

function evaluate() {
  if (!features) return;
  const decision = xDecision(location.pathname, features);
  if (decision.action === 'block')
    location.replace(chrome.runtime.getURL(`src/ui/blocked/index.html?site=x.com&why=${decision.reason}&next=${encodeURIComponent(location.href)}`));
}

function apply(policy: Policy | undefined) {
  features = restrictionFor(policy, 'x', ['x.com', 'twitter.com'])?.features ?? null;
  setStyle('pavio-x-style', features?.has('forYou') ? xCss() : null);
  if (features) {
    schedule();
    return evaluate();
  }
  root.classList.remove('pavio-x-pending');
  document.querySelectorAll(`[${x.hiddenAttr}]`).forEach((el) => el.removeAttribute(x.hiddenAttr));
}

void chrome.storage.local.get('policy').then((r) => apply(r.policy as Policy | undefined));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.policy) apply(changes.policy.newValue as Policy | undefined);
});
onNavigate(evaluate);
// A timeline é montada aos poucos: observa o DOM (agrupando as mudanças para não pesar).
new MutationObserver(schedule).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
