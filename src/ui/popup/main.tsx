import { render } from 'preact';
import '../theme.css';
import './popup.css';
import { Candle } from '../candle/Candle';
import { candleProgress, formatRemaining, remainingMs } from '../../core/session';
import type { Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

function Popup() {
  const { value: session } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(1000);
  const skin = (settings ?? DEFAULT_SETTINGS).candleSkin;
  const active = session?.status === 'active' && remainingMs(session, now) > 0 ? session : undefined;

  return (
    <main class="popup">
      <div class="popup-candle">
        <Candle
          skin={skin}
          progress={active ? candleProgress(active, now) : 1}
          lit={Boolean(active)}
          label={active ? 'Vela acesa, sessão em andamento' : 'Vela apagada'}
        />
      </div>
      {active ? (
        <>
          <p class="time" aria-live="off">{formatRemaining(remainingMs(active, now))}</p>
          <p class="sub">{active.environmentSnapshot.name}</p>
        </>
      ) : (
        <>
          <p class="sub">Nenhuma vela acesa.</p>
          <button class="btn btn-primary" disabled title="Chega na próxima etapa">Acender vela</button>
        </>
      )}
      <button class="btn btn-ghost" onClick={() => chrome.runtime.openOptionsPage()}>Ambientes e opções</button>
    </main>
  );
}

render(<Popup />, document.getElementById('app')!);
