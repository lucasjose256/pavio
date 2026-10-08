import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import '../theme.css';
import './blocked.css';
import { Candle } from '../candle/Candle';
import type { Policy, Session, Settings, Strictness } from '../../core/models';
import { frictionForRelease } from '../../core/friction';
import { RELEASE_OPTIONS_MIN, addRelease } from '../../core/release';
import { DEFAULT_SETTINGS } from '../../core/models';
import { hostMatchesDomain } from '../../core/matching';
import { rawNextParam, returnTarget } from '../../core/return-url';
import { blockStillApplies, returnTimeFor } from '../../core/policy';
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

/**
 * Depois de liberar, o Chrome ainda leva um instante para tirar a regra de bloqueio da rede: navegar antes disso
 * mandaria a pessoa de volta para esta mesma tela. Espera a regra sumir (no máximo ~4 s).
 */
async function waitForRuleRemoval(site: string) {
  for (let i = 0; i < 40; i++) {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const stillThere = rules.some((r) => r.id < 500 && r.condition.requestDomains?.some((d) => hostMatchesDomain(site, d)));
    if (!stillThere) return;
    await new Promise((r) => setTimeout(r, 100));
  }
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
  // Onde a pessoa estava (quando sabemos) ou a página inicial do site.
  const destination = site ? returnTarget(site, rawNextParam(location.search)) : undefined;
  // Voltar sozinho só quando o site era bloqueado AQUI e é liberado enquanto a página está aberta (mais tempo, pausa,
  // regra desligada, fim da faixa). Na pausa do Pomodoro a página fica, para a pessoa respirar e escolher.
  const cameBack = params.get('back') === '1';
  const sawBlocked = useRef(false);
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    if (stillBlocked) { sawBlocked.current = true; return; }
    if (!sawBlocked.current || resting || !site || !destination) return;
    sawBlocked.current = false;
    setReturning(true);
    void waitForRuleRemoval(site).then(() => {
      // Aba que já estava aberta: voltar pelo histórico deixa o Chrome restaurar a página como estava (rolagem, vídeo,
      // texto digitado), em vez de recarregá-la do zero. Se não sair daqui, abre o endereço.
      if (cameBack && history.length > 1) {
        history.back();
        setTimeout(() => location.replace(destination), 1500);
      } else location.replace(destination);
    });
  }, [loaded, stillBlocked, !!resting]);
  // Quando ESTE site (ou recurso) volta de verdade; sem fim à vista, não prometemos horário nenhum.
  const returnAt = returnTimeFor(policy, site, !!why);
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
          {returning && <p class="time" role="status">{releasedUi.returning(site)}</p>}
          {releasedUntil && <p class="time">{releasedUi.backAt(clock(releasedUntil))}</p>}
        </>
      ) : (
        limitedDomain ? (
          <>
            <p class="quote">{limitUi.title}</p>
            <p class="site">{limitUi.message(limitedDomain)}</p>
            {returnAt && <p class="time">{releasedUi.until(formatWhen(returnAt, now))}</p>}
          </>
        ) : (
        <>
          <p class="quote">{quote}</p>
          {why ? <p class="site">{why}</p> : site && <p class="site">{site} está fora do seu foco agora. Tudo bem, ele espera.</p>}
          {returnAt && (timer && returnAt === timer.endsAt
            ? <p class="time">{formatRemaining(remainingMs(timer, now))} até a vela acabar</p>
            : <p class="time">{releasedUi.until(formatWhen(returnAt, now))}</p>)}
        </>
        )
      )}

      <div class="actions">
        <button class="btn" onClick={goBack}>Voltar</button>
        {released && site && <a class="btn btn-primary" href={destination ?? `https://${site}/`}>{breakUi.open(site)}</a>}
      </div>
      {!released && loaded && releasable && (settings ?? DEFAULT_SETTINGS).releaseOffer && <ReleasePanel domain={releasable} level={(settings ?? DEFAULT_SETTINGS).friction} limited={!!limitedDomain} />}
    </main>
  );
}

render(<Blocked />, document.getElementById('app')!);
