import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '../theme.css';
import './popup.css';
import { Candle } from '../candle/Candle';
import {
  DURATION_PRESETS_MIN, MAX_DURATION_MIN, MIN_DURATION_MIN, candleProgress, formatRemaining, isValidDuration, remainingMs,
} from '../../core/session';
import type { Environment, Session, Settings, Strictness } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { planForEnvironment } from '../../core/blocking';
import { findRule } from '../../core/matching';
import { parseYouTubeLinks } from '../../core/youtube';
import { youtubeUi } from '../i18n/pt-BR';
import { ensureHostAccess } from '../../platform/chrome/permissions';
import { createServices } from '../../platform/chrome/services';
import { initTheme } from '../shared/theme';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

const services = createServices();
initTheme();

function StartForm({ skin }: { skin: string }) {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [envId, setEnvId] = useState('');
  const [minutes, setMinutes] = useState(25);
  const [custom, setCustom] = useState(false);
  const [strictness, setStrictness] = useState<Strictness>('focus');
  const [error, setError] = useState('');
  const [links, setLinks] = useState('');

  useEffect(() => {
    void services.environments.list().then((list) => {
      setEnvs(list);
      setEnvId((id) => id || list[0]?.id || '');
    });
  }, []);

  const selected = envs.find((e) => e.id === envId);
  const youtubeRule = selected && findRule(selected, 'www.youtube.com');
  const usesYouTube = youtubeRule?.mode === 'restricted' && youtubeRule.restrictedKind === 'youtube';

  async function start() {
    const environment = envs.find((e) => e.id === envId);
    if (!environment) return setError('Crie um ambiente nas opções primeiro.');
    if (!isValidDuration(minutes)) return setError(`Escolha entre ${MIN_DURATION_MIN} e ${MAX_DURATION_MIN} minutos.`);
    const parsed = parseYouTubeLinks(usesYouTube ? links : '');
    if (parsed.invalid.length) return setError(youtubeUi.invalid(parsed.invalid));
    // O redirect do bloqueio precisa de acesso aos sites. Pedido aqui, direto do clique.
    const plan = planForEnvironment(environment);
    if (!(await ensureHostAccess([...plan.block, ...plan.intent]))) {
      return setError('Sem acesso aos sites bloqueados, a vela não conseguiria protegê-lo. Permita o acesso ou use outro ambiente.');
    }
    try {
      await services.sessionService.start({ environment, minutes, strictness, youtubeAllowlist: parsed.links });
    } catch {
      setError('Não foi possível acender a vela.');
    }
  }

  return (
    <>
      <p class="greeting">Vamos acender uma vela?</p>
      <div class="popup-candle small"><Candle skin={skin} progress={1} lit={false} label="Vela apagada" /></div>
      <form class="form" onSubmit={(e) => { e.preventDefault(); void start(); }}>
        <label>
          <span class="lbl">Ambiente</span>
          <select class="field full" value={envId} onChange={(e) => setEnvId(e.currentTarget.value)}>
            {envs.map((e) => <option value={e.id}>{e.name}</option>)}
          </select>
        </label>

        <div>
          <span class="lbl">Duração</span>
          <div class="chips">
            {DURATION_PRESETS_MIN.map((m) => (
              <button type="button" class="chip" aria-pressed={!custom && minutes === m}
                onClick={() => { setCustom(false); setMinutes(m); }}>{m} min</button>
            ))}
            <button type="button" class="chip" aria-pressed={custom} onClick={() => setCustom(true)}>Outro</button>
          </div>
          {custom && (
            <input class="field full" type="number" min={MIN_DURATION_MIN} max={MAX_DURATION_MIN} value={minutes}
              aria-label="Minutos" onInput={(e) => setMinutes(Number(e.currentTarget.value))} />
          )}
        </div>

        {usesYouTube && (
          <details class="yt">
            <summary>{youtubeUi.summary}</summary>
            <textarea class="field full" rows={4} placeholder={youtubeUi.placeholder} value={links}
              onInput={(e) => setLinks(e.currentTarget.value)} spellcheck={false} />
            <p class="hint">{youtubeUi.help}</p>
          </details>
        )}

        <div>
          <span class="lbl">Modo</span>
          <div class="chips">
            <button type="button" class="chip" aria-pressed={strictness === 'focus'} onClick={() => setStrictness('focus')}>Foco</button>
            <button type="button" class="chip" aria-pressed={strictness === 'light'} onClick={() => setStrictness('light')}>Leve</button>
          </div>
          <p class="hint">{strictness === 'focus' ? 'Desistir dá um pouco de trabalho, de propósito.' : 'Você pode parar com uma confirmação.'}</p>
        </div>

        {error && <p class="error" role="alert">{error}</p>}
        <button class="btn btn-primary full" type="submit" disabled={!envs.length}>Acender vela</button>
      </form>
    </>
  );
}

function Running({ session, skin, now }: { session: Session; skin: string; now: number }) {
  // O popup fecha ao perder o foco: a fricção acontece numa aba própria.
  async function stop() {
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/friction/index.html') });
    window.close();
  }
  return (
    <>
      <p class="greeting">Sua vela está acesa</p>
      <div class="popup-candle"><Candle skin={skin} progress={candleProgress(session, now)} label="Vela acesa, sessão em andamento" /></div>
      <p class="time">{formatRemaining(Math.min(remainingMs(session, now), session.plannedMs))}</p>
      <p class="sub">{session.environmentSnapshot.name}</p>
      <button class="btn btn-ghost" onClick={stop}>Preciso parar antes da hora</button>
    </>
  );
}

function Popup() {
  const { value: session, loaded } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(1000);
  const skin = (settings ?? DEFAULT_SETTINGS).candleSkin;

  // Se a sessão venceu enquanto ninguém olhava, conclui agora (idempotente).
  useEffect(() => { void services.sessionService.reconcile(); }, []);
  useEffect(() => {
    if (session && remainingMs(session, now) === 0) void services.sessionService.reconcile();
  }, [session, now]);

  const active = session?.status === 'active' && remainingMs(session, now) > 0 ? session : undefined;

  return (
    <main class="popup">
      {!loaded ? null : active ? <Running session={active} skin={skin} now={now} /> : <StartForm skin={skin} />}
      <button class="btn btn-ghost" onClick={() => chrome.runtime.openOptionsPage()}>Ambientes e opções</button>
    </main>
  );
}

render(<Popup />, document.getElementById('app')!);
