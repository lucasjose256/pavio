import { dayKey } from './history';
import { hostMatchesDomain } from './matching';
import type { Rule, RoutineSite } from './models';

/** Tempo de uso de um dia: ms por app e minutos extras concedidos ("mais 5 min"). */
export interface DayUsage {
  ms: Record<string, number>;
  extraMin: Record<string, number>;
}
/** Por dia local (AAAA-MM-DD). */
export type UsageData = Record<string, DayUsage>;

export const USAGE_KEEP_DAYS = 90;
export const MIN_LIMIT_MIN = 1;
export const MAX_LIMIT_MIN = 1440;
/** Quanto cada "mais um pouco" acrescenta ao limite do dia. */
export const EXTEND_MIN = 5;

const MS_PER_MIN = 60_000;
const today = (data: UsageData, now: number): DayUsage | undefined => data[dayKey(now)];

export const isValidLimit = (minutes: number): boolean => Number.isInteger(minutes) && minutes >= MIN_LIMIT_MIN && minutes <= MAX_LIMIT_MIN;

/** Primeira meia-noite local depois de `now` (quando o limite zera). */
export function nextMidnight(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export const usedMs = (data: UsageData, domain: string, now: number): number => today(data, now)?.ms[domain] ?? 0;
export const extraMinutes = (data: UsageData, domain: string, now: number): number => today(data, now)?.extraMin[domain] ?? 0;

/** Limite de HOJE em ms (o fixo + as extensões), ou undefined se o app não tem limite. */
export function limitMsFor(site: Pick<RoutineSite, 'domain' | 'limitMin'>, data: UsageData, now: number): number | undefined {
  return site.limitMin && site.limitMin > 0 ? (site.limitMin + extraMinutes(data, site.domain, now)) * MS_PER_MIN : undefined;
}

/** O limite está valendo (app ligado na rotina) e o uso de hoje chegou a ele? */
export function limitReached(site: Pick<RoutineSite, 'domain' | 'limitMin' | 'enabled'>, data: UsageData, now: number): boolean {
  const limit = site.enabled ? limitMsFor(site, data, now) : undefined;
  return limit !== undefined && usedMs(data, site.domain, now) >= limit;
}

/** Quanto ainda pode usar hoje (0 se estourou); undefined se não há limite. */
export function remainingMsFor(site: Pick<RoutineSite, 'domain' | 'limitMin'>, data: UsageData, now: number): number | undefined {
  const limit = limitMsFor(site, data, now);
  return limit === undefined ? undefined : Math.max(0, limit - usedMs(data, site.domain, now));
}

function withDay(data: UsageData, now: number, change: (day: DayUsage) => DayUsage): UsageData {
  const key = dayKey(now);
  const day = data[key] ?? { ms: {}, extraMin: {} };
  return pruneUsage({ ...data, [key]: change({ ms: { ...day.ms }, extraMin: { ...day.extraMin } }) }, now);
}

/** Soma `ms` de uso do app no dia de `now` (não muta o original). */
export function addUsage(data: UsageData, domain: string, ms: number, now: number): UsageData {
  if (ms <= 0) return data;
  return withDay(data, now, (day) => ({ ...day, ms: { ...day.ms, [domain]: (day.ms[domain] ?? 0) + ms } }));
}

/** "Mais um pouco": sobe o limite de HOJE em `minutes`. */
export function extendLimit(data: UsageData, domain: string, minutes: number, now: number): UsageData {
  return withDay(data, now, (day) => ({ ...day, extraMin: { ...day.extraMin, [domain]: (day.extraMin[domain] ?? 0) + minutes } }));
}

/** Guarda só os últimos `keepDays` dias (a chave do dia ordena como texto). */
export function pruneUsage(data: UsageData, now: number, keepDays = USAGE_KEEP_DAYS): UsageData {
  const cutoff = dayKey(now - keepDays * 86_400_000);
  return Object.fromEntries(Object.entries(data).filter(([key]) => key >= cutoff));
}

/** O app da rotina (com limite) a que este endereço pertence. Subdomínios contam; o domínio mais específico vence. */
export function limitedSiteFor(routine: RoutineSite[], host: string): RoutineSite | undefined {
  return routine
    .filter((s) => s.enabled && !!s.limitMin && hostMatchesDomain(host, s.domain))
    .sort((a, b) => b.domain.length - a.domain.length)[0];
}

/** Regras de bloqueio de hoje: os apps que estouraram o limite ficam bloqueados até a meia-noite. */
export function limitRules(routine: RoutineSite[], data: UsageData, now: number): Rule[] {
  return routine.filter((s) => limitReached(s, data, now)).map((s) => ({ id: `limit:${s.domain}`, domain: s.domain, mode: 'blocked' as const }));
}

export interface LimitStatus {
  domain: string;
  limitMin: number;
  usedMs: number;
  limitMs: number;
  remainingMs: number;
  reached: boolean;
  extraMin: number;
}

/** Para a tela: uso de hoje de cada app com limite. */
export function limitStatuses(routine: RoutineSite[], data: UsageData, now: number): LimitStatus[] {
  return routine
    .filter((s) => !!s.limitMin)
    .map((s) => {
      const limitMs = limitMsFor(s, data, now)!;
      const used = usedMs(data, s.domain, now);
      return { domain: s.domain, limitMin: s.limitMin!, usedMs: used, limitMs, remainingMs: Math.max(0, limitMs - used), reached: s.enabled && used >= limitMs, extraMin: extraMinutes(data, s.domain, now) };
    });
}
