import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '../theme.css';
import '../popup/popup.css';
import './float.css';
import { Candle } from '../candle/Candle';
import type { Session, Settings } from '../../core/models';
import { DEFAULT_SETTINGS } from '../../core/models';
import { remainingMs } from '../../core/session';
import { createServices } from '../../platform/chrome/services';
import { RunningCandle, openFriction } from '../shared/RunningCandle';
import { initTheme } from '../shared/theme';
import { useNow } from '../shared/useNow';
import { useStorageValue } from '../shared/useStorageValue';

const services = createServices();
initTheme();

/** Picture-in-Picture de documento (Chrome 116+): uma janelinha que fica por cima de tudo. */
interface DocumentPiP { requestWindow(o: { width: number; height: number }): Promise<Window> }
const pip = (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture;

function useCandleState() {
  const { value: session, loaded } = useStorageValue<Session>('activeSession');
  const { value: settings } = useStorageValue<Settings>('settings');
  const now = useNow(1000);
  const active = session?.status === 'active' && remainingMs(session, now) > 0 ? session : undefined;
  return { active, loaded, now, skin: (settings ?? DEFAULT_SETTINGS).candleSkin };
}

/** O que aparece na janelinha "sempre por cima": só a vela e o tempo. */
function Mini({ onBack }: { onBack: () => void }) {
  const { active, now, skin } = useCandleState();
  return (
    <main class="popup float mini" onDblClick={onBack} title="Clique duas vezes para voltar à janela da vela">
      {active ? <RunningCandle session={active} skin={skin} now={now} compact /> : (
        <>
          <div class="popup-candle compact"><Candle skin={skin} progress={0} lit={false} label="Vela apagada" /></div>
          <p class="sub">Vela apagada</p>
        </>
      )}
    </main>
  );
}

/** Copia o CSS desta página para a janela de Picture-in-Picture. */
function copyStyles(target: Document) {
  for (const sheet of [...document.styleSheets]) {
    const style = target.createElement('style');
    style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
    target.head.append(style);
  }
  const theme = document.documentElement.dataset.theme;
  if (theme) target.documentElement.dataset.theme = theme;
}

function Float() {
  const { active, loaded, now, skin } = useCandleState();
  const [pinned, setPinned] = useState(false);
  useEffect(() => { void services.sessionService.reconcile(); }, [active === undefined]);

  async function pinOnTop() {
    if (!pip) return;
    const win = await pip.requestWindow({ width: 200, height: 260 });
    copyStyles(win.document);
    win.document.title = 'Pavio';
    const me = await chrome.windows.getCurrent();
    const back = () => win.close();
    render(<Mini onBack={back} />, win.document.body);
    setPinned(true);
    // Enquanto a vela está por cima, esta janela vai para o Dock (fechá-la fecharia a janelinha também).
    if (me.id !== undefined) void chrome.windows.update(me.id, { state: 'minimized' });
    win.addEventListener('pagehide', () => {
      render(null, win.document.body);
      setPinned(false);
      if (me.id !== undefined) void chrome.windows.update(me.id, { state: 'normal', focused: true });
    });
  }

  if (!loaded) return null;
  if (!active) {
    return (
      <main class="popup float">
        <div class="popup-candle"><Candle skin={skin} progress={0} lit={false} label="Vela apagada" /></div>
        <p class="sub">A vela se apagou. Bom trabalho por hoje.</p>
        <button class="btn btn-primary" onClick={() => window.close()}>Fechar</button>
      </main>
    );
  }
  return (
    <main class="popup float">
      <RunningCandle session={active} skin={skin} now={now} />
      <div class="float-actions">
        {pip && !pinned && <button class="btn" onClick={pinOnTop} title="Uma janelinha que fica por cima das outras">Deixar sempre por cima</button>}
        <button class="btn btn-ghost" onClick={() => void openFriction()}>Preciso parar antes da hora</button>
      </div>
    </main>
  );
}

render(<Float />, document.getElementById('app')!);
