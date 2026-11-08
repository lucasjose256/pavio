import { describe, expect, it } from 'vitest';
import { nextRadioIndex, radio } from './radioGroup';

describe('nextRadioIndex', () => {
  it('anda com as setas e dá a volta', () => {
    expect(nextRadioIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextRadioIndex('ArrowDown', 2, 3)).toBe(0);
    expect(nextRadioIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextRadioIndex('ArrowUp', 1, 3)).toBe(0);
  });
  it('Home e End vão às pontas', () => {
    expect(nextRadioIndex('Home', 2, 3)).toBe(0);
    expect(nextRadioIndex('End', 0, 3)).toBe(2);
  });
  it('sem foco no grupo: → começa na primeira, ← na última', () => {
    expect(nextRadioIndex('ArrowRight', -1, 3)).toBe(0);
    expect(nextRadioIndex('ArrowLeft', -1, 3)).toBe(2);
  });
  it('ignora outras teclas e grupo vazio', () => {
    expect(nextRadioIndex('Enter', 0, 3)).toBeNull();
    expect(nextRadioIndex('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('radio', () => {
  it('só a marcada (ou a primeira, sem marcada) entra no Tab', () => {
    expect(radio(true)).toEqual({ role: 'radio', 'aria-checked': true, tabIndex: 0 });
    expect(radio(false)).toMatchObject({ tabIndex: -1 });
    expect(radio(false, true)).toMatchObject({ tabIndex: 0 });
  });
});
