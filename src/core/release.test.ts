import { describe, expect, it } from 'vitest';
import { activeReleases, addRelease, isReleased, isValidRelease } from './release';

const t0 = new Date(2026, 9, 5, 10).getTime();
const min = (n: number) => n * 60_000;

describe('liberação temporária', () => {
  it('libera por N minutos a partir de agora e substitui a anterior do mesmo app', () => {
    let list = addRelease([], 'youtube.com', 15, t0);
    expect(list).toEqual([{ domain: 'youtube.com', until: t0 + min(15) }]);
    list = addRelease(list, 'youtube.com', 5, t0 + min(1));
    expect(list).toEqual([{ domain: 'youtube.com', until: t0 + min(6) }]);
  });
  it('vencidas somem; valida os minutos', () => {
    const list = addRelease(addRelease([], 'a.com', 5, t0), 'b.com', 30, t0);
    expect(activeReleases(list, t0 + min(10)).map((r) => r.domain)).toEqual(['b.com']);
    expect(isValidRelease(0)).toBe(false);
    expect(isValidRelease(121)).toBe(false);
    expect(() => addRelease([], 'a.com', 0, t0)).toThrow();
  });
  it('cobre subdomínios da regra, não domínios parecidos', () => {
    const list = addRelease([], 'youtube.com', 15, t0);
    expect(isReleased({ domain: 'youtube.com' }, list, t0)).toBe(true);
    expect(isReleased({ domain: 'm.youtube.com' }, list, t0)).toBe(true);
    expect(isReleased({ domain: 'notyoutube.com' }, list, t0)).toBe(false);
    expect(isReleased({ domain: 'youtube.com' }, list, t0 + min(15))).toBe(false);
  });
});
