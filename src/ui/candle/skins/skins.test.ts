import { describe, expect, it } from 'vitest';
import { SKINS, getSkin } from './index';

describe('skins da vela', () => {
  it('têm ids e nomes únicos', () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(new Set(SKINS.map((s) => s.name)).size).toBe(SKINS.length);
  });
  it('id desconhecido cai na Clássica', () => {
    expect(getSkin('nao-existe').id).toBe('classic');
    expect(getSkin('jar').name).toBe('Pote de vidro');
  });
});
