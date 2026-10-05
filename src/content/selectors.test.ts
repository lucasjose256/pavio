import { describe, expect, it } from 'vitest';
import { classifyXTab, xCss } from './selectors';

describe('classifyXTab', () => {
  it('reconhece "Para você" e "Seguindo" em vários idiomas', () => {
    expect(classifyXTab('For you')).toBe('for-you');
    expect(classifyXTab('  Para  você ')).toBe('for-you');
    expect(classifyXTab('Following')).toBe('following');
    expect(classifyXTab('Seguindo')).toBe('following');
    expect(classifyXTab('Trending')).toBe('other');
    expect(classifyXTab('')).toBe('other');
  });
  it('o CSS usa o atributo marcado pelo script', () => {
    expect(xCss()).toContain('[data-pavio-x="for-you"]');
  });
});
