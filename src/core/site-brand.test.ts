import { describe, expect, it } from 'vitest';
import { monogram, siteBrand } from './site-brand';

describe('siteBrand', () => {
  it('reconhece os sites conhecidos e seus subdomínios; domínio parecido não conta', () => {
    expect(siteBrand('youtube.com')).toBe('youtube');
    expect(siteBrand('m.youtube.com')).toBe('youtube');
    expect(siteBrand('twitter.com')).toBe('x');
    expect(siteBrand('x.com')).toBe('x');
    expect(siteBrand('twitch.tv')).toBe('twitch');
    expect(siteBrand('notyoutube.com')).toBeUndefined();
    expect(siteBrand('exemplo.com.br')).toBeUndefined();
  });
});

describe('monogram', () => {
  it('letra maiúscula do domínio e tom estável', () => {
    expect(monogram('www.pinterest.com')).toEqual(monogram('pinterest.com'));
    expect(monogram('pinterest.com').letter).toBe('P');
    expect(monogram('pinterest.com').hue).toBeGreaterThanOrEqual(0);
    expect(monogram('pinterest.com').hue).toBeLessThan(360);
    expect(monogram('').letter).toBe('?');
  });
});
