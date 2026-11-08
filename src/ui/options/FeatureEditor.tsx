import { forwardRef } from 'preact/compat';
import { DAY_PRESETS, dayPresetOf, toggleDay } from '../../core/day-presets';
import { randomId } from '../../core/ports';
import { MINUTES_PER_DAY, formatMinutes, gapsBetween, parseTime, slotDurationMin, suggestFreeTime } from '../../core/timeslots';
import { DAY_SHORT, WEEK_ORDER } from '../shared/format';
import { SiteIcon } from '../shared/SiteIcon';

/** Um recurso (feed, Shorts…) que está sendo editado: dias, horário e horários extras no mesmo dia. */
export interface FeatureDraft {
  siteId: string;
  feature: string;
  /** Faixa existente que está sendo editada (ausente = horário novo). */
  slotId?: string;
  days: number[];
  startMin: number;
  endMin: number;
  extra: { id: string; startMin: number; endMin: number }[];
}

const TIME_CHIPS = [
  { label: 'Horário comercial', startMin: 9 * 60, endMin: 18 * 60 },
  { label: 'Manhã', startMin: 6 * 60, endMin: 12 * 60 },
  { label: 'Noite', startMin: 22 * 60, endMin: 6 * 60 },
  { label: 'O dia todo', startMin: 0, endMin: MINUTES_PER_DAY },
];

interface Props {
  domain: string;
  label: string;
  value: FeatureDraft;
  onChange: (fn: (d: FeatureDraft) => FeatureDraft) => void;
  onSave: () => void;
  onRemove?: () => void;
  onCancel: () => void;
  notice?: { kind: 'ok' | 'warn' | 'error'; text: string };
}

/**
 * Editor de UM recurso do site. Convive com as barras de cada recurso: quem prefere arrastar usa a barra; quem prefere
 * digitar usa isto (dias, das/até, vários horários). Só esconde este recurso; o resto do site não é afetado.
 */
export const FeatureEditor = forwardRef<HTMLElement, Props>(function FeatureEditor({ domain, label, value, onChange, onSave, onRemove, onCancel, notice }, ref) {
  const allDay = value.startMin === 0 && value.endMin === MINUTES_PER_DAY;
  const set = (p: Partial<FeatureDraft>) => onChange((d) => ({ ...d, ...p }));
  const gaps = gapsBetween([value, ...value.extra]);
  const dur = slotDurationMin(value);

  function addRange() {
    onChange((d) => {
      const ranges = [d, ...d.extra].filter((x) => x.endMin > x.startMin);
      const last = ranges.reduce((m, x) => Math.max(m, x.endMin), 9 * 60);
      const next = suggestFreeTime(ranges, Math.min(last + 60, MINUTES_PER_DAY - 60)) ?? { startMin: MINUTES_PER_DAY - 120, endMin: MINUTES_PER_DAY };
      return { ...d, extra: [...d.extra, { id: randomId(), ...next }] };
    });
  }
  const setExtra = (id: string, p: Partial<{ startMin: number; endMin: number }>) =>
    onChange((d) => ({ ...d, extra: d.extra.map((x) => (x.id === id ? { ...x, ...p } : x)) }));

  return (
    <section class="card feature-editor" ref={ref} aria-label={`Editar ${label}`}>
      <h3><SiteIcon domain={domain} /> {label} <span class="muted">em {domain}</span></h3>
      <p class="hint">Esconde só este recurso, nos dias e horários abaixo. O resto do site continua como está.</p>

      <span class="lbl gap">Dias</span>
      <div class="chips tight day-presets">
        {DAY_PRESETS.map((p) => (
          <button type="button" key={p.id} class="chip" aria-pressed={dayPresetOf(value.days) === p.id} onClick={() => set({ days: p.days })}>{p.label}</button>
        ))}
      </div>
      <div class="day-row" role="group" aria-label="Dias da semana">
        {WEEK_ORDER.map((d) => (
          <button type="button" key={d} class="day-btn" aria-pressed={value.days.includes(d)} onClick={() => set({ days: toggleDay(value.days, d) })}>{DAY_SHORT[d]}</button>
        ))}
      </div>

      <span class="lbl gap">Horário <span class="muted">(ou arraste na barra do recurso)</span></span>
      <div class="time-row">
        <label><span class="lbl">Das</span>
          <input class="field" type="time" disabled={allDay} value={formatMinutes(allDay ? 0 : value.startMin)}
            onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) set({ startMin: m }); }} /></label>
        <label><span class="lbl">Até</span>
          <input class="field" type="time" disabled={allDay} value={formatMinutes(allDay ? 0 : value.endMin % MINUTES_PER_DAY)}
            onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) set({ endMin: m }); }} /></label>
        <label class="check inline"><input type="checkbox" checked={allDay}
          onChange={(e) => set(e.currentTarget.checked ? { startMin: 0, endMin: MINUTES_PER_DAY } : { startMin: 9 * 60, endMin: 18 * 60 })} /> Dia todo</label>
        {dur > 0 && !allDay && (
          <span class="hint dur">{Math.floor(dur / 60)} h{dur % 60 ? ` ${dur % 60} min` : ''}{value.endMin <= value.startMin ? ' · termina no dia seguinte' : ''}</span>
        )}
      </div>
      <div class="chips tight">
        {TIME_CHIPS.map((c) => <button type="button" key={c.label} class="chip" onClick={() => set({ startMin: c.startMin, endMin: c.endMin })}>{c.label}</button>)}
      </div>

      {!allDay && (
        <div class="extra-ranges">
          {value.extra.map((r) => (
            <div class="time-row extra-range" key={r.id}>
              <label><span class="lbl">Também das</span>
                <input class="field" type="time" value={formatMinutes(r.startMin)}
                  onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) setExtra(r.id, { startMin: m }); }} /></label>
              <label><span class="lbl">Até</span>
                <input class="field" type="time" value={formatMinutes(r.endMin % MINUTES_PER_DAY)}
                  onInput={(e) => { const m = parseTime(e.currentTarget.value); if (m !== null) setExtra(r.id, { endMin: m }); }} /></label>
              <button type="button" class="btn btn-ghost x" aria-label="Tirar este horário" onClick={() => onChange((d) => ({ ...d, extra: d.extra.filter((x) => x.id !== r.id) }))}>✕</button>
            </div>
          ))}
          <div class="extra-add">
            <button type="button" class="btn" onClick={addRange}>+ Adicionar outro horário neste dia</button>
            <span class="hint">{gaps.length ? `Livre: ${gaps.map((g) => `${formatMinutes(g.startMin)}–${formatMinutes(g.endMin)}`).join(' e ')}` : 'Para esconder em intervalos, como 9h–12h e 14h–18h.'}</span>
          </div>
        </div>
      )}

      {notice && <p class={`notice ${notice.kind}`} role="alert">{notice.text}</p>}
      <div class="actions-row">
        <button class="btn btn-primary" onClick={onSave}>Salvar</button>
        <button class="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <span class="grow" />
        {onRemove && <button class="btn btn-ghost btn-danger" onClick={onRemove}>Remover este horário</button>}
      </div>
    </section>
  );
});
