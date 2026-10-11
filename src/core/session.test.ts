import { describe, expect, it } from 'vitest';
import { DURATION_PRESETS_MIN, candleProgress, durationLabel, formatRemaining, remainingMs } from './session';

const s = { endsAt: 10_000, plannedMs: 10_000 };

describe('session time', () => {
  it('calcula restante e progresso com limites', () => {
    expect(remainingMs(s, 4_000)).toBe(6_000);
    expect(remainingMs(s, 20_000)).toBe(0);
    expect(candleProgress(s, 0)).toBe(1);
    expect(candleProgress(s, 2_500)).toBe(0.75);
    expect(candleProgress(s, 99_999)).toBe(0);
    expect(candleProgress({ endsAt: 1, plannedMs: 0 }, 0)).toBe(0);
  });
  it('formata o tempo', () => {
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(1)).toBe('00:01');
    expect(formatRemaining(25 * 60_000)).toBe('25:00');
    expect(formatRemaining(90 * 60_000)).toBe('1:30:00');
  });
});

describe('durationLabel', () => {
  it('formata os tempos prontos', () => {
    expect(DURATION_PRESETS_MIN.map(durationLabel)).toEqual(['30 min', '45 min', '1 h', '1h30', '2 h', '2h30']);
    expect(durationLabel(5)).toBe('5 min');
    expect(durationLabel(185)).toBe('3h05');
  });
});
