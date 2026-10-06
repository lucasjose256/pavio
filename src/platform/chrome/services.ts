import { randomId, systemClock } from '../../core/ports';
import {
  EnvironmentRepository, HistoryRepository, IntentRepository, PolicyRepository, RoutineRepository, SessionRepository, SettingsRepository,
  UsageRepository,
} from '../../core/repositories';
import { IntentService } from '../../core/intent-service';
import { PolicyService } from '../../core/policy-service';
import { SessionService } from '../../core/session-service';
import { UsageService } from '../../core/usage-service';
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
  const routine = new RoutineRepository(storage);
  const settings = new SettingsRepository(storage);
  const policies = new PolicyRepository(storage);
  const usage = new UsageRepository(storage);
  const scheduler = new ChromeScheduler();
  const notifier = new ChromeNotifier();

  const sessionService = new SessionService({ sessions, history, scheduler, notifier, clock: systemClock, newId: randomId });
  const intentService = new IntentService({ intents, scheduler, notifier, clock: systemClock });

  return {
    storage,
    environments,
    routine,
    settings,
    sessions,
    history,
    intents,
    policies,
    usage,
    blocker: new ChromeBlocker(),
    sessionService,
    intentService,
    usageService: new UsageService({ usage, routine, clock: systemClock }),
    policyService: new PolicyService({ routine, settings, policies, usage, sessionService, intentService, scheduler, clock: systemClock }),
  };
}
