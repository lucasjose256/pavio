import type { HistoryEntry } from '../../core/models';
import type { NotifierPort } from '../../core/ports';
import { notifications } from '../../ui/i18n/pt-BR';

export class ChromeNotifier implements NotifierPort {
  async sessionCompleted(entry: HistoryEntry): Promise<void> {
    await chrome.notifications.create(`done-${entry.sessionId}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('public/icons/icon-128.png'),
      title: notifications.completedTitle,
      message: notifications.completedMessage(entry.environmentName, Math.round(entry.actualMs / 60_000)),
    });
  }
}
