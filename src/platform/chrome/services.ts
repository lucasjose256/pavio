import { randomId, systemClock } from '../../core/ports';
import {
  EnvironmentRepository, HistoryRepository, IntentRepository, SessionRepository, SettingsRepository,
} from '../../core/repositories';
import { IntentService } from '../../core/intent-service';
import { SessionService } from '../../core/session-service';
import { ChromeScheduler } from './alarms';
import { ChromeBlocker } from './blocking';
import { ChromeNotifier } from './notifications';
import { ChromeStorage } from './storage';

/** Composição das dependências para UI e background (páginas da extensão). */
export function createServices() {
  const storage = new ChromeStorage();
  const sessions = new SessionRepository(storage);
  const history = new HistoryRepository(storage);
  const intents = new IntentRepository(storage);
  const scheduler = new ChromeScheduler();
  const notifier = new ChromeNotifier();
  return {
    storage,
    environments: new EnvironmentRepository(storage, systemClock),
    settings: new SettingsRepository(storage),
    sessions,
    history,
    intents,
    blocker: new ChromeBlocker(),
    intentService: new IntentService({ intents, scheduler, notifier, clock: systemClock }),
    sessionService: new SessionService({
      sessions,
      history,
      scheduler,
      notifier,
      clock: systemClock,
      newId: randomId,
    }),
  };
}
