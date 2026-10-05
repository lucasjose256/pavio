import { describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import { defaultFeatures, featuresOf, restrictionFor, serviceKindFor } from './restrictions';

describe('padrões por serviço', () => {
  it('só o que o serviço realmente tem, com Instagram/LinkedIn liberando mensagens', () => {
    expect(defaultFeatures('youtube')).toEqual(['home', 'shorts', 'related', 'comments']);
    expect(defaultFeatures('instagram')).toEqual(['feed', 'reels', 'explore', 'stories']);
    expect(defaultFeatures('x')).toEqual(['forYou', 'explore']);
    expect(defaultFeatures('linkedin')).toEqual(['feed', 'videos', 'news']);
    expect(defaultFeatures('intent')).toEqual([]);
  });
  it('serviceKindFor reconhece domínios e subdomínios (inclusive twitter.com)', () => {
    expect(serviceKindFor('www.youtube.com')).toBe('youtube');
    expect(serviceKindFor('twitter.com')).toBe('x');
    expect(serviceKindFor('linkedin.com')).toBe('linkedin');
    expect(serviceKindFor('reddit.com')).toBeNull();
  });
  it('featuresOf: regra sem lista usa o padrão; lista explícita manda; ids desconhecidos são ignorados', () => {
    expect([...featuresOf({ restrictedKind: 'instagram' })]).toEqual(['feed', 'reels', 'explore', 'stories']);
    expect([...featuresOf({ restrictedKind: 'instagram', features: ['messages', 'inventado'] })]).toEqual(['messages']);
    expect([...featuresOf({ restrictedKind: 'instagram', features: [] })]).toEqual([]);
    expect(featuresOf({ restrictedKind: 'intent', features: ['x'] }).size).toBe(0);
  });
});

describe('restrictionFor', () => {
  const night = createBuiltinEnvironment('builtin-night', 0)!;
  it('devolve os recursos do serviço restrito; null nos outros casos', () => {
    const s = { status: 'active' as const, environmentSnapshot: night };
    expect([...restrictionFor(s, 'instagram', ['instagram.com'])!.features]).toEqual(['feed', 'reels', 'explore', 'stories']);
    expect(restrictionFor(s, 'x', ['x.com', 'twitter.com'])).not.toBeNull();
    expect(restrictionFor(s, 'linkedin', ['linkedin.com'])).toBeNull(); // bloqueado na Noite, não restrito
    expect(restrictionFor({ ...s, status: 'completed' as never }, 'x', ['x.com'])).toBeNull();
    expect(restrictionFor(undefined, 'x', ['x.com'])).toBeNull();
  });
  it('respeita a escolha explícita de recursos da regra', () => {
    const env = structuredClone(night);
    env.rules.find((r) => r.domain === 'instagram.com')!.features = ['reels'];
    expect([...restrictionFor({ status: 'active', environmentSnapshot: env }, 'instagram', ['instagram.com'])!.features]).toEqual(['reels']);
  });
});
