import { render } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import '../theme.css';
import './friction.css';
import { Candle } from '../candle/Candle';
import { evaluateFriction, frictionFor } from '../../core/friction';
import { candleProgress, formatRemaining, remainingMs } from '../../core/session';
import type { Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { createServices } from '../../platform/chrome/services';
import { friction as t } from '../i18n/pt-BR';
import { initTheme } from '../shared/theme';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

const services = createServices();
initTheme();

function closeThisTab() {
  chrome.tabs.getCurrent().then((tab) => (tab?.id !== undefined ? chrome.tabs.remove(tab.id) : window.close()));
}

function Friction() {
  const { value: session, loaded } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(250);
  const openedAt = useRef(Date.now());
  const [typed, setTyped] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [ended, setEnded] = useState(false);
  const skin = (settings ?? DEFAULT_SETTINGS).candleSkin;

  const active = session?.status === 'active' && remainingMs(session, now) > 0 ? session : undefined;
  const steps = useMemo(() => frictionFor(active?.strictness ?? 'focus'), [active?.strictness]);
  const status = evaluateFriction(steps, { elapsedMs: now - openedAt.current, typed, confirmed, challengesPassed: [] });
  const phraseStep = steps.find((s) => s.type === 'typePhrase');
  const waits = steps.some((s) => s.type === 'wait');
  const light = steps.some((s) => s.type === 'confirm');

  async function giveUp() {
    if (!status.done) return; // a UI já desabilita; reforço contra Enter/atalhos
    await services.sessionService.abandon();
    setEnded(true);
  }

  if (!loaded) return null;

  if (ended || !active) {
    return (
      <main class="friction">
        <div class="friction-candle"><Candle skin={skin} progress={ended ? 0 : 1} lit={false} label="Vela apagada" /></div>
        <h1>{ended ? t.doneTitle : t.noSessionTitle}</h1>
        <p class="msg">{ended ? t.doneMessage : t.noSessionMessage}</p>
        <button class="btn btn-primary" onClick={closeThisTab}>{t.close}</button>
      </main>
    );
  }

  const secondsLeft = Math.ceil(status.waitRemainingMs / 1000);
  return (
    <main class="friction">
      <div class="friction-candle"><Candle skin={skin} progress={candleProgress(active, now)} label="Vela acesa" /></div>
      <h1>{t.title}</h1>
      <p class="msg">{light ? t.lightMessage : t.focusMessage}</p>
      <p class="time">{formatRemaining(Math.min(remainingMs(active, now), active.plannedMs))} até a vela acabar</p>

      <form class="steps" onSubmit={(e) => { e.preventDefault(); void giveUp(); }}>
        {waits && <p class="wait" aria-live="polite">{secondsLeft > 0 ? t.waitLeft(secondsLeft) : t.waitDone}</p>}
        {phraseStep?.type === 'typePhrase' && (
          <label>
            <span class="prompt">{t.typePrompt} <q>{phraseStep.phrase}</q></span>
            <input class="field full" value={typed} placeholder={t.phrasePlaceholder} autocomplete="off" spellcheck={false}
              onInput={(e) => setTyped(e.currentTarget.value)}
              onPaste={(e) => e.preventDefault() /* de propósito: tem que digitar */} />
          </label>
        )}
        {light && (
          <label class="check">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.currentTarget.checked)} />
            Sim, quero encerrar agora
          </label>
        )}
        <div class="buttons">
          <button type="button" class="btn btn-primary" onClick={closeThisTab}>{t.keepFocus}</button>
          <button type="submit" class="btn btn-ghost" disabled={!status.done}>{t.giveUp}</button>
        </div>
      </form>
    </main>
  );
}

render(<Friction />, document.getElementById('app')!);
