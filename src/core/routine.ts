import type { Rule, RoutineSite, RoutineSlot, RestrictionSpec } from './models';
import { FEATURE_DEFS, combineSpecs, featuresOf, serviceKindFor, strictness } from './restrictions';
import type { ServiceKind } from './restrictions';
import { normalizeDomain } from './matching';
import { occurrencesAround, validateTimeSlot } from './timeslots';
import type { Occurrence, TimeSlot } from './timeslots';
import { isValidLimit, limitRules } from './usage';
import type { UsageData } from './usage';

/** Faixa com o site a que pertence (para achatar a rotina). */
type FlatSlot = RoutineSlot & { siteId: string; domain: string };

const flatten = (routine: RoutineSite[]): FlatSlot[] =>
  routine.filter((s) => s.enabled).flatMap((site) => site.slots.map((slot) => ({ ...slot, siteId: site.id, domain: site.domain })));

const toRule = (domain: string, spec: RestrictionSpec): Rule => ({
  id: `routine:${domain}`,
  domain,
  mode: spec.mode,
  ...(spec.restrictedKind ? { restrictedKind: spec.restrictedKind } : {}),
  ...(spec.features ? { features: spec.features } : {}),
});

const spec = (s: RestrictionSpec): RestrictionSpec => ({ mode: s.mode, restrictedKind: s.restrictedKind, features: s.features });

/** Junta tratamentos do mesmo domínio: o mais rigoroso vale. */
function strictestPerDomain(items: { domain: string; spec: RestrictionSpec }[]): Rule[] {
  const byDomain = new Map<string, RestrictionSpec>();
  for (const { domain, spec: s } of items) {
    const prev = byDomain.get(domain);
    byDomain.set(domain, prev ? combineSpecs(prev, s) : s);
  }
  return [...byDomain].map(([domain, s]) => toRule(domain, s));
}

const BLOCKED: RestrictionSpec = { mode: 'blocked' };

/** Sites com o bloqueio rápido ligado (app inteiro, o tempo todo). */
const blockedAll = (routine: RoutineSite[]) => routine.filter((s) => s.enabled && s.blockAll).map((s) => ({ domain: s.domain, spec: BLOCKED }));

/**
 * Regras da rotina valendo em `now`: as faixas ativas (só com os horários ligados) somadas ao bloqueio rápido,
 * que vale sempre. Por site, a mais rigorosa vence.
 */
export function activeRules(routine: RoutineSite[], enabled: boolean, now: number): Rule[] {
  const active = enabled ? occurrencesAround(flatten(routine), now, 1, 1).filter((o) => o.start <= now && now < o.end) : [];
  return strictestPerDomain([...active.map((o) => ({ domain: o.slot.domain, spec: spec(o.slot) })), ...blockedAll(routine)]);
}

/** O tratamento mais rigoroso de cada site em QUALQUER faixa, bloqueio rápido ou limite (para pedir as permissões de acesso certas). */
export function rulesAnyTime(routine: RoutineSite[]): Rule[] {
  // Apps com limite de tempo também entram: ao estourar viram bloqueados, e para isso (e para saber qual aba está em uso)
  // o Pavio precisa do acesso ao site.
  const limited = routine.filter((s) => s.enabled && !!s.limitMin).map((s) => ({ domain: s.domain, spec: BLOCKED }));
  return strictestPerDomain([...flatten(routine).map((s) => ({ domain: s.domain, spec: spec(s) })), ...blockedAll(routine), ...limited]);
}

/** O app está com o bloqueio rápido ligado? */
export const isBlockedAll = (routine: RoutineSite[], domain: string): boolean =>
  routine.some((s) => s.domain === domain && s.enabled && !!s.blockAll);

/**
 * Define (ou, com `undefined`, remove) o limite de tempo diário de um app. Site novo entra na rotina sem faixas;
 * definir um limite religa o site; remover o limite de um site que ficou vazio (sem faixas nem bloqueio rápido) o tira da lista.
 */
export function setLimit(routine: RoutineSite[], domain: string, limitMin: number | undefined, newId: () => string): RoutineSite[] {
  if (limitMin === undefined) {
    return routine.flatMap((s) => {
      if (s.domain !== domain) return [s];
      const rest: RoutineSite = { ...s };
      delete rest.limitMin;
      return rest.slots.length === 0 && !rest.blockAll ? [] : [rest];
    });
  }
  if (!routine.some((s) => s.domain === domain)) return [...routine, { id: newId(), domain, enabled: true, slots: [], limitMin }];
  return routine.map((s) => (s.domain === domain ? { ...s, limitMin, enabled: true } : s));
}

/**
 * Liga/desliga o bloqueio rápido de um app. Se o site ainda não está na rotina, entra (sem faixas).
 * Ligar um site que estava desligado na rotina o religa.
 */
export function setBlockAll(routine: RoutineSite[], domain: string, on: boolean, newId: () => string): RoutineSite[] {
  const exists = routine.some((s) => s.domain === domain);
  if (!exists) return on ? [...routine, { id: newId(), domain, enabled: true, slots: [], blockAll: true }] : routine;
  return routine.map((s) => (s.domain === domain ? { ...s, blockAll: on, enabled: on ? true : s.enabled } : s));
}

/** Próximo instante (início ou fim de alguma faixa) em que o que vale pode mudar. */
export function nextBoundary(routine: RoutineSite[], enabled: boolean, now: number): number | undefined {
  if (!enabled) return undefined;
  const times = occurrencesAround(flatten(routine), now, 1, 8).flatMap((o) => [o.start, o.end]).filter((t) => t > now);
  return times.length ? Math.min(...times) : undefined;
}

