import { randomId, systemClock } from '../../core/ports';
import {
  EnvironmentRepository, HistoryRepository, SessionRepository, SettingsRepository,
} from '../../core/repositories';
import { SessionService } from '../../core/session-service';
import { ChromeScheduler } from './alarms';
import { ChromeNotifier } from './notifications';
import { ChromeStorage } from './storage';

/** Composição das dependências para UI e background (páginas da extensão). */
export function createServices() {
  const storage = new ChromeStorage();
  const sessions = new SessionRepository(storage);
  const history = new HistoryRepository(storage);
  return {
    storage,
    environments: new EnvironmentRepository(storage, systemClock),
    settings: new SettingsRepository(storage),
    sessions,
    history,
    sessionService: new SessionService({
      sessions,
      history,
      scheduler: new ChromeScheduler(),
      notifier: new ChromeNotifier(),
      clock: systemClock,
      newId: randomId,
    }),
  };
}
