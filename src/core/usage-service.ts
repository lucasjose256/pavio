import type { Clock } from './ports';
import type { RoutineRepository, UsageRepository } from './repositories';
import { EXTEND_MIN, addUsage, extendLimit, limitReached, limitStatuses, limitedSiteFor } from './usage';
import type { LimitStatus } from './usage';

/** Intervalo da medição (o alarme do Chrome dispara a cada minuto). */
export const TICK_MS = 60_000;

interface Deps {
  usage: UsageRepository;
  routine: RoutineRepository;
  clock: Clock;
}

export interface RecordResult {
  /** App que recebeu o tempo (se o endereço era de um app com limite). */
  domain?: string;
  /** Este tempo fez o app estourar o limite agora (a política precisa ser recalculada). */
  crossed: boolean;
}

/**
 * Mede o tempo de uso dos apps com limite. Quem observa o navegador (aba ativa em foco, computador parado ou não)
 * decide o `host` e chama `record` a cada minuto; aqui só se soma e se detecta o estouro.
 */
export class UsageService {
  constructor(private d: Deps) {}

  /**
   * Soma o tempo de uma medição. `host` nulo = nada a contar (sem aba de app, janela sem foco, computador parado).
   * `elapsedMs` é limitado a 2 intervalos: se o service worker dormiu e o alarme veio atrasado, não se inventa tempo.
   */
  async record(host: string | null, elapsedMs: number = TICK_MS): Promise<RecordResult> {
    if (!host) return { crossed: false };
    const site = limitedSiteFor(await this.d.routine.list(), host);
    if (!site) return { crossed: false };
    const now = this.d.clock.now();
    const before = await this.d.usage.get();
    const wasReached = limitReached(site, before, now);
    const after = addUsage(before, site.domain, Math.min(Math.max(0, elapsedMs), 2 * TICK_MS), now);
    await this.d.usage.set(after, now);
    return { domain: site.domain, crossed: !wasReached && limitReached(site, after, now) };
  }

  /** "Mais um pouco" (só depois da fricção, na UI): sobe o limite de hoje. */
  async extend(domain: string, minutes: number = EXTEND_MIN): Promise<void> {
    const now = this.d.clock.now();
    await this.d.usage.set(extendLimit(await this.d.usage.get(), domain, minutes, now), now);
  }

  async statuses(): Promise<LimitStatus[]> {
    return limitStatuses(await this.d.routine.list(), await this.d.usage.get(), this.d.clock.now());
  }
}
