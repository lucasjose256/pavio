import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { accessDomains } from '../../core/blocking';
import { normalizeDomain } from '../../core/matching';
import type { RoutineSite, RoutineSlot } from '../../core/models';
import { randomId } from '../../core/ports';
import { activeRules, loosensNow, nextBoundary, rulesAnyTime, validateSlot } from '../../core/routine';
import { ROUTINE_SUGGESTIONS, SLOT_PRESETS, defaultRoutine } from '../../core/routine-defaults';
import { defaultSpec, featuresOf } from '../../core/restrictions';
import { MINUTES_PER_DAY, formatMinutes, parseTime, segmentsForDay, slotDurationMin } from '../../core/timeslots';
import { ensureHostAccess } from '../../platform/chrome/permissions';
import { featureLabel } from '../i18n/pt-BR';
import { DAY_SHORT, WEEK_ORDER, formatRange, formatWhen } from '../shared/format';
import { RestrictionPicker } from './RestrictionPicker';
import { missingAccess } from './access';
import { services } from './shared';

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string };

/** Faixa em edição. `siteId` ausente = site novo. */
interface Draft {
  domain: string;
  siteId?: string;
  isNewSlot: boolean;
  slot: RoutineSlot;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const slotErrorText = (code: string): string =>
  ({
    'days:empty': 'Escolha ao menos um dia.',
    'time:same': 'O início e o fim não podem ser iguais.',
    'time:range': 'Horário inválido.',
    'kind:missing': 'Escolha como restringir.',
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

export function RoutineTab({ active }: { active: boolean }) {
  const [sites, setSites] = useState<RoutineSite[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState(new Date().getDay());
  const [draft, setDraft] = useState<Draft>();
  const [notice, setNotice] = useState<Notice>();
  const [missing, setMissing] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [now, setNow] = useState(Date.now());
  const editorRef = useRef<HTMLElement>(null);

  async function reload() {
    const [list, settings] = await Promise.all([services.routine.list(), services.settings.get()]);
    setSites(list);
    setEnabled(settings.routineEnabled);
    setMissing(settings.routineEnabled ? await missingAccess(accessDomains({ rules: rulesAnyTime(list) })) : []);
  }

  useEffect(() => {
    void reload();
    const id = setInterval(() => setNow(Date.now()), 30_000);
    const onChange = (_: unknown, area: string) => area === 'local' && void reload();
    chrome.storage.onChanged.addListener(onChange);
    return () => { clearInterval(id); chrome.storage.onChanged.removeListener(onChange); };
  }, []);

  useEffect(() => { if (draft) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [draft?.domain, draft?.slot.id]);

  const today = new Date(now).getDay();
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const activeNow = useMemo(() => activeRules(sites, enabled, now), [sites, enabled, now]);
  const boundary = useMemo(() => nextBoundary(sites, enabled, now), [sites, enabled, now]);
  const unused = ROUTINE_SUGGESTIONS.filter((d) => !sites.some((s) => s.domain === d));

  /**
   * Aplica uma mudança. Pede confirmação se ela afrouxa algo que protege AGORA, e o acesso aos sites
   * (precisa do clique do usuário, por isso vem antes de gravar).
   */
  async function commit(nextSites: RoutineSite[], nextEnabled = enabled, okText = 'Rotina salva.'): Promise<boolean> {
    if (loosensNow({ sites, enabled }, { sites: nextSites, enabled: nextEnabled }, Date.now())
      && !confirm('Isso afrouxa uma regra que está protegendo agora. Tem certeza?')) return false;
    const granted = nextEnabled ? await ensureHostAccess(accessDomains({ rules: rulesAnyTime(nextSites) })) : true;
    await services.routine.save(nextSites);
    if (nextEnabled !== enabled) await services.settings.update({ routineEnabled: nextEnabled });
    await reload();
    setNotice(granted
      ? { kind: 'ok', text: okText }
      : { kind: 'warn', text: 'Salvo, mas sem acesso aos sites o bloqueio não funciona. Use "Conceder acesso".' });
    return true;
  }

  function openNew(site: RoutineSite, atMin?: number) {
    const last = site.slots[site.slots.length - 1];
    const start = atMin === undefined ? 9 * 60 : Math.min(atMin, MINUTES_PER_DAY - 30);
    const slot: RoutineSlot = {
      id: randomId(),
      days: atMin === undefined ? WEEKDAYS : [day],
      startMin: start,
      endMin: Math.min(start + 120, MINUTES_PER_DAY),
      ...(last ? { mode: last.mode, restrictedKind: last.restrictedKind, features: last.features } : defaultSpec(site.domain, 'blocked')),
    };
    setDraft({ domain: site.domain, siteId: site.id, isNewSlot: true, slot });
    setNotice(undefined);
  }

  function edit(site: RoutineSite, slot: RoutineSlot) {
    setDraft({ domain: site.domain, siteId: site.id, isNewSlot: false, slot: structuredClone(slot) });
    setNotice(undefined);
  }

  function onTrackClick(site: RoutineSite, e: MouseEvent) {
    if (e.target !== e.currentTarget) return; // clique numa faixa abre a edição, não cria
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const minute = Math.round(((e.clientX - rect.left) / rect.width) * MINUTES_PER_DAY / 30) * 30;
    openNew(site, minute);
  }

  function addSite(input: string) {
    const domain = normalizeDomain(input);
    if (!domain) return setNotice({ kind: 'error', text: 'Esse endereço não parece um site válido (ex.: reddit.com).' });
    const existing = sites.find((s) => s.domain === domain);
    if (existing) return openNew(existing);
    const spec = defaultSpec(domain, 'blocked');
    setDraft({ domain, isNewSlot: true, slot: { id: randomId(), days: WEEKDAYS, startMin: 9 * 60, endMin: 18 * 60, ...spec } });
    setNewDomain('');
    setNotice(undefined);
  }

  const patch = (p: Partial<RoutineSlot>) => draft && setDraft({ ...draft, slot: { ...draft.slot, ...p } });

  async function saveDraft() {
    if (!draft) return;
    const errors = validateSlot(draft.slot);
    if (errors.length) return setNotice({ kind: 'error', text: errors.map(slotErrorText).join(' ') });
    const next = draft.siteId
      ? sites.map((s) => s.id !== draft.siteId ? s : { ...s, slots: draft.isNewSlot ? [...s.slots, draft.slot] : s.slots.map((x) => x.id === draft.slot.id ? draft.slot : x) })
      : [...sites, { id: randomId(), domain: draft.domain, enabled: true, slots: [draft.slot] }];
    if (await commit(next, enabled, 'Faixa salva.')) setDraft(undefined);
  }

  async function deleteSlot() {
    if (!draft?.siteId || draft.isNewSlot) return;
    const next = sites.map((s) => s.id !== draft.siteId ? s : { ...s, slots: s.slots.filter((x) => x.id !== draft.slot.id) });
    if (await commit(next, enabled, 'Faixa apagada.')) setDraft(undefined);
  }

  const toggleSite = (site: RoutineSite) => commit(sites.map((s) => s.id === site.id ? { ...s, enabled: !s.enabled } : s), enabled, site.enabled ? 'Site desligado na rotina.' : 'Site ligado na rotina.');
  const removeSite = (site: RoutineSite) => confirm(`Tirar ${site.domain} da rotina?`) && commit(sites.filter((s) => s.id !== site.id), enabled, 'Site removido.');
  const restoreDefaults = () => confirm('Voltar à programação pronta? Suas faixas atuais serão substituídas.') && commit(defaultRoutine(), enabled, 'Programação pronta restaurada.');
  const grantAccess = async () => {
    await ensureHostAccess(missing);
    await reload();
  };

  const allDay = !!draft && draft.slot.startMin === 0 && draft.slot.endMin === MINUTES_PER_DAY;
  const status = !enabled
    ? 'Rotina desligada: nada é bloqueado por horário.'
    : activeNow.length
      ? `Protegendo agora: ${activeNow.map((r) => r.domain).join(', ')}${boundary ? ` · muda ${formatWhen(boundary, now)}` : ' · sem hora para acabar'}.`
      : boundary
        ? `Livre agora. Próxima proteção: ${formatWhen(boundary, now)}.`
        : 'Nenhuma faixa ativa. Crie uma abaixo.';

  return (
    <main class="pane" hidden={!active}>
      <section class="card status">
        <div class="grow">
          <h2 class="section-title">Sua rotina</h2>
          <p class="section-sub">Para cada site, escolha em quais dias e horas ele fica bloqueado ou com partes escondidas. A rotina trabalha sozinha, sem precisar acender a vela; o <strong>Timer</strong> do popup serve para um foco extra por cima dela.</p>
          <p class={`status-line ${enabled && activeNow.length ? 'on' : ''}`} role="status">{status}</p>
        </div>
        <label class="master" title="Liga ou desliga toda a rotina">
          <span class="switch"><input type="checkbox" checked={enabled} onChange={() => commit(sites, !enabled, enabled ? 'Rotina desligada.' : 'Rotina ligada.')} aria-label="Rotina ligada" /><span /></span>
          <strong>{enabled ? 'Ligada' : 'Desligada'}</strong>
        </label>
      </section>

      {!enabled && (
        <p class="notice warn onboarding">
          <span>A programação pronta já está aqui embaixo, mas <strong>desligada</strong>. Confira os horários, ajuste o que quiser e ligue quando estiver bom para você.</span>
          <button class="btn btn-primary" onClick={() => commit(sites, true, 'Rotina ligada.')}>Ligar a rotina</button>
        </p>
      )}
      {enabled && missing.length > 0 && (
        <p class="notice warn onboarding">
          <span>O Chrome ainda não deu acesso a <strong>{missing.join(', ')}</strong>. Sem isso, o bloqueio desses sites não funciona.</span>
          <button class="btn btn-primary" onClick={grantAccess}>Conceder acesso</button>
        </p>
      )}
      {notice && !draft && <p class={`notice ${notice.kind}`} role="status">{notice.text}</p>}

      <section class="card">
        <div class="day-bar" role="tablist" aria-label="Dia da semana">
          {WEEK_ORDER.map((d) => (
            <button key={d} role="tab" class={`daytab ${day === d ? 'on' : ''}`} aria-selected={day === d} onClick={() => setDay(d)}>
              {DAY_SHORT[d]}{d === today && <i class="today-dot" title="Hoje" />}
            </button>
          ))}
        </div>

        <div class="rt" aria-label={`Rotina de ${DAY_SHORT[day]}`}>
          <div class="rt-axis" aria-hidden="true">
            <span />
            <div>{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <b key={h} style={{ left: `${(h / 24) * 100}%` }}>{h}</b>)}</div>
            <span />
          </div>
          {sites.length === 0 && <p class="empty">Nenhum site ainda. Adicione o primeiro abaixo.</p>}
          {sites.map((site) => (
            <div key={site.id} class={`rt-row ${site.enabled ? '' : 'off'}`}>
              <div class="rt-label">
                <button class="rt-site" onClick={() => openNew(site)} title="Adicionar uma faixa neste site">{site.domain}</button>
                {site.slots.length === 0 && <small>sem faixas</small>}
              </div>
              <div class="rt-track" onClick={(e) => onTrackClick(site, e as unknown as MouseEvent)} title="Clique num espaço vazio para criar uma faixa">
                {segmentsForDay(site.slots, day).map((seg) => {
                  const slot = site.slots.find((s) => s.id === seg.slotId)!;
                  return (
                    <button key={`${seg.slotId}-${seg.startMin}`} class={`rt-seg m-${slot.mode}`} style={{ left: `${(seg.startMin / MINUTES_PER_DAY) * 100}%`, width: `${((seg.endMin - seg.startMin) / MINUTES_PER_DAY) * 100}%` }}
                      title={`${site.domain} · ${slotLabel(slot)} · ${formatRange(slot)}`} onClick={() => edit(site, slot)}>
                      <span>{slotLabel(slot)}</span>
                    </button>
                  );
                })}
                {day === today && <i class="rt-now" style={{ left: `${(nowMin / MINUTES_PER_DAY) * 100}%` }} />}
              </div>
              <div class="rt-actions">
                <label class="switch" title={site.enabled ? 'Desligar este site na rotina' : 'Ligar este site na rotina'}>
                  <input type="checkbox" checked={site.enabled} onChange={() => toggleSite(site)} aria-label={`${site.domain} na rotina`} />
                  <span />
                </label>
                <button class="btn btn-ghost x" aria-label={`Tirar ${site.domain} da rotina`} onClick={() => removeSite(site)}>✕</button>
              </div>
            </div>
          ))}
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

          <span class="lbl gap">Dias</span>
          <div class="day-row" role="group" aria-label="Dias da semana">
            {WEEK_ORDER.map((d) => (
              <button type="button" key={d} class="day" aria-pressed={draft.slot.days.includes(d)}
                onClick={() => patch({ days: draft.slot.days.includes(d) ? draft.slot.days.filter((x) => x !== d) : [...draft.slot.days, d] })}>{DAY_SHORT[d]}</button>
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

          <span class="lbl gap">O que fazer</span>
          <RestrictionPicker domain={draft.domain} spec={draft.slot} onChange={(spec) => patch({ mode: spec.mode, restrictedKind: spec.restrictedKind, features: spec.features })} />

          {notice && <p class={`notice ${notice.kind}`} role="alert">{notice.text}</p>}
          <div class="actions-row">
            <button class="btn btn-primary" onClick={saveDraft}>Salvar faixa</button>
            <button class="btn btn-ghost" onClick={() => { setDraft(undefined); setNotice(undefined); }}>Cancelar</button>
            <span class="grow" />
            {!draft.isNewSlot && <button class="btn btn-ghost btn-danger" onClick={deleteSlot}>Apagar faixa</button>}
          </div>
        </section>
      )}

      <p class="hint footnote">
        O acesso aos sites serve só para bloquear ou limitar essas páginas; nada sai do seu computador.{' '}
        <button class="link" onClick={restoreDefaults}>Restaurar a programação pronta</button>
      </p>
    </main>
  );
}
