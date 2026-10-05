import type { HistoryEntry, IntentGrant, PomodoroPhase, Session } from '../../core/models';
import { formatMinutes } from '../../core/schedule';
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

  async pomodoroPhase(session: Session, phase: PomodoroPhase, until: number): Promise<void> {
    const end = new Date(until);
    const time = formatMinutes(end.getHours() * 60 + end.getMinutes());
    const cycle = session.pomodoro?.cycle ?? 1;
    await chrome.notifications.create(`pomodoro-${session.id}`, {
      type: 'basic',
      iconUrl: icon(),
      title: phase === 'break' ? notifications.breakTitle : notifications.focusTitle,
      message: phase === 'break'
        ? notifications.breakMessage(Math.max(1, Math.round((until - Date.now()) / 60_000)), time, session.pomodoro?.long ?? false)
        : notifications.focusMessage(cycle),
    });
  }

  async scheduledStarted(session: Session): Promise<void> {
    const end = new Date(session.endsAt);
    await chrome.notifications.create(`sched-${session.id}`, {
      type: 'basic',
      iconUrl: icon(),
      title: notifications.scheduledTitle,
      message: notifications.scheduledMessage(
        session.scheduleName || session.environmentSnapshot.name,
        formatMinutes(end.getHours() * 60 + end.getMinutes()),
      ),
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
