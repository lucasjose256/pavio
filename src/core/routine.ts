import type { Release, Rule, RoutineSite, RoutineSlot, RestrictionSpec } from './models';
import { FEATURE_DEFS, combineSpecs, featuresOf, serviceKindFor, strictness } from './restrictions';
import type { ServiceKind } from './restrictions';
import { normalizeDomain } from './matching';
import { occurrencesAround, validateTimeSlot } from './timeslots';
import type { Occurrence, TimeSlot } from './timeslots';
import { isValidLimit, limitRules } from './usage';
import type { UsageData } from './usage';

/** Faixa com o site a que pertence (para achatar a rotina). */
type FlatSlot = RoutineSlot & { siteId: string; domain: string };

/** `live` tira as faixas pausadas (`off`) e as de pausa temporária: para o que vale agora. Sem isso, todas (permissões, desenho). */
type Live = { now: number; releases: Release[] };

/** Recursos pausados de um site (até religar, ou por um tempo): saem da lista do que é escondido. */
function offFeaturesNow(site: RoutineSite, live?: Live): Set<string> {
  const off = new Set(site.offFeatures ?? []);
  if (live) for (const r of live.releases) if (r.feature !== undefined && r.until > live.now && r.domain === site.domain) off.add(r.feature);
  return off;
}

const flatten = (routine: RoutineSite[], live?: Live): FlatSlot[] =>
  routine.filter((s) => s.enabled).flatMap((site) => {
    const off = offFeaturesNow(site, live);
    return site.slots
      .filter((slot) => !live || (!slot.off && !live.releases.some((r) => r.slotId === slot.id && r.until > live.now)))
      .flatMap((slot): FlatSlot[] => {
        const flat: FlatSlot = { ...slot, siteId: site.id, domain: site.domain };
        if (!live || off.size === 0 || slot.mode !== 'restricted' || !slot.restrictedKind || slot.restrictedKind === 'intent') return [flat];
        const features = [...featuresOf(slot)].filter((f) => !off.has(f));
        if (features.length === 0) return []; // todos os recursos desta faixa estão pausados
        return [{ ...flat, features }];
      });
  });

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

/**
 * Bloqueio rápido por partes: o que cada site esconde SEMPRE (`quickFeatures`), menos os recursos pausados.
 * Só vale para serviços com recursos (YouTube, Instagram, X, LinkedIn); ids desconhecidos são ignorados.
 */
const quickParts = (routine: RoutineSite[], live?: Live) =>
  routine.filter((s) => s.enabled && !!s.quickFeatures?.length).flatMap((site) => {
    const kind = serviceOf(site);
    if (!kind) return [];
    const known = new Set(FEATURE_DEFS[kind].map((f) => f.id));
    const off = offFeaturesNow(site, live);
    const features = site.quickFeatures!.filter((f) => known.has(f) && !off.has(f));
    return features.length ? [{ domain: site.domain, spec: { mode: 'restricted' as const, restrictedKind: kind, features } }] : [];
  });

/** Sites com o bloqueio rápido ligado (app inteiro, o tempo todo). */
const blockedAll = (routine: RoutineSite[]) => routine.filter((s) => s.enabled && s.blockAll).map((s) => ({ domain: s.domain, spec: BLOCKED }));

/**
 * Regras da rotina valendo em `now`: as faixas ativas (só com os horários ligados) somadas ao bloqueio rápido,
 * que vale sempre. Por site, a mais rigorosa vence.
 */
export function activeRules(routine: RoutineSite[], enabled: boolean, now: number, releases: Release[] = []): Rule[] {
  const active = enabled ? occurrencesAround(flatten(routine, { now, releases }), now, 1, 1).filter((o) => o.start <= now && now < o.end) : [];
  return strictestPerDomain([...active.map((o) => ({ domain: o.slot.domain, spec: spec(o.slot) })), ...blockedAll(routine), ...quickParts(routine, { now, releases })]);
}

/** O tratamento mais rigoroso de cada site em QUALQUER faixa, bloqueio rápido ou limite (para pedir as permissões de acesso certas). */
export function rulesAnyTime(routine: RoutineSite[]): Rule[] {
  // Apps com limite de tempo também entram: ao estourar viram bloqueados, e para isso (e para saber qual aba está em uso)
  // o Pavio precisa do acesso ao site.
  const limited = routine.filter((s) => s.enabled && !!s.limitMin).map((s) => ({ domain: s.domain, spec: BLOCKED }));
  return strictestPerDomain([...flatten(routine).map((s) => ({ domain: s.domain, spec: spec(s) })), ...blockedAll(routine), ...quickParts(routine), ...limited]);
}

/** O app está com o bloqueio rápido ligado? */
export const isBlockedAll = (routine: RoutineSite[], domain: string): boolean =>
  routine.some((s) => s.domain === domain && s.enabled && !!s.blockAll);

