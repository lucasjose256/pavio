import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { accessDomains } from '../../core/blocking';
import { normalizeDomain } from '../../core/matching';
import type { Release, RestrictionSpec, RoutineSite, RoutineSlot, Strictness } from '../../core/models';
import { addPause, pauseUntil, pausedUntil, removePause, type PauseTarget } from '../../core/release';
import { DAY_PRESETS, dayPresetOf, toggleDay } from '../../core/day-presets';
import { FeatureEditor, type FeatureDraft } from './FeatureEditor';
import { PauseModal, type PauseAnswer } from './PauseModal';
import { frictionForRelease } from '../../core/friction';
import { FrictionGate } from '../shared/FrictionGate';
import { randomId } from '../../core/ports';
import { activeRules, dropFeature, featureSlotsOf, isBlockedAll, loosensNow, newFeatureSlot, nextBoundary, reshapeFeature, retimeFeature, protectsNow, rulesAnyTime, serviceOf, setBlockAll, setFeatureOff, setLimit, setSlotOff, validateSlot } from '../../core/routine';
import { isValidLimit, limitStatuses, MAX_LIMIT_MIN, type UsageData } from '../../core/usage';
import { ROUTINE_SUGGESTIONS, SLOT_PRESETS, defaultRoutine } from '../../core/routine-defaults';
import { FEATURE_DEFS, featuresOf } from '../../core/restrictions';
import { MINUTES_PER_DAY, SNAP_MIN, formatMinutes, gapsBetween, layoutLanes, moveSlot, parseTime, resizeSlot, segmentsForDay, slotDurationMin, snapMinute, suggestFreeTime } from '../../core/timeslots';
import { ensureHostAccess } from '../../platform/chrome/permissions';
import { featureLabel, pauseUi } from '../i18n/pt-BR';
import { DAY_SHORT, WEEK_ORDER, formatDays, formatRange, formatWhen } from '../shared/format';
import { SiteIcon } from '../shared/SiteIcon';
import { RestrictionPicker } from './RestrictionPicker';
import { missingAccess } from './access';
import { services } from './shared';

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string };

/** Faixa em edição: o "o que fazer" começa SEM escolha (a pessoa decide). `siteId` ausente = site novo. */
type DraftSlot = Omit<RoutineSlot, keyof RestrictionSpec> & Partial<RestrictionSpec>;
interface Draft {
  domain: string;
  siteId?: string;
  isNewSlot: boolean;
  slot: DraftSlot;
  /** Outros horários no mesmo dia (mesmos dias e mesma ação): viram faixas próprias ao salvar. */
  extra?: { id: string; startMin: number; endMin: number }[];
}

const WEEKDAYS = [1, 2, 3, 4, 5];

/** Com os horários desligados só o bloqueio rápido vale: as faixas não pedem permissão. */
const effectiveSites = (sites: RoutineSite[], enabled: boolean): RoutineSite[] => (enabled ? sites : sites.map((s) => ({ ...s, slots: [] })));
const DRAG_THRESHOLD_PX = 4;

/** Gesto em andamento na linha do tempo de um site. */
type Drag =
  | { kind: 'resize'; siteId: string; feature?: string; slotId: string; edge: 'start' | 'end'; startX: number; moved: boolean }
  | { kind: 'move'; siteId: string; feature?: string; slotId: string; grabMin: number; startX: number; moved: boolean }
  | { kind: 'create'; siteId: string; feature?: string; fromMin: number; startX: number; moved: boolean };

/** Horário provisório mostrado enquanto se arrasta (`slotId` ausente = faixa nova sendo desenhada). */
interface Ghost { siteId: string; feature?: string; slotId?: string; startMin: number; endMin: number }
/** Hora do dia (HH:MM) de um instante. */
const clock = (ts: number) => formatMinutes(new Date(ts).getHours() * 60 + new Date(ts).getMinutes());
/** "15:30", ou "o fim do dia" quando a pausa acaba à meia-noite. */
const untilText = (ts: number) => (new Date(ts).getHours() === 0 && new Date(ts).getMinutes() === 0 ? pauseUi.endOfDay : clock(ts));
const slotErrorText = (code: string): string =>
  ({
    'days:empty': 'Escolha ao menos um dia.',
    'time:same': 'O início e o fim não podem ser iguais.',
    'time:range': 'Horário inválido.',
    'kind:missing': 'Escolha como restringir.',
    'mode:invalid': 'Escolha o que fazer com o site: Bloqueado ou Restrito.',
  })[code] ?? 'Faixa inválida.';

/** Rótulo curto do que a faixa faz. */
function slotLabel(slot: RoutineSlot): string {
  if (slot.mode === 'blocked') return 'Bloqueado';
  const kind = slot.restrictedKind;
  if (!kind || kind === 'intent') return 'Intenção';
  const labels = [...featuresOf(slot)].map((f) => featureLabel[kind]?.[f] ?? f);
  if (labels.length === 0) return 'Nada escondido';
  return labels.length <= 2 ? `Esconde: ${labels.join(', ')}` : `Esconde ${labels.length} partes`;
}

/** As três telas de bloqueio dividem o mesmo estado (e o mesmo `commit`): horários, bloqueio rápido e limite de tempo. */
export type RoutineView = 'schedule' | 'quick' | 'limits';

