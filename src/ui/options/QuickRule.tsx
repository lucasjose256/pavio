import { useState } from 'preact/hooks';
import { normalizeDomain } from '../../core/matching';
import type { RoutineSlot } from '../../core/models';
import { DAY_PRESETS, TIME_PRESETS, dayPresetOf, hideKindFor, quickSlot, toggleDay, type QuickAction } from '../../core/quick-rule';
import { randomId } from '../../core/ports';
import { formatMinutes, parseTime } from '../../core/timeslots';
import { DAY_SHORT, WEEK_ORDER, formatDays } from '../shared/format';
import { SiteIcon } from '../shared/SiteIcon';
import { quickRuleUi as t } from '../i18n/pt-BR';

/**
 * "Nova regra": o caminho curto para o caso comum. Site → dias → horário → o que fazer, e uma frase mostra o que vai
 * acontecer. Cria a faixa de uma vez; a linha do tempo abaixo serve para ajustar com precisão.
 */
export function QuickRule({ known, onCreate }: { known: string[]; onCreate: (domain: string, slot: RoutineSlot) => Promise<boolean> }) {
  const [domain, setDomain] = useState('');
  const [other, setOther] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeId, setTimeId] = useState('all');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('18:00');
  const [action, setAction] = useState<QuickAction>('block');
  const [error, setError] = useState('');

  const chosen = domain || normalizeDomain(other) || '';
  const preset = TIME_PRESETS.find((p) => p.id === timeId);
  const times = preset ? { startMin: preset.startMin, endMin: preset.endMin } : { startMin: parseTime(from) ?? -1, endMin: parseTime(to) ?? -1 };
  const timeLabel = preset
    ? (preset.endMin === 1440 && preset.startMin === 0 ? 'o dia todo' : `das ${formatMinutes(preset.startMin)} às ${formatMinutes(preset.endMin % 1440)}`)
    : `das ${from} às ${to}`;
  const isService = hideKindFor(chosen || 'x.com') !== 'intent';

  async function create() {
    if (!chosen) return setError(t.pickSite);
    if (times.startMin < 0 || times.endMin < 0) return setError(t.badTime);
    const { slot, errors } = quickSlot({ domain: chosen, days, ...times, action }, randomId);
    if (errors.length) return setError(errors.includes('days:empty') ? 'Escolha ao menos um dia.' : t.badTime);
    setError('');
    if (await onCreate(chosen, slot)) { setDomain(''); setOther(''); }
  }

  return (
    <section class="card qr" aria-label={t.title}>
      <h2 class="section-title">{t.title}</h2>
      <p class="section-sub">{t.sub}</p>

      <div class="qr-step">
        <span class="qr-num">1</span>
        <div class="qr-body">
          <span class="lbl">{t.stepSite}</span>
          <div class="qr-chips">
            {known.map((d) => (
              <button key={d} type="button" class="qr-chip" aria-pressed={domain === d} onClick={() => { setDomain(domain === d ? '' : d); setOther(''); }}>
                <SiteIcon domain={d} size={16} /> {d}
              </button>
            ))}
          </div>
          <input class="field qr-other" placeholder={t.otherSite} value={other} aria-label={t.otherSite}
            onInput={(e) => { setOther(e.currentTarget.value); setDomain(''); }} />
        </div>
      </div>

      <div class="qr-step">
        <span class="qr-num">2</span>
        <div class="qr-body">
          <span class="lbl">{t.stepDays}</span>
          <div class="qr-chips">
            {DAY_PRESETS.map((p) => (
              <button key={p.id} type="button" class="qr-chip" aria-pressed={dayPresetOf(days) === p.id} onClick={() => setDays(p.days)}>{p.label}</button>
            ))}
          </div>
          <div class="qr-days" role="group" aria-label="Dias da semana">
            {WEEK_ORDER.map((d) => (
              <button key={d} type="button" class="day" aria-pressed={days.includes(d)} onClick={() => setDays(toggleDay(days, d))}>{DAY_SHORT[d]}</button>
            ))}
          </div>
        </div>
      </div>

      <div class="qr-step">
        <span class="qr-num">3</span>
        <div class="qr-body">
          <span class="lbl">{t.stepTime}</span>
          <div class="qr-chips">
            {TIME_PRESETS.map((p) => (
              <button key={p.id} type="button" class="qr-chip" aria-pressed={timeId === p.id} onClick={() => setTimeId(p.id)}>{p.label}</button>
            ))}
            <button type="button" class="qr-chip" aria-pressed={timeId === 'custom'} onClick={() => setTimeId('custom')}>{t.customTime}</button>
          </div>
          {timeId === 'custom' && (
            <div class="time-row qr-times">
              <label><span class="lbl">{t.from}</span><input class="field" type="time" value={from} onInput={(e) => setFrom(e.currentTarget.value)} /></label>
              <label><span class="lbl">{t.to}</span><input class="field" type="time" value={to} onInput={(e) => setTo(e.currentTarget.value)} /></label>
            </div>
          )}
        </div>
      </div>

      <div class="qr-step">
        <span class="qr-num">4</span>
        <div class="qr-body">
          <span class="lbl">{t.stepAction}</span>
          <div class="qr-actions">
            <button type="button" class="qr-choice m-blocked" aria-pressed={action === 'block'} onClick={() => setAction('block')}>
              <strong>{t.block}</strong><span>{t.blockHint}</span>
            </button>
            <button type="button" class="qr-choice m-restricted" aria-pressed={action === 'hide'} onClick={() => setAction('hide')}>
              <strong>{isService ? t.hide : t.hideOther}</strong><span>{isService ? t.hideHint : t.hideOtherHint}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="qr-foot">
        <p class="qr-summary" aria-live="polite">
          {chosen
            ? t.summary(action === 'block' ? 'Bloquear' : isService ? 'Esconder partes de' : 'Perguntar a intenção em', chosen, formatDays(days).toLowerCase(), timeLabel)
            : t.pickSite}
        </p>
        <button class="btn btn-primary" onClick={() => void create()}>{t.create}</button>
      </div>
      {error && <p class="notice error" role="alert">{error}</p>}
    </section>
  );
}
