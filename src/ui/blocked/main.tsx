import { render } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import '../theme.css';
import './blocked.css';
import { Candle } from '../candle/Candle';
import { candleProgress, formatRemaining, remainingMs } from '../../core/session';
import type { Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { blockedWhy, breakUi, quotes } from '../i18n/pt-BR';
import { onBreak } from '../../core/pomodoro';
import { formatMinutes } from '../../core/schedule';
import { createServices } from '../../platform/chrome/services';
import { initTheme } from '../shared/theme';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

const services = createServices();
initTheme();

function goBack() {
  if (history.length > 1) history.back();
  else void chrome.tabs.update({ url: 'chrome://newtab/' });
}

function Blocked() {
  const params = new URLSearchParams(location.search);
  const site = params.get('site');
  const why = blockedWhy[params.get('why') ?? ''];
  const { value: session, loaded } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(1000);
  const quote = useMemo(() => quotes[Math.floor(Math.random() * quotes.length)], []);
  useEffect(() => {
    if (site) void services.sessionService.recordBlockedAttempt();
  }, [site]);
  const active = session?.status === 'active' && remainingMs(session, now) > 0 ? session : undefined;
  // Pausa do Pomodoro: o site está liberado. A página abre-se sozinha para quem já estava aqui.
  const resting = active && onBreak(active) ? active : undefined;
  const breakEnd = resting?.pomodoro ? new Date(resting.pomodoro.phaseEndsAt) : undefined;

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
      <p class="quote">{resting ? breakUi.title : quote}</p>
      {resting && breakEnd && <p class="site">{breakUi.message(site, formatMinutes(breakEnd.getHours() * 60 + breakEnd.getMinutes()))}</p>}
      {!resting && why && <p class="site">{why}</p>}
      {!resting && !why && site && <p class="site">{site} está fora do seu ambiente agora. Tudo bem, ele espera.</p>}
      {active && !resting && <p class="time">{formatRemaining(remainingMs(active, now))} até a vela acabar</p>}
      {!active && loaded && <p class="time">A vela acabou. Você chegou até o fim. 🕯️</p>}
      <div class="actions">
        <button class="btn" onClick={goBack}>Voltar</button>
        {(resting || (!active && loaded)) && site && <a class="btn btn-primary" href={`https://${site}/`}>{breakUi.open(site)}</a>}
      </div>
    </main>
  );
}

render(<Blocked />, document.getElementById('app')!);
