import { useEffect, useState } from 'preact/hooks';
import type { Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { candleProgress, formatRemaining, remainingMs } from '../../core/session';
import { Candle } from '../candle/Candle';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';
import { Icon } from './icons';
import { AppearanceTab } from './AppearanceTab';
import { EnvironmentsTab } from './EnvironmentsTab';
import { FrictionTab } from './FrictionTab';
import { HistoryTab } from './HistoryTab';
import { RoutineTab, type RoutineView } from './RoutineTab';

/** Seções das opções. Os ids são os hashes da URL (`#rotina` continua sendo a de entrada). */
const NAV = [
  { group: 'Bloqueios', items: [
    { id: 'rotina', label: 'Horários', icon: 'clock', note: 'por dia e hora' },
    { id: 'bloqueio', label: 'Bloqueio rápido', icon: 'ban', note: 'o app inteiro, já' },
    { id: 'limite', label: 'Limite de tempo', icon: 'hourglass', note: 'minutos por dia' },
    { id: 'liberar', label: 'Para liberar', icon: 'key', note: 'leve ou firme' },
  ] },
  { group: 'Você', items: [
    { id: 'historico', label: 'Histórico', icon: 'chart', note: 'horas devolvidas' },
    { id: 'aparencia', label: 'Vela e tema', icon: 'palette', note: 'estilo e cores' },
  ] },
] as const;
type TabId = 'ambientes' | (typeof NAV)[number]['items'][number]['id'];
const IDS: TabId[] = ['ambientes', ...NAV.flatMap((g) => g.items.map((i) => i.id))];
const ROUTINE_VIEWS: Partial<Record<TabId, RoutineView>> = { rotina: 'schedule', bloqueio: 'quick', limite: 'limits' };

const fromHash = (): TabId => IDS.find((id) => `#${id}` === location.hash) ?? 'rotina';

export function App() {
  const [tab, setTab] = useState<TabId>(fromHash());
  const { value: session } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(1000);
  const running = session?.status === 'active' && remainingMs(session, now) > 0 ? session : undefined;
  const skin = (settings ?? DEFAULT_SETTINGS).candleSkin;

  useEffect(() => {
    const onHash = () => { setTab(fromHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // No celular o menu vira uma fileira que rola: mantém a seção atual à vista.
  useEffect(() => { document.querySelector('.nav-item.on, .timer-card.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [tab]);

  const routineView = ROUTINE_VIEWS[tab];

  return (
    <div class="shell">
      <aside class="side">
        <div class="brand">
          <h1>Pavio</h1>
          <p>Você não controla você, mas pode controlar seu ambiente.</p>
        </div>

        {/* O Timer em destaque: a vela, com o estado da sessão, leva aos ambientes. */}
        <a href="#ambientes" class={`timer-card ${tab === 'ambientes' ? 'on' : ''} ${running ? 'lit' : ''}`} aria-current={tab === 'ambientes' ? 'page' : undefined}>
          <span class="timer-candle" aria-hidden="true"><Candle skin={skin} progress={running ? candleProgress(running, now) : 1} lit /></span>
          <span class="timer-text">
            <strong>Timer</strong>
            <span>{running ? `${formatRemaining(Math.min(remainingMs(running, now), running.plannedMs))} · ${running.environmentSnapshot.name}` : 'Ambientes e vela para um foco extra'}</span>
          </span>
        </a>

        <nav aria-label="Seções">
          {NAV.map((g) => (
            <div key={g.group} class="nav-group">
              <span class="nav-title">{g.group}</span>
              {g.items.map((i) => (
                <a key={i.id} href={`#${i.id}`} class={`nav-item ${tab === i.id ? 'on' : ''}`} aria-current={tab === i.id ? 'page' : undefined}>
                  <span class="nav-icon" aria-hidden="true"><Icon name={i.icon} /></span>
                  <span class="nav-label">{i.label}<small>{i.note}</small></span>
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div class="content">
        {/* Todas ficam montadas: trocar de seção não perde alterações não salvas. */}
        <RoutineTab active={!!routineView} view={routineView ?? 'schedule'} />
        <EnvironmentsTab active={tab === 'ambientes'} />
        <FrictionTab active={tab === 'liberar'} />
        <HistoryTab active={tab === 'historico'} />
        <AppearanceTab active={tab === 'aparencia'} />
      </div>
    </div>
  );
}
