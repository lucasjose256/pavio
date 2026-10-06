import { describe, expect, it } from 'vitest';
import type { RoutineSite, RoutineSlot } from './models';
import { activeRules, dropFeature, featureSlotsOf, isBlockedAll, loosensNow, mergeRules, newFeatureSlot, nextBoundary, retimeFeature, rulesAnyTime, setBlockAll, validateSite } from './routine';
import { defaultRoutine } from './routine-defaults';
import { addUsage } from './usage';

const t = (h: number, m = 0) => h * 60 + m;
const mon = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime(); // segunda
const sat = (h: number, m = 0) => new Date(2026, 9, 10, h, m).getTime();
const WEEK = [1, 2, 3, 4, 5];

const slot = (id: string, over: Partial<RoutineSlot> = {}): RoutineSlot => ({ id, days: WEEK, startMin: t(9), endMin: t(18), mode: 'blocked', ...over });
const site = (domain: string, slots: RoutineSlot[], enabled = true): RoutineSite => ({ id: `s:${domain}`, domain, enabled, slots });

describe('activeRules', () => {
  const routine = [
    site('instagram.com', [slot('a')]),
    site('youtube.com', [slot('b', { mode: 'restricted', restrictedKind: 'youtube', startMin: t(14), endMin: t(18) })]),
  ];
  it('só o que está dentro da faixa agora', () => {
    expect(activeRules(routine, true, mon(10)).map((r) => r.domain)).toEqual(['instagram.com']);
    expect(activeRules(routine, true, mon(15)).map((r) => r.domain).sort()).toEqual(['instagram.com', 'youtube.com']);
    expect(activeRules(routine, true, mon(19))).toEqual([]);
    expect(activeRules(routine, true, sat(10))).toEqual([]); // fim de semana
  });
  it('rotina desligada, ou site desligado, não vale', () => {
    expect(activeRules(routine, false, mon(10))).toEqual([]);
    expect(activeRules([site('instagram.com', [slot('a')], false)], true, mon(10))).toEqual([]);
  });
  it('regra carrega o modo, o tipo e os recursos', () => {
    const [r] = activeRules([site('youtube.com', [slot('b', { mode: 'restricted', restrictedKind: 'youtube', features: ['shorts'] })])], true, mon(10));
    expect(r).toMatchObject({ domain: 'youtube.com', mode: 'restricted', restrictedKind: 'youtube', features: ['shorts'] });
  });
  it('faixas sobrepostas do mesmo site: a mais rigorosa vence; esconder partes do mesmo serviço soma recursos', () => {
    const both = site('instagram.com', [slot('a', { mode: 'restricted', restrictedKind: 'instagram', features: ['reels'] }), slot('b', { mode: 'blocked' })]);
    expect(activeRules([both], true, mon(10))[0]!.mode).toBe('blocked');
    const parts = site('instagram.com', [slot('a', { mode: 'restricted', restrictedKind: 'instagram', features: ['reels'] }), slot('b', { mode: 'restricted', restrictedKind: 'instagram', features: ['feed'] })]);
    expect(activeRules([parts], true, mon(10))[0]!.features).toEqual(['feed', 'reels']);
  });
  it('"para sempre" (todos os dias, dia todo) vale em qualquer hora', () => {
    const always = site('tiktok.com', [slot('x', { days: [0, 1, 2, 3, 4, 5, 6], startMin: 0, endMin: 1440 })]);
    for (const when of [mon(0), mon(13, 30), sat(23, 59)]) expect(activeRules([always], true, when)).toHaveLength(1);
  });
  it('faixa noturna vale na madrugada do dia seguinte', () => {
    const night = site('tiktok.com', [slot('n', { days: [0, 1, 2, 3, 4, 5, 6], startMin: t(22), endMin: t(6) })]);
    expect(activeRules([night], true, mon(23))).toHaveLength(1);
    expect(activeRules([night], true, new Date(2026, 9, 6, 3).getTime())).toHaveLength(1);
    expect(activeRules([night], true, new Date(2026, 9, 6, 7).getTime())).toHaveLength(0);
  });
});

describe('nextBoundary', () => {
  const routine = [site('instagram.com', [slot('a')])];
  it('é o próximo início ou fim de faixa', () => {
    expect(nextBoundary(routine, true, mon(8))).toBe(mon(9));
    expect(nextBoundary(routine, true, mon(10))).toBe(mon(18));
    expect(nextBoundary(routine, true, mon(19))).toBe(new Date(2026, 9, 6, 9).getTime());
    expect(nextBoundary(routine, false, mon(8))).toBeUndefined();
    expect(nextBoundary([], true, mon(8))).toBeUndefined();
  });
});

