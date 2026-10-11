import { useState } from 'preact/hooks';
import type { PomodoroConfig } from '../../core/models';
import { DEFAULT_POMODORO, POMODORO_LIMITS } from '../../core/pomodoro';

interface Props {
  /** Pomodoro em uso (ausente = desligado). */
  value: PomodoroConfig | undefined;
  /** O que ligar ao marcar (a sugestão para o tempo escolhido). */
  suggestion: PomodoroConfig;
  onToggle: (on: boolean) => void;
  onChange: (value: PomodoroConfig) => void;
}

const summary = (c: PomodoroConfig) => `foco ${c.focusMin} · pausa ${c.breakMin} min${c.longBreakMin > 0 ? ` · longa ${c.longBreakMin}` : ''}`;

/**
 * Pomodoro em UM cartão: interruptor + resumo do que está valendo, e "Ajustar" para mexer em foco, pausa e pausa longa.
 * Na pausa os bloqueios do timer se desligam sozinhos (a rotina continua firme).
 */
export function PomodoroFields({ value, suggestion, onToggle, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const shown = value ?? suggestion;
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
  const set = (patch: Partial<PomodoroConfig>) => value && onChange({ ...value, ...patch });
  const longOn = !!value && value.longBreakMin > 0;

  return (
    <section class={`pomo-card ${value ? 'on' : ''}`} aria-label="Pomodoro">
      <div class="pomo-head">
        <label class="pomo-toggle">
          <span class="switch"><input type="checkbox" checked={!!value} onChange={(e) => onToggle(e.currentTarget.checked)} aria-label="Pomodoro" /><span /></span>
          <span class="pomo-title">
            <strong>Pomodoro</strong>
            <small>{summary(shown)}</small>
          </span>
        </label>
        {value && (
          <button type="button" class="pomo-adjust" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Pronto' : 'Ajustar'}</button>
        )}
      </div>
      <p class="pomo-note">{value ? 'Nas pausas, os bloqueios da vela se desligam sozinhos.' : 'Sem pausas: a vela bloqueia o tempo todo.'}</p>

      {value && open && (
        <div class="pomo-grid">
          <label><span>Foco</span>
            <span class="pomo-num"><input class="field" type="number" min={POMODORO_LIMITS.focus[0]} max={POMODORO_LIMITS.focus[1]} value={value.focusMin} onInput={(e) => set({ focusMin: num(e) })} /> min</span></label>
          <label><span>Pausa</span>
            <span class="pomo-num"><input class="field" type="number" min={POMODORO_LIMITS.break[0]} max={POMODORO_LIMITS.break[1]} value={value.breakMin} onInput={(e) => set({ breakMin: num(e) })} /> min</span></label>
          <label class="pomo-long-toggle">
            <input type="checkbox" checked={longOn}
              onChange={(e) => set({ longBreakMin: e.currentTarget.checked ? DEFAULT_POMODORO.longBreakMin : 0, cyclesBeforeLong: value.cyclesBeforeLong || DEFAULT_POMODORO.cyclesBeforeLong })} />
            Pausa longa
          </label>
          {longOn && (
            <>
              <label><span>Dura</span>
                <span class="pomo-num"><input class="field" type="number" min={1} max={POMODORO_LIMITS.long[1]} value={value.longBreakMin} onInput={(e) => set({ longBreakMin: num(e) })} /> min</span></label>
              <label><span>A cada</span>
                <span class="pomo-num"><input class="field" type="number" min={POMODORO_LIMITS.cycles[0]} max={POMODORO_LIMITS.cycles[1]} value={value.cyclesBeforeLong} onInput={(e) => set({ cyclesBeforeLong: num(e) })} /> focos</span></label>
            </>
          )}
        </div>
      )}
    </section>
  );
}
