import { randomId, systemClock } from '../../core/ports';
import {
  EnvironmentRepository, HistoryRepository, IntentRepository, ScheduleRepository, SessionRepository, SettingsRepository,
} from '../../core/repositories';
import { IntentService } from '../../core/intent-service';
import { ScheduleService } from '../../core/schedule-service';
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
  const environments = new EnvironmentRepository(storage, systemClock);
  const schedule = new ScheduleRepository(storage, systemClock);
  const scheduler = new ChromeScheduler();
  const notifier = new ChromeNotifier();

  const sessionService = new SessionService({
    sessions, history, schedule, scheduler, notifier, clock: systemClock, newId: randomId,
  });

  return {
    storage,
    environments,
    schedule,
    settings: new SettingsRepository(storage),
    sessions,
    history,
    intents,
    blocker: new ChromeBlocker(),
    sessionService,
    scheduleService: new ScheduleService({ schedule, environments, sessionService, scheduler, clock: systemClock }),
    intentService: new IntentService({ intents, scheduler, notifier, clock: systemClock }),
  };
}
