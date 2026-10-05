import type { Policy } from '../core/models';
import { restrictionFor } from '../core/restrictions';
import { instagramDecision } from '../core/sites';
import { onNavigate, setStyle } from './navigation';
import { instagramCss } from './selectors';

/**
 * Instagram por recursos: cada parte escondida (feed, Reels, Explorar, Stories, mensagens, perfis e
 * publicações) bloqueia a sua página; o feed (início) leva às mensagens. Menu: atalhos escondidos por CSS.
 */

let features: ReadonlySet<string> | null = null;

function evaluate() {
  if (!features) return;
  const decision = instagramDecision(location.pathname, features);
  if (decision.action === 'redirect') location.replace(decision.to);
  else if (decision.action === 'block')
    location.replace(chrome.runtime.getURL(`src/ui/blocked/index.html?site=instagram.com&why=${decision.reason}`));
}

function apply(policy: Policy | undefined) {
  features = restrictionFor(policy, 'instagram', ['instagram.com'])?.features ?? null;
  setStyle('pavio-instagram-style', features ? instagramCss(features) : null);
  evaluate();
}

void chrome.storage.local.get('policy').then((r) => apply(r.policy as Policy | undefined));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.policy) apply(changes.policy.newValue as Policy | undefined);
});
onNavigate(evaluate);
