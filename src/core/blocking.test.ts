import { describe, expect, it } from 'vitest';
import { EMPTY_PLAN, planFor, planForEnvironment } from './blocking';
import { createBuiltinEnvironment } from './environments';

describe('planForEnvironment', () => {
  it('bloqueia só os "blocked"; restritos passam', () => {
    const plan = planForEnvironment(createBuiltinEnvironment('builtin-study', 0)!);
    expect(plan.block).toEqual(['facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com', 'x.com']);
    expect(plan.block).not.toContain('youtube.com');
    expect(plan.allow).toEqual([]);
  });

  it('subdomínio liberado ou restrito vira exceção do domínio bloqueado', () => {
    const env = createBuiltinEnvironment('builtin-deep-work', 0)!;
    env.rules.push(
      { id: 'a', domain: 'music.youtube.com', mode: 'allowed' },
      { id: 'b', domain: 'studio.youtube.com', mode: 'restricted', restrictedKind: 'intent' },
    );
    const plan = planForEnvironment(env);
    expect(plan.block).toContain('youtube.com');
    expect(plan.allow).toEqual(['music.youtube.com', 'studio.youtube.com']);
  });
});

describe('planFor', () => {
  it('sem sessão ativa não bloqueia nada', () => {
    const env = createBuiltinEnvironment('builtin-study', 0)!;
    expect(planFor(undefined)).toEqual(EMPTY_PLAN);
    expect(planFor({ status: 'completed', environmentSnapshot: env })).toEqual(EMPTY_PLAN);
    expect(planFor({ status: 'active', environmentSnapshot: env }).block).toHaveLength(5);
  });
});
