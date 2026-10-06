import { describe, expect, it } from 'vitest';
import { formatMinutes, layoutLanes, moveSlot, occurrencesAround, parseTime, resizeSlot, segmentsForDay, slotDurationMin, snapMinute, suggestFreeTime, validateTimeSlot } from './timeslots';
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
    expect(segmentsForDay([night], 5)).toEqual([{ slotId: 'n', startMin: t(22), endMin: 1440, part: 'head' }]);
    expect(segmentsForDay([night], 6)).toEqual([{ slotId: 'n', startMin: 0, endMin: t(6), part: 'tail' }]);
    expect(segmentsForDay([night], 1)).toEqual([]);
    expect(segmentsForDay([slot({ id: 'd', days: [1], startMin: 0, endMin: 1440 })], 1)).toEqual([{ slotId: 'd', startMin: 0, endMin: 1440, part: 'whole' }]);
  });
});

describe('arrastar na linha do tempo', () => {
  const work = { startMin: t(9), endMin: t(18) };
  it('encaixa de 15 em 15 minutos', () => {
    expect(snapMinute(t(9, 7))).toBe(t(9));
    expect(snapMinute(t(9, 8))).toBe(t(9, 15));
    expect(snapMinute(t(9, 53))).toBe(t(10));
  });

  it('arrastar a ponta de início/fim muda só aquela ponta', () => {
    expect(resizeSlot(work, 'start', t(8, 40))).toEqual({ startMin: t(8, 45), endMin: t(18) });
    expect(resizeSlot(work, 'end', t(19, 3))).toEqual({ startMin: t(9), endMin: t(19) });
  });

  it('não deixa as pontas se cruzarem (mínimo de 15 min) nem sair do dia', () => {
    expect(resizeSlot(work, 'start', t(20))).toEqual({ startMin: t(17, 45), endMin: t(18) });
    expect(resizeSlot(work, 'end', t(5))).toEqual({ startMin: t(9), endMin: t(9, 15) });
    expect(resizeSlot(work, 'start', -300).startMin).toBe(0);
    expect(resizeSlot(work, 'end', 5000).endMin).toBe(1440);
  });

  it('horário que vira a noite: início à noite e fim de manhã nunca se encontram', () => {
    const night = { startMin: t(22), endMin: t(6) };
    expect(resizeSlot(night, 'start', t(21))).toEqual({ startMin: t(21), endMin: t(6) });
    expect(resizeSlot(night, 'start', t(3))).toEqual({ startMin: t(6, 15), endMin: t(6) }); // não passa do fim
    expect(resizeSlot(night, 'end', t(8))).toEqual({ startMin: t(22), endMin: t(8) });
    expect(resizeSlot(night, 'end', t(23))).toEqual({ startMin: t(22), endMin: t(21, 45) });
  });

  it('mover mantém a duração e fica dentro do dia', () => {
    expect(moveSlot(work, 60)).toEqual({ startMin: t(10), endMin: t(19) });
    expect(moveSlot(work, -9999)).toEqual({ startMin: 0, endMin: t(9) });
    expect(moveSlot(work, 9999)).toEqual({ startMin: 1440 - t(9), endMin: 1440 });
    expect(moveSlot({ startMin: 0, endMin: 1440 }, 120)).toEqual({ startMin: 0, endMin: 1440 }); // dia todo não anda
    expect(moveSlot({ startMin: t(22), endMin: t(6) }, 60)).toBeNull(); // virar a noite: só pelas pontas
  });
});

describe('layoutLanes (faixas que se cruzam ficam empilhadas)', () => {
  const seg = (startMin: number, endMin: number) => ({ startMin, endMin });
  it('sem cruzamento: uma pista só', () => {
    const r = layoutLanes([seg(0, t(6)), seg(t(9), t(18)), seg(t(22), 1440)]);
    expect(r.lanes).toBe(1);
    expect(r.items.map((i) => i.lane)).toEqual([0, 0, 0]);
  });
  it('cruzamento: cada faixa numa pista, na ordem original', () => {
    const r = layoutLanes([seg(t(9), t(18)), seg(0, 1440), seg(t(14), t(16))]); // dia todo cobre as outras; 9–18 e 14–16 também se cruzam
    expect(r.lanes).toBe(3);
    expect(new Set(r.items.map((i) => i.lane)).size).toBe(3);
    // faixas encostadas (18:00 e 18:00) não se cruzam e dividem a pista
    expect(layoutLanes([seg(t(9), t(18)), seg(t(18), t(20))]).lanes).toBe(1);
  });
  it('reaproveita pistas livres', () => {
    const r = layoutLanes([seg(0, t(10)), seg(t(8), t(12)), seg(t(10), t(14))]);
    expect(r.lanes).toBe(2);
    expect(r.items[2]!.lane).toBe(0); // 10–14 cabe depois de 0–10
  });
});

describe('suggestFreeTime', () => {
  it('dia vazio: 9h–11h', () => {
    expect(suggestFreeTime([])).toEqual({ startMin: t(9), endMin: t(11) });
  });
  it('pula o que já está ocupado', () => {
    expect(suggestFreeTime([{ startMin: t(9), endMin: t(18) }])).toEqual({ startMin: t(18), endMin: t(20) });
    expect(suggestFreeTime([{ startMin: t(8), endMin: t(10) }, { startMin: t(10, 30), endMin: t(12) }])).toEqual({ startMin: t(12), endMin: t(14) }); // 30 min não cabe
  });
  it('sem espaço depois das 9h, usa antes; dia cheio devolve null', () => {
    expect(suggestFreeTime([{ startMin: t(6), endMin: 1440 }])).toEqual({ startMin: 0, endMin: t(2) });
    expect(suggestFreeTime([{ startMin: 0, endMin: 1440 }])).toBeNull();
  });
});
