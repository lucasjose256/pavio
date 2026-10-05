import type { Session } from './models';
import type { Clock, SchedulerPort } from './ports';
import type { EnvironmentRepository, ScheduleRepository } from './repositories';
import { scheduleState } from './schedule';
import type { SessionService } from './session-service';

export const SCHEDULE_ALARM = 'schedule-next';

interface Deps {
  schedule: ScheduleRepository;
  environments: EnvironmentRepository;
  sessionService: SessionService;
  scheduler: SchedulerPort;
  clock: Clock;
}

/**
 * Faz as faixas de horário "trabalharem sozinhas": acende a vela quando uma faixa está valendo
 * e agenda um alarme para o início da próxima. `sync()` é idempotente: chame ao acordar o service worker,
 * quando o alarme disparar, quando as faixas mudarem e quando uma sessão terminar.
 */
export class ScheduleService {
  constructor(private d: Deps) {}

  /** Há uma faixa valendo e nenhuma vela acesa? Acende. Devolve a sessão ativa (qualquer origem). */
  async ensure(): Promise<Session | undefined> {
    const running = await this.d.sessionService.reconcile();
    if (running) return running;
    const { active } = scheduleState(await this.d.schedule.list(), this.d.clock.now(), await this.d.schedule.skipped());
    if (!active) return undefined;
    const env = await this.d.environments.get(active.block.environmentId);
    if (!env) return undefined; // ambiente apagado: a faixa fica sem efeito
    return this.d.sessionService.startScheduled(env, active);
  }

  /** Alarme para o início da próxima faixa (ou cancela se não houver). */
  async planNext(): Promise<void> {
    const { next } = scheduleState(await this.d.schedule.list(), this.d.clock.now(), await this.d.schedule.skipped());
    if (next) await this.d.scheduler.schedule(SCHEDULE_ALARM, next.start);
    else await this.d.scheduler.cancel(SCHEDULE_ALARM);
  }

  async sync(): Promise<Session | undefined> {
    const session = await this.ensure();
    await this.planNext();
    return session;
  }
}
