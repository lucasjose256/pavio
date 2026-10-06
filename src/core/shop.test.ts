import { describe, expect, it } from 'vitest';
import { CANDLE_OFFERS, cleanOfferUrl, offerOfTheDay, offersFor, popupMoment } from './shop';

const copied = 'https://www.mercadolivre.com.br/vela-aromatica-lavanda-150g/p/MLB69706454?pdp_filters=item_id:MLB5147644197|item_id:MLB5147644197#is_advertising=true&searchVariation=MLB69706454&backend_model=search-backend&position=4&tracking_id=6fe4bb29&ad_click_id=OTMz';

describe('cleanOfferUrl', () => {
  it('tira o rastreio de busca/anúncio e o "#", mantém o produto', () => {
    expect(cleanOfferUrl(copied, 'mercadolivre')).toBe('https://www.mercadolivre.com.br/vela-aromatica-lavanda-150g/p/MLB69706454');
  });
  it('mantém os parâmetros e links curtos do programa de afiliados', () => {
    expect(cleanOfferUrl('https://mercadolivre.com/sec/1AbCdEf', 'mercadolivre')).toBe('https://mercadolivre.com/sec/1AbCdEf');
    expect(cleanOfferUrl('https://meli.la/2e9HdHQ', 'mercadolivre')).toBe('https://meli.la/2e9HdHQ');
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
    expect(offersFor('classic')[0]!.skin).toBe('classic');
    const bad = [{ ...CANDLE_OFFERS[0]!, url: 'https://outra-loja.com/x' }];
    expect(offersFor('jar', bad)).toEqual([]);
  });
});

describe('popupMoment', () => {
  const now = new Date(2026, 9, 6, 20).getTime();
  const h = (n: number) => n * 3_600_000;
  const base = { enabled: true, inPopup: true, running: false, now };
  it('antes, durante e logo depois da vela', () => {
    expect(popupMoment(base)).toBe('before');
    expect(popupMoment({ ...base, running: true, lastCompletedAt: now - h(1) })).toBe('during');
    expect(popupMoment({ ...base, lastCompletedAt: now - h(1) })).toBe('after');
    expect(popupMoment({ ...base, lastCompletedAt: now - h(7) })).toBe('before');
  });
  it('desligada nas opções ou escondida no popup: nada', () => {
    expect(popupMoment({ ...base, enabled: false })).toBeNull();
    expect(popupMoment({ ...base, inPopup: false, running: true })).toBeNull();
  });
});

describe('offerOfTheDay', () => {
  const day = (d: number) => new Date(2026, 9, d, 12).getTime();
  it('a da skin da pessoa, todo dia', () => {
    expect(offerOfTheDay('jar', day(6))!.skin).toBe('jar');
    expect(offerOfTheDay('jar', day(7))!.skin).toBe('jar');
  });
  it('sem vela da skin: a mesma o dia todo e muda de um dia para o outro', () => {
    const morning = offerOfTheDay('starry', new Date(2026, 9, 6, 8).getTime());
    expect(offerOfTheDay('starry', new Date(2026, 9, 6, 23).getTime())).toEqual(morning);
    const ids = new Set([6, 7].map((d) => offerOfTheDay('starry', day(d))!.id));
    expect(ids.size).toBe(CANDLE_OFFERS.length);
  });
});
