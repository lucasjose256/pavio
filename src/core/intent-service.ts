import type { IntentGrant } from './models';
import type { Clock, NotifierPort, SchedulerPort } from './ports';
import type { IntentRepository } from './repositories';

export const INTENT_ALARM_PREFIX = 'intent:';
export const intentAlarm = (domain: string) => `${INTENT_ALARM_PREFIX}${domain}`;
export const domainFromIntentAlarm = (name: string): string | null =>
  name.startsWith(INTENT_ALARM_PREFIX) ? name.slice(INTENT_ALARM_PREFIX.length) : null;

export const INTENT_MIN_MINUTES = 1;
export const INTENT_MAX_MINUTES = 180;
export const INTENT_MAX_TEXT = 120;
export const INTENT_EXTEND_MINUTES = 5;
export const INTENT_PRESETS_MIN = [5, 10, 15, 30];

export function validateIntent(text: string, minutes: number): string | null {
  if (!text.trim()) return 'text:empty';
  if (text.trim().length > INTENT_MAX_TEXT) return 'text:too-long';
  if (!Number.isInteger(minutes) || minutes < INTENT_MIN_MINUTES || minutes > INTENT_MAX_MINUTES) return 'minutes:invalid';
  return null;
}

interface Deps {
  intents: IntentRepository;
  scheduler: SchedulerPort;
  notifier: NotifierPort;
  clock: Clock;
}

/**
 * Modo intenção: o usuário diz o que vai fazer e por quanto tempo; o site fica liberado nesse período.
 * Passou do tempo → aviso gentil ("ainda está na tarefa?"), sem bloquear à força.
 */
export class IntentService {
  constructor(private d: Deps) {}

  async grant(domain: string, text: string, minutes: number): Promise<IntentGrant> {
    const error = validateIntent(text, minutes);
    if (error) throw new Error(`Invalid intent: ${error}`);
    const now = this.d.clock.now();
    const grant: IntentGrant = { domain, text: text.trim(), minutes, startedAt: now, endsAt: now + minutes * 60_000 };
    await this.d.intents.put(grant);
    await this.d.scheduler.schedule(intentAlarm(domain), grant.endsAt);
    return grant;
  }

  /** "Preciso de mais um pouco": estende a partir de agora. */
  async extend(domain: string, minutes = INTENT_EXTEND_MINUTES): Promise<IntentGrant | undefined> {
    const current = await this.d.intents.get(domain);
    if (!current) return undefined;
    const endsAt = Math.max(current.endsAt, this.d.clock.now()) + minutes * 60_000;
    const next = { ...current, endsAt, minutes: current.minutes + minutes };
    await this.d.intents.put(next);
    await this.d.scheduler.schedule(intentAlarm(domain), endsAt);
    return next;
  }

  /** "Já terminei": o site volta a pedir intenção. */
  async revoke(domain: string): Promise<void> {
    await this.d.intents.remove(domain);
    await this.d.scheduler.cancel(intentAlarm(domain));
  }

  /** Alarme disparou. Alarmes podem vir um pouco antes; reagenda se for o caso. */
  async timeUp(domain: string): Promise<void> {
    const grant = await this.d.intents.get(domain);
    if (!grant) return;
    if (this.d.clock.now() < grant.endsAt - 1000) return void (await this.d.scheduler.schedule(intentAlarm(domain), grant.endsAt));
    await this.d.notifier.intentTimeUp(grant);
  }

  /**
   * Mantém só as permissões de sites que AINDA estão em modo intenção na política atual
   * (acabou a faixa da rotina ou a vela: nada de permissões penduradas).
   */
  async prune(stillIntent: string[]): Promise<void> {
    for (const g of await this.d.intents.list()) {
      if (stillIntent.includes(g.domain)) continue;
      await this.d.scheduler.cancel(intentAlarm(g.domain));
      await this.d.intents.remove(g.domain);
    }
  }
}
