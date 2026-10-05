import type { HistoryEntry, Session } from './models';
import type { Clock, IdGenerator, NotifierPort, SchedulerPort } from './ports';
import type { HistoryRepository, SessionRepository } from './repositories';
import { buildSession, isExpired, toHistoryEntry } from './session';
import type { StartInput } from './session';

export const SESSION_ALARM = 'session-end';

export class SessionAlreadyActiveError extends Error {
  constructor() {
    super('A session is already active');
  }
}

interface Deps {
  sessions: SessionRepository;
  history: HistoryRepository;
  scheduler: SchedulerPort;
  notifier: NotifierPort;
  clock: Clock;
  newId: IdGenerator;
}

/**
 * Ciclo de vida da sessão. Fonte da verdade: `activeSession` no storage.
 * `reconcile()` é idempotente: chame ao acordar o service worker, ao abrir o popup e quando o alarme disparar.
 */
export class SessionService {
  constructor(private d: Deps) {}

  async start(input: StartInput): Promise<Session> {
    const current = await this.reconcile();
    if (current) throw new SessionAlreadyActiveError();
    const session = buildSession(input, this.d.clock.now(), this.d.newId);
    await this.d.sessions.set(session);
    await this.d.scheduler.schedule(SESSION_ALARM, session.endsAt);
    return session;
  }

  /** Encerra sessão vencida (concluída) e garante o alarme da ativa. Retorna a sessão ainda ativa. */
  async reconcile(): Promise<Session | undefined> {
    const session = await this.d.sessions.get();
    if (!session || session.status !== 'active') return undefined;
    if (isExpired(session, this.d.clock.now())) {
      await this.finish(session, 'completed');
      return undefined;
    }
    await this.d.scheduler.schedule(SESSION_ALARM, session.endsAt);
    return session;
  }

  /** Desistência. A fricção (etapa 5) acontece na UI, antes de chamar isto. */
  async abandon(): Promise<HistoryEntry | undefined> {
    const session = await this.d.sessions.get();
    if (!session || session.status !== 'active') return undefined;
    return this.finish(session, 'abandoned');
  }

  private async finish(session: Session, outcome: HistoryEntry['outcome']): Promise<HistoryEntry> {
    const entry = toHistoryEntry(session, outcome, this.d.clock.now());
    await this.d.history.append(entry);
    await this.d.sessions.clear();
    await this.d.scheduler.cancel(SESSION_ALARM);
    if (outcome === 'completed') await this.d.notifier.sessionCompleted(entry);
    return entry;
  }
}
