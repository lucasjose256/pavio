import { useEffect, useMemo, useState } from 'preact/hooks';
import { accessDomains } from '../../core/blocking';
import type { Environment, ScheduleBlock, Strictness } from '../../core/models';
import { randomId } from '../../core/ports';
import {
  MINUTES_PER_DAY, blockDurationMin, crossesMidnight, findOverlaps, formatMinutes, parseTime, scheduleState, validateBlock, weekSegments,
} from '../../core/schedule';
import { ensureHostAccess } from '../../platform/chrome/permissions';
import { DAY_SHORT, WEEK_ORDER, formatDays, formatRange, formatWhen } from '../shared/format';
import { services } from './shared';

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string };

const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Dias úteis', days: [1, 2, 3, 4, 5] },
  { label: 'Fim de semana', days: [0, 6] },
  { label: 'Todos os dias', days: [0, 1, 2, 3, 4, 5, 6] },
];

const newBlock = (environmentId: string): ScheduleBlock => ({
  id: randomId(), name: '', environmentId, days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 12 * 60,
  strictness: 'focus', enabled: true, createdAt: Date.now(), updatedAt: Date.now(),
});

const errorText = (code: string): string =>
  ({
    'days:empty': 'Escolha ao menos um dia.',
    'time:same': 'O início e o fim não podem ser iguais.',
    'time:range': 'Horário inválido.',
    'env:missing': 'Escolha um ambiente.',
  })[code] ?? 'Faixa inválida.';

