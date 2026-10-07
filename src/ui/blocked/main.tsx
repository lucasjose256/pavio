import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import '../theme.css';
import './blocked.css';
import { Candle } from '../candle/Candle';
import type { Policy, Session, Settings, Strictness } from '../../core/models';
import { frictionForRelease } from '../../core/friction';
import { RELEASE_OPTIONS_MIN, addRelease } from '../../core/release';
import { DEFAULT_SETTINGS } from '../../core/models';
import { hostMatchesDomain } from '../../core/matching';
import { blockStillApplies } from '../../core/policy';
import { onBreak } from '../../core/pomodoro';
import { candleProgress, formatRemaining, remainingMs } from '../../core/session';
import { formatMinutes } from '../../core/timeslots';
import { createServices } from '../../platform/chrome/services';
import { blockedWhy, breakUi, limitUi, quotes, releaseUi, releasedUi } from '../i18n/pt-BR';
import { FrictionGate } from '../shared/FrictionGate';
import { formatWhen } from '../shared/format';
import { initTheme } from '../shared/theme';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

const services = createServices();
initTheme();

/** "Precisa dele agora?": liberar por 5/15/30 min, com a fricção escolhida nas opções (Leve ou Firme). */
function ReleasePanel({ domain, level, limited }: { domain: string; level: Strictness; limited: boolean }) {
  const [minutes, setMinutes] = useState<number>();
  async function release(min: number) {
    await services.releases.save(addRelease(await services.releases.list(), domain, min, Date.now()));
    setMinutes(undefined); // o background recalcula a política e esta página se libera sozinha
  }
  const section = limited ? 'limite' : 'rotina';
  return (
    <section class="release" aria-label="Liberar por um tempo">
      {minutes === undefined ? (
        <>
          <p class="release-ask">{releaseUi.ask}</p>
          <div class="release-options">
            {RELEASE_OPTIONS_MIN.map((m) => <button key={m} class="btn" onClick={() => setMinutes(m)}>{releaseUi.option(m)}</button>)}
          </div>
          <button class="link" onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL(`src/ui/options/index.html#${section}`) })}>{releaseUi.forever}</button>
        </>
      ) : (
        <>
          <p class="release-ask">{releaseUi.confirmQuestion(domain, minutes)}</p>
          <FrictionGate steps={frictionForRelease(level)} action={releaseUi.action(minutes)} onDone={() => release(minutes)} onCancel={() => setMinutes(undefined)} />
        </>
      )}
    </section>
  );
}

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
  const limitedDomain = site ? policy?.limitReached?.find((d) => hostMatchesDomain(site, d)) : undefined;
  const resting = timer && onBreak(timer) ? timer : undefined;
  const releasable = site ? policy?.releasable?.find((d) => hostMatchesDomain(site, d)) : undefined;
  const releasedUntil = site ? policy?.released?.find((r) => hostMatchesDomain(site, r.domain))?.until : undefined;

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
          {releasedUntil && <p class="time">{releasedUi.backAt(clock(releasedUntil))}</p>}
        </>
      ) : (
        limitedDomain ? (
          <>
            <p class="quote">{limitUi.title}</p>
            <p class="site">{limitUi.message(limitedDomain)}</p>
            {policy?.nextChange && <p class="time">{releasedUi.until(formatWhen(policy.nextChange, now))}</p>}
          </>
        ) : (
        <>
          <p class="quote">{quote}</p>
          {why ? <p class="site">{why}</p> : site && <p class="site">{site} está fora do seu foco agora. Tudo bem, ele espera.</p>}
          {timer && <p class="time">{formatRemaining(remainingMs(timer, now))} até a vela acabar</p>}
          {!timer && policy?.nextChange && <p class="time">{releasedUi.until(formatWhen(policy.nextChange, now))}</p>}
        </>
        )
      )}

      <div class="actions">
        <button class="btn" onClick={goBack}>Voltar</button>
        {released && site && <a class="btn btn-primary" href={`https://${site}/`}>{breakUi.open(site)}</a>}
      </div>
      {!released && loaded && releasable && (settings ?? DEFAULT_SETTINGS).releaseOffer && <ReleasePanel domain={releasable} level={(settings ?? DEFAULT_SETTINGS).friction} limited={!!limitedDomain} />}
    </main>
  );
}

render(<Blocked />, document.getElementById('app')!);
