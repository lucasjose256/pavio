import type { Policy } from '../core/models';
import { restrictionFor } from '../core/restrictions';
import { linkedinDecision } from '../core/sites';
import { onNavigate, setStyle } from './navigation';
import { linkedinCss } from './selectors';

/** LinkedIn por recursos: feed (leva às mensagens), vídeos, "LinkedIn Notícias" e, se escolhido, mensagens. */

let features: ReadonlySet<string> | null = null;

function evaluate() {
  if (!features) return;
  const decision = linkedinDecision(location.pathname, features);
  if (decision.action === 'redirect') location.replace(decision.to);
  else if (decision.action === 'block')
    location.replace(chrome.runtime.getURL(`src/ui/blocked/index.html?site=linkedin.com&why=${decision.reason}&next=${encodeURIComponent(location.href)}`));
}

function apply(policy: Policy | undefined) {
  features = restrictionFor(policy, 'linkedin', ['linkedin.com'])?.features ?? null;
  setStyle('pavio-linkedin-style', features ? linkedinCss(features) : null);
  evaluate();
}

void chrome.storage.local.get('policy').then((r) => apply(r.policy as Policy | undefined));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.policy) apply(changes.policy.newValue as Policy | undefined);
});
onNavigate(evaluate);