describe('mergeRules e rulesAnyTime', () => {
  it('por domínio vale a mais rigorosa, vinda da rotina ou do Timer', () => {
    const merged = mergeRules(
      [{ id: 'r', domain: 'reddit.com', mode: 'restricted', restrictedKind: 'intent' }],
      [{ id: 't', domain: 'reddit.com', mode: 'blocked' }, { id: 't2', domain: 'x.com', mode: 'allowed' }],
    );
    expect(merged.find((r) => r.domain === 'reddit.com')!.mode).toBe('blocked');
    expect(merged).toHaveLength(2);
  });
  it('rulesAnyTime pega o tratamento mais rigoroso de cada site em qualquer faixa', () => {
    const routine = [site('instagram.com', [slot('a', { mode: 'restricted', restrictedKind: 'instagram' }), slot('b', { mode: 'blocked', startMin: t(22), endMin: t(6) })])];
    expect(rulesAnyTime(routine)[0]!.mode).toBe('blocked');
  });
});

describe('loosensNow (confirmação ao afrouxar o que protege agora)', () => {
  const before = { sites: [site('instagram.com', [slot('a')])], enabled: true };
  const at = mon(10);
  it('apagar, desligar ou mudar o horário para fora de agora afrouxa', () => {
    expect(loosensNow(before, { sites: [], enabled: true }, at)).toBe(true);
    expect(loosensNow(before, { ...before, enabled: false }, at)).toBe(true);
    expect(loosensNow(before, { sites: [site('instagram.com', [slot('a', { startMin: t(14) })])], enabled: true }, at)).toBe(true);
    expect(loosensNow(before, { sites: [site('instagram.com', [slot('a')], false)], enabled: true }, at)).toBe(true);
  });
  it('mudar de bloqueado para esconder partes, ou esconder menos partes, afrouxa; endurecer não', () => {
    expect(loosensNow(before, { sites: [site('instagram.com', [slot('a', { mode: 'restricted', restrictedKind: 'instagram', features: ['feed'] })])], enabled: true }, at)).toBe(true);
    const restricted = { sites: [site('instagram.com', [slot('a', { mode: 'restricted', restrictedKind: 'instagram', features: ['feed', 'reels'] })])], enabled: true };
    expect(loosensNow(restricted, { sites: [site('instagram.com', [slot('a', { mode: 'restricted', restrictedKind: 'instagram', features: ['feed'] })])], enabled: true }, at)).toBe(true);
    expect(loosensNow(restricted, { sites: [site('instagram.com', [slot('a', { mode: 'restricted', restrictedKind: 'instagram', features: ['feed', 'reels', 'stories'] })])], enabled: true }, at)).toBe(false);
    expect(loosensNow(restricted, before, at)).toBe(false); // restrito → bloqueado endurece
  });
  it('mexer no que NÃO está valendo agora, ou adicionar, não pede confirmação', () => {
    const other = site('x.com', [slot('o', { startMin: t(20), endMin: t(21) })]);
    expect(loosensNow({ sites: [...before.sites, other], enabled: true }, { sites: before.sites, enabled: true }, at)).toBe(false);
    expect(loosensNow(before, { sites: [...before.sites, other], enabled: true }, at)).toBe(false);
    expect(loosensNow({ sites: before.sites, enabled: false }, { sites: [], enabled: false }, at)).toBe(false); // nada protegia
  });
});

describe('validação e rotina limpa', () => {
  it('valida domínio, horário e tipo de restrição', () => {
    expect(validateSite(site('instagram.com', [slot('a')]))).toEqual([]);
    expect(validateSite(site('lixo', [slot('a')]))).toContain('site:invalid-domain');
    expect(validateSite(site('x.com', [slot('a', { days: [] })]))).toContain('days:empty');
    expect(validateSite(site('x.com', [slot('a', { mode: 'restricted' })]))).toContain('kind:missing');
  });
  it('a rotina inicial é limpa: nada bloqueado nem programado', () => {
    expect(defaultRoutine()).toEqual([]);
    expect(activeRules(defaultRoutine(), true, mon(10))).toEqual([]);
  });
});

