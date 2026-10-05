import { describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import { combineSpecs, defaultFeatures, defaultSpec, featuresOf, restrictionFor, serviceKindFor, specToggleFeature, specWithKind, specWithMode, strictness } from './restrictions';

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
  const night = { rules: createBuiltinEnvironment('builtin-night', 0)!.rules };
  it('devolve os recursos do serviço restrito; null nos outros casos', () => {
    expect([...restrictionFor(night, 'instagram', ['instagram.com'])!.features]).toEqual(['feed', 'reels', 'explore', 'stories']);
    expect(restrictionFor(night, 'x', ['x.com', 'twitter.com'])).not.toBeNull();
    expect(restrictionFor(night, 'linkedin', ['linkedin.com'])).toBeNull(); // bloqueado na Noite, não restrito
    expect(restrictionFor(undefined, 'x', ['x.com'])).toBeNull();
    expect(restrictionFor({ rules: [] }, 'x', ['x.com'])).toBeNull();
  });
  it('respeita a escolha explícita de recursos da regra', () => {
    const rules = structuredClone(night.rules);
    rules.find((r) => r.domain === 'instagram.com')!.features = ['reels'];
    expect([...restrictionFor({ rules }, 'instagram', ['instagram.com'])!.features]).toEqual(['reels']);
  });
});

describe('tratamento por site: rigor e combinação', () => {
  it('bloqueado > esconder partes > intenção > liberado', () => {
    expect(strictness({ mode: 'blocked' })).toBeGreaterThan(strictness({ mode: 'restricted', restrictedKind: 'youtube' }));
    expect(strictness({ mode: 'restricted', restrictedKind: 'youtube' })).toBeGreaterThan(strictness({ mode: 'restricted', restrictedKind: 'intent' }));
    expect(strictness({ mode: 'restricted', restrictedKind: 'intent' })).toBeGreaterThan(strictness({ mode: 'allowed' }));
  });
  it('combineSpecs: o mais rigoroso vence; mesmo serviço soma os recursos', () => {
    expect(combineSpecs({ mode: 'blocked' }, { mode: 'restricted', restrictedKind: 'intent' }).mode).toBe('blocked');
    const merged = combineSpecs(
      { mode: 'restricted', restrictedKind: 'instagram', features: ['reels'] },
      { mode: 'restricted', restrictedKind: 'instagram', features: ['feed', 'stories'] },
    );
    expect(merged.features).toEqual(['feed', 'reels', 'stories']);
  });
  it('helpers de edição: modo, tipo e recurso', () => {
    expect(defaultSpec('youtube.com', 'restricted')).toEqual({ mode: 'restricted', restrictedKind: 'youtube', features: ['home', 'shorts', 'related', 'comments'] });
    expect(defaultSpec('reddit.com', 'restricted')).toEqual({ mode: 'restricted', restrictedKind: 'intent' });
    expect(defaultSpec('reddit.com', 'blocked')).toEqual({ mode: 'blocked' });
    const spec = defaultSpec('instagram.com', 'restricted');
    expect(specToggleFeature(spec, 'reels').features).toEqual(['feed', 'explore', 'stories']);
    expect(specToggleFeature(spec, 'messages').features).toEqual(['feed', 'reels', 'explore', 'stories', 'messages']);
    expect(specWithKind(spec, 'intent')).toEqual({ mode: 'restricted', restrictedKind: 'intent' });
    expect(specWithMode(spec, 'instagram.com', 'blocked')).toEqual({ mode: 'blocked' });
  });
});
