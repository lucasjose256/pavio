import { describe, expect, it } from 'vitest';
import type { RoutineSite, RoutineSlot } from './models';
import { activeRules, dropFeature, featureSlotsOf, isBlockedAll, loosensNow, mergeRules, newFeatureSlot, nextBoundary, reshapeFeature, retimeFeature, rulesAnyTime, setBlockAll, quickFeaturesOf, quickMode, setFeatureOff, setLimit, setQuickFeatures, setQuickMode, setSlotOff, protectsNow, validateSite } from './routine';
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

describe('setLimit', () => {
  let n = 0;
  const id = () => `l${++n}`;
  it('site novo entra na rotina só com o limite; site existente ganha o limite e é religado', () => {
    expect(setLimit([], 'youtube.com', 30, id)).toEqual([{ id: 'l1', domain: 'youtube.com', enabled: true, slots: [], limitMin: 30 }]);
    const off: RoutineSite[] = [{ id: 'a', domain: 'x.com', enabled: false, slots: [slot('s')] }];
    expect(setLimit(off, 'x.com', 45, id)[0]).toMatchObject({ enabled: true, limitMin: 45, slots: [slot('s')] });
  });
  it('remover o limite tira o site se ele ficou vazio; senão mantém faixas e bloqueio rápido', () => {
    const only = setLimit([], 'youtube.com', 30, id);
    expect(setLimit(only, 'youtube.com', undefined, id)).toEqual([]);
    const withSlots: RoutineSite[] = [{ id: 'a', domain: 'x.com', enabled: true, slots: [slot('s')], limitMin: 20 }];
    expect(setLimit(withSlots, 'x.com', undefined, id)).toEqual([{ id: 'a', domain: 'x.com', enabled: true, slots: [slot('s')] }]);
    const quick = setBlockAll(setLimit([], 'x.com', 20, id), 'x.com', true, id);
    expect(setLimit(quick, 'x.com', undefined, id)[0]).toMatchObject({ blockAll: true });
    expect('limitMin' in setLimit(quick, 'x.com', undefined, id)[0]!).toBe(false);
  });
  it('não mexe nos outros sites', () => {
    const base = setLimit(setLimit([], 'a.com', 10, id), 'b.com', 20, id);
    expect(setLimit(base, 'a.com', undefined, id).map((s) => s.domain)).toEqual(['b.com']);
  });
});

describe('pausar faixa e protectsNow', () => {
  const mon = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();
  const site: RoutineSite[] = [{ id: 'i', domain: 'instagram.com', enabled: true, slots: [
    { id: 'a', days: [1], startMin: 9 * 60, endMin: 18 * 60, mode: 'blocked' },
    { id: 'b', days: [1], startMin: 20 * 60, endMin: 22 * 60, mode: 'blocked' },
  ] }];
  it('setSlotOff liga e desliga só a faixa pedida', () => {
    const off = setSlotOff(site, 'i', 'a', true);
    expect(off[0]!.slots[0]!.off).toBe(true);
    expect('off' in off[0]!.slots[1]!).toBe(false);
    expect('off' in setSlotOff(off, 'i', 'a', false)[0]!.slots[0]!).toBe(false);
  });
  it('faixa pausada some das regras e das viradas', () => {
    expect(activeRules(setSlotOff(site, 'i', 'a', true), true, mon(10)).map((r) => r.domain)).toEqual([]);
    expect(nextBoundary(setSlotOff(site, 'i', 'a', true), true, mon(10))).toBe(mon(20));
  });
  it('protectsNow: só pede fricção se pausar tira proteção que vale agora', () => {
    expect(protectsNow(site, true, mon(10), {}, [], { domain: 'instagram.com' })).toBe(true);
    expect(protectsNow(site, true, mon(10), {}, [], { domain: 'instagram.com', slotId: 'a' })).toBe(true);
    expect(protectsNow(site, true, mon(10), {}, [], { domain: 'instagram.com', slotId: 'b' })).toBe(false); // ainda não é a hora
    expect(protectsNow(site, true, mon(19), {}, [], { domain: 'instagram.com' })).toBe(false); // fora de faixa
    expect(protectsNow(site, true, mon(10), {}, [{ domain: 'instagram.com', until: mon(11) }], { domain: 'instagram.com' })).toBe(false); // já pausado
  });
});

