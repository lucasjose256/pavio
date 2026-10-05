import type { Session } from '../core/models';
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
    location.replace(chrome.runtime.getURL(`src/ui/blocked/index.html?site=linkedin.com&why=${decision.reason}`));
}

function apply(session: Session | undefined) {
  features = restrictionFor(session, 'linkedin', ['linkedin.com'])?.features ?? null;
  setStyle('pavio-linkedin-style', features ? linkedinCss(features) : null);
  evaluate();
}

void chrome.storage.local.get('activeSession').then((r) => apply(r.activeSession as Session | undefined));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.activeSession) apply(changes.activeSession.newValue as Session | undefined);
});
onNavigate(evaluate);
