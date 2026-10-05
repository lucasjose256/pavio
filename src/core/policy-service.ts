import { intentDomains } from './blocking';
import type { IntentService } from './intent-service';
import type { Policy } from './models';
import type { Clock, SchedulerPort } from './ports';
import { computePolicy } from './policy';
import type { PolicyRepository, RoutineRepository, SettingsRepository } from './repositories';
import { nextBoundary } from './routine';
import type { SessionService } from './session-service';

export const ROUTINE_ALARM = 'routine-boundary';

interface Deps {
  routine: RoutineRepository;
  settings: SettingsRepository;
  policies: PolicyRepository;
  sessionService: SessionService;
  intentService: IntentService;
  scheduler: SchedulerPort;
  clock: Clock;
}

/**
 * Mantém a política (o que vale agora) em dia: conclui a vela que venceu, soma rotina + Timer, grava só se mudou,
 * descarta permissões de intenção que já não valem e agenda o alarme da próxima virada da rotina.
 * Idempotente: chame ao acordar o service worker, nos alarmes e quando sessão/rotina/configurações mudarem.
 */
export class PolicyService {
  constructor(private d: Deps) {}

  async sync(): Promise<Policy> {
    const session = await this.d.sessionService.reconcile();
    const [routine, settings] = await Promise.all([this.d.routine.list(), this.d.settings.get()]);
    const now = this.d.clock.now();
    const policy = computePolicy({ routine, routineEnabled: settings.routineEnabled, session, now });
    await this.d.policies.set(policy);
    await this.d.intentService.prune(intentDomains(policy.rules));

    const next = nextBoundary(routine, settings.routineEnabled, now);
    if (next) await this.d.scheduler.schedule(ROUTINE_ALARM, next);
    else await this.d.scheduler.cancel(ROUTINE_ALARM);
    return policy;
  }
}
