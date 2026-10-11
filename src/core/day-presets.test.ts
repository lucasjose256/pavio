import { describe, expect, it } from 'vitest';
import { DAY_PRESETS, dayPresetOf, toggleDay } from './day-presets';

describe('dias da faixa', () => {
  it('reconhece o atalho certo (em qualquer ordem) e alterna dias mantendo a ordem', () => {
    expect(dayPresetOf([5, 1, 3, 2, 4])).toBe('weekdays');
    expect(dayPresetOf([6, 0])).toBe('weekend');
    expect(dayPresetOf([0, 1, 2, 3, 4, 5, 6])).toBe('every');
    expect(dayPresetOf([1, 3])).toBeUndefined();
    expect(toggleDay([1, 3], 2)).toEqual([1, 2, 3]);
    expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3]);
    expect(DAY_PRESETS.map((p) => p.id)).toEqual(['every', 'weekdays', 'weekend']);
  });
});
