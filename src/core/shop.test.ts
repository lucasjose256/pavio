import { describe, expect, it } from 'vitest';
import { CANDLE_OFFERS, cleanOfferUrl, offersFor, suggestionDue } from './shop';

const copied = 'https://www.mercadolivre.com.br/vela-aromatica-lavanda-150g/p/MLB69706454?pdp_filters=item_id:MLB5147644197|item_id:MLB5147644197#is_advertising=true&searchVariation=MLB69706454&backend_model=search-backend&position=4&tracking_id=6fe4bb29&ad_click_id=OTMz';

describe('cleanOfferUrl', () => {
  it('tira o rastreio de busca/anúncio e o "#", mantém o produto', () => {
    expect(cleanOfferUrl(copied, 'mercadolivre')).toBe('https://www.mercadolivre.com.br/vela-aromatica-lavanda-150g/p/MLB69706454');
  });
  it('mantém os parâmetros e links curtos do programa de afiliados', () => {
    expect(cleanOfferUrl('https://mercadolivre.com/sec/1AbCdEf', 'mercadolivre')).toBe('https://mercadolivre.com/sec/1AbCdEf');
    expect(cleanOfferUrl('https://www.mercadolivre.com.br/p/MLB1?matt_tool=123&matt_word=pavio', 'mercadolivre'))
      .toBe('https://www.mercadolivre.com.br/p/MLB1?matt_tool=123&matt_word=pavio');
  });
  it('recusa outra loja, domínio parecido e lixo; força https', () => {
    expect(cleanOfferUrl('https://evil.com/mercadolivre.com.br', 'mercadolivre')).toBeNull();
    expect(cleanOfferUrl('https://mercadolivre.com.br.evil.com/p', 'mercadolivre')).toBeNull();
    expect(cleanOfferUrl('não é link', 'mercadolivre')).toBeNull();
    expect(cleanOfferUrl('http://produto.mercadolivre.com.br/MLB-1', 'mercadolivre')).toBe('https://produto.mercadolivre.com.br/MLB-1');
  });
});

describe('vitrine', () => {
  it('todos os links da lista são válidos', () => {
    expect(offersFor(undefined)).toHaveLength(CANDLE_OFFERS.length);
  });
  it('a vela da skin da pessoa vem primeiro; links inválidos somem', () => {
    expect(offersFor('honey')[0]!.skin).toBe('honey');
    const bad = [{ ...CANDLE_OFFERS[0]!, url: 'https://outra-loja.com/x' }];
    expect(offersFor('jar', bad)).toEqual([]);
  });
});

describe('suggestionDue', () => {
  const now = new Date(2026, 9, 6, 20).getTime();
  const h = (n: number) => n * 3_600_000;
  it('só logo depois de concluir uma vela, uma vez por semana, se não desligou', () => {
    expect(suggestionDue({ enabled: true, lastCompletedAt: now - h(1), now })).toBe(true);
    expect(suggestionDue({ enabled: false, lastCompletedAt: now - h(1), now })).toBe(false);
    expect(suggestionDue({ enabled: true, now })).toBe(false);
    expect(suggestionDue({ enabled: true, lastCompletedAt: now - h(7), now })).toBe(false);
    expect(suggestionDue({ enabled: true, lastCompletedAt: now - h(1), lastShownAt: now - h(24), now })).toBe(false);
    expect(suggestionDue({ enabled: true, lastCompletedAt: now - h(1), lastShownAt: now - h(24 * 7), now })).toBe(true);
  });
});
