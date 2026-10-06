import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '../theme.css';
import './popup.css';
import { Candle } from '../candle/Candle';
import {
  DURATION_PRESETS_MIN, MAX_DURATION_MIN, MIN_DURATION_MIN, isValidDuration, remainingMs,
} from '../../core/session';
import type { Environment, Session, Settings, Strictness } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { accessDomains } from '../../core/blocking';
import { validatePomodoro } from '../../core/pomodoro';
import type { PomodoroConfig } from '../../core/models';
import { PomodoroFields } from '../shared/PomodoroFields';
import { RunningCandle, openFriction } from '../shared/RunningCandle';
import { openFloatingCandle } from '../shared/floating';
import { findRule } from '../../core/matching';
import { parseYouTubeLinks } from '../../core/youtube';
import { pomodoroError, youtubeUi } from '../i18n/pt-BR';
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
  const [pomodoro, setPomodoro] = useState<PomodoroConfig>();

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
    const pomodoroProblem = pomodoro && validatePomodoro(pomodoro);
    if (pomodoroProblem) return setError(pomodoroError(pomodoroProblem));
    const parsed = parseYouTubeLinks(usesYouTube ? links : '');
    if (parsed.invalid.length) return setError(youtubeUi.invalid(parsed.invalid));
    // O redirect do bloqueio precisa de acesso aos sites. Pedido aqui, direto do clique.
    if (!(await ensureHostAccess(accessDomains(environment)))) {
      return setError('Sem acesso aos sites bloqueados, a vela não conseguiria protegê-lo. Permita o acesso ou use outro ambiente.');
    }
    try {
      await services.sessionService.start({ environment, minutes, strictness, youtubeAllowlist: parsed.links, pomodoro });
    } catch {
      setError('Não foi possível acender a vela.');
    }
  }

  return (
    <>
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
          <div class="seg" role="group" aria-label="Duração">
            {DURATION_PRESETS_MIN.map((m) => (
              <button type="button" aria-pressed={!custom && minutes === m} onClick={() => { setCustom(false); setMinutes(m); }}>{m} min</button>
            ))}
            <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>Outro</button>
          </div>
          {custom && (
            <input class="field full minutes" type="number" min={MIN_DURATION_MIN} max={MAX_DURATION_MIN} value={minutes}
              aria-label="Minutos" onInput={(e) => setMinutes(Number(e.currentTarget.value))} />
          )}
        </div>

        <details class="more">
          <summary>Mais opções</summary>
          <div class="more-body">
            <div>
              <span class="lbl">Ao parar antes da hora</span>
              <div class="seg" role="group" aria-label="Modo">
                <button type="button" title="Desistir dá trabalho, de propósito" aria-pressed={strictness === 'focus'} onClick={() => setStrictness('focus')}>Foco</button>
                <button type="button" title="Você pode parar com uma confirmação" aria-pressed={strictness === 'light'} onClick={() => setStrictness('light')}>Leve</button>
              </div>
            </div>
            <PomodoroFields value={pomodoro} onChange={setPomodoro} />
            {usesYouTube && (
              <label>
                <span class="lbl">{youtubeUi.summary}</span>
                <textarea class="field full" rows={3} placeholder={youtubeUi.placeholder} value={links}
                  onInput={(e) => setLinks(e.currentTarget.value)} spellcheck={false} />
                <span class="hint">{youtubeUi.help}</span>
              </label>
            )}
          </div>
        </details>

        {error && <p class="error" role="alert">{error}</p>}
        <button class="btn btn-primary full" type="submit" disabled={!envs.length}>Acender vela</button>
      </form>
    </>
  );
}

function Running({ session, skin, now }: { session: Session; skin: string; now: number }) {
  // O popup fecha ao perder o foco: a fricção acontece numa aba própria, e a vela pode ganhar uma janela que fica aberta.
  async function stop() {
    await openFriction();
    window.close();
  }
  async function keepOpen() {
    await openFloatingCandle();
    window.close();
  }
  return (
    <>
      <RunningCandle session={session} skin={skin} now={now} />
      <div class="run-actions">
        <button class="btn btn-primary" onClick={keepOpen} title="Abre a vela numa janelinha que não fecha sozinha">Manter a vela aberta</button>
        <button class="btn btn-ghost" onClick={stop}>Preciso parar antes da hora</button>
      </div>
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
      <nav class="foot" aria-label="Atalhos">
        <button onClick={() => chrome.runtime.openOptionsPage()}>Opções</button>
        <button onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/options/index.html#historico') })}>Histórico</button>
      </nav>
    </main>
  );
}

render(<Popup />, document.getElementById('app')!);
