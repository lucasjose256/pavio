import { Candle } from '../candle/Candle';
import type { Session } from '../../core/models';
import { pomodoroAt } from '../../core/pomodoro';
import { candleProgress, formatRemaining, remainingMs } from '../../core/session';

/** Abre a tela de desistir (com fricção) numa aba própria: popup e janelas pequenas não servem para isso. */
export function openFriction() {
  return chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/friction/index.html') });
}

/** A vela acesa com tempo, ambiente e fase do Pomodoro. Usada no popup e na janela da vela. */
export function RunningCandle({ session, skin, now, compact }: { session: Session; skin: string; now: number; compact?: boolean }) {
  // Fase atual calculada pelo relógio (a gravada na sessão é a que bloqueios e content scripts usam).
  const phase = session.pomodoro && session.endsAt > now ? pomodoroAt(session.pomodoro, session.startedAt, session.endsAt, now) : undefined;
  return (
    <>
      <div class={`popup-candle ${compact ? 'compact' : ''}`}><Candle skin={skin} progress={candleProgress(session, now)} label="Vela acesa, sessão em andamento" /></div>
      <p class="time">{formatRemaining(Math.min(remainingMs(session, now), session.plannedMs))}</p>
      <p class="sub">{session.environmentSnapshot.name}</p>
      {phase && (
        <p class={`phase ${phase.phase}`} role="status">
          {phase.phase === 'break'
            ? `Pausa${phase.long ? ' longa' : ''} · ${formatRemaining(phase.end - now)}${compact ? '' : ' · bloqueios liberados'}`
            : `Foco ${phase.cycle} · pausa em ${formatRemaining(phase.end - now)}`}
        </p>
      )}
    </>
  );
}
