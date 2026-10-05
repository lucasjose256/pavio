import { render } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import '../theme.css';
import './blocked.css';
import { Candle } from '../candle/Candle';
import type { Policy, Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { blockStillApplies } from '../../core/policy';
import { onBreak } from '../../core/pomodoro';
import { candleProgress, formatRemaining, remainingMs } from '../../core/session';
import { formatMinutes } from '../../core/timeslots';
import { createServices } from '../../platform/chrome/services';
import { blockedWhy, breakUi, quotes, releasedUi } from '../i18n/pt-BR';
import { formatWhen } from '../shared/format';
import { initTheme } from '../shared/theme';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

const services = createServices();
initTheme();

function goBack() {
  if (history.length > 1) history.back();
  else void chrome.tabs.update({ url: 'chrome://newtab/' });
}

const clock = (ts: number) => formatMinutes(new Date(ts).getHours() * 60 + new Date(ts).getMinutes());

function Blocked() {
  const params = new URLSearchParams(location.search);
  const site = params.get('site');
  const why = blockedWhy[params.get('why') ?? ''];
  const { value: session } = useStorageValue<Session>('activeSession');
  const { value: policy, loaded } = useStorageValue<Policy>('policy');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(1000);
  const quote = useMemo(() => quotes[Math.floor(Math.random() * quotes.length)], []);
  useEffect(() => {
    if (site) void services.sessionService.recordBlockedAttempt();
  }, [site]);

  const timer = session?.status === 'active' && remainingMs(session, now) > 0 ? session : undefined;
  // O site ainda está bloqueado pela política (rotina ou Timer)? Se não, a página que ficou aberta libera sozinha.
  const stillBlocked = blockStillApplies(policy, site, !!why);
  const released = loaded && !stillBlocked;
  const resting = timer && onBreak(timer) ? timer : undefined;

  return (
    <main class="blocked">
      <div class="blocked-candle">
        <Candle skin={(settings ?? DEFAULT_SETTINGS).candleSkin} progress={timer ? candleProgress(timer, now) : 1} lit label="Vela acesa" />
      </div>

      {released ? (
        <>
          <p class="quote">{resting ? breakUi.title : releasedUi.title}</p>
          <p class="site">
            {resting?.pomodoro
              ? breakUi.message(site, clock(resting.pomodoro.phaseEndsAt))
              : releasedUi.message(site)}
          </p>
        </>
      ) : (
        <>
          <p class="quote">{quote}</p>
          {why ? <p class="site">{why}</p> : site && <p class="site">{site} está fora do seu foco agora. Tudo bem, ele espera.</p>}
          {timer && <p class="time">{formatRemaining(remainingMs(timer, now))} até a vela acabar</p>}
          {!timer && policy?.nextChange && <p class="time">{releasedUi.until(formatWhen(policy.nextChange, now))}</p>}
        </>
      )}

      <div class="actions">
        <button class="btn" onClick={goBack}>Voltar</button>
        {released && site && <a class="btn btn-primary" href={`https://${site}/`}>{breakUi.open(site)}</a>}
      </div>
    </main>
  );
}

render(<Blocked />, document.getElementById('app')!);
