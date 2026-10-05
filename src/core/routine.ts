import type { Rule, RoutineSite, RoutineSlot, RestrictionSpec } from './models';
import { combineSpecs, strictness, featuresOf } from './restrictions';
import { normalizeDomain } from './matching';
import { occurrencesAround, validateTimeSlot } from './timeslots';
import type { Occurrence, TimeSlot } from './timeslots';

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

/** Regras da rotina valendo em `now` (rotina desligada = nenhuma). */
export function activeRules(routine: RoutineSite[], enabled: boolean, now: number): Rule[] {
  if (!enabled) return [];
  const active = occurrencesAround(flatten(routine), now, 1, 1).filter((o) => o.start <= now && now < o.end);
  return strictestPerDomain(active.map((o) => ({ domain: o.slot.domain, spec: spec(o.slot) })));
}

/** O tratamento mais rigoroso de cada site em QUALQUER faixa (para pedir as permissões de acesso certas). */
export function rulesAnyTime(routine: RoutineSite[]): Rule[] {
  return strictestPerDomain(flatten(routine).map((s) => ({ domain: s.domain, spec: spec(s) })));
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
export function loosensNow(before: { sites: RoutineSite[]; enabled: boolean }, after: { sites: RoutineSite[]; enabled: boolean }, now: number): boolean {
  const was = activeRules(before.sites, before.enabled, now);
  const next = activeRules(after.sites, after.enabled, now);
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
  for (const slot of site.slots) errors.push(...validateSlot(slot));
  return errors;
}

/** Faixa ativa em `now` (a que ganha em caso de sobreposição não importa: serve para destacar na tela). */
export function activeOccurrences(routine: RoutineSite[], enabled: boolean, now: number): Occurrence<FlatSlot & TimeSlot>[] {
  if (!enabled) return [];
  return occurrencesAround(flatten(routine), now, 1, 1).filter((o) => o.start <= now && now < o.end);
}
