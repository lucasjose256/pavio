import { render } from 'preact';
import { useMemo } from 'preact/hooks';
import '../theme.css';
import './blocked.css';
import { Candle } from '../candle/Candle';
import { candleProgress, formatRemaining, remainingMs } from '../../core/session';
import type { Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { quotes } from '../i18n/pt-BR';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

function Blocked() {
  const site = new URLSearchParams(location.search).get('site');
  const { value: session } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(1000);
  const quote = useMemo(() => quotes[Math.floor(Math.random() * quotes.length)], []);
  const active = session?.status === 'active' && remainingMs(session, now) > 0 ? session : undefined;

  return (
    <main class="blocked">
      <div class="blocked-candle">
        <Candle
          skin={(settings ?? DEFAULT_SETTINGS).candleSkin}
          progress={active ? candleProgress(active, now) : 1}
          lit
          label="Vela acesa"
        />
      </div>
      <p class="quote">{quote}</p>
      {site && <p class="site">{site} está fora do seu ambiente agora.</p>}
      {active && <p class="time">{formatRemaining(remainingMs(active, now))} até a vela acabar</p>}
      <button class="btn" onClick={() => history.length > 1 ? history.back() : window.close()}>Voltar</button>
    </main>
  );
}

render(<Blocked />, document.getElementById('app')!);
