import { describe, expect, it } from 'vitest';
import type { PomodoroConfig } from './models';
import { DEFAULT_POMODORO, enforcing, onBreak, pomodoroAt, pomodoroState, validatePomodoro } from './pomodoro';

const min = (n: number) => n * 60_000;
const START = 1_000_000;
const END = START + min(200);
const cfg: PomodoroConfig = { focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 };
const at = (m: number, c = cfg) => pomodoroAt(c, START, END, START + min(m));

describe('pomodoroAt', () => {
  it('começa em foco e vira pausa depois de 25 min', () => {
    expect(at(0)).toMatchObject({ phase: 'focus', cycle: 1, end: START + min(25) });
    expect(at(24.9)).toMatchObject({ phase: 'focus' });
    expect(at(25)).toMatchObject({ phase: 'break', cycle: 1, long: false, end: START + min(30) });
    expect(at(30)).toMatchObject({ phase: 'focus', cycle: 2 });
  });

  it('a cada 4 focos a pausa é a longa', () => {
    // focos 1-3 terminam em 25,55,85; foco 4: 90..115; pausa longa 115..130
    expect(at(100)).toMatchObject({ phase: 'focus', cycle: 4 });
    expect(at(115)).toMatchObject({ phase: 'break', cycle: 4, long: true, end: START + min(130) });
    expect(at(130)).toMatchObject({ phase: 'focus', cycle: 5 });
  });

  it('sem pausa longa (0), todas as pausas são curtas', () => {
    expect(at(115, { ...cfg, longBreakMin: 0 })).toMatchObject({ phase: 'break', long: false, end: START + min(120) });
  });

  it('a fase nunca passa do fim da sessão', () => {
    const short = pomodoroAt(cfg, START, START + min(27), START + min(26));
    expect(short).toMatchObject({ phase: 'break', end: START + min(27) });
    expect(pomodoroAt(cfg, START, START + min(10), START + min(50)).phase).toBe('focus'); // depois do fim: limita
  });

  it('antes do início conta como o começo', () => {
    expect(pomodoroAt(cfg, START, END, START - 5000)).toMatchObject({ phase: 'focus', cycle: 1 });
  });
});

describe('estado e consultas', () => {
  it('pomodoroState grava a fase atual junto da config', () => {
    expect(pomodoroState(cfg, START, END, START)).toMatchObject({ ...cfg, phase: 'focus', cycle: 1, long: false, phaseEndsAt: START + min(25) });
  });
  it('enforcing: sessão ativa e fora da pausa', () => {
    const base = pomodoroState(cfg, START, END, START);
    expect(enforcing({ status: 'active', pomodoro: base })).toBe(true);
    expect(enforcing({ status: 'active', pomodoro: { ...base, phase: 'break' } })).toBe(false);
    expect(enforcing({ status: 'active' })).toBe(true); // sem pomodoro
    expect(enforcing({ status: 'completed' })).toBe(false);
    expect(enforcing(undefined)).toBe(false);
    expect(onBreak({ pomodoro: { ...base, phase: 'break' } })).toBe(true);
  });
});

describe('validatePomodoro', () => {
  it('aceita o padrão e recusa valores fora dos limites', () => {
    expect(validatePomodoro(DEFAULT_POMODORO)).toBeNull();
    expect(validatePomodoro({ ...cfg, focusMin: 0 })).toBe('pomodoro:focus');
    expect(validatePomodoro({ ...cfg, breakMin: 90 })).toBe('pomodoro:break');
    expect(validatePomodoro({ ...cfg, longBreakMin: -1 })).toBe('pomodoro:long');
    expect(validatePomodoro({ ...cfg, cyclesBeforeLong: 1 })).toBe('pomodoro:cycles');
    expect(validatePomodoro({ ...cfg, longBreakMin: 0, cyclesBeforeLong: 1 })).toBeNull(); // ciclos só importam com pausa longa
    expect(validatePomodoro({ ...cfg, focusMin: 2.5 })).toBe('pomodoro:focus');
  });
});