export function ScheduleTab({ active }: { active: boolean }) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [draft, setDraft] = useState<ScheduleBlock>();
  const [isNew, setIsNew] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [now, setNow] = useState(Date.now());

  async function reload() {
    const [b, e, s] = await Promise.all([services.schedule.list(), services.environments.list(), services.schedule.skipped()]);
    setBlocks(b);
    setEnvs(e);
    setSkipped(s);
  }

  useEffect(() => {
    void reload();
    const id = setInterval(() => setNow(Date.now()), 30_000);
    // Faixas e ambientes são editados em outras abas: acompanha o storage.
    const onChange = (_: unknown, area: string) => area === 'local' && void reload();
    chrome.storage.onChanged.addListener(onChange);
    return () => { clearInterval(id); chrome.storage.onChanged.removeListener(onChange); };
  }, []);

  const envName = (id: string) => envs.find((e) => e.id === id)?.name;
  const state = useMemo(() => scheduleState(blocks, now, skipped), [blocks, now, skipped]);
  const segments = useMemo(() => weekSegments(blocks), [blocks]);
  const colorOf = (id: string) => blocks.findIndex((b) => b.id === id) % 4;

  const overlaps = useMemo(() => {
    if (!draft) return [];
    const all = [...blocks.filter((b) => b.id !== draft.id), draft];
    return findOverlaps(all).filter(([a, b]) => a === draft.id || b === draft.id)
      .map(([a, b]) => all.find((x) => x.id === (a === draft.id ? b : a))?.name || 'outra faixa');
  }, [blocks, draft]);

  function startNew() {
    if (!envs[0]) return setNotice({ kind: 'error', text: 'Crie um ambiente primeiro (aba Ambientes).' });
    setDraft(newBlock(envs[0].id));
    setIsNew(true);
    setNotice(undefined);
  }

  function edit(block: ScheduleBlock) {
    setDraft(structuredClone(block));
    setIsNew(false);
    setNotice(undefined);
  }

  const patch = (p: Partial<ScheduleBlock>) => draft && setDraft({ ...draft, ...p });
  const toggleDay = (d: number) => draft && patch({ days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d] });

  async function save() {
    if (!draft) return;
    const errors = validateBlock(draft, envs.map((e) => e.id));
    if (errors.length) return setNotice({ kind: 'error', text: errors.map(errorText).join(' ') });
    // Permissão primeiro (precisa do clique), depois o storage.
    const env = envs.find((e) => e.id === draft.environmentId);
    const granted = env ? await ensureHostAccess(accessDomains(env)) : true;
    await services.schedule.save(draft, envs.map((e) => e.id));
    setDraft(undefined);
    await reload();
    setNotice(granted ? { kind: 'ok', text: 'Faixa salva.' } : { kind: 'warn', text: 'Faixa salva, mas sem acesso aos sites o bloqueio não funciona. Dê acesso na aba Ambientes.' });
  }

  async function remove() {
    if (!draft || isNew || !confirm('Apagar esta faixa de horário?')) return;
    await services.schedule.remove(draft.id);
    setDraft(undefined);
    await reload();
  }

  async function toggle(block: ScheduleBlock) {
    await services.schedule.save({ ...block, enabled: !block.enabled });
    await reload();
  }

  const status = state.active
    ? `Agora: “${state.active.block.name || envName(state.active.block.environmentId) || 'Faixa'}” até ${formatWhen(state.active.end, now).replace(/^hoje /, '')}.`
    : state.next
      ? `Próxima faixa: “${state.next.block.name || envName(state.next.block.environmentId) || 'Faixa'}”, ${formatWhen(state.next.start, now)}.`
      : 'Nenhuma faixa ativa. Crie uma e o Pavio acende a vela por você.';
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  return (
    <main class="pane" hidden={!active}>
      <section class="card status">
        <div>
          <h2 class="section-title">Seus horários</h2>
          <p class="section-sub">Escolha os dias e as horas, e o ambiente de cada faixa. Quando chegar a hora, o Pavio acende a vela e aplica as regras por você.</p>
          <p class={`status-line ${state.active ? 'on' : ''}`} role="status">{status}</p>
        </div>
        <button class="btn btn-primary" onClick={startNew}>+ Nova faixa</button>
      </section>

      {notice && !draft && <p class={`notice ${notice.kind}`} role="status">{notice.text}</p>}

      {draft && (
        <section class="card" aria-label={isNew ? 'Nova faixa' : 'Editar faixa'}>
          <h3>{isNew ? 'Nova faixa' : 'Editar faixa'}</h3>
          <label>
            <span class="lbl">Nome (opcional)</span>
            <input class="field full" value={draft.name} maxLength={40} placeholder="Ex.: Manhã de estudo" onInput={(e) => patch({ name: e.currentTarget.value })} />
          </label>

          <span class="lbl gap">Dias</span>
          <div class="day-row" role="group" aria-label="Dias da semana">
            {WEEK_ORDER.map((d) => (
              <button type="button" key={d} class="day" aria-pressed={draft.days.includes(d)} onClick={() => toggleDay(d)}>{DAY_SHORT[d]}</button>
            ))}
          </div>
          <div class="chips">
            {PRESETS.map((p) => <button type="button" key={p.label} class="chip" onClick={() => patch({ days: p.days })}>{p.label}</button>)}
          </div>

          <div class="time-row">
            <label><span class="lbl">Das</span>
              <input class="field" type="time" value={formatMinutes(draft.startMin)} onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) patch({ startMin: m }); }} /></label>
            <label><span class="lbl">Até</span>
              <input class="field" type="time" value={formatMinutes(draft.endMin)} onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) patch({ endMin: m }); }} /></label>
            {blockDurationMin(draft) > 0 && (
              <span class="hint dur">{Math.floor(blockDurationMin(draft) / 60)} h {blockDurationMin(draft) % 60 ? `${blockDurationMin(draft) % 60} min` : ''}{crossesMidnight(draft) ? ' · termina no dia seguinte' : ''}</span>
            )}
          </div>

          <label>
            <span class="lbl gap">Ambiente (as regras de cada site nesse horário)</span>
            <select class="field full" value={draft.environmentId} onChange={(e) => patch({ environmentId: e.currentTarget.value })}>
              {envs.map((e) => <option value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <p class="hint">Para mudar o que fica liberado, bloqueado ou restrito, edite o ambiente na aba <a href="#ambientes">Ambientes</a>.</p>

          <span class="lbl">Modo ao tentar parar antes da hora</span>
          <div class="chips tight">
            {(['focus', 'light'] as Strictness[]).map((s) => (
              <button type="button" key={s} class="chip" aria-pressed={draft.strictness === s} onClick={() => patch({ strictness: s })}>{s === 'focus' ? 'Foco' : 'Leve'}</button>
            ))}
          </div>

          <label class="check"><input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.currentTarget.checked })} /> Faixa ativa</label>

          {overlaps.length > 0 && (
            <p class="notice warn">Esta faixa se sobrepõe a: {[...new Set(overlaps)].join(', ')}. Nos horários em comum vale a que começou por último.</p>
          )}
          {notice && <p class={`notice ${notice.kind}`} role="alert">{notice.text}</p>}
          <div class="actions-row">
            <button class="btn btn-primary" onClick={save}>Salvar faixa</button>
            <button class="btn btn-ghost" onClick={() => { setDraft(undefined); setNotice(undefined); }}>Cancelar</button>
            <span class="grow" />
            {!isNew && <button class="btn btn-ghost btn-danger" onClick={remove}>Apagar</button>}
          </div>
        </section>
      )}

      <section class="card">
        <h3>Sua semana</h3>
        {blocks.length === 0 && <p class="empty">Ainda não há faixas. Comece com “+ Nova faixa”.</p>}
        <div class="week" aria-label="Grade semanal">
          <div class="hours" aria-hidden="true">
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <span key={h} style={{ top: `${(h / 24) * 100}%` }}>{String(h).padStart(2, '0')}h</span>)}
          </div>
          {WEEK_ORDER.map((d) => {
            const isToday = new Date(now).getDay() === d;
            return (
              <div key={d} class={`col ${isToday ? 'today' : ''}`}>
                <span class="col-head">{DAY_SHORT[d]}</span>
                <div class="col-body">
                  {segments.filter((s) => s.day === d).map((s) => {
                    const block = blocks.find((b) => b.id === s.blockId)!;
                    return (
                      <button key={`${s.blockId}-${s.startMin}`} class={`seg c${colorOf(s.blockId)} ${block.enabled ? '' : 'off'}`}
                        style={{ top: `${(s.startMin / MINUTES_PER_DAY) * 100}%`, height: `${((s.endMin - s.startMin) / MINUTES_PER_DAY) * 100}%` }}
                        title={`${block.name || envName(block.environmentId)} · ${formatRange(block)}`} onClick={() => edit(block)}>
                        <span>{block.name || envName(block.environmentId)}</span>
                      </button>
                    );
                  })}
                  {isToday && <i class="now" style={{ top: `${(nowMin / MINUTES_PER_DAY) * 100}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {blocks.length > 0 && (
        <section class="card">
          <h3>Faixas</h3>
          <ul class="blocks">
            {blocks.map((b) => (
              <li key={b.id} class={`block ${b.enabled ? '' : 'off'}`}>
                <i class={`swatch-dot c${colorOf(b.id)}`} />
                <button class="block-main" onClick={() => edit(b)}>
                  <strong>{b.name || 'Sem nome'}</strong>
                  <span>{formatDays(b.days)} · {formatRange(b)}</span>
                  <span class="muted">{envName(b.environmentId) ?? <em class="bad">ambiente removido</em>} · {b.strictness === 'focus' ? 'Foco' : 'Leve'}</span>
                </button>
                <label class="switch" title={b.enabled ? 'Desativar' : 'Ativar'}>
                  <input type="checkbox" checked={b.enabled} onChange={() => toggle(b)} aria-label={`Faixa ${b.name || 'sem nome'} ativa`} />
                  <span />
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
