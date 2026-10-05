import { describe, expect, it } from 'vitest';
import { EMPTY_PLAN, accessDomains, intentDomains, planFor, planForRules } from './blocking';
import { createBuiltinEnvironment } from './environments';
import type { IntentGrant, Rule } from './models';

const grant = (domain: string): IntentGrant => ({ domain, text: 'x', minutes: 5, startedAt: 0, endsAt: 1 });
const deep = () => createBuiltinEnvironment('builtin-deep-work', 0)!;

describe('planForRules', () => {
  it('bloqueia os "blocked"; restritos de serviço passam; intenção vai para a pergunta', () => {
    const plan = planForRules(deep().rules);
    expect(plan.block).toEqual(['facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com']);
    expect(plan.intent).toEqual(['reddit.com']); // x.com e linkedin.com são restritos por serviço: content script, não rede
    expect(plan.allow).toEqual([]);
  });

  it('com permissão de intenção, o site deixa de ser redirecionado', () => {
    expect(planForRules(deep().rules, [grant('reddit.com')]).intent).toEqual([]);
  });

  it('subdomínio liberado/restrito vira exceção do domínio bloqueado ou com intenção', () => {
    const rules: Rule[] = [
      ...deep().rules,
      { id: 'a', domain: 'music.youtube.com', mode: 'allowed' },
      { id: 'b', domain: 'old.reddit.com', mode: 'allowed' },
    ];
    expect(planForRules(rules).allow).toEqual(['music.youtube.com', 'old.reddit.com']);
  });
});

describe('planFor / accessDomains / intentDomains', () => {
  it('sem política não bloqueia nada', () => {
    expect(planFor(undefined)).toEqual(EMPTY_PLAN);
    expect(planFor({ rules: [] })).toEqual(EMPTY_PLAN);
    expect(planFor({ rules: createBuiltinEnvironment('builtin-study', 0)!.rules }).block).toHaveLength(5);
  });
  it('accessDomains pede acesso só ao que o DNR precisa (YouTube/Instagram/X/LinkedIn restritos não)', () => {
    expect(accessDomains(createBuiltinEnvironment('builtin-night', 0)!)).toEqual(['facebook.com', 'linkedin.com', 'tiktok.com', 'reddit.com']);
  });
  it('intentDomains lista os sites em modo intenção', () => {
    expect(intentDomains(deep().rules)).toEqual(['reddit.com']);
  });
});
