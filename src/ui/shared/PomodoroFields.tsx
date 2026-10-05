import type { PomodoroConfig } from '../../core/models';
import { DEFAULT_POMODORO, POMODORO_LIMITS } from '../../core/pomodoro';

interface Props {
  value: PomodoroConfig | undefined;
  onChange: (value: PomodoroConfig | undefined) => void;
}

/** Liga/desliga o Pomodoro automático e ajusta foco, pausa e pausa longa. */
export function PomodoroFields({ value, onChange }: Props) {
  const set = (patch: Partial<PomodoroConfig>) => value && onChange({ ...value, ...patch });
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
  const longOn = !!value && value.longBreakMin > 0;

  return (
    <div class="pomo">
      <label class="pomo-toggle">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.currentTarget.checked ? { ...DEFAULT_POMODORO } : undefined)} />
        <span><strong>Pomodoro automático</strong> <span class="pomo-sub">pausas que liberam os bloqueios, sozinhas</span></span>
      </label>
      {value && (
        <div class="pomo-body">
          <span class="pomo-unit">tempos em minutos</span>
          <label>Foco <input class="field num" type="number" min={POMODORO_LIMITS.focus[0]} max={POMODORO_LIMITS.focus[1]} value={value.focusMin} onInput={(e) => set({ focusMin: num(e) })} /></label>
          <label>Pausa <input class="field num" type="number" min={POMODORO_LIMITS.break[0]} max={POMODORO_LIMITS.break[1]} value={value.breakMin} onInput={(e) => set({ breakMin: num(e) })} /></label>
          <label class="pomo-long">
            <input type="checkbox" checked={longOn} onChange={(e) => set({ longBreakMin: e.currentTarget.checked ? DEFAULT_POMODORO.longBreakMin : 0, cyclesBeforeLong: value.cyclesBeforeLong || DEFAULT_POMODORO.cyclesBeforeLong })} />
            Pausa longa
            <input class="field num" type="number" min={1} max={POMODORO_LIMITS.long[1]} disabled={!longOn} value={value.longBreakMin || DEFAULT_POMODORO.longBreakMin} onInput={(e) => set({ longBreakMin: num(e) })} />
            a cada
            <input class="field num" type="number" min={POMODORO_LIMITS.cycles[0]} max={POMODORO_LIMITS.cycles[1]} disabled={!longOn} value={value.cyclesBeforeLong} onInput={(e) => set({ cyclesBeforeLong: num(e) })} />
            focos
          </label>
        </div>
      )}
    </div>
  );
}
