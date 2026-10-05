import { useEffect, useMemo, useState } from 'preact/hooks';
import { formatDuration, summarizeHistory } from '../../core/history';
import type { HistoryEntry } from '../../core/models';
import { Candle } from '../candle/Candle';
import { services } from './shared';

const weekday = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
const when = (ts: number) =>
  new Date(ts).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');

export function HistoryTab({ active }: { active: boolean }) {
  const [entries, setEntries] = useState<HistoryEntry[]>();
  const [skin, setSkin] = useState('classic');

  const load = () => void services.history.list().then(setEntries);
  useEffect(() => {
    if (!active) return;
    load();
    void services.settings.get().then((s) => setSkin(s.candleSkin));
  }, [active]);

  const summary = useMemo(() => (entries ? summarizeHistory(entries, Date.now()) : undefined), [entries, active]);
  const recent = useMemo(() => [...(entries ?? [])].sort((a, b) => b.endedAt - a.endedAt).slice(0, 40), [entries]);

  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries ?? [], null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'pavio-historico.json' });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clear() {
    if (!confirm('Apagar todo o histórico? Isso não pode ser desfeito.')) return;
    await services.history.clear();
    load();
  }

  const max = Math.max(1, ...(summary?.last7Days.map((d) => d.focusedMs) ?? [1]));

  return (
    <main class="pane" hidden={!active}>
      {entries && entries.length === 0 && (
        <section class="card empty-state">
          <div class="empty-candle"><Candle skin={skin} progress={1} lit={false} label="Vela apagada" /></div>
          <h2 class="section-title">Sua primeira vela ainda vai acender</h2>
          <p class="section-sub">Quando você terminar uma sessão, o tempo que devolveu a você aparece aqui.</p>
        </section>
      )}

      {summary && entries && entries.length > 0 && (
        <>
          <section class="stats" aria-label="Resumo">
            <div class="stat big">
              <span class="stat-label">Horas devolvidas</span>
              <span class="stat-value">{formatDuration(summary.focusedMs)}</span>
              <span class="stat-note">tempo com a vela acesa, só seu</span>
            </div>
            <div class="stat"><span class="stat-label">Velas concluídas</span><span class="stat-value">{summary.completed}</span>
              <span class="stat-note">{summary.abandoned} encerrada{summary.abandoned === 1 ? '' : 's'} antes</span></div>
            <div class="stat"><span class="stat-label">Distrações adiadas</span><span class="stat-value">{summary.blockedAttempts}</span>
              <span class="stat-note">sites que esperaram por você</span></div>
            <div class="stat"><span class="stat-label">Sequência</span><span class="stat-value">{summary.streakDays}</span>
              <span class="stat-note">dia{summary.streakDays === 1 ? '' : 's'} seguido{summary.streakDays === 1 ? '' : 's'}</span></div>
          </section>

          <section class="card">
            <h3>Últimos 7 dias</h3>
            <ol class="bars" aria-label="Tempo de foco por dia">
              {summary.last7Days.map((d) => (
                <li key={d.date} title={`${weekday(d.date)}: ${formatDuration(d.focusedMs)}`}>
                  <span class="bar-val">{d.focusedMs ? formatDuration(d.focusedMs) : ''}</span>
                  <span class="bar" style={{ height: `${Math.max(d.focusedMs ? 8 : 3, (d.focusedMs / max) * 100)}%` }} />
                  <span class="bar-day">{weekday(d.date)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section class="card">
            <h3>Sessões recentes</h3>
            <ul class="sessions">
              {recent.map((e) => (
                <li key={e.sessionId} class="session">
                  <span class={`pill ${e.outcome}`}>{e.outcome === 'completed' ? 'Concluída' : 'Encerrada antes'}</span>
                  <span class="session-env">{e.environmentName}</span>
                  <span class="session-time">{formatDuration(e.actualMs)} de {formatDuration(e.plannedMs)}</span>
                  <span class="session-when">{when(e.endedAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section class="card data">
        <h3>Seus dados</h3>
        <p class="hint">Tudo fica só neste navegador. O Pavio não envia nada para lugar nenhum.</p>
        <div class="row">
          <button class="btn" onClick={exportJson} disabled={!entries?.length}>Exportar (JSON)</button>
          <button class="btn btn-ghost btn-danger" onClick={clear} disabled={!entries?.length}>Apagar histórico</button>
        </div>
      </section>
    </main>
  );
}
