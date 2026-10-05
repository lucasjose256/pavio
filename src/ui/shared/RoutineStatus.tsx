import type { RoutineSite, Settings } from '../../core/models';
import { activeRules, nextBoundary } from '../../core/routine';
import { formatWhen } from './format';
import { useNow } from './useNow';
import { useStorageValue } from './useStorageValue';

const openRoutine = () => chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/options/index.html#rotina') });

/** Uma linha com o estado da rotina (ligada/desligada, protegendo agora, próxima proteção). */
export function RoutineStatus() {
  const { value: routine, loaded } = useStorageValue<RoutineSite[]>('routine');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(30_000);
  if (!loaded || !routine?.length) return null;

  const enabled = settings?.routineEnabled ?? false;
  const active = activeRules(routine, enabled, now);
  const next = nextBoundary(routine, enabled, now);

  if (!enabled) return <button class="routine-line off" onClick={openRoutine}>Rotina desligada · ligar nas opções</button>;
  if (active.length) {
    return (
      <button class="routine-line on" onClick={openRoutine}>
        Rotina protegendo {active.length} {active.length === 1 ? 'site' : 'sites'}{next ? ` · muda ${formatWhen(next, now)}` : ''}
      </button>
    );
  }
  return <button class="routine-line" onClick={openRoutine}>Rotina: livre agora{next ? ` · próxima ${formatWhen(next, now)}` : ''}</button>;
}
