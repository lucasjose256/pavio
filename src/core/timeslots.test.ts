import { describe, expect, it } from 'vitest';
import { formatMinutes, occurrencesAround, parseTime, segmentsForDay, slotDurationMin, validateTimeSlot } from './timeslots';
import type { TimeSlot } from './timeslots';

const t = (h: number, m = 0) => h * 60 + m;
const slot = (over: Partial<TimeSlot> = {}): TimeSlot => ({ id: 's', days: [1, 2, 3, 4, 5], startMin: t(9), endMin: t(12), ...over });
// 2026-10-05 é segunda-feira
const mon = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();
const tue = (h: number, m = 0) => new Date(2026, 9, 6, h, m).getTime();

describe('horário', () => {
  it('duração, formatação e leitura (inclui "dia todo" = 24:00)', () => {
    expect(slotDurationMin(slot())).toBe(180);
    expect(slotDurationMin(slot({ startMin: t(22), endMin: t(6) }))).toBe(480);
    expect(slotDurationMin(slot({ startMin: 0, endMin: 1440 }))).toBe(1440);
    expect(slotDurationMin(slot({ startMin: t(9), endMin: t(9) }))).toBe(0);
    expect(formatMinutes(t(9, 5))).toBe('09:05');
    expect(formatMinutes(1440)).toBe('24:00');
    expect(parseTime('9:05')).toBe(545);
    expect(parseTime('24:00')).toBe(1440);
    expect(parseTime('24:01')).toBeNull();
    expect(parseTime('abc')).toBeNull();
  });
  it('valida dias, faixa de horas e início = fim', () => {
    expect(validateTimeSlot(slot())).toEqual([]);
    expect(validateTimeSlot(slot({ startMin: 0, endMin: 1440 }))).toEqual([]);
    expect(validateTimeSlot(slot({ days: [] }))).toContain('days:empty');
    expect(validateTimeSlot(slot({ days: [7] }))).toContain('days:empty');
    expect(validateTimeSlot(slot({ endMin: t(9) }))).toContain('time:same');
    expect(validateTimeSlot(slot({ startMin: 1440 }))).toContain('time:range');
    expect(validateTimeSlot(slot({ endMin: 1500 }))).toContain('time:range');
  });
});

describe('occurrencesAround', () => {
  it('início e fim certos, só nos dias escolhidos', () => {
    const occ = occurrencesAround([slot()], mon(10)).find((o) => o.start <= mon(10) && mon(10) < o.end)!;
    expect(occ).toMatchObject({ start: mon(9), end: mon(12), key: 's:2026-10-05' });
    expect(occurrencesAround([slot({ days: [6, 0] })], mon(10), 0, 0)).toEqual([]); // fim de semana: segunda não tem
  });
  it('vira a noite: a madrugada de terça pertence ao horário de segunda', () => {
    const night = slot({ days: [1], startMin: t(22), endMin: t(6) });
    const occ = occurrencesAround([night], tue(3)).find((o) => o.start <= tue(3) && tue(3) < o.end)!;
    expect(occ).toMatchObject({ start: mon(22), end: tue(6) });
  });
  it('"dia todo" (24:00) vai até a meia-noite do dia seguinte', () => {
    const all = slot({ days: [1], startMin: 0, endMin: 1440 });
    const occ = occurrencesAround([all], mon(15)).find((o) => o.start <= mon(15) && mon(15) < o.end)!;
    expect(occ).toMatchObject({ start: mon(0), end: tue(0) });
  });
});

describe('segmentsForDay (linha do tempo de 24 h)', () => {
  it('desenha o horário no dia e a continuação da noite no dia seguinte', () => {
    const night = slot({ id: 'n', days: [5], startMin: t(22), endMin: t(6) }); // sexta 22h → sábado 6h
    expect(segmentsForDay([night], 5)).toEqual([{ slotId: 'n', startMin: t(22), endMin: 1440 }]);
    expect(segmentsForDay([night], 6)).toEqual([{ slotId: 'n', startMin: 0, endMin: t(6) }]);
    expect(segmentsForDay([night], 1)).toEqual([]);
    expect(segmentsForDay([slot({ id: 'd', days: [1], startMin: 0, endMin: 1440 })], 1)).toEqual([{ slotId: 'd', startMin: 0, endMin: 1440 }]);
  });
});