describe('bloqueio rápido (o app inteiro, sempre)', () => {
  let n = 0;
  const id = () => `q${++n}`;

  it('setBlockAll adiciona o site à rotina sem faixas, liga e desliga', () => {
    const on = setBlockAll([], 'tiktok.com', true, id);
    expect(on).toEqual([{ id: 'q1', domain: 'tiktok.com', enabled: true, slots: [], blockAll: true }]);
    expect(isBlockedAll(on, 'tiktok.com')).toBe(true);
    const off = setBlockAll(on, 'tiktok.com', false, id);
    expect(isBlockedAll(off, 'tiktok.com')).toBe(false);
    expect(setBlockAll([], 'tiktok.com', false, id)).toEqual([]); // desligar o que não existe não cria nada
  });

  it('bloqueia o tempo todo, mesmo com os horários desligados e fora de qualquer faixa', () => {
    const routine = setBlockAll([site('instagram.com', [slot('a')])], 'instagram.com', true, id);
    for (const when of [mon(3), mon(10), sat(23, 59)]) {
      expect(activeRules(routine, true, when).find((r) => r.domain === 'instagram.com')!.mode).toBe('blocked');
      expect(activeRules(routine, false, when).find((r) => r.domain === 'instagram.com')!.mode).toBe('blocked'); // interruptor geral não importa
    }
    expect(nextBoundary(routine, false, mon(8))).toBeUndefined();
  });

  it('ganha de faixas mais leves; site desligado na rotina não bloqueia; ligar religa o site', () => {
    const restricted = site('youtube.com', [slot('r', { mode: 'restricted', restrictedKind: 'youtube' })]);
    expect(activeRules(setBlockAll([restricted], 'youtube.com', true, id), true, mon(10))[0]!.mode).toBe('blocked');
    const off = { ...setBlockAll([restricted], 'youtube.com', true, id)[0]!, enabled: false };
    expect(activeRules([off], true, mon(10))).toEqual([]);
    expect(isBlockedAll(setBlockAll([off], 'youtube.com', true, id), 'youtube.com')).toBe(true);
  });

  it('entra no pedido de permissões e na confirmação ao afrouxar', () => {
    const routine = setBlockAll([], 'tiktok.com', true, id);
    expect(rulesAnyTime(routine).map((r) => r.domain)).toEqual(['tiktok.com']);
    expect(loosensNow({ sites: routine, enabled: true }, { sites: setBlockAll(routine, 'tiktok.com', false, id), enabled: true }, mon(10))).toBe(true);
    expect(loosensNow({ sites: [], enabled: true }, { sites: routine, enabled: true }, mon(10))).toBe(false); // bloquear não pede confirmação
  });
});

