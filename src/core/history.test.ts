import { describe, expect, it } from 'vitest';
import { formatDuration, summarizeHistory } from './history';
import type { HistoryEntry } from './models';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const min = (n: number) => n * 60_000;
const entry = (endedAt: number, actualMin: number, outcome: HistoryEntry['outcome'] = 'completed', blockedAttempts = 0): HistoryEntry => ({
  sessionId: String(endedAt), environmentName: 'Estudo', startedAt: endedAt - min(actualMin), endedAt,
  plannedMs: min(25), actualMs: min(actualMin), outcome, blockedAttempts,
});
const now = at(2026, 10, 5);

describe('summarizeHistory', () => {
  it('soma tempo, conta concluídas/encerradas e tentativas bloqueadas', () => {
    const s = summarizeHistory([entry(at(2026, 10, 5, 9), 25, 'completed', 3), entry(at(2026, 10, 4), 10, 'abandoned', 2)], now);
    expect(s).toMatchObject({ focusedMs: min(35), completed: 1, abandoned: 1, blockedAttempts: 5 });
  });

  it('lista vazia não quebra', () => {
    const s = summarizeHistory([], now);
    expect(s).toMatchObject({ focusedMs: 0, completed: 0, streakDays: 0 });
    expect(s.last7Days).toHaveLength(7);
  });

  it('sequência: dias seguidos com vela concluída; hoje ainda sem sessão não zera', () => {
    const entries = [entry(at(2026, 10, 4), 25), entry(at(2026, 10, 3), 25), entry(at(2026, 10, 1), 25)];
    expect(summarizeHistory(entries, now).streakDays).toBe(2); // ontem e anteontem; hoje ainda não
    expect(summarizeHistory([...entries, entry(at(2026, 10, 5, 8), 25)], now).streakDays).toBe(3);
  });

  it('sessão só encerrada antes não conta para a sequência', () => {
    expect(summarizeHistory([entry(at(2026, 10, 5), 10, 'abandoned')], now).streakDays).toBe(0);
  });

  it('últimos 7 dias: do mais antigo para hoje, somando por dia', () => {
    const s = summarizeHistory([entry(at(2026, 10, 5, 8), 20), entry(at(2026, 10, 5, 15), 30), entry(at(2026, 9, 29), 40), entry(at(2026, 9, 20), 99)], now);
    expect(s.last7Days.map((d) => d.focusedMs)).toEqual([min(40), 0, 0, 0, 0, 0, min(50)]);
    expect(new Date(s.last7Days[6]!.date).getDate()).toBe(5);
  });
});

describe('formatDuration', () => {
  it('formata em português curto', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(5_000)).toBe('menos de 1 min');
    expect(formatDuration(min(35))).toBe('35 min');
    expect(formatDuration(min(180))).toBe('3 h');
    expect(formatDuration(min(125))).toBe('2 h 05 min');
  });
});