describe('reshapeFeature (editor por recurso)', () => {
  const yt = (slots: RoutineSlot[]): RoutineSite => ({ id: 'y', domain: 'youtube.com', enabled: true, slots });
  const base = (over: Partial<RoutineSlot>): RoutineSlot => ({ id: 'a', days: [1, 2, 3, 4, 5], startMin: 540, endMin: 1080, mode: 'restricted', restrictedKind: 'youtube', ...over });
  let n = 0;
  const id = () => `n${++n}`;

  it('faixa só deste recurso: muda dias e horário nela mesma', () => {
    const out = reshapeFeature(yt([base({ features: ['shorts'] })]), 'a', 'shorts', { days: [0, 6], startMin: 600, endMin: 720 }, id);
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0]).toMatchObject({ id: 'a', days: [0, 6], startMin: 600, endMin: 720 });
  });
  it('faixa com vários recursos: o recurso vai para uma faixa própria; os outros ficam como estavam', () => {
    const out = reshapeFeature(yt([base({ features: ['home', 'shorts'] })]), 'a', 'shorts', { days: [6], startMin: 0, endMin: 1440 }, id);
    expect(out.slots).toHaveLength(2);
    expect(out.slots[0]).toMatchObject({ id: 'a', features: ['home'], days: [1, 2, 3, 4, 5], startMin: 540, endMin: 1080 });
    expect(out.slots[1]).toMatchObject({ features: ['shorts'], days: [6], startMin: 0, endMin: 1440, mode: 'restricted', restrictedKind: 'youtube' });
  });
  it('só o horário (retimeFeature) mantém os dias da faixa original', () => {
    const out = retimeFeature(yt([base({ features: ['home', 'shorts'] })]), 'a', 'home', { startMin: 60, endMin: 120 }, id);
    expect(out.slots[1]).toMatchObject({ features: ['home'], days: [1, 2, 3, 4, 5], startMin: 60, endMin: 120 });
  });
  it('faixa inexistente não muda nada', () => {
    const site = yt([base({ features: ['shorts'] })]);
    expect(reshapeFeature(site, 'zzz', 'shorts', { startMin: 0 }, id)).toBe(site);
  });
});

describe('pausar só um recurso (offFeatures e pausa por recurso)', () => {
  const mon = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();
  const yt: RoutineSite[] = [{ id: 'y', domain: 'youtube.com', enabled: true, slots: [
    { id: 'a', days: [1], startMin: 9 * 60, endMin: 18 * 60, mode: 'restricted', restrictedKind: 'youtube', features: ['shorts', 'related', 'comments'] },
    { id: 'b', days: [1], startMin: 9 * 60, endMin: 18 * 60, mode: 'blocked' },
  ] }];
  const hidden = (rules: ReturnType<typeof activeRules>) => rules.find((r) => r.domain === 'youtube.com');

  it('sem pausa: a faixa esconde os três recursos', () => {
    const r = activeRules([{ ...yt[0]!, slots: [yt[0]!.slots[0]!] }], true, mon(10));
    expect(hidden(r)?.features).toEqual(['shorts', 'related', 'comments']);
  });
  it('recurso pausado até religar: só ele sai, os outros seguem escondidos', () => {
    const only = [{ ...yt[0]!, slots: [yt[0]!.slots[0]!] }];
    const off = setFeatureOff(only, 'y', 'shorts', true);
    expect(off[0]!.offFeatures).toEqual(['shorts']);
    expect(hidden(activeRules(off, true, mon(10)))?.features).toEqual(['related', 'comments']);
    expect('offFeatures' in setFeatureOff(off, 'y', 'shorts', false)[0]!).toBe(false);
  });
  it('pausa temporária de um recurso volta sozinha no fim', () => {
    const only = [{ ...yt[0]!, slots: [yt[0]!.slots[0]!] }];
    const paused = [{ domain: 'youtube.com', feature: 'related', until: mon(10, 30) }];
    expect(hidden(activeRules(only, true, mon(10), paused))?.features).toEqual(['shorts', 'comments']);
    expect(hidden(activeRules(only, true, mon(10, 30), paused))?.features).toEqual(['shorts', 'related', 'comments']);
  });
  it('todos os recursos pausados: a faixa deixa de valer; faixa de bloqueio não é afetada por pausa de recurso', () => {
    const only = [{ ...yt[0]!, slots: [yt[0]!.slots[0]!] }];
    let off = setFeatureOff(setFeatureOff(setFeatureOff(only, 'y', 'shorts', true), 'y', 'related', true), 'y', 'comments', true);
    expect(activeRules(off, true, mon(10))).toEqual([]);
    off = setFeatureOff(yt, 'y', 'shorts', true);
    expect(hidden(activeRules(off, true, mon(10)))?.mode).toBe('blocked');
  });
  it('faixa sem lista usa os recursos padrão do serviço (e a pausa tira só o escolhido)', () => {
    const def = [{ ...yt[0]!, slots: [{ ...yt[0]!.slots[0]!, features: undefined }] }];
    const all = hidden(activeRules(def, true, mon(10)))?.features;
    const off = hidden(activeRules(setFeatureOff(def, 'y', 'shorts', true), true, mon(10)))?.features;
    expect(all).toBeUndefined(); // padrão do serviço
    expect(off).not.toContain('shorts');
    expect(off!.length).toBeGreaterThan(0);
  });
  it('protectsNow para um recurso: só se ele está sendo escondido agora', () => {
    const only = [{ ...yt[0]!, slots: [yt[0]!.slots[0]!] }];
    expect(protectsNow(only, true, mon(10), {}, [], { domain: 'youtube.com', feature: 'shorts' })).toBe(true);
    expect(protectsNow(only, true, mon(19), {}, [], { domain: 'youtube.com', feature: 'shorts' })).toBe(false);
    expect(protectsNow(setFeatureOff(only, 'y', 'shorts', true), true, mon(10), {}, [], { domain: 'youtube.com', feature: 'shorts' })).toBe(false);
  });
});

