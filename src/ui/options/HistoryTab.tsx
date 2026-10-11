import { useEffect, useMemo, useState } from 'preact/hooks';
import { EMPTY_TOTALS, HISTORY_MAX_AGE_DAYS, HISTORY_MAX_ENTRIES, RECENT_SESSIONS_LIMIT, formatDuration, recentSessions, summarizeHistory } from '../../core/history';
import type { HistoryTotals } from '../../core/history';
import type { HistoryEntry } from '../../core/models';
import { usageByApp, type UsageData } from '../../core/usage';
import { Candle } from '../candle/Candle';
import { SiteIcon } from '../shared/SiteIcon';
import { services } from './shared';

const weekday = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
const when = (ts: number) =>
  new Date(ts).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');

export function HistoryTab({ active }: { active: boolean }) {
  const [entries, setEntries] = useState<HistoryEntry[]>();
  const [skin, setSkin] = useState('classic');
  const [usage, setUsage] = useState<UsageData>({});

  const [totals, setTotals] = useState<HistoryTotals>(EMPTY_TOTALS);
  const [shown, setShown] = useState(RECENT_SESSIONS_LIMIT);

  const load = () => void Promise.all([services.history.list(), services.history.totals()]).then(([list, t]) => { setEntries(list); setTotals(t); });
  useEffect(() => {
    if (!active) return;
    // O que passou do limite de sessões/dias vira só total; depois recarrega a lista.
    void services.history.prune(Date.now()).then(load);
    void services.usage.get().then(setUsage);
    void services.settings.get().then((s) => setSkin(s.candleSkin));
  }, [active]);

  const summary = useMemo(() => (entries ? summarizeHistory(entries, Date.now(), totals) : undefined), [entries, totals, active]);
  const allRecent = useMemo(() => recentSessions(entries ?? [], HISTORY_MAX_ENTRIES), [entries]);
  const recent = allRecent.slice(0, shown);

  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ totaisAnteriores: totals, sessoes: entries ?? [] }, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'pavio-historico.json' });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clear() {
    if (!confirm('Apagar todo o histórico? Isso não pode ser desfeito.')) return;
    await services.history.clear();
    await services.usage.clear();
    setUsage({});
    load();
  }

  const apps = useMemo(() => usageByApp(usage, Date.now()), [usage, active]);
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
            <div class="more-row">
              {shown < allRecent.length && (
                <button class="btn" onClick={() => setShown((n) => n + RECENT_SESSIONS_LIMIT)}>Ver mais ({Math.min(RECENT_SESSIONS_LIMIT, allRecent.length - shown)})</button>
              )}
              <span class="hint">Mostrando {recent.length} de {allRecent.length}. O Pavio guarda os detalhes das últimas {HISTORY_MAX_ENTRIES} sessões ou de {HISTORY_MAX_AGE_DAYS} dias; as mais antigas entram só nos totais{totals.sessions > 0 ? ` (${totals.sessions} já somadas)` : ''}.</span>
            </div>
          </section>
        </>
      )}

      {apps.length > 0 && (
        <section class="card">
          <h3>Tempo por app (últimos 7 dias)</h3>
          <ul class="app-usage">
            {apps.map((a) => {
              const top = apps[0]!.totalMs || 1;
              return (
                <li key={a.domain}>
                  <span class="app-name"><SiteIcon domain={a.domain} /> {a.domain}</span>
                  <span class="app-bar"><i style={{ width: `${Math.max(3, (a.totalMs / top) * 100)}%` }} /></span>
                  <span class="app-time">{formatDuration(a.totalMs)}</span>
                  <span class="app-today">hoje {formatDuration(a.todayMs)}</span>
                </li>
              );
            })}
          </ul>
          <p class="hint">Só os apps com limite de tempo são medidos, e só neste navegador.</p>
        </section>
      )}

      <section class="card data">
        <h3>Seus dados</h3>
        <p class="hint">Tudo fica só neste navegador. O Pavio não envia nada para lugar nenhum.</p>
        <div class="row">
          <button class="btn" onClick={exportJson} disabled={!entries?.length}>Exportar (JSON)</button>
          <button class="btn btn-ghost btn-danger" onClick={clear} disabled={!entries?.length && apps.length === 0}>Apagar histórico</button>
        </div>
      </section>
    </main>
  );
}
