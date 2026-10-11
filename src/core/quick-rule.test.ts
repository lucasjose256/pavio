import { describe, expect, it } from 'vitest';
import { DAY_PRESETS, TIME_PRESETS, dayPresetOf, hideKindFor, quickSlot, toggleDay } from './quick-rule';

const id = () => 's1';

describe('quickSlot', () => {
  it('bloquear em dias úteis, das 9h às 18h', () => {
    const { slot, errors } = quickSlot({ domain: 'youtube.com', days: [5, 1, 3, 2, 4], startMin: 540, endMin: 1080, action: 'block' }, id);
    expect(errors).toEqual([]);
    expect(slot).toEqual({ id: 's1', days: [1, 2, 3, 4, 5], startMin: 540, endMin: 1080, mode: 'blocked' });
  });
  it('esconder partes: serviço conhecido usa o próprio tipo; outro site vira intenção', () => {
    expect(quickSlot({ domain: 'instagram.com', days: [0], startMin: 0, endMin: 1440, action: 'hide' }, id).slot).toMatchObject({ mode: 'restricted', restrictedKind: 'instagram' });
    expect(hideKindFor('reddit.com')).toBe('intent');
    expect(quickSlot({ domain: 'reddit.com', days: [0], startMin: 0, endMin: 1440, action: 'hide' }, id).slot.restrictedKind).toBe('intent');
  });
  it('recusa sem dias e com início = fim', () => {
    expect(quickSlot({ domain: 'a.com', days: [], startMin: 0, endMin: 1440, action: 'block' }, id).errors.length).toBeGreaterThan(0);
    expect(quickSlot({ domain: 'a.com', days: [1], startMin: 600, endMin: 600, action: 'block' }, id).errors.length).toBeGreaterThan(0);
  });
  it('a noite atravessa a meia-noite e é válida', () => {
    const night = TIME_PRESETS.find((t) => t.id === 'night')!;
    expect(quickSlot({ domain: 'a.com', days: [1], startMin: night.startMin, endMin: night.endMin, action: 'block' }, id).errors).toEqual([]);
  });
});

describe('dias', () => {
  it('reconhece o atalho certo e alterna dias em ordem', () => {
    expect(dayPresetOf([1, 2, 3, 4, 5])).toBe('weekdays');
    expect(dayPresetOf([6, 0])).toBe('weekend');
    expect(dayPresetOf([1, 3])).toBeUndefined();
    expect(toggleDay([1, 3], 2)).toEqual([1, 2, 3]);
    expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3]);
    expect(DAY_PRESETS.map((p) => p.id)).toEqual(['every', 'weekdays', 'weekend']);
  });
});