describe('horário por recurso', () => {
  let n = 0;
  const id = () => `novo${++n}`;
  const youtube = (): RoutineSite =>
    site('youtube.com', [
      slot('work', { mode: 'restricted', restrictedKind: 'youtube', features: ['home', 'shorts', 'related'] }),
      slot('night', { mode: 'restricted', restrictedKind: 'youtube', features: ['home'], days: [0, 1, 2, 3, 4, 5, 6], startMin: t(22), endMin: t(6) }),
      slot('blk', { mode: 'blocked', startMin: t(12), endMin: t(13) }),
    ]);

  it('featureSlotsOf: só as faixas restritas do serviço que escondem o recurso', () => {
    expect(featureSlotsOf(youtube(), 'home').map((s) => s.id)).toEqual(['work', 'night']);
    expect(featureSlotsOf(youtube(), 'related').map((s) => s.id)).toEqual(['work']);
    expect(featureSlotsOf(youtube(), 'comments')).toEqual([]);
    expect(featureSlotsOf(site('reddit.com', [slot('x', { mode: 'restricted', restrictedKind: 'intent' })]), 'home')).toEqual([]);
  });

  it('faixa de um recurso só: o horário muda no lugar', () => {
    const next = retimeFeature(youtube(), 'night', 'home', { startMin: t(23), endMin: t(5) }, id);
    expect(next.slots.find((s) => s.id === 'night')).toMatchObject({ startMin: t(23), endMin: t(5), features: ['home'] });
    expect(next.slots).toHaveLength(3);
  });

  it('faixa com vários recursos: o recurso é separado numa faixa própria e os outros ficam como estavam', () => {
    const next = retimeFeature(youtube(), 'work', 'home', { startMin: t(14), endMin: t(16) }, id);
    expect(next.slots.find((s) => s.id === 'work')).toMatchObject({ features: ['shorts', 'related'], startMin: t(9), endMin: t(18) });
    const detached = next.slots.find((s) => !['work', 'night', 'blk'].includes(s.id))!;
    expect(detached).toMatchObject({ mode: 'restricted', restrictedKind: 'youtube', features: ['home'], startMin: t(14), endMin: t(16), days: WEEK });
    expect(activeRules([next], true, mon(10))[0]!.features).toEqual(['shorts', 'related']);
    expect(activeRules([next], true, mon(15))[0]!.features).toEqual(['home', 'shorts', 'related']);
  });

  it('cenário do usuário: recomendados o dia todo, feed só em certos horários', () => {
    let y = site('youtube.com', []);
    y = { ...y, slots: [newFeatureSlot(y, 'related', [0, 1, 2, 3, 4, 5, 6], { startMin: 0, endMin: 1440 }, id), newFeatureSlot(y, 'home', WEEK, { startMin: t(9), endMin: t(18) }, id)] };
    expect(activeRules([y], true, mon(7))[0]!.features).toEqual(['related']);
    expect(activeRules([y], true, mon(10))[0]!.features).toEqual(['home', 'related']);
    expect(activeRules([y], true, sat(10))[0]!.features).toEqual(['related']);
    expect(validateSite(y)).toEqual([]);
  });

  it('newFeatureSlot recusa recurso que o serviço não tem; dropFeature apaga a faixa que ficou sem recursos', () => {
    expect(() => newFeatureSlot(site('youtube.com', []), 'reels', WEEK, { startMin: 0, endMin: 60 }, id)).toThrow();
    expect(() => newFeatureSlot(site('reddit.com', []), 'home', WEEK, { startMin: 0, endMin: 60 }, id)).toThrow();
    const afterDrop = dropFeature(youtube(), 'work', 'shorts');
    expect(afterDrop.slots.find((s) => s.id === 'work')!.features).toEqual(['home', 'related']);
    expect(dropFeature(youtube(), 'night', 'home').slots.map((s) => s.id)).toEqual(['work', 'blk']);
  });
});

describe('limite de tempo e permissões de acesso', () => {
  it('rulesAnyTime inclui os apps com limite (ao estourar viram bloqueados e o Pavio precisa do acesso)', () => {
    const routine: RoutineSite[] = [
      { id: 'a', domain: 'youtube.com', enabled: true, slots: [], limitMin: 30 },
      { id: 'b', domain: 'x.com', enabled: true, slots: [] },
      { id: 'c', domain: 'tiktok.com', enabled: false, slots: [], limitMin: 15 },
    ];
    expect(rulesAnyTime(routine).map((r) => `${r.domain}:${r.mode}`)).toEqual(['youtube.com:blocked']);
  });
});

describe('limite de tempo: validação e confirmação ao afrouxar', () => {
  const limited = (limitMin?: number): RoutineSite[] => [{ id: 'y', domain: 'youtube.com', enabled: true, slots: [], ...(limitMin ? { limitMin } : {}) }];
  const spent = addUsage({}, 'youtube.com', 31 * 60_000, mon(15));

  it('valida limitMin (1 a 1440)', () => {
    expect(validateSite(limited(30)[0]!)).toEqual([]);
    expect(validateSite({ ...limited(30)[0]!, limitMin: 0 })).toContain('limit:invalid'); // "sem limite" é a ausência do campo, não zero
    expect(validateSite({ ...limited(30)[0]!, limitMin: 2000 })).toContain('limit:invalid');
    expect(validateSite({ ...limited(30)[0]!, limitMin: 1.5 })).toContain('limit:invalid');
  });

  it('tirar ou subir o limite de um app que estourou hoje é afrouxar; baixar ou mexer sem estar estourado, não', () => {
    const before = { sites: limited(30), enabled: true };
    expect(loosensNow(before, { sites: limited(), enabled: true }, mon(15), spent)).toBe(true); // tirou o limite
    expect(loosensNow(before, { sites: limited(60), enabled: true }, mon(15), spent)).toBe(true); // subiu acima do uso
    expect(loosensNow(before, { sites: limited(20), enabled: true }, mon(15), spent)).toBe(false); // baixou: continua estourado
    expect(loosensNow(before, { sites: limited(), enabled: true }, mon(15), {})).toBe(false); // ainda não tinha estourado
  });
});
