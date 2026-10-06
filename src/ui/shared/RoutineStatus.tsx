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
  const sites = routine ?? [];
  if (!loaded || sites.length === 0) return null; // rotina vazia: nada a dizer

  const enabled = settings?.routineEnabled ?? true;
  const active = activeRules(sites, enabled, now);
  const next = nextBoundary(sites, enabled, now);

  if (active.length) {
    return (
      <button class="routine-line on" onClick={openRoutine}>
        Protegendo {active.length} {active.length === 1 ? 'site' : 'sites'}{next ? ` · muda ${formatWhen(next, now)}` : ''}
      </button>
    );
  }
  if (!enabled) return <button class="routine-line off" onClick={openRoutine}>Horários desligados · ligar nas opções</button>;
  return <button class="routine-line" onClick={openRoutine}>Rotina: livre agora{next ? ` · próxima ${formatWhen(next, now)}` : ''}</button>;
}
