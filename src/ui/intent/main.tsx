import { render } from 'preact';
import { useState } from 'preact/hooks';
import '../theme.css';
import './intent.css';
import { Candle } from '../candle/Candle';
import { INTENT_MAX_MINUTES, INTENT_MAX_TEXT, INTENT_MIN_MINUTES, INTENT_PRESETS_MIN, validateIntent } from '../../core/intent-service';
import { hostMatchesDomain } from '../../core/matching';
import type { Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { createServices } from '../../platform/chrome/services';
import { intentPage as t } from '../i18n/pt-BR';
import { initTheme } from '../shared/theme';
import { useStorageValue } from '../shared/useStorageValue';

const services = createServices();
initTheme();

const search = location.search;
const site = new URLSearchParams(search).get('site') ?? '';
// `next` é a última parte e chega sem codificação (ver platform/chrome/blocking.ts).
const rawNext = search.includes('next=') ? search.slice(search.indexOf('next=') + 5) : '';

/** Só volta para o mesmo site (evita virar redirecionador aberto). */
function destination(): string {
  const fallback = `https://${site}/`;
  for (const candidate of [rawNext, safeDecode(rawNext)]) {
    try {
      const url = new URL(candidate);
      if (/^https?:$/.test(url.protocol) && hostMatchesDomain(url.hostname, site)) return url.href;
    } catch { /* tenta o próximo */ }
  }
  return fallback;
}
function safeDecode(v: string) {
  try { return decodeURIComponent(v); } catch { return v; }
}

/** O DNR atualiza as regras de forma assíncrona: espera a regra sumir antes de navegar. */
async function waitForRuleRemoval() {
  for (let i = 0; i < 30; i++) {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    if (!rules.some((r) => r.condition.requestDomains?.[0] === site && r.id >= 500 && r.id < 1000)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

function goBack() {
  if (history.length > 1) history.back();
  else void chrome.tabs.update({ url: 'chrome://newtab/' });
}

function Intent() {
  const { value: session } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const [text, setText] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const skin = (settings ?? DEFAULT_SETTINGS).candleSkin;

  async function enter() {
    const problem = validateIntent(text, minutes);
    if (problem) return setError(problem.startsWith('text') ? t.errors.text : t.errors.minutes);
    setBusy(true);
    try {
      await services.intentService.grant(site, text, minutes);
      await waitForRuleRemoval();
      location.replace(destination());
    } catch {
      setError(t.errors.generic);
      setBusy(false);
    }
  }

  // Sem sessão ativa não há o que perguntar: segue para o site.
  if (session !== undefined && session.status !== 'active') location.replace(destination());

  return (
    <main class="intent">
      <div class="intent-candle"><Candle skin={skin} progress={1} label="Vela acesa" /></div>
      <h1>{t.title}</h1>
      <p class="sub">{t.subtitle(site)}</p>
      <form onSubmit={(e) => { e.preventDefault(); void enter(); }}>
        <input class="field full" autofocus maxLength={INTENT_MAX_TEXT} placeholder={t.placeholder} value={text}
          onInput={(e) => { setText(e.currentTarget.value); setError(''); }} />
        <span class="lbl">{t.duration}</span>
        <div class="chips">
          {INTENT_PRESETS_MIN.map((m) => (
            <button type="button" class="chip" aria-pressed={!custom && minutes === m} onClick={() => { setCustom(false); setMinutes(m); }}>{m} min</button>
          ))}
          <button type="button" class="chip" aria-pressed={custom} onClick={() => setCustom(true)}>{t.other}</button>
          {custom && (
            <input class="field minutes" type="number" min={INTENT_MIN_MINUTES} max={INTENT_MAX_MINUTES} value={minutes}
              aria-label="Minutos" onInput={(e) => setMinutes(Number(e.currentTarget.value))} />
          )}
        </div>
        {error && <p class="error" role="alert">{error}</p>}
        <div class="buttons">
          <button type="submit" class="btn btn-primary" disabled={busy}>{t.enter}</button>
          <button type="button" class="btn btn-ghost" onClick={goBack}>{t.back}</button>
        </div>
      </form>
    </main>
  );
}

render(<Intent />, document.getElementById('app')!);
