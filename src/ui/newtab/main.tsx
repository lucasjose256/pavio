import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '../theme.css';
import './newtab.css';
import { Candle } from '../candle/Candle';
import type { Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { candleProgress } from '../../core/session';
import { newTabUi } from '../i18n/pt-BR';
import { initTheme } from '../shared/theme';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

initTheme();
const CLOSE_AFTER_S = 3;

function closeThisTab() {
  chrome.tabs.getCurrent().then((tab) => (tab?.id !== undefined ? chrome.tabs.remove(tab.id) : window.close()));
}

/** Aviso calmo: a aba nova foi barrada e se fecha sozinha em instantes. */
function NewTab() {
  const { value: session } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(1000);
  const [left, setLeft] = useState(CLOSE_AFTER_S);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (left <= 0) closeThisTab(); }, [left]);

  return (
    <main class="newtab">
      <div class="newtab-candle">
        <Candle skin={(settings ?? DEFAULT_SETTINGS).candleSkin} progress={session ? candleProgress(session, now) : 1} lit label="Vela acesa" />
      </div>
      <h1>{newTabUi.title}</h1>
      <p class="msg">{newTabUi.message}</p>
      <button class="btn btn-primary" onClick={closeThisTab}>{newTabUi.close(Math.max(left, 0))}</button>
    </main>
  );
}

render(<NewTab />, document.getElementById('app')!);
