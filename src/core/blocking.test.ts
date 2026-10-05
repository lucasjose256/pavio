import { describe, expect, it } from 'vitest';
import { EMPTY_PLAN, planFor, planForEnvironment } from './blocking';
import { createBuiltinEnvironment } from './environments';
import type { IntentGrant } from './models';

const grant = (domain: string): IntentGrant => ({ domain, text: 'x', minutes: 5, startedAt: 0, endsAt: 1 });

describe('planForEnvironment', () => {
  it('bloqueia os "blocked"; restritos de app passam; intenção vai para a pergunta', () => {
    const plan = planForEnvironment(createBuiltinEnvironment('builtin-deep-work', 0)!);
    expect(plan.block).toEqual(['facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com']);
    expect(plan.intent).toEqual(['reddit.com']); // x.com é restrito "x": content script, não rede
    expect(plan.allow).toEqual([]);
  });

  it('com permissão de intenção, o site deixa de ser redirecionado', () => {
    const env = createBuiltinEnvironment('builtin-deep-work', 0)!;
    expect(planForEnvironment(env, [grant('reddit.com')]).intent).toEqual([]);
  });

  it('subdomínio liberado/restrito vira exceção do domínio bloqueado ou com intenção', () => {
    const env = createBuiltinEnvironment('builtin-deep-work', 0)!;
    env.rules.push(
      { id: 'a', domain: 'music.youtube.com', mode: 'allowed' },
      { id: 'b', domain: 'old.reddit.com', mode: 'allowed' },
    );
    expect(planForEnvironment(env).allow).toEqual(['music.youtube.com', 'old.reddit.com']);
  });
});

describe('planFor', () => {
  it('sem sessão ativa não bloqueia nada', () => {
    const env = createBuiltinEnvironment('builtin-study', 0)!;
    expect(planFor(undefined)).toEqual(EMPTY_PLAN);
    expect(planFor({ status: 'completed', environmentSnapshot: env })).toEqual(EMPTY_PLAN);
    const plan = planFor({ status: 'active', environmentSnapshot: env });
    expect(plan.block).toHaveLength(5);
    expect(plan.intent).toEqual([]);
  });
});
