import { describe, expect, it } from 'vitest';
import { activeReleases, addPause, addRelease, isReleased, isValidRelease, pauseUntil, pausedUntil, removePause } from './release';

const t0 = new Date(2026, 9, 5, 10).getTime();
const min = (n: number) => n * 60_000;

describe('liberação temporária', () => {
  it('libera por N minutos a partir de agora e substitui a anterior do mesmo app', () => {
    let list = addRelease([], 'youtube.com', 15, t0);
    expect(list).toEqual([{ domain: 'youtube.com', until: t0 + min(15) }]);
    list = addRelease(list, 'youtube.com', 5, t0 + min(1));
    expect(list).toEqual([{ domain: 'youtube.com', until: t0 + min(6) }]);
  });
  it('vencidas somem; valida os minutos', () => {
    const list = addRelease(addRelease([], 'a.com', 5, t0), 'b.com', 30, t0);
    expect(activeReleases(list, t0 + min(10)).map((r) => r.domain)).toEqual(['b.com']);
    expect(isValidRelease(0)).toBe(false);
    expect(isValidRelease(121)).toBe(false);
    expect(() => addRelease([], 'a.com', 0, t0)).toThrow();
  });
  it('cobre subdomínios da regra, não domínios parecidos', () => {
    const list = addRelease([], 'youtube.com', 15, t0);
    expect(isReleased({ domain: 'youtube.com' }, list, t0)).toBe(true);
    expect(isReleased({ domain: 'm.youtube.com' }, list, t0)).toBe(true);
    expect(isReleased({ domain: 'notyoutube.com' }, list, t0)).toBe(false);
    expect(isReleased({ domain: 'youtube.com' }, list, t0 + min(15))).toBe(false);
  });
});

describe('pausas por app e por faixa', () => {
  const noon = new Date(2026, 9, 5, 12).getTime();
  it('"até o fim do dia" = meia-noite que vem; minutos = a partir de agora', () => {
    expect(pauseUntil({ kind: 'day' }, noon)).toBe(new Date(2026, 9, 6).getTime());
    expect(pauseUntil({ kind: 'min', minutes: 15 }, noon)).toBe(noon + min(15));
    expect(() => pauseUntil({ kind: 'min', minutes: 0 }, noon)).toThrow();
  });
  it('uma pausa por alvo (app ou faixa); trocar substitui', () => {
    let list = addPause([], { domain: 'a.com' }, noon + min(5), noon);
    list = addPause(list, { domain: 'a.com', slotId: 's1' }, noon + min(15), noon);
    list = addPause(list, { domain: 'a.com', slotId: 's1' }, noon + min(30), noon);
    expect(list).toEqual([{ domain: 'a.com', until: noon + min(5) }, { domain: 'a.com', slotId: 's1', until: noon + min(30) }]);
    expect(() => addPause(list, { domain: 'a.com' }, noon, noon)).toThrow();
  });
  it('pausedUntil: a pausa do app vale para as faixas; a da faixa só para ela', () => {
    const list = addPause(addPause([], { domain: 'a.com', slotId: 's1' }, noon + min(15), noon), { domain: 'b.com' }, noon + min(5), noon);
    expect(pausedUntil(list, { domain: 'a.com', slotId: 's1' }, noon)).toBe(noon + min(15));
    expect(pausedUntil(list, { domain: 'a.com', slotId: 's2' }, noon)).toBeUndefined();
    expect(pausedUntil(list, { domain: 'a.com' }, noon)).toBeUndefined();
    expect(pausedUntil(list, { domain: 'b.com', slotId: 's9' }, noon)).toBe(noon + min(5));
    expect(pausedUntil(list, { domain: 'b.com' }, noon + min(6))).toBeUndefined();
  });
  it('retomar: faixa tira só a dela; app tira a do app e as das faixas', () => {
    const list = addPause(addPause([], { domain: 'a.com', slotId: 's1' }, noon + min(15), noon), { domain: 'a.com' }, noon + min(5), noon);
    expect(removePause(list, { domain: 'a.com', slotId: 's1' })).toEqual([{ domain: 'a.com', until: noon + min(5) }]);
    expect(removePause(list, { domain: 'a.com' })).toEqual([]);
  });
  it('isReleased (política) só conta a pausa do app inteiro', () => {
    const list = addPause([], { domain: 'a.com', slotId: 's1' }, noon + min(5), noon);
    expect(isReleased({ domain: 'a.com' }, list, noon)).toBe(false);
  });
});

describe('pausa por recurso', () => {
  const noon = new Date(2026, 9, 5, 12).getTime();
  it('vale só para o recurso; a do app vale para todos; retomar o recurso não mexe nas outras', () => {
    const list = addPause(addPause([], { domain: 'a.com', feature: 'shorts' }, noon + min(15), noon), { domain: 'a.com', slotId: 's1' }, noon + min(30), noon);
    expect(pausedUntil(list, { domain: 'a.com', feature: 'shorts' }, noon)).toBe(noon + min(15));
    expect(pausedUntil(list, { domain: 'a.com', feature: 'related' }, noon)).toBeUndefined();
    expect(pausedUntil(list, { domain: 'a.com', slotId: 's1' }, noon)).toBe(noon + min(30));
    expect(pausedUntil(list, { domain: 'a.com' }, noon)).toBeUndefined();
    const whole = addPause(list, { domain: 'a.com' }, noon + min(5), noon);
    expect(pausedUntil(whole, { domain: 'a.com', feature: 'related' }, noon)).toBe(noon + min(5));
    expect(removePause(list, { domain: 'a.com', feature: 'shorts' })).toEqual([{ domain: 'a.com', slotId: 's1', until: noon + min(30) }]);
    expect(isReleased({ domain: 'a.com' }, list, noon)).toBe(false);
  });
});
