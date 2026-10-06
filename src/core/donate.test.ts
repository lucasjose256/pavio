import { describe, expect, it } from 'vitest';
import { crc16, donationLinks, hasDonation, isValidPixKey, pixPayload, validPix } from './donate';

const pix = { key: 'voce@email.com', name: 'Lúcia Silva', city: 'São Paulo' };

describe('crc16', () => {
  it('bate com o vetor padrão CCITT-FALSE ("123456789" → 29B1)', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('chaves Pix', () => {
  it('aceita e-mail, telefone, CPF/CNPJ e chave aleatória; recusa o resto', () => {
    for (const k of ['a@b.com', '+5511999998888', '12345678901', '12345678000195', '123e4567-e89b-12d3-a456-426614174000']) expect(isValidPixKey(k)).toBe(true);
    for (const k of ['', 'abc', '1234', '1199999888', 'a@b']) expect(isValidPixKey(k)).toBe(false);
    expect(validPix({ ...pix, name: ' ' })).toBeUndefined();
  });
});

describe('pixPayload', () => {
  it('monta o copia e cola estático, sem acento, com CRC no fim', () => {
    const p = pixPayload(pix)!;
    expect(p.startsWith('00020126')).toBe(true);
    expect(p).toContain('0014br.gov.bcb.pix0114voce@email.com');
    expect(p).toContain('5911LUCIA SILVA');
    expect(p).toContain('6009SAO PAULO');
    expect(p).not.toContain('5303986540'); // sem valor (o campo 54 viria logo após a moeda)
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
  it('com valor: campo 54 com duas casas; valor inválido ou config inválida = undefined', () => {
    expect(pixPayload(pix, 10)).toContain('540510.00');
    expect(pixPayload(pix, 5.5)).toContain('54045.50');
    expect(pixPayload(pix, 0)).toBeUndefined();
    expect(pixPayload(pix, 1_000_000)).toBeUndefined();
    expect(pixPayload({ ...pix, key: 'x' })).toBeUndefined();
    expect(pixPayload(undefined)).toBeUndefined();
  });
  it('limita nome (25) e cidade (15)', () => {
    const p = pixPayload({ key: 'a@b.com', name: 'N'.repeat(40), city: 'C'.repeat(30) })!;
    expect(p).toContain(`5925${'N'.repeat(25)}`);
    expect(p).toContain(`6015${'C'.repeat(15)}`);
  });
});

describe('links e visibilidade', () => {
  it('só https com rótulo; aba escondida sem nada configurado', () => {
    expect(donationLinks({ links: [{ label: 'A', url: 'https://a.com/x' }, { label: 'B', url: 'http://b.com' }, { label: '', url: 'https://c.com' }, { label: 'D', url: 'lixo' }] }))
      .toEqual([{ label: 'A', url: 'https://a.com/x' }]);
    expect(hasDonation({ links: [] })).toBe(false);
    expect(hasDonation({ pix, links: [] })).toBe(true);
    expect(hasDonation({ links: [{ label: 'A', url: 'https://a.com' }] })).toBe(true);
  });
});
