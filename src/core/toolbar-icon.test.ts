import { describe, expect, it } from 'vitest';
import { candleBadge, toolbarIconFor } from './toolbar-icon';

const now = 1_000_000;
const lit = { status: 'active' as const, endsAt: now + 60_000 };

describe('toolbarIconFor', () => {
  it('aceso só com vela ativa dentro do tempo e a opção ligada', () => {
    expect(toolbarIconFor(lit, true, now)).toBe('active');
    expect(toolbarIconFor(lit, false, now)).toBe('idle');
    expect(toolbarIconFor(undefined, true, now)).toBe('idle');
  });
  it('apagado depois do fim e com a sessão encerrada', () => {
    expect(toolbarIconFor({ ...lit, endsAt: now }, true, now)).toBe('idle');
    expect(toolbarIconFor({ status: 'abandoned', endsAt: now + 1 }, true, now)).toBe('idle');
    expect(toolbarIconFor({ status: 'completed', endsAt: now + 1 }, true, now)).toBe('idle');
  });
});

describe('candleBadge (minutos no ícone)', () => {
  const lit = (minsLeft: number, over = {}) => ({ status: 'active' as const, endsAt: now + minsLeft, ...over });
  it('minutos arredondados para cima, e horas como "1h05"', () => {
    expect(candleBadge(lit(25 * 60_000), true, now).text).toBe('25m');
    expect(candleBadge(lit(24 * 60_000 + 10_000), true, now).text).toBe('25m');
    expect(candleBadge(lit(30_000), true, now).text).toBe('1m');
    expect(candleBadge(lit(65 * 60_000), true, now).text).toBe('1h05');
    expect(candleBadge(lit(150 * 60_000), true, now).text).toBe('2h30');
    expect(candleBadge(lit(60 * 60_000), true, now).text).toBe('1h00');
  });
  it('sabe quando o número muda (no minuto exato) e o fim da vela', () => {
    const b = candleBadge(lit(24 * 60_000 + 10_000), true, now);
    expect(b.nextUpdate).toBe(now + 10_000); // aí passa a mostrar "24m"
    expect(candleBadge(lit(30_000), true, now).nextUpdate).toBe(now + 30_000); // fim da vela
  });
  it('pausa do Pomodoro muda a fase; sem vela, desligado ou depois do fim: sem selo', () => {
    const pomodoro = { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4, phase: 'break' as const, cycle: 1, long: false, phaseEndsAt: now + 1 };
    expect(candleBadge(lit(10 * 60_000, { pomodoro }), true, now).phase).toBe('break');
    expect(candleBadge(lit(10 * 60_000), false, now)).toEqual({ text: '', phase: null });
    expect(candleBadge(undefined, true, now).text).toBe('');
    expect(candleBadge(lit(0), true, now).text).toBe('');
  });
});
