import type { Session } from '../core/models';
import { instagramDecision, restrictedKindActive } from '../core/sites';
import { onNavigate, setStyle } from './navigation';
import { instagramCss } from './selectors';

/** Instagram "só mensagens": só /direct (e o login) passam; Reels, Explorar, feed e perfis vão para a vela. */

let active = false;

function evaluate() {
  if (!active) return;
  const decision = instagramDecision(location.pathname);
  if (decision.action === 'redirect-inbox') location.replace('/direct/inbox/');
  else if (decision.action === 'block')
    location.replace(chrome.runtime.getURL(`src/ui/blocked/index.html?site=instagram.com&why=${decision.reason}`));
}

function apply(session: Session | undefined) {
  active = restrictedKindActive(session, 'instagram', ['instagram.com']);
  setStyle('pavio-instagram-style', active ? instagramCss() : null);
  evaluate();
}

void chrome.storage.local.get('activeSession').then((r) => apply(r.activeSession as Session | undefined));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.activeSession) apply(changes.activeSession.newValue as Session | undefined);
});
onNavigate(evaluate);