export function RoutineTab({ active, view }: { active: boolean; view: RoutineView }) {
  const [sites, setSites] = useState<RoutineSite[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [day, setDay] = useState(new Date().getDay());
  const [draft, setDraft] = useState<Draft>();
  const [notice, setNotice] = useState<Notice>();
  const [missing, setMissing] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [quickDomain, setQuickDomain] = useState('');
  const [usage, setUsage] = useState<UsageData>({});
  const [friction, setFriction] = useState<Strictness>('light');
  const [releases, setReleases] = useState<Release[]>([]);
  /** Janela "Pausar": o app inteiro ou uma faixa dele. */
  /** Editor de UM recurso (feed, Shorts…) aberto a partir da sub-linha dele. */
  const [featureDraft, setFeatureDraft] = useState<FeatureDraft>();
  const featureEditorRef = useRef<HTMLElement>(null);
  const [pausing, setPausing] = useState<{ site: RoutineSite; slot?: RoutineSlot; feature?: string }>();
  // Fricção de afrouxar (Leve: confirmar; Firme: frase), como uma pergunta que a função `commit` espera.
  const [gate, setGate] = useState<(ok: boolean) => void>();
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [limitDomain, setLimitDomain] = useState('');
  const [extraLimit, setExtraLimit] = useState<string[]>([]); // sites adicionados ao cartão antes de ter limite
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // sites com uma barra por recurso
  const [drag, setDrag] = useState<Drag>();
  const [ghost, setGhost] = useState<Ghost>();
  // O gesto também vive em referências: pointermove/up podem chegar antes de uma nova renderização.
  const dragRef = useRef<Drag | undefined>(undefined);
  const ghostRef = useRef<Ghost | undefined>(undefined);
  const setGesture = (d: Drag | undefined) => { dragRef.current = d; setDrag(d); };
  const setPreview = (g: Ghost | undefined) => { ghostRef.current = g; setGhost(g); };
  const editorRef = useRef<HTMLElement>(null);

  async function reload() {
    const [list, settings, used, paused] = await Promise.all([services.routine.list(), services.settings.get(), services.usage.get(), services.releases.list()]);
    setSites(list);
    setReleases(paused);
    setUsage(used);
    setFriction(settings.friction);
    setEnabled(settings.routineEnabled);
    setMissing(await missingAccess(accessDomains({ rules: rulesAnyTime(effectiveSites(list, settings.routineEnabled)) })));
  }

  useEffect(() => {
    void reload();
    const id = setInterval(() => setNow(Date.now()), 30_000);
    const onChange = (_: unknown, area: string) => area === 'local' && void reload();
    chrome.storage.onChanged.addListener(onChange);
    return () => { clearInterval(id); chrome.storage.onChanged.removeListener(onChange); };
  }, []);

  useEffect(() => { if (draft) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [draft?.domain, draft?.slot.id]);
  useEffect(() => { if (featureDraft) featureEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [featureDraft?.siteId, featureDraft?.feature, featureDraft?.slotId]);

  const today = new Date(now).getDay();
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const activeNow = useMemo(() => activeRules(sites, enabled, now), [sites, enabled, now]);
  const boundary = useMemo(() => nextBoundary(sites, enabled, now), [sites, enabled, now]);
  const unused = ROUTINE_SUGGESTIONS.filter((d) => !sites.some((s) => s.domain === d));

  /**
   * Aplica uma mudança. Pede confirmação se ela afrouxa algo que protege AGORA, e o acesso aos sites
   * (precisa do clique do usuário, por isso vem antes de gravar).
   */
  async function commit(nextSites: RoutineSite[], nextEnabled = enabled, okText = 'Rotina salva.', skipGate = false): Promise<boolean> {
    if (!skipGate && loosensNow({ sites, enabled }, { sites: nextSites, enabled: nextEnabled }, Date.now(), usage)
      && !(await new Promise<boolean>((resolve) => setGate(() => resolve)))) return false;
    const needed = accessDomains({ rules: rulesAnyTime(effectiveSites(nextSites, nextEnabled)) });
    const granted = needed.length ? await ensureHostAccess(needed) : true;
    await services.routine.save(nextSites);
    if (nextEnabled !== enabled) await services.settings.update({ routineEnabled: nextEnabled });
    await reload();
    setNotice(granted
      ? { kind: 'ok', text: okText }
      : { kind: 'warn', text: 'Salvo, mas sem acesso aos sites o bloqueio não funciona. Use "Conceder acesso".' });
    return true;
  }

  function openNew(site: RoutineSite, atMin?: number, endAt?: number, feature?: string) {
    // Sem gesto (botão "+"): sugere o primeiro horário livre do dia mostrado, para a faixa nova não nascer por cima de outra.
    const free = atMin === undefined ? suggestFreeTime(segmentsForDay(feature ? featureSlotsOf(site, feature) : site.slots, day)) : null;
    const start = atMin !== undefined ? Math.min(atMin, MINUTES_PER_DAY - 30) : free?.startMin ?? 9 * 60;
    const slot: DraftSlot = {
      id: randomId(),
      days: [day],
      startMin: start,
      endMin: endAt ?? free?.endMin ?? Math.min(start + 120, MINUTES_PER_DAY),
    };
    // Numa barra de recurso, abre o editor DAQUELE recurso (escondendo só ele).
    if (feature) {
      setDraft(undefined);
      setFeatureDraft({ siteId: site.id, feature, days: slot.days, startMin: slot.startMin, endMin: slot.endMin, extra: [] });
      setNotice(undefined);
      return;
    }
    setDraft({ domain: site.domain, siteId: site.id, isNewSlot: true, slot });
    setNotice(undefined);
  }

  /** Clique numa barra: do site abre o editor da faixa; de um recurso abre o editor dele (com os dias e o horário dessa faixa). */
  function editSegment(site: RoutineSite, slot: RoutineSlot, feature?: string) {
    if (!feature) return edit(site, slot);
    setDraft(undefined);
    setFeatureDraft({ siteId: site.id, feature, slotId: slot.id, days: [...slot.days], startMin: slot.startMin, endMin: slot.endMin, extra: [] });
    setNotice(undefined);
  }

  // Sempre parte do rascunho mais novo (dois eventos no mesmo instante não pisam um no outro).
  const featureRef = useRef<FeatureDraft | undefined>(undefined);
  featureRef.current = featureDraft;
  function mutateFeature(fn: (d: FeatureDraft) => FeatureDraft) {
    if (!featureRef.current) return;
    const next = fn(featureRef.current);
    featureRef.current = next;
    setFeatureDraft(next);
  }

  async function saveFeature() {
    const fd = featureDraft;
    const site = fd && sites.find((x) => x.id === fd.siteId);
    if (!fd || !site) return;
    const allDay = fd.startMin === 0 && fd.endMin === MINUTES_PER_DAY;
    const extras = allDay ? [] : fd.extra;
    const make = (r: { startMin: number; endMin: number }) => newFeatureSlot(site, fd.feature, fd.days, { startMin: r.startMin, endMin: r.endMin }, randomId);
    const errors = [...new Set([fd, ...extras].flatMap((r) => validateSlot(make(r))))];
    if (errors.length) return setNotice({ kind: 'error', text: errors.map(slotErrorText).join(' ') });
    const base = fd.slotId ? reshapeFeature(site, fd.slotId, fd.feature, { days: fd.days, startMin: fd.startMin, endMin: fd.endMin }, randomId) : { ...site, slots: [...site.slots, make(fd)] };
    const nextSite = { ...base, slots: [...base.slots, ...extras.map(make)] };
    if (await commit(sites.map((x) => (x.id === site.id ? nextSite : x)), enabled, extras.length ? `${extras.length + 1} horários salvos.` : 'Horário salvo.')) setFeatureDraft(undefined);
  }

  async function removeFeatureSlot() {
    const fd = featureDraft;
    const site = fd && sites.find((x) => x.id === fd.siteId);
    if (!fd || !site || !fd.slotId) return;
    if (await commit(sites.map((x) => (x.id === site.id ? dropFeature(site, fd.slotId!, fd.feature) : x)), enabled, 'Horário removido.')) setFeatureDraft(undefined);
  }

  function edit(site: RoutineSite, slot: RoutineSlot) {
    setDraft({ domain: site.domain, siteId: site.id, isNewSlot: false, slot: structuredClone(slot) });
    setNotice(undefined);
  }

  // ---- gestos na barra: arrastar pontas (início/fim), arrastar a faixa (mover), arrastar no vazio (criar) ----
  const minuteAt = (e: PointerEvent, track: HTMLElement) => {
    const rect = track.getBoundingClientRect();
    return Math.min(Math.max(((e.clientX - rect.left) / rect.width) * MINUTES_PER_DAY, 0), MINUTES_PER_DAY);
  };

  /** Começa um gesto; a barra captura o ponteiro para acompanhar o arraste mesmo fora dela. */
  function beginDrag(e: PointerEvent, next: Drag) {
    e.stopPropagation();
    e.preventDefault();
    const track = (e.currentTarget as HTMLElement).closest('.rt-track') as HTMLElement;
    track.setPointerCapture(e.pointerId);
    setGesture(next);
  }

  function onTrackDown(site: RoutineSite, e: PointerEvent, feature?: string) {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    beginDrag(e, { kind: 'create', siteId: site.id, feature, fromMin: minuteAt(e, e.currentTarget as HTMLElement), startX: e.clientX, moved: false });
  }

  function onTrackMove(site: RoutineSite, e: PointerEvent, feature?: string) {
    const current = dragRef.current;
    if (!current || current.siteId !== site.id || (current.feature ?? '') !== (feature ?? '')) return;
    const m = minuteAt(e, e.currentTarget as HTMLElement);
    if (!current.moved && Math.abs(e.clientX - current.startX) > DRAG_THRESHOLD_PX) setGesture({ ...current, moved: true });
    if (!dragRef.current?.moved) return;
    if (current.kind === 'create') {
      const [a, b] = [snapMinute(Math.min(current.fromMin, m)), snapMinute(Math.max(current.fromMin, m))];
      return setPreview({ siteId: site.id, feature, startMin: a, endMin: Math.max(b, a + SNAP_MIN) });
    }
    const slot = site.slots.find((s) => s.id === current.slotId);
    if (!slot) return;
    const times = current.kind === 'resize' ? resizeSlot(slot, current.edge, m) : moveSlot(slot, m - current.grabMin);
    if (times) setPreview({ siteId: site.id, feature, slotId: slot.id, ...times });
  }

  async function onTrackUp(site: RoutineSite, feature?: string) {
    const current = dragRef.current;
    const preview = ghostRef.current;
    setGesture(undefined);
    setPreview(undefined);
    if (!current || current.siteId !== site.id || (current.feature ?? '') !== (feature ?? '')) return;
    const slot = 'slotId' in current ? site.slots.find((s) => s.id === current.slotId) : undefined;

    if (!current.moved) {
      if (current.kind === 'move' && slot) editSegment(site, slot, feature); // clique simples na faixa: abre o editor
      if (current.kind === 'create') openNew(site, Math.round(current.fromMin / 30) * 30, undefined, feature); // clique no vazio: faixa de 2 h
      return;
    }
    if (!preview) return;
    if (current.kind === 'create') return openNew(site, preview.startMin, preview.endMin, feature);
    if (!slot || (preview.startMin === slot.startMin && preview.endMin === slot.endMin)) return;
    const times = { startMin: preview.startMin, endMin: preview.endMin };
    // Numa barra de recurso, só aquele recurso muda (se a faixa tinha outros, ele é separado numa faixa própria).
    const nextSite: RoutineSite = current.feature
      ? retimeFeature(site, slot.id, current.feature, times, randomId)
      : { ...site, slots: site.slots.map((x) => x.id === slot.id ? { ...x, ...times } : x) };
    await commit(sites.map((s) => s.id === site.id ? nextSite : s), enabled, `Horário ajustado: ${formatRange(preview)}.`);
  }

  function addSite(input: string) {
    const domain = normalizeDomain(input);
    if (!domain) return setNotice({ kind: 'error', text: 'Esse endereço não parece um site válido (ex.: reddit.com).' });
    const existing = sites.find((s) => s.domain === domain);
    if (existing) return openNew(existing);
    setDraft({ domain, isNewSlot: true, slot: { id: randomId(), days: WEEKDAYS, startMin: 9 * 60, endMin: 18 * 60 } });
    setNewDomain('');
    setNotice(undefined);
  }

  // Sempre parte do rascunho mais novo (dois eventos no mesmo instante não pisam um no outro).
  const draftRef = useRef<Draft | undefined>(undefined);
  draftRef.current = draft;
  function mutateDraft(fn: (d: Draft) => Draft) {
    if (!draftRef.current) return;
    const next = fn(draftRef.current);
    draftRef.current = next;
    setDraft(next);
  }
  const patch = (p: Partial<RoutineSlot>) => mutateDraft((d) => ({ ...d, slot: { ...d.slot, ...p } }));

  async function saveDraft(andAddAnother = false) {
    if (!draft) return;
    const errors = draft.slot.mode ? validateSlot(draft.slot as RoutineSlot) : ['mode:invalid'];
    if (errors.length) return setNotice({ kind: 'error', text: errors.map(slotErrorText).join(' ') });
    const saving = draft.slot as RoutineSlot;
    // Horários extras do mesmo dia: cada um vira uma faixa com os mesmos dias e a mesma ação (ignorados com "dia todo").
    const extras = draft.slot.startMin === 0 && draft.slot.endMin === MINUTES_PER_DAY ? [] : (draft.extra ?? []);
    const extraSlots: RoutineSlot[] = extras.map((r) => ({ ...saving, id: randomId(), startMin: r.startMin, endMin: r.endMin }));
    const extraErrors = extraSlots.flatMap((sl) => validateSlot(sl));
    if (extraErrors.length) return setNotice({ kind: 'error', text: [...new Set(extraErrors)].map(slotErrorText).join(' ') });
    const next = draft.siteId
      ? sites.map((s) => s.id !== draft.siteId ? s : {
        ...s,
        slots: draft.isNewSlot
          ? [...s.slots, saving, ...extraSlots]
          : [...s.slots.map((x) => x.id === saving.id ? saving : x), ...extraSlots],
      })
      : [...sites, { id: randomId(), domain: draft.domain, enabled: true, slots: [saving, ...extraSlots] }];
    if (!(await commit(next, enabled, extraSlots.length ? `${extraSlots.length + 1} horários salvos.` : 'Faixa salva.'))) return;
    setDraft(undefined);
    const saved = next.find((x) => x.domain === draft.domain);
    if (andAddAnother && saved) openNew(saved); // abre já a próxima, num horário livre
  }

  /** Copia a faixa em edição como um rascunho novo (para a mesma coisa em outros dias ou horários). */
  function duplicateDraft() {
    if (draft) setDraft({ ...draft, isNewSlot: true, slot: { ...structuredClone(draft.slot), id: randomId() } });
    setNotice(undefined);
  }

  async function deleteSlot() {
    if (!draft?.siteId || draft.isNewSlot) return;
    const next = sites.map((s) => s.id !== draft.siteId ? s : { ...s, slots: s.slots.filter((x) => x.id !== draft.slot.id) });
    if (await commit(next, enabled, 'Faixa apagada.')) setDraft(undefined);
  }

  // ---- bloqueio rápido: o app inteiro, sempre ----
  const quickDomains = [...new Set([...ROUTINE_SUGGESTIONS, ...sites.map((x) => x.domain)])];
  const quickBlocked = quickDomains.filter((d) => isBlockedAll(sites, d));
  const toggleQuick = (domain: string) => {
    const on = !isBlockedAll(sites, domain);
    return commit(setBlockAll(sites, domain, on, randomId), enabled, on ? `${domain} bloqueado por inteiro.` : `${domain} liberado.`);
  };
  const setAllQuick = (on: boolean) =>
    commit(quickDomains.reduce((acc, d) => setBlockAll(acc, d, on, randomId), sites), enabled, on ? 'Todos os apps bloqueados.' : 'Todos os apps liberados.');
  function quickAdd(input: string) {
    const domain = normalizeDomain(input);
    if (!domain) return setNotice({ kind: 'error', text: 'Esse endereço não parece um site válido (ex.: reddit.com).' });
    setQuickDomain('');
    return commit(setBlockAll(sites, domain, true, randomId), enabled, `${domain} bloqueado por inteiro.`);
  }

  const limitDomains = [...new Set([...ROUTINE_SUGGESTIONS, ...sites.filter((s) => s.limitMin).map((s) => s.domain), ...extraLimit])];
  const limitStatus = (d: string) => limitStatuses(sites, usage, now).find((s) => s.domain === d);
  async function saveLimit(domain: string, raw: string) {
    const n = Number(raw.trim());
    if (!isValidLimit(n)) { setNotice({ kind: 'error', text: `O limite vai de 1 a ${MAX_LIMIT_MIN} minutos por dia.` }); return; }
    if (await commit(setLimit(sites, domain, n, randomId), enabled, `Limite de ${domain}: ${n} min por dia.`)) setLimitInputs((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== domain)));
  }
  const removeLimit = (domain: string) => commit(setLimit(sites, domain, undefined, randomId), enabled, `Limite de ${domain} removido.`);
  async function addLimitSite(input: string) {
    const domain = normalizeDomain(input);
    if (!domain) { setNotice({ kind: 'error', text: 'Escreva um site, como twitch.tv.' }); return; }
    setLimitDomain('');
    setLimitInputs((m) => ({ ...m, [domain]: m[domain] ?? '30' }));
    if (!limitDomains.includes(domain)) setExtraLimit((x) => [...new Set([...x, domain])]);
  }
  /** Desligar abre a janela "Pausar" (5/15/30 min, fim do dia ou até religar); ligar religa e tira qualquer pausa. */
  async function toggleSite(site: RoutineSite) {
    if (site.enabled) return setPausing({ site });
    await services.releases.save(removePause(await services.releases.list(), { domain: site.domain }));
    await commit(sites.map((s) => s.id === site.id ? { ...s, enabled: true } : s), enabled, 'Site ligado na rotina.');
  }
  const gateNeeded = (t: PauseTarget) => protectsNow(sites, enabled, Date.now(), usage, releases, t);

  async function applyPause(answer: PauseAnswer) {
    if (!pausing) return;
    const { site, slot, feature } = pausing;
    const target: PauseTarget = { domain: site.domain, ...(slot ? { slotId: slot.id } : {}), ...(feature ? { feature } : {}) };
    const service = serviceOf(site);
    const featureName = feature && service ? (featureLabel[service]?.[feature] ?? feature) : '';
    const what = feature ? `${featureName} em ${site.domain}` : slot ? `a faixa ${formatRange(slot)} de ${site.domain}` : site.domain;
    if (answer.kind === 'manual') {
      // Pausa sem prazo: a fricção já foi feita na janela, então não pergunta de novo.
      const next = feature ? setFeatureOff(sites, site.id, feature, true)
        : slot ? setSlotOff(sites, site.id, slot.id, true)
          : sites.map((s) => s.id === site.id ? { ...s, enabled: false } : s);
      const text = feature ? `${featureName} pausado. Retome quando quiser.` : slot ? 'Faixa pausada. Retome quando quiser.' : 'Site desligado na rotina.';
      if (await commit(next, enabled, text, true)) setPausing(undefined);
      return;
    }
    const now = Date.now();
    const until = pauseUntil(answer, now);
    await services.releases.save(addPause(await services.releases.list(), target, until, now));
    await reload();
    setPausing(undefined);
    setNotice({ kind: 'ok', text: pauseUi.inPause(what, untilText(until)) });
  }
  async function resume(site: RoutineSite, slot?: RoutineSlot, feature?: string) {
    const target: PauseTarget = { domain: site.domain, ...(slot ? { slotId: slot.id } : {}), ...(feature ? { feature } : {}) };
    await services.releases.save(removePause(await services.releases.list(), target));
    if (feature && site.offFeatures?.includes(feature)) await commit(setFeatureOff(sites, site.id, feature, false), enabled, 'Recurso retomado.', true);
    else if (slot?.off) await commit(setSlotOff(sites, site.id, slot.id, false), enabled, 'Faixa retomada.', true);
    else { await reload(); setNotice({ kind: 'ok', text: feature ? 'Recurso retomado.' : slot ? 'Faixa retomada.' : `${site.domain} retomado.` }); }
  }
  const removeSite = (site: RoutineSite) => confirm(`Tirar ${site.domain} da rotina?`) && commit(sites.filter((s) => s.id !== site.id), enabled, 'Site removido.');
  const clearRoutine = () => confirm('Limpar a rotina? Todos os sites, faixas e bloqueios rápidos serão removidos.') && commit(defaultRoutine(), enabled, 'Rotina limpa.');
  const grantAccess = async () => {
    await ensureHostAccess(missing);
    await reload();
  };

  const draftSite = draft?.siteId ? sites.find((x) => x.id === draft.siteId) : undefined;
  const draftSlot = draftSite?.slots.find((sl) => sl.id === draft?.slot.id);
  const allDay = !!draft && draft.slot.startMin === 0 && draft.slot.endMin === MINUTES_PER_DAY;
  const directNow = sites.filter((x) => x.enabled && x.blockAll).map((x) => x.domain);
  const byHour = activeNow.map((r) => r.domain).filter((d) => !directNow.includes(d));
  const parts = [
    directNow.length ? `bloqueados por inteiro: ${directNow.join(', ')}` : '',
    byHour.length ? `pelos horários: ${byHour.join(', ')}${boundary ? ` (muda ${formatWhen(boundary, now)})` : ''}` : '',
  ].filter(Boolean);
  const status = parts.length
    ? `Protegendo agora → ${parts.join(' · ')}.`
    : !enabled
      ? 'Os horários estão desligados: só o bloqueio rápido vale.'
      : boundary
        ? `Livre agora. Próxima proteção: ${formatWhen(boundary, now)}.`
        : 'Nada bloqueado. Use o bloqueio rápido ou desenhe faixas abaixo.';

  /**
   * Barra de 24 h de um site (ou, com `feature`, de um recurso dele): faixas com alças, rascunho e linha do "agora".
   * `slots` são as faixas desenhadas nesta barra.
   */
  function renderTrack(site: RoutineSite, slots: RoutineSlot[], feature?: string) {
    const lane = feature ?? '';
    const here = (g?: { siteId: string; feature?: string }) => !!g && g.siteId === site.id && (g.feature ?? '') === lane;
    const ghostHere = here(ghost) ? ghost : undefined;
    const draftHere = draft?.isNewSlot && draft.siteId === site.id && (!feature || featuresOf(draft.slot).has(feature)) ? draft : undefined;
    const pct = (a: number, b: number) => ({ left: `${(a / MINUTES_PER_DAY) * 100}%`, width: `${((b - a) / MINUTES_PER_DAY) * 100}%` });

    // Faixas que se cruzam ficam em pistas empilhadas: nenhuma cobre a outra.
    const placed = layoutLanes(segmentsForDay(slots.map((sl) => ghostHere?.slotId === sl.id ? { ...sl, startMin: ghostHere.startMin, endMin: ghostHere.endMin } : sl), day));
    const unit = feature ? 24 : 32; // altura da faixa quando há uma só pista
    const laneH = placed.lanes === 1 ? unit : Math.max(14, Math.floor((unit * 1.7) / placed.lanes));
    const trackH = placed.lanes === 1 ? unit + 8 : placed.lanes * (laneH + 3) + 5;

    // App bloqueado por inteiro: barra cheia, sem faixas para mexer.
    if (!feature && site.blockAll && site.enabled) {
      return (
        <div class="rt-track locked" title="Bloqueio rápido: o app inteiro, o tempo todo (desligue no painel de Bloqueio rápido)">
          <div class="rt-seg m-blocked all" style={{ left: 0, width: '100%' }}><span>🔒 Bloqueado o tempo todo</span></div>
        </div>
      );
    }

    return (
      <div class="rt-track" style={{ height: `${trackH}px` }} title="Arraste num espaço vazio para criar uma faixa; clique para uma de 2 h"
        onPointerDown={(e) => onTrackDown(site, e, feature)} onPointerMove={(e) => onTrackMove(site, e, feature)}
        onPointerUp={() => void onTrackUp(site, feature)} onPointerCancel={() => { setGesture(undefined); setPreview(undefined); }}>
        {placed.items.map((seg) => {
          const slot = slots.find((sl) => sl.id === seg.slotId)!;
          const dragging = here(drag) && !!drag && 'slotId' in drag && drag.slotId === slot.id && drag.moved;
          const shown = ghostHere?.slotId === slot.id ? { ...slot, startMin: ghostHere.startMin, endMin: ghostHere.endMin } : slot;
          const slotPause = pausedUntil(releases, { domain: site.domain, slotId: slot.id }, now);
          const featurePaused = !!feature && (!!site.offFeatures?.includes(feature) || pausedUntil(releases, { domain: site.domain, feature }, now) !== undefined);
          const isPaused = !!slot.off || slotPause !== undefined || featurePaused;
          const canStart = seg.part !== 'tail';
          const canEnd = seg.part !== 'head';
          const canMove = seg.part === 'whole' && !(slot.startMin === 0 && slot.endMin === MINUTES_PER_DAY);
          const handle = (edge: 'start' | 'end') => (e: PointerEvent) =>
            beginDrag(e, { kind: 'resize', siteId: site.id, feature, slotId: slot.id, edge, startX: e.clientX, moved: false });
          return (
            <div key={`${seg.slotId}-${seg.part}`} class={`rt-seg m-${slot.mode} ${isPaused ? 'paused' : ''} ${canMove ? 'movable' : ''} ${dragging ? 'dragging' : ''} ${seg.lane % 2 ? 'alt' : ''}`}
              style={{ ...pct(seg.startMin, seg.endMin), top: `${4 + seg.lane * (laneH + 3)}px`, height: `${laneH}px`, bottom: 'auto' }}
              title={`${site.domain} · ${slotLabel(slot)} · ${formatRange(shown)} (clique para editar; arraste para mover; arraste as pontas para ajustar)`}
              role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && editSegment(site, slot, feature)}
              onPointerDown={(e) => canMove
                ? beginDrag(e, { kind: 'move', siteId: site.id, feature, slotId: slot.id, grabMin: minuteAt(e, (e.currentTarget as HTMLElement).closest('.rt-track') as HTMLElement), startX: e.clientX, moved: false })
                : (e.stopPropagation(), editSegment(site, slot, feature))}>
              {canStart && <i class="rt-handle start" aria-hidden="true" onPointerDown={handle('start')} />}
              <span>{dragging ? formatRange(shown) : isPaused ? `⏸ ${slot.off || featurePaused ? pauseUi.slotOff : pauseUi.pausedUntil(untilText(slotPause!))}` : feature ? 'Escondido' : slotLabel(slot)}</span>
              {canEnd && <i class="rt-handle end" aria-hidden="true" onPointerDown={handle('end')} />}
            </div>
          );
        })}
        {ghostHere && !ghostHere.slotId && (
          <div class="rt-seg ghost" style={pct(ghostHere.startMin, ghostHere.endMin)}><span>{formatRange(ghostHere)}</span></div>
        )}
        {draftHere && segmentsForDay([draftHere.slot], day).map((seg) => (
          <div key={`draft-${seg.part}`} class="rt-seg ghost" style={pct(seg.startMin, seg.endMin)}><span>Nova faixa</span></div>
        ))}
        {day === today && <i class="rt-now" style={{ left: `${(nowMin / MINUTES_PER_DAY) * 100}%` }} />}
      </div>
    );
  }

  return (
    <main class="pane" hidden={!active}>
      {pausing && (
        <PauseModal
          title={pausing.feature
            ? pauseUi.titleFeature(featureLabel[serviceOf(pausing.site) ?? '']?.[pausing.feature] ?? pausing.feature, pausing.site.domain)
            : pausing.slot ? pauseUi.titleSlot(pausing.site.domain, formatRange(pausing.slot)) : pauseUi.titleSite(pausing.site.domain)}
          needsGate={gateNeeded({ domain: pausing.site.domain, ...(pausing.slot ? { slotId: pausing.slot.id } : {}), ...(pausing.feature ? { feature: pausing.feature } : {}) })} level={friction}
          onChoose={applyPause} onCancel={() => setPausing(undefined)} />
      )}
      {gate && (
        <div class="modal" role="dialog" aria-modal="true" aria-label="Afrouxar uma regra ativa">
          <div class="modal-card">
            <h3>Isso afrouxa uma regra que está protegendo agora</h3>
            <p class="hint">{friction === 'light' ? 'Tem certeza? Se precisar só por um tempo, use "Precisa dele agora?" na tela de bloqueio.' : 'Você escolheu a fricção Firme. Se precisar só por um tempo, use "Precisa dele agora?" na tela de bloqueio.'}</p>
            <FrictionGate steps={frictionForRelease(friction)} action="Afrouxar mesmo assim" cancelLabel="Manter como está"
              onDone={() => { gate(true); setGate(undefined); }} onCancel={() => { gate(false); setGate(undefined); }} />
          </div>
        </div>
      )}

      {view === 'schedule' && (
      <section class="card status">
        <div class="grow">
          <h2 class="section-title">Horários</h2>
          <p class="section-sub">Escolha, para cada site, em quais dias e horas ele fica bloqueado ou com partes escondidas. Funciona sozinho, sem acender a vela.</p>
          <p class={`status-line ${enabled && activeNow.length ? 'on' : ''}`} role="status">{status}</p>
        </div>
        <label class="master" title="Liga ou desliga as faixas de horário (o bloqueio rápido continua valendo)">
          <span class="switch"><input type="checkbox" checked={enabled} onChange={() => commit(sites, !enabled, enabled ? 'Horários desligados.' : 'Horários ligados.')} aria-label="Horários ligados" /><span /></span>
          <strong>Horários {enabled ? 'ligados' : 'desligados'}</strong>
        </label>
      </section>
      )}

      {view === 'quick' && (
      <section class="card quick" aria-label="Bloqueio rápido">
        <div class="quick-head">
          <div class="grow">
            <h2 class="section-title">Bloqueio rápido</h2>
            <p class="section-sub">Bloqueia o app <strong>inteiro</strong>, o tempo todo, com um clique. Clique de novo para liberar. Vale mesmo com os horários desligados.</p>
          </div>
          <div class="quick-actions">
            <button class="btn" onClick={() => setAllQuick(true)} disabled={quickBlocked.length === quickDomains.length}>Bloquear todos</button>
            <button class="btn btn-ghost" onClick={() => setAllQuick(false)} disabled={quickBlocked.length === 0}>Liberar todos</button>
          </div>
        </div>
        <div class="tiles">
          {quickDomains.map((d) => {
            const on = isBlockedAll(sites, d);
            return (
              <button key={d} class={`tile ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleQuick(d)} title={on ? `Liberar ${d}` : `Bloquear ${d} por inteiro`}>
                <span class="tile-name"><SiteIcon domain={d} /> {d}</span>
                <strong>{on ? '🔒 Bloqueado' : 'Bloquear'}</strong>
              </button>
            );
          })}
        </div>
        <form class="add" onSubmit={(e) => { e.preventDefault(); void quickAdd(quickDomain); }}>
          <input class="field grow" placeholder="Bloquear outro site por inteiro (ex.: twitch.tv)" value={quickDomain} aria-label="Outro site para bloquear" onInput={(e) => setQuickDomain(e.currentTarget.value)} />
          <button class="btn" type="submit">Bloquear</button>
        </form>
      </section>
      )}

      {view === 'limits' && (
      <section class="card limits" aria-label="Limite de tempo">
        <div class="grow">
          <h2 class="section-title">Limite de tempo</h2>
          <p class="section-sub">Quantos minutos por dia você aceita gastar em cada app. Conta só com a aba ativa e a janela em foco. Estourou, o app fica bloqueado até a meia-noite; se precisar, a tela de bloqueio deixa <strong>liberar por um tempo</strong>.</p>
        </div>
        <ul class="limit-list">
          {limitDomains.map((d) => {
            const st = limitStatus(d);
            const raw = limitInputs[d] ?? (st ? String(st.limitMin) : '');
            const pct = st ? Math.min(100, (st.usedMs / Math.max(1, st.limitMs)) * 100) : 0;
            return (
              <li key={d} class={`limit-row ${st?.reached ? 'reached' : ''}`}>
                <span class="limit-name"><SiteIcon domain={d} /> {d}</span>
                {st ? (
                  <span class="limit-meter" title={`${Math.floor(st.usedMs / 60_000)} de ${st.limitMs / 60_000} min hoje`}>
                    <span class="limit-bar"><i style={{ width: `${pct}%` }} /></span>
                    <span class="limit-text">{st.reached ? 'Limite de hoje atingido' : `${Math.floor(st.usedMs / 60_000)} de ${st.limitMs / 60_000} min`}</span>
                  </span>
                ) : <span class="limit-text muted">Sem limite</span>}
                <form class="limit-form" onSubmit={(e) => { e.preventDefault(); void saveLimit(d, raw); }}>
                  <input class="field limit-input" type="number" inputMode="numeric" min={1} max={MAX_LIMIT_MIN} placeholder="min/dia" value={raw} aria-label={`Limite diário de ${d} em minutos`}
                    onInput={(e) => setLimitInputs((m) => ({ ...m, [d]: e.currentTarget.value }))} />
                  <button class="btn" type="submit" disabled={!raw || (!!st && raw === String(st.limitMin))}>{st ? 'Atualizar' : 'Definir'}</button>
                  {st && <button class="btn btn-ghost" type="button" onClick={() => removeLimit(d)}>Remover</button>}
                </form>
              </li>
            );
          })}
        </ul>
        <form class="add" onSubmit={(e) => { e.preventDefault(); void addLimitSite(limitDomain); }}>
          <input class="field grow" placeholder="Limitar outro site (ex.: twitch.tv)" value={limitDomain} aria-label="Outro site para limitar" onInput={(e) => setLimitDomain(e.currentTarget.value)} />
          <button class="btn" type="submit">Adicionar</button>
        </form>
      </section>
      )}

      {view === 'schedule' && !enabled && (
        <p class="notice warn onboarding">
          <span>Os <strong>horários estão desligados</strong>: as faixas abaixo não valem até você ligá-los. O bloqueio rápido continua funcionando.</span>
          <button class="btn btn-primary" onClick={() => commit(sites, true, 'Horários ligados.')}>Ligar os horários</button>
        </p>
      )}
      {(enabled || view !== 'schedule') && missing.length > 0 && (
        <p class="notice warn onboarding">
          <span>O Chrome ainda não deu acesso a <strong>{missing.join(', ')}</strong>. Sem isso, o bloqueio desses sites não funciona.</span>
          <button class="btn btn-primary" onClick={grantAccess}>Conceder acesso</button>
        </p>
      )}
      {notice && !draft && !featureDraft && <p class={`notice ${notice.kind}`} role="status">{notice.text}</p>}

      {view === 'schedule' && (<>
      <section class="card">
        <div class="day-bar" role="tablist" aria-label="Dia da semana">
          {WEEK_ORDER.map((d) => (
            <button key={d} role="tab" class={`daytab ${day === d ? 'on' : ''}`} aria-selected={day === d} onClick={() => setDay(d)}>
              {DAY_SHORT[d]}{d === today && <i class="today-dot" title="Hoje" />}
            </button>
          ))}
        </div>

        <div class="howto" aria-label="Como montar sua rotina">
          <h3>Como montar sua rotina</h3>
          <ol>
            <li><strong>Crie uma faixa:</strong> arraste num espaço vazio da linha do site (ou clique no <strong>+</strong>). A hora da faixa é a que você desenhou.</li>
            <li><strong>Escolha os dias e o que fazer:</strong> na janela que abre, marque <em>Dias úteis</em>, <em>Fim de semana</em> ou só um dia, e escolha bloquear ou esconder partes. Quer <em>intervalos</em> no mesmo dia (9h–12h e 14h–18h)? Use <strong>+ Adicionar outro horário</strong>. Salve.</li>
            <li><strong>Ajuste quando quiser:</strong> arraste as <strong>pontas</strong> para mudar início e fim, ou a <strong>faixa</strong> para movê-la. Clique nela para editar, pausar ou apagar.</li>
          </ol>
          <p class="hint">As abas <strong>Seg…Dom</strong> mostram o que vale em cada dia. A seta <strong>▸</strong> ao lado de YouTube, Instagram, X ou LinkedIn dá horários diferentes a cada recurso: arraste na barra do recurso <em>ou</em> clique nela (ou no <strong>+</strong>) para digitar dias e horário. Encaixa de 15 em 15 min; faixas que se cruzam ficam empilhadas e vale a mais rigorosa.</p>
        </div>
        <ul class="rt-legend" aria-label="Legenda de cores">
          <li><i class="dot m-blocked" /> Bloqueado</li>
          <li><i class="dot m-restricted" /> Restrito (esconde partes ou pergunta a intenção)</li>
          <li><i class="swatch-ghost" /> Rascunho (ainda não salvo)</li>
        </ul>
        <div class="rt" aria-label={`Rotina de ${DAY_SHORT[day]}`}>
          <div class="rt-axis" aria-hidden="true">
            <span />
            <div>{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <b key={h} style={{ left: `${(h / 24) * 100}%` }}>{h}</b>)}</div>
            <span />
          </div>
          {sites.length === 0 && <p class="empty">Nenhum horário ainda. Adicione um site abaixo e desenhe quando ele deve ficar bloqueado ou com partes escondidas.</p>}
          {sites.map((site) => {
            const service = serviceOf(site);
            const locked = !!site.blockAll && site.enabled;
            const sitePause = site.enabled ? pausedUntil(releases, { domain: site.domain }, now) : undefined;
            const open = !!service && !locked && expanded.has(site.id);
            return (
              <div key={site.id} class="rt-group">
                <div class={`rt-row ${site.enabled ? '' : 'off'}`}>
                  <div class="rt-label">
                    <div class="rt-name">
                      {(!service || locked) && <span class="rt-expander-spacer" aria-hidden="true" />}
                      {service && !locked && (
                        <button class="rt-expander" aria-expanded={open} aria-label={`${open ? 'Recolher' : 'Expandir'} os recursos de ${site.domain}`}
                          title="Horário separado para cada recurso (feed, Shorts, recomendados…)"
                          onClick={() => setExpanded((cur) => { const n = new Set(cur); if (!n.delete(site.id)) n.add(site.id); return n; })}>{open ? '▾' : '▸'}</button>
                      )}
                      <button class="rt-site" onClick={() => openNew(site)} title="Adicionar uma faixa neste site"><SiteIcon domain={site.domain} /> {site.domain}</button>
                    </div>
                    {sitePause !== undefined
                      ? <span class="rt-paused-note">⏸ {pauseUi.pausedUntil(untilText(sitePause))} <button class="link" onClick={() => void resume(site)}>{pauseUi.resume}</button></span>
                      : locked ? <small>bloqueio rápido</small> : site.slots.length === 0 && <small>sem faixas</small>}
                  </div>
                  {renderTrack(site, site.slots)}
                  <div class="rt-actions">
                    <button class="rt-plus" aria-label={`Adicionar uma faixa em ${site.domain}`} title="Adicionar outra faixa neste site" onClick={() => openNew(site)}>+</button>
                    <label class="switch" title={site.enabled ? 'Pausar este site (5, 15, 30 min, até o fim do dia ou até religar)' : 'Ligar este site na rotina'}>
                      <input type="checkbox" checked={site.enabled} onChange={() => toggleSite(site)} aria-label={`${site.domain} na rotina`} />
                      <span />
                    </label>
                    <button class="btn btn-ghost x" aria-label={`Tirar ${site.domain} da rotina`} onClick={() => removeSite(site)}>✕</button>
                  </div>
                </div>
                {open && service && FEATURE_DEFS[service].map((f) => {
                  const name = featureLabel[service]?.[f.id] ?? f.id;
                  // Só a pausa DESTE recurso (a do site inteiro aparece na linha do site, com o próprio "Retomar").
                  const own = releases.filter((r) => r.domain === site.domain && r.feature === f.id && r.until > now).map((r) => r.until);
                  const until = own.length ? Math.max(...own) : undefined;
                  const off = !!site.offFeatures?.includes(f.id);
                  const paused = off || until !== undefined;
                  return (
                    <div key={f.id} class={`rt-row lane ${site.enabled ? '' : 'off'} ${paused ? 'paused' : ''}`}>
                      <div class="rt-label">
                        <span class="rt-feature" title={name}>{name}</span>
                        {paused && <span class="rt-paused-note">⏸ {off ? pauseUi.featureOff : pauseUi.pausedUntil(untilText(until!))}</span>}
                      </div>
                      {renderTrack(site, featureSlotsOf(site, f.id), f.id)}
                      <div class="rt-actions">
                        <button class="rt-plus" aria-label={`Adicionar horário para ${name}`} title="Digitar o horário deste recurso" onClick={() => openNew(site, undefined, undefined, f.id)}>+</button>
                        {paused
                          ? <button class="rt-pause on" aria-label={`Retomar ${name}`} title={pauseUi.resumeFeature} onClick={() => void resume(site, undefined, f.id)}>▶</button>
                          : <button class="rt-pause" aria-label={`Pausar ${name}`} title={`${pauseUi.pauseFeature}: ${pauseUi.featureHint}`} onClick={() => setPausing({ site, feature: f.id })}>⏸</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <form class="add" onSubmit={(e) => { e.preventDefault(); addSite(newDomain); }}>
          <input class="field grow" placeholder="Adicionar site à rotina (ex.: reddit.com)" value={newDomain} aria-label="Novo site" onInput={(e) => setNewDomain(e.currentTarget.value)} />
          <button class="btn" type="submit">Adicionar</button>
        </form>
        {unused.length > 0 && (
          <div class="chips">
            <span class="hint">Sugestões:</span>
            {unused.map((d) => <button key={d} class="chip" onClick={() => addSite(d)}>+ {d}</button>)}
          </div>
        )}
      </section>

      {draft && (
        <section class="card" ref={editorRef} aria-label="Editar faixa">
          <h3>{draft.isNewSlot ? 'Nova faixa em' : 'Editar faixa em'} <span class="accent">{draft.domain}</span></h3>
          {draftSite && (
            <div class="site-slots" role="group" aria-label={`Faixas de ${draft.domain}`}>
              <span class="lbl">Faixas deste site</span>
              {draftSite.slots.map((sl) => (
                <button key={sl.id} type="button" class={`slot-chip m-${sl.mode} ${sl.off || pausedUntil(releases, { domain: draftSite.domain, slotId: sl.id }, now) ? 'paused' : ''}`} aria-pressed={!draft.isNewSlot && draft.slot.id === sl.id} onClick={() => edit(draftSite, sl)}>
                  <i class="dot" /> {sl.off || pausedUntil(releases, { domain: draftSite.domain, slotId: sl.id }, now) ? '⏸ ' : ''}{formatDays(sl.days)} · {formatRange(sl)} · {slotLabel(sl)}
                </button>
              ))}
              <button type="button" class="slot-chip add" aria-pressed={draft.isNewSlot} onClick={() => openNew(draftSite)}>+ Nova faixa</button>
            </div>
          )}

          <span class="lbl gap">Dias</span>
          <div class="chips tight day-presets">
            {DAY_PRESETS.map((p) => (
              <button type="button" key={p.id} class="chip" aria-pressed={dayPresetOf(draft.slot.days) === p.id} onClick={() => patch({ days: p.days })}>{p.label}</button>
            ))}
          </div>
          <div class="day-row" role="group" aria-label="Dias da semana">
            {WEEK_ORDER.map((d) => (
              <button type="button" key={d} class="day" aria-pressed={draft.slot.days.includes(d)}
                onClick={() => patch({ days: toggleDay(draft.slot.days, d) })}>{DAY_SHORT[d]}</button>
            ))}
          </div>

          <span class="lbl gap">Horário</span>
          <div class="time-row">
            <label><span class="lbl">Das</span>
              <input class="field" type="time" disabled={allDay} value={formatMinutes(allDay ? 0 : draft.slot.startMin)} onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) patch({ startMin: m }); }} /></label>
            <label><span class="lbl">Até</span>
              <input class="field" type="time" disabled={allDay} value={formatMinutes(allDay ? 0 : draft.slot.endMin % MINUTES_PER_DAY)} onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) patch({ endMin: m }); }} /></label>
            <label class="check inline"><input type="checkbox" checked={allDay} onChange={(e) => patch(e.currentTarget.checked ? { startMin: 0, endMin: MINUTES_PER_DAY } : { startMin: 9 * 60, endMin: 18 * 60 })} /> Dia todo</label>
            {slotDurationMin(draft.slot) > 0 && !allDay && <span class="hint dur">{Math.floor(slotDurationMin(draft.slot) / 60)} h{slotDurationMin(draft.slot) % 60 ? ` ${slotDurationMin(draft.slot) % 60} min` : ''}{draft.slot.endMin <= draft.slot.startMin ? ' · termina no dia seguinte' : ''}</span>}
          </div>
          <div class="chips tight">
            {SLOT_PRESETS.map((p) => <button type="button" key={p.label} class="chip" onClick={() => patch({ days: p.days, startMin: p.startMin, endMin: p.endMin })}>{p.label}</button>)}
          </div>

          {!allDay && (
            <div class="extra-ranges">
              {(draft.extra ?? []).map((r) => {
                const setRange = (p: Partial<{ startMin: number; endMin: number }>) =>
                  mutateDraft((d) => ({ ...d, extra: (d.extra ?? []).map((x) => x.id === r.id ? { ...x, ...p } : x) }));
                return (
                  <div class="time-row extra-range" key={r.id}>
                    <label><span class="lbl">Também das</span>
                      <input class="field" type="time" value={formatMinutes(r.startMin)} onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) setRange({ startMin: m }); }} /></label>
                    <label><span class="lbl">Até</span>
                      <input class="field" type="time" value={formatMinutes(r.endMin % MINUTES_PER_DAY)} onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) setRange({ endMin: m }); }} /></label>
                    <button type="button" class="btn btn-ghost x" aria-label="Tirar este horário" title="Tirar este horário"
                      onClick={() => mutateDraft((d) => ({ ...d, extra: (d.extra ?? []).filter((x) => x.id !== r.id) }))}>✕</button>
                  </div>
                );
              })}
              <div class="extra-add">
                <button type="button" class="btn" onClick={() => {
                  const ranges = [draft.slot, ...(draft.extra ?? [])].filter((x) => x.endMin > x.startMin);
                  const last = ranges.reduce((m, x) => Math.max(m, x.endMin), draft.slot.endMin > draft.slot.startMin ? draft.slot.endMin : 9 * 60);
                  const next = suggestFreeTime(ranges, Math.min(last + 60, MINUTES_PER_DAY - 60)) ?? { startMin: Math.max(0, MINUTES_PER_DAY - 120), endMin: MINUTES_PER_DAY };
                  mutateDraft((d) => ({ ...d, extra: [...(d.extra ?? []), { id: randomId(), ...next }] }));
                }}>+ Adicionar outro horário neste dia</button>
                {(() => {
                  const gaps = gapsBetween([draft.slot, ...(draft.extra ?? [])]);
                  return gaps.length > 0
                    ? <span class="hint">Livre: {gaps.map((g) => `${formatMinutes(g.startMin)}–${formatMinutes(g.endMin)}`).join(' e ')}</span>
                    : <span class="hint">Para bloquear em intervalos, como 9h–12h e 14h–18h.</span>;
                })()}
              </div>
            </div>
          )}

          <span class="lbl gap">O que fazer</span>
          <RestrictionPicker domain={draft.domain} spec={draft.slot} onChange={(spec) => patch({ mode: spec.mode, restrictedKind: spec.restrictedKind, features: spec.features })} />

          {notice && <p class={`notice ${notice.kind}`} role="alert">{notice.text}</p>}
          <div class="actions-row">
            <button class="btn btn-primary" onClick={() => saveDraft()}>Salvar faixa</button>
            <button class="btn" onClick={() => saveDraft(true)} title="Salva esta e já abre outra faixa neste site">Salvar e adicionar outra</button>
            {!draft.isNewSlot && <button class="btn btn-ghost" onClick={duplicateDraft} title="Cria uma cópia desta faixa para ajustar">Duplicar</button>}
            {!draft.isNewSlot && draftSite && draftSlot && (draftSlot.off || pausedUntil(releases, { domain: draftSite.domain, slotId: draftSlot.id }, now)
              ? <button class="btn btn-ghost" onClick={() => void resume(draftSite, draftSlot)}>{pauseUi.resumeSlot}</button>
              : <button class="btn btn-ghost" onClick={() => setPausing({ site: draftSite, slot: draftSlot })} title="Pausa só esta faixa por um tempo ou até religar">{pauseUi.pauseSlot}</button>)}
            <button class="btn btn-ghost" onClick={() => { setDraft(undefined); setNotice(undefined); }}>Cancelar</button>
            <span class="grow" />
            {!draft.isNewSlot && <button class="btn btn-ghost btn-danger" onClick={deleteSlot}>Apagar faixa</button>}
          </div>
        </section>
      )}

      {featureDraft && (() => {
        const site = sites.find((x) => x.id === featureDraft.siteId);
        const service = site ? serviceOf(site) : null;
        if (!site || !service) return null;
        return (
          <FeatureEditor ref={featureEditorRef} domain={site.domain} label={featureLabel[service]?.[featureDraft.feature] ?? featureDraft.feature}
            value={featureDraft} onChange={mutateFeature} onSave={() => void saveFeature()} onCancel={() => { setFeatureDraft(undefined); setNotice(undefined); }}
            onRemove={featureDraft.slotId ? () => void removeFeatureSlot() : undefined} notice={notice} />
        );
      })()}

      <p class="hint footnote">
        O acesso aos sites serve só para bloquear ou limitar essas páginas; nada sai do seu computador.{' '}
        <button class="link" onClick={clearRoutine}>Limpar a rotina</button>
      </p>
      </>)}
    </main>
  );
}
