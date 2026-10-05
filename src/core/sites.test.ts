import { describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import { instagramDecision, restrictedKindActive } from './sites';

describe('instagramDecision', () => {
  it('só mensagens (e login) passam', () => {
    for (const p of ['/direct/inbox/', '/direct/t/123456/', '/direct', '/accounts/login/', '/challenge/abc/'])
      expect(instagramDecision(p).action, p).toBe('allow');
  });
  it('início vai para a caixa de mensagens; o resto é bloqueado', () => {
    expect(instagramDecision('/').action).toBe('redirect-inbox');
    for (const p of ['/reels/', '/reel/Cx12/', '/explore/', '/explore/tags/x/', '/someuser/', '/p/abc/', '/stories/someone/', '/directory/'])
      expect(instagramDecision(p), p).toEqual({ action: 'block', reason: 'dm-only' });
  });
});

describe('restrictedKindActive', () => {
  const night = createBuiltinEnvironment('builtin-night', 0)!; // instagram e x restritos
  const study = createBuiltinEnvironment('builtin-study', 0)!; // instagram e x bloqueados
  it('ativa só com sessão ativa e regra restrita do tipo certo', () => {
    expect(restrictedKindActive({ status: 'active', environmentSnapshot: night }, 'instagram', ['instagram.com'])).toBe(true);
    expect(restrictedKindActive({ status: 'active', environmentSnapshot: night }, 'x', ['x.com', 'twitter.com'])).toBe(true);
    expect(restrictedKindActive({ status: 'active', environmentSnapshot: night }, 'instagram', ['x.com'])).toBe(false);
    expect(restrictedKindActive({ status: 'active', environmentSnapshot: study }, 'instagram', ['instagram.com'])).toBe(false);
    expect(restrictedKindActive({ status: 'completed', environmentSnapshot: night }, 'x', ['x.com'])).toBe(false);
    expect(restrictedKindActive(undefined, 'x', ['x.com'])).toBe(false);
  });
});
