import { describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import { findRule, hostMatchesDomain, normalizeDomain } from './matching';

describe('normalizeDomain', () => {
  it('limpa protocolo, www, caminho, porta e caixa', () => {
    expect(normalizeDomain('https://www.YouTube.com/watch?v=1')).toBe('youtube.com');
    expect(normalizeDomain('  Reddit.com/r/foo ')).toBe('reddit.com');
    expect(normalizeDomain('user@sub.example.com:8080/x')).toBe('sub.example.com');
  });
  it('rejeita entradas inválidas', () => {
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain('não é site')).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
  });
});

describe('hostMatchesDomain / findRule', () => {
  it('casa subdomínios mas não sufixos parecidos', () => {
    expect(hostMatchesDomain('m.youtube.com', 'youtube.com')).toBe(true);
    expect(hostMatchesDomain('www.youtube.com', 'youtube.com')).toBe(true);
    expect(hostMatchesDomain('notyoutube.com', 'youtube.com')).toBe(false);
  });
  it('usa a regra mais específica e libera o que não tem regra', () => {
    const env = createBuiltinEnvironment('builtin-study', 0)!;
    env.rules.push({ id: 'x', domain: 'music.youtube.com', mode: 'allowed' });
    expect(findRule(env, 'music.youtube.com')?.mode).toBe('allowed');
    expect(findRule(env, 'www.youtube.com')?.mode).toBe('restricted');
    expect(findRule(env, 'wikipedia.org')).toBeUndefined();
  });
});