/** Soma de regras de fontes diferentes (rotina + Timer): por domínio, a mais rigorosa vence. */
export function mergeRules(...lists: Rule[][]): Rule[] {
  const byDomain = new Map<string, Rule>();
  for (const rule of lists.flat()) {
    const prev = byDomain.get(rule.domain);
    byDomain.set(rule.domain, prev ? { ...rule, ...combineSpecs(prev, rule), id: prev.id, domain: rule.domain } : rule);
  }
  return [...byDomain.values()];
}

/**
 * Esta mudança afrouxa o que está protegendo AGORA? (Para pedir confirmação antes de salvar.)
 * Afrouxar = site que deixa de ser restrito, tratamento mais fraco, ou menos partes escondidas.
 */
export function loosensNow(
  before: { sites: RoutineSite[]; enabled: boolean },
  after: { sites: RoutineSite[]; enabled: boolean },
  now: number,
  usage: UsageData = {},
): boolean {
  // Inclui os apps bloqueados hoje por limite estourado: tirar ou subir o limite também é afrouxar.
  const was = mergeRules(activeRules(before.sites, before.enabled, now), limitRules(before.sites, usage, now));
  const next = mergeRules(activeRules(after.sites, after.enabled, now), limitRules(after.sites, usage, now));
  return was.some((b) => {
    const a = next.find((r) => r.domain === b.domain);
    if (!a) return true;
    const [sb, sa] = [strictness(b), strictness(a)];
    if (sa !== sb) return sa < sb;
    if (sb === 3 && b.restrictedKind === a.restrictedKind) return [...featuresOf(b)].some((f) => !featuresOf(a).has(f));
    return false;
  });
}

/** Erros (códigos) de uma faixa; vazio = válida. */
export function validateSlot(slot: RoutineSlot): string[] {
  const errors = validateTimeSlot(slot);
  if (slot.mode !== 'blocked' && slot.mode !== 'restricted') errors.push('mode:invalid');
  if (slot.mode === 'restricted' && !slot.restrictedKind) errors.push('kind:missing');
  return errors;
}

export function validateSite(site: RoutineSite): string[] {
  const errors: string[] = [];
  if (normalizeDomain(site.domain) !== site.domain) errors.push('site:invalid-domain');
  if (site.limitMin !== undefined && !isValidLimit(site.limitMin)) errors.push('limit:invalid');
  for (const slot of site.slots) errors.push(...validateSlot(slot));
  return errors;
}

/** Faixa ativa em `now` (a que ganha em caso de sobreposição não importa: serve para destacar na tela). */
export function activeOccurrences(routine: RoutineSite[], enabled: boolean, now: number): Occurrence<FlatSlot & TimeSlot>[] {
  if (!enabled) return [];
  return occurrencesAround(flatten(routine), now, 1, 1).filter((o) => o.start <= now && now < o.end);
}

// ---------- horário por recurso (uma barra por recurso do serviço) ----------

type Times = { startMin: number; endMin: number };

/** Serviço com recursos para este site (youtube, instagram, x, linkedin) ou null. */
export const serviceOf = (site: Pick<RoutineSite, 'domain'>): ServiceKind | null => serviceKindFor(site.domain);

/** Faixas que escondem `feature` neste site (as "restritas" do serviço que incluem o recurso). */
export function featureSlotsOf(site: RoutineSite, feature: string): RoutineSlot[] {
  const service = serviceOf(site);
  return site.slots.filter((s) => s.mode === 'restricted' && !!service && s.restrictedKind === service && featuresOf(s).has(feature));
}

/** Faixa nova que esconde só `feature`. */
export function newFeatureSlot(site: Pick<RoutineSite, 'domain'>, feature: string, days: number[], times: Times, newId: () => string): RoutineSlot {
  const service = serviceOf(site);
  if (!service || !FEATURE_DEFS[service].some((f) => f.id === feature)) throw new Error(`Unknown feature ${feature} for ${site.domain}`);
  return { id: newId(), days: [...days], ...times, mode: 'restricted', restrictedKind: service, features: [feature] };
}

/**
 * Muda o horário SÓ do recurso `feature` na faixa `slotId`. Se a faixa escondia outros recursos também, o recurso
 * é separado numa faixa própria (com os mesmos dias), e a original continua igual para os demais.
 */
export function retimeFeature(site: RoutineSite, slotId: string, feature: string, times: Times, newId: () => string): RoutineSite {
  const slot = site.slots.find((s) => s.id === slotId);
  if (!slot) return site;
  const features = [...featuresOf(slot)];
  if (features.length <= 1) return { ...site, slots: site.slots.map((s) => (s.id === slotId ? { ...s, ...times } : s)) };
  const rest = features.filter((f) => f !== feature);
  const detached = newFeatureSlot(site, feature, slot.days, times, newId);
  return { ...site, slots: [...site.slots.map((s) => (s.id === slotId ? { ...s, features: rest } : s)), detached] };
}

/** Tira `feature` da faixa (apaga a faixa se não sobrar nenhum recurso). */
export function dropFeature(site: RoutineSite, slotId: string, feature: string): RoutineSite {
  return {
    ...site,
    slots: site.slots.flatMap((s) => {
      if (s.id !== slotId) return [s];
      const rest = [...featuresOf(s)].filter((f) => f !== feature);
      return rest.length ? [{ ...s, features: rest }] : [];
    }),
  };
}