/** Site sem nada configurado (sem faixas, bloqueio rápido, partes nem limite): pode sair da lista. */
const isEmptySite = (s: RoutineSite): boolean => s.slots.length === 0 && !s.blockAll && !s.limitMin && !s.quickFeatures?.length;

/** Os recursos que o site esconde sempre (bloqueio rápido por partes). */
export const quickFeaturesOf = (routine: RoutineSite[], domain: string): string[] =>
  routine.find((s) => s.domain === domain && s.enabled)?.quickFeatures ?? [];

/**
 * Define quais partes do site ficam escondidas SEMPRE (lista vazia remove). Site novo entra na rotina sem faixas;
 * marcar uma parte religa o site; ao desmarcar a última, um site que ficou vazio sai da lista.
 */
export function setQuickFeatures(routine: RoutineSite[], domain: string, features: string[], newId: () => string): RoutineSite[] {
  const list = [...new Set(features)];
  if (list.length === 0) {
    return routine.flatMap((s) => {
      if (s.domain !== domain) return [s];
      const rest: RoutineSite = { ...s };
      delete rest.quickFeatures;
      return isEmptySite(rest) ? [] : [rest];
    });
  }
  if (!routine.some((s) => s.domain === domain)) return [...routine, { id: newId(), domain, enabled: true, slots: [], quickFeatures: list }];
  return routine.map((s) => (s.domain === domain ? { ...s, quickFeatures: list, enabled: true } : s));
}

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
      return isEmptySite(rest) ? [] : [rest];
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
export function nextBoundary(routine: RoutineSite[], enabled: boolean, now: number, releases: Release[] = []): number | undefined {
  if (!enabled) return undefined;
  const times = occurrencesAround(flatten(routine, { now, releases }), now, 1, 8).flatMap((o) => [o.start, o.end]).filter((t) => t > now);
  return times.length ? Math.min(...times) : undefined;
}

/** Pausa (`off`) ou retoma um recurso do site até a pessoa religar (vale em todas as faixas). */
export function setFeatureOff(routine: RoutineSite[], siteId: string, feature: string, off: boolean): RoutineSite[] {
  return routine.map((s) => {
    if (s.id !== siteId) return s;
    const list = (s.offFeatures ?? []).filter((f) => f !== feature);
    const next: RoutineSite = { ...s };
    if (off) next.offFeatures = [...list, feature];
    else if (list.length) next.offFeatures = list;
    else delete next.offFeatures;
    return next;
  });
}

/** Pausa (`off`) ou retoma uma faixa até a pessoa religar. */
export function setSlotOff(routine: RoutineSite[], siteId: string, slotId: string, off: boolean): RoutineSite[] {
  return routine.map((s) => s.id !== siteId ? s : {
    ...s,
    slots: s.slots.map((sl) => {
      if (sl.id !== slotId) return sl;
      const next: RoutineSlot = { ...sl };
      if (off) next.off = true;
      else delete next.off;
      return next;
    }),
  });
}

/**
 * Pausar `target` (o app, ou uma faixa dele) tira alguma proteção que vale AGORA? Só então vale pedir fricção.
 * App inteiro: qualquer regra da rotina ou limite estourado dele. Faixa: ela estar valendo neste instante.
 */
export function protectsNow(
  routine: RoutineSite[], enabled: boolean, now: number, usage: UsageData, releases: Release[], target: { domain: string; slotId?: string; feature?: string },
): boolean {
  if (releases.some((r) => r.until > now && r.slotId === undefined && r.domain === target.domain)) return false; // já pausado
  const mine = (rules: Rule[]) => rules.filter((r) => r.domain === target.domain);
  if (target.slotId === undefined && target.feature === undefined) return mine(mergeRules(activeRules(routine, enabled, now, releases), limitRules(routine, usage, now))).length > 0;
  const paused = [...releases, { ...target, until: now + 60_000 }];
  return JSON.stringify(mine(activeRules(routine, enabled, now, releases))) !== JSON.stringify(mine(activeRules(routine, enabled, now, paused)));
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
  return reshapeFeature(site, slotId, feature, times, newId);
}

/**
 * Muda dias e/ou horário SÓ do recurso `feature` na faixa `slotId` (o que o editor por recurso grava). Se a faixa
 * escondia outros recursos, ele é separado numa faixa própria e a original continua igual para os demais.
 */
export function reshapeFeature(
  site: RoutineSite, slotId: string, feature: string, patch: Partial<Times & { days: number[] }>, newId: () => string,
): RoutineSite {
  const slot = site.slots.find((s) => s.id === slotId);
  if (!slot) return site;
  const features = [...featuresOf(slot)];
  if (features.length <= 1) return { ...site, slots: site.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)) };
  const rest = features.filter((f) => f !== feature);
  const detached = newFeatureSlot(
    site, feature, patch.days ?? slot.days, { startMin: patch.startMin ?? slot.startMin, endMin: patch.endMin ?? slot.endMin }, newId,
  );
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