describe('bloqueio rápido por partes (quickFeatures)', () => {
  const mon = (h: number) => new Date(2026, 9, 5, h).getTime();
  const sun = (h: number) => new Date(2026, 9, 4, h).getTime();
  let n = 0;
  const id = () => `q${++n}`;
  const yt = (over: Partial<RoutineSite> = {}): RoutineSite => ({ id: 'y', domain: 'youtube.com', enabled: true, slots: [], ...over });
  const hidden = (r: ReturnType<typeof activeRules>, domain = 'youtube.com') => r.find((x) => x.domain === domain);

  it('esconde as partes sempre: qualquer dia e hora, e mesmo com os horários desligados', () => {
    const routine = [yt({ quickFeatures: ['shorts'] })];
    for (const [enabled, when] of [[true, mon(10)], [true, sun(23)], [false, mon(3)]] as const) {
      expect(hidden(activeRules(routine, enabled, when))).toMatchObject({ mode: 'restricted', restrictedKind: 'youtube', features: ['shorts'] });
    }
  });
  it('soma com as faixas do site (une os recursos) e o bloqueio total vence', () => {
    const slot: RoutineSlot = { id: 'a', days: [1], startMin: 540, endMin: 1080, mode: 'restricted', restrictedKind: 'youtube', features: ['comments'] };
    expect(hidden(activeRules([yt({ quickFeatures: ['shorts'], slots: [slot] })], true, mon(10)))?.features?.sort()).toEqual(['comments', 'shorts']);
    expect(hidden(activeRules([yt({ quickFeatures: ['shorts'], blockAll: true })], true, mon(10)))?.mode).toBe('blocked');
  });
  it('pausar um recurso (ou o site) tira só ele; site desligado não esconde nada', () => {
    const routine = [yt({ quickFeatures: ['shorts', 'comments'] })];
    expect(hidden(activeRules(setFeatureOff(routine, 'y', 'shorts', true), true, mon(10)))?.features).toEqual(['comments']);
    const paused = [{ domain: 'youtube.com', feature: 'comments', until: mon(11) }];
    expect(hidden(activeRules(routine, true, mon(10), paused))?.features).toEqual(['shorts']);
    expect(activeRules([yt({ enabled: false, quickFeatures: ['shorts'] })], true, mon(10))).toEqual([]);
  });
  it('site sem recursos (reddit) e ids desconhecidos são ignorados', () => {
    expect(activeRules([{ id: 'r', domain: 'reddit.com', enabled: true, slots: [], quickFeatures: ['shorts'] }], true, mon(10))).toEqual([]);
    expect(activeRules([yt({ quickFeatures: ['naoexiste'] })], true, mon(10))).toEqual([]);
  });
  it('setQuickFeatures cria o site, religa, e some quando fica vazio', () => {
    let r = setQuickFeatures([], 'youtube.com', ['shorts', 'shorts'], id);
    expect(r).toEqual([{ id: 'q1', domain: 'youtube.com', enabled: true, slots: [], quickFeatures: ['shorts'] }]);
    r = setQuickFeatures([{ ...r[0]!, enabled: false }], 'youtube.com', ['shorts', 'home'], id);
    expect(r[0]).toMatchObject({ enabled: true, quickFeatures: ['shorts', 'home'] });
    expect(setQuickFeatures(r, 'youtube.com', [], id)).toEqual([]);
    const withSlot: RoutineSite[] = [yt({ quickFeatures: ['shorts'], slots: [{ id: 'a', days: [1], startMin: 0, endMin: 60, mode: 'blocked' }] })];
    expect(setQuickFeatures(withSlot, 'youtube.com', [], id)).toHaveLength(1); // ainda tem faixa
    expect(quickFeaturesOf(r, 'youtube.com')).toEqual(['shorts', 'home']);
  });
  it('tirar o limite não apaga um site que ainda tem partes escondidas', () => {
    const r = setLimit([yt({ quickFeatures: ['shorts'], limitMin: 20 })], 'youtube.com', undefined, id);
    expect(r).toHaveLength(1);
    expect(r[0]!.quickFeatures).toEqual(['shorts']);
  });
  it('loosensNow: desmarcar uma parte que está escondendo agora é afrouxar', () => {
    const before = [yt({ quickFeatures: ['shorts', 'comments'] })];
    const after = setQuickFeatures(before, 'youtube.com', ['comments'], id);
    expect(loosensNow({ sites: before, enabled: true }, { sites: after, enabled: true }, mon(10))).toBe(true);
    expect(loosensNow({ sites: after, enabled: true }, { sites: before, enabled: true }, mon(10))).toBe(false);
  });
});

