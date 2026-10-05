import type { HistoryEntry, IntentGrant } from '../../core/models';
import type { NotifierPort } from '../../core/ports';
import { notifications } from '../../ui/i18n/pt-BR';

export const INTENT_NOTIFICATION_PREFIX = 'intent-';
const icon = () => chrome.runtime.getURL('public/icons/icon-128.png');

export class ChromeNotifier implements NotifierPort {
  async sessionCompleted(entry: HistoryEntry): Promise<void> {
    await chrome.notifications.create(`done-${entry.sessionId}`, {
      type: 'basic',
      iconUrl: icon(),
      title: notifications.completedTitle,
      message: notifications.completedMessage(entry.environmentName, Math.round(entry.actualMs / 60_000)),
    });
  }

  /** Botões: 0 = mais 5 min, 1 = já terminei (tratados no service worker). */
  async intentTimeUp(grant: IntentGrant): Promise<void> {
    await chrome.notifications.create(`${INTENT_NOTIFICATION_PREFIX}${grant.domain}`, {
      type: 'basic',
      iconUrl: icon(),
      title: notifications.intentTitle,
      message: notifications.intentMessage(grant.domain, grant.text),
      buttons: [{ title: notifications.intentMore }, { title: notifications.intentDone }],
      requireInteraction: true,
    });
  }
}
