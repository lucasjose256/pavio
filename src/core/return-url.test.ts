import { describe, expect, it } from 'vitest';
import { hasExactReturn, rawNextParam, returnTarget } from './return-url';

describe('rawNextParam', () => {
  it('pega tudo depois de next=, inclusive & e ? da URL original', () => {
    expect(rawNextParam('?site=reddit.com&next=https://reddit.com/r/x?a=1&b=2')).toBe('https://reddit.com/r/x?a=1&b=2');
    expect(rawNextParam('?site=reddit.com')).toBe('');
  });
});

describe('returnTarget', () => {
  it('volta ao endereço exato (cru ou codificado) quando é do mesmo site', () => {
    expect(returnTarget('reddit.com', 'https://www.reddit.com/r/x?a=1&b=2')).toBe('https://www.reddit.com/r/x?a=1&b=2');
    expect(returnTarget('reddit.com', encodeURIComponent('https://old.reddit.com/r/y'))).toBe('https://old.reddit.com/r/y');
    expect(hasExactReturn('reddit.com', 'https://reddit.com/r/x')).toBe(true);
  });
  it('sem endereço, ou de outro site/esquema, cai na página inicial', () => {
    for (const next of [undefined, '', 'lixo', 'https://evil.com/?u=reddit.com', 'https://reddit.com.evil.com/', 'javascript:alert(1)', 'chrome://settings']) {
      expect(returnTarget('reddit.com', next)).toBe('https://reddit.com/');
    }
    expect(hasExactReturn('reddit.com', undefined)).toBe(false);
  });
});
