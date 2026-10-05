import { useEffect, useState } from 'preact/hooks';
import { AppearanceTab } from './AppearanceTab';
import { EnvironmentsTab } from './EnvironmentsTab';
import { HistoryTab } from './HistoryTab';
import { RoutineTab } from './RoutineTab';

const TABS = [
  { id: 'rotina', label: 'Rotina' },
  { id: 'ambientes', label: 'Ambientes (Timer)' },
  { id: 'historico', label: 'Histórico' },
  { id: 'aparencia', label: 'Aparência' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const fromHash = (): TabId => TABS.find((t) => `#${t.id}` === location.hash)?.id ?? 'rotina';

export function App() {
  const [tab, setTab] = useState<TabId>(fromHash());

  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div class="page">
      <header class="top">
        <div>
          <h1>Pavio</h1>
          <p>Você não controla você, mas pode controlar seu ambiente.</p>
        </div>
        <nav class="tabs" aria-label="Seções">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} class={`tab ${tab === t.id ? 'on' : ''}`} aria-current={tab === t.id ? 'page' : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
      </header>
      {/* Todas ficam montadas: trocar de aba não perde alterações não salvas. */}
      <RoutineTab active={tab === 'rotina'} />
      <EnvironmentsTab active={tab === 'ambientes'} />
      <HistoryTab active={tab === 'historico'} />
      <AppearanceTab active={tab === 'aparencia'} />
    </div>
  );
}