describe('modo do bloqueio rápido (livre / só partes / tudo)', () => {
  let n = 0;
  const id = () => `m${++n}`;
  it('livre → só partes: já vem com os Shorts no YouTube; sem serviço, "só partes" não existe', () => {
    let r = setQuickMode([], 'youtube.com', 'parts', id);
    expect(quickMode(r, 'youtube.com')).toBe('parts');
    expect(quickFeaturesOf(r, 'youtube.com')).toEqual(['shorts']);
    expect(quickMode(setQuickMode([], 'reddit.com', 'parts', id), 'reddit.com')).toBe('free');
    r = setQuickMode([], 'instagram.com', 'parts', id);
    expect(quickFeaturesOf(r, 'instagram.com')).toEqual(['feed', 'reels', 'explore', 'stories']);
  });
  it('tudo vence, mas guarda as partes: voltar a "só partes" as restaura', () => {
    let r = setQuickFeatures([], 'youtube.com', ['shorts', 'comments'], id);
    r = setQuickMode(r, 'youtube.com', 'all', id);
    expect(quickMode(r, 'youtube.com')).toBe('all');
    r = setQuickMode(r, 'youtube.com', 'parts', id);
    expect(quickMode(r, 'youtube.com')).toBe('parts');
    expect(quickFeaturesOf(r, 'youtube.com')).toEqual(['shorts', 'comments']);
  });
  it('livre limpa o bloqueio e as partes (e o site vazio sai da lista); mantém faixas e limite', () => {
    let r = setQuickMode(setQuickMode([], 'youtube.com', 'parts', id), 'youtube.com', 'all', id);
    expect(setQuickMode(r, 'youtube.com', 'free', id)).toEqual([]);
    r = [{ id: 'y', domain: 'youtube.com', enabled: true, blockAll: true, quickFeatures: ['shorts'], limitMin: 30, slots: [] }];
    const freed = setQuickMode(r, 'youtube.com', 'free', id);
    expect(freed).toHaveLength(1);
    expect(freed[0]).toMatchObject({ limitMin: 30, blockAll: false });
    expect('quickFeatures' in freed[0]!).toBe(false);
    expect(quickMode(freed, 'youtube.com')).toBe('free');
  });
  it('tudo num app novo ou desligado o liga', () => {
    expect(quickMode(setQuickMode([], 'tiktok.com', 'all', id), 'tiktok.com')).toBe('all');
    const off: RoutineSite[] = [{ id: 'x', domain: 'x.com', enabled: false, slots: [], quickFeatures: ['forYou'] }];
    expect(quickMode(off, 'x.com')).toBe('free'); // desligado = livre
    expect(quickMode(setQuickMode(off, 'x.com', 'all', id), 'x.com')).toBe('all');
  });
});
