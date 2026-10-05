import { describe, expect, it } from 'vitest';
import type { ScheduleBlock } from './models';
import {
  blockDurationMin, findOverlaps, formatMinutes, parseTime, scheduleState, validateBlock, weekSegments,
} from './schedule';

const MON = 1, TUE = 2, WED = 3, FRI = 5, SAT = 6, SUN = 0;
const t = (h: number, m = 0) => h * 60 + m;
const block = (over: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  id: 'b1', name: 'Estudo', environmentId: 'env', days: [MON, TUE, WED, 4, FRI], startMin: t(9), endMin: t(12),
  strictness: 'focus', enabled: true, createdAt: 0, updatedAt: 0, ...over,
});
// 2026-10-05 é segunda-feira
const mon = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();
const tue = (h: number, m = 0) => new Date(2026, 9, 6, h, m).getTime();

describe('tempo', () => {
  it('duração, formatação e leitura de horário', () => {
    expect(blockDurationMin(block())).toBe(180);
    expect(blockDurationMin(block({ startMin: t(22), endMin: t(6) }))).toBe(480);
    expect(blockDurationMin(block({ startMin: t(9), endMin: t(9) }))).toBe(0);
    expect(formatMinutes(t(9, 5))).toBe('09:05');
    expect(parseTime('9:05')).toBe(545);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('abc')).toBeNull();
  });
});

describe('validateBlock', () => {
  it('detecta dias vazios, horários iguais e ambiente inexistente', () => {
    expect(validateBlock(block(), ['env'])).toEqual([]);
    expect(validateBlock(block({ days: [] }))).toContain('days:empty');
    expect(validateBlock(block({ endMin: t(9) }))).toContain('time:same');
    expect(validateBlock(block({ startMin: 2000 }))).toContain('time:range');
    expect(validateBlock(block(), ['outro'])).toContain('env:missing');
    const pomo = { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4 };
    expect(validateBlock(block({ pomodoro: pomo }))).toEqual([]);
    expect(validateBlock(block({ pomodoro: { ...pomo, focusMin: 0 } }))).toContain('pomodoro:focus');
  });
});

describe('scheduleState', () => {
  it('ativa dentro da faixa, com início e fim certos', () => {
    const { active } = scheduleState([block()], mon(10));
    expect(active).toMatchObject({ start: mon(9), end: mon(12), key: 'b1:2026-10-05' });
  });
  it('fora da faixa: nada ativo e a próxima é a de hoje ou a de amanhã', () => {
    expect(scheduleState([block()], mon(8)).next?.start).toBe(mon(9));
    const afterEnd = scheduleState([block()], mon(13));
    expect(afterEnd.active).toBeUndefined();
    expect(afterEnd.next?.start).toBe(tue(9));
  });
  it('só vale nos dias escolhidos', () => {
    const weekend = block({ days: [SAT, SUN] });
    expect(scheduleState([weekend], mon(10)).active).toBeUndefined();
    expect(scheduleState([weekend], mon(10)).next?.start).toBe(new Date(2026, 9, 10, 9).getTime());
  });
  it('faixa que vira a noite vale depois da meia-noite, no dia seguinte', () => {
    const night = block({ id: 'n', days: [MON], startMin: t(22), endMin: t(6) });
    expect(scheduleState([night], mon(23)).active?.end).toBe(tue(6));
    const after = scheduleState([night], tue(3)); // madrugada de terça pertence à faixa de segunda
    expect(after.active).toMatchObject({ start: mon(22), end: tue(6), key: 'n:2026-10-05' });
    expect(scheduleState([night], tue(7)).active).toBeUndefined();
  });
  it('ocorrência pulada (desistência) não vale mais, mas a de amanhã continua', () => {
    const s = scheduleState([block()], mon(10), ['b1:2026-10-05']);
    expect(s.active).toBeUndefined();
    expect(s.next?.start).toBe(tue(9));
  });
  it('faixa desativada é ignorada', () => {
    expect(scheduleState([block({ enabled: false })], mon(10))).toEqual({ active: undefined, next: undefined });
  });
  it('em sobreposição vale a que começou por último', () => {
    const a = block({ id: 'a', startMin: t(9), endMin: t(12) });
    const b = block({ id: 'b', startMin: t(10), endMin: t(11) });
    expect(scheduleState([a, b], mon(10, 30)).active?.block.id).toBe('b');
    expect(scheduleState([a, b], mon(11, 30)).active?.block.id).toBe('a'); // b acabou, a continua
  });
});

describe('weekSegments e findOverlaps', () => {
  it('divide faixa noturna em dois pedaços', () => {
    const segs = weekSegments([block({ days: [FRI], startMin: t(22), endMin: t(6) })]);
    expect(segs).toEqual([
      { blockId: 'b1', day: FRI, startMin: t(22), endMin: 1440 },
      { blockId: 'b1', day: SAT, startMin: 0, endMin: t(6) },
    ]);
  });
  it('acha sobreposições (inclusive a que passa da meia-noite) e ignora desativadas', () => {
    const a = block({ id: 'a', days: [FRI], startMin: t(22), endMin: t(6) });
    const b = block({ id: 'b', days: [SAT], startMin: t(5), endMin: t(8) });
    const c = block({ id: 'c', days: [SAT], startMin: t(6), endMin: t(8) }); // encosta no fim de `a`: não sobrepõe `a`
    expect(findOverlaps([a, b, c])).toEqual([['a', 'b'], ['b', 'c']]);
    expect(findOverlaps([a, c])).toEqual([]);
    expect(findOverlaps([a, { ...b, enabled: false }, c])).toEqual([]);
  });
});
