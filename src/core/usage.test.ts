import { describe, expect, it } from 'vitest';
import type { RoutineSite } from './models';
import {
  EXTEND_MIN, addUsage, extendLimit, isValidLimit, limitReached, limitRules, limitStatuses, limitedSiteFor, limitMsFor,
  nextMidnight, pruneUsage, remainingMsFor, trackableHost, usedMs,
} from './usage';
import type { UsageData } from './usage';

const min = (n: number) => n * 60_000;
const at = (day: number, h = 12, m = 0) => new Date(2026, 9, day, h, m).getTime(); // outubro de 2026
const site = (domain: string, limitMin?: number, enabled = true): RoutineSite => ({ id: domain, domain, enabled, slots: [], ...(limitMin ? { limitMin } : {}) });

describe('tempo de uso', () => {
  it('soma por app e por dia, sem mexer no original', () => {
    const empty: UsageData = {};
    const a = addUsage(empty, 'youtube.com', min(10), at(5));
    const b = addUsage(a, 'youtube.com', min(5), at(5, 20));
    expect(empty).toEqual({});
    expect(usedMs(b, 'youtube.com', at(5))).toBe(min(15));
    expect(usedMs(b, 'instagram.com', at(5))).toBe(0);
    expect(usedMs(b, 'youtube.com', at(6))).toBe(0); // outro dia começa do zero
    expect(addUsage(b, 'youtube.com', 0, at(5))).toBe(b); // nada a somar
  });

  it('nextMidnight é a primeira meia-noite local depois do instante', () => {
    expect(nextMidnight(at(5, 23, 59))).toBe(at(6, 0, 0));
    expect(nextMidnight(at(5, 0, 0))).toBe(at(6, 0, 0));
  });

  it('a poda guarda só os últimos 90 dias', () => {
    const data: UsageData = { [`2026-01-01`]: { ms: { 'a.com': 1 }, extraMin: {} }, [`2026-10-04`]: { ms: { 'a.com': 1 }, extraMin: {} } };
    expect(Object.keys(pruneUsage(data, at(5)))).toEqual(['2026-10-04']);
  });
});

describe('limite', () => {
  const yt = site('youtube.com', 30);

  it('só há limite se o app tem limitMin; o valor é o fixo mais as extensões de HOJE', () => {
    expect(limitMsFor(site('x.com'), {}, at(5))).toBeUndefined();
    expect(limitMsFor(yt, {}, at(5))).toBe(min(30));
    const extended = extendLimit({}, 'youtube.com', EXTEND_MIN, at(5));
    expect(limitMsFor(yt, extended, at(5))).toBe(min(35));
    expect(limitMsFor(yt, extended, at(6))).toBe(min(30)); // a extensão vale só no dia
  });

  it('estoura exatamente ao chegar no limite; antes disso não', () => {
    const before = addUsage({}, 'youtube.com', min(30) - 1, at(5));
    expect(limitReached(yt, before, at(5))).toBe(false);
    expect(limitReached(yt, addUsage(before, 'youtube.com', 1, at(5)), at(5))).toBe(true);
    expect(remainingMsFor(yt, before, at(5))).toBe(1);
    expect(remainingMsFor(yt, addUsage(before, 'youtube.com', min(10), at(5)), at(5))).toBe(0);
    expect(remainingMsFor(site('x.com'), {}, at(5))).toBeUndefined();
  });

  it('app desligado na rotina, ou sem limite, nunca estoura', () => {
    const used = addUsage({}, 'youtube.com', min(99), at(5));
    expect(limitReached(site('youtube.com', 30, false), used, at(5))).toBe(false);
    expect(limitReached(site('youtube.com'), used, at(5))).toBe(false);
  });

  it('"mais 5 min" desbloqueia e estoura de novo 5 minutos depois; no dia seguinte zera', () => {
    let data = addUsage({}, 'youtube.com', min(30), at(5));
    expect(limitReached(yt, data, at(5))).toBe(true);
    data = extendLimit(data, 'youtube.com', EXTEND_MIN, at(5));
    expect(limitReached(yt, data, at(5))).toBe(false);
    data = addUsage(data, 'youtube.com', min(5), at(5, 13));
    expect(limitReached(yt, data, at(5, 13))).toBe(true);
    expect(limitReached(yt, data, at(6))).toBe(false);
  });

  it('valida o valor do limite', () => {
    expect([1, 30, 1440].every(isValidLimit)).toBe(true);
    expect([0, -5, 1441, 2.5, NaN].some(isValidLimit)).toBe(false);
  });
});

describe('apps, regras e status', () => {
  const routine = [site('youtube.com', 30), site('instagram.com', 20), site('x.com'), site('music.youtube.com', 10), site('tiktok.com', 15, false)];

  it('limitedSiteFor casa subdomínios, prefere o mais específico e ignora sem limite ou desligado', () => {
    expect(limitedSiteFor(routine, 'www.youtube.com')?.domain).toBe('youtube.com');
    expect(limitedSiteFor(routine, 'music.youtube.com')?.domain).toBe('music.youtube.com');
    expect(limitedSiteFor(routine, 'x.com')).toBeUndefined();
    expect(limitedSiteFor(routine, 'tiktok.com')).toBeUndefined();
    expect(limitedSiteFor(routine, 'wikipedia.org')).toBeUndefined();
  });

  it('limitRules bloqueia só os apps que estouraram hoje', () => {
    const data = addUsage(addUsage({}, 'youtube.com', min(31), at(5)), 'instagram.com', min(5), at(5));
    expect(limitRules(routine, data, at(5))).toEqual([{ id: 'limit:youtube.com', domain: 'youtube.com', mode: 'blocked' }]);
    expect(limitRules(routine, data, at(6))).toEqual([]);
  });

  it('limitStatuses lista os apps com limite, com uso, restante e extensão', () => {
    const data = extendLimit(addUsage({}, 'youtube.com', min(18), at(5)), 'youtube.com', 5, at(5));
    const [yt] = limitStatuses(routine, data, at(5));
    expect(yt).toMatchObject({ domain: 'youtube.com', limitMin: 30, usedMs: min(18), limitMs: min(35), remainingMs: min(17), reached: false, extraMin: 5 });
    expect(limitStatuses(routine, data, at(5)).map((s) => s.domain)).toEqual(['youtube.com', 'instagram.com', 'music.youtube.com', 'tiktok.com']);
  });
});

describe('trackableHost (o que conta como "em uso")', () => {
  const ok = { idle: 'active' as const, windowFocused: true };
  it('só com o computador em uso, janela em foco e aba http(s)', () => {
    expect(trackableHost({ ...ok, url: 'https://www.YouTube.com/watch?v=1' })).toBe('www.youtube.com');
    expect(trackableHost({ ...ok, url: 'http://localhost:3000/x' })).toBe('localhost');
    expect(trackableHost({ ...ok, idle: 'idle', url: 'https://youtube.com' })).toBeNull();
    expect(trackableHost({ ...ok, idle: 'locked', url: 'https://youtube.com' })).toBeNull();
    expect(trackableHost({ ...ok, windowFocused: false, url: 'https://youtube.com' })).toBeNull();
  });
  it('ignora páginas internas, da extensão, sem endereço ou inválidas', () => {
    for (const url of [undefined, '', 'chrome://newtab', 'chrome-extension://abc/page.html', 'about:blank', 'file:///tmp/a.html', 'não é url'])
      expect(trackableHost({ ...ok, url }), String(url)).toBeNull();
  });
});
