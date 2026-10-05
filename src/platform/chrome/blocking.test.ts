import { beforeAll, describe, expect, it } from 'vitest';
import { buildRules, intentPageUrl } from './blocking';

let rules: ReturnType<typeof buildRules>;
beforeAll(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { getURL: (p: string) => `chrome-extension://abc/${p}` } };
  rules = buildRules({ block: ['facebook.com', 'tiktok.com'], intent: ['reddit.com'], allow: ['old.reddit.com'] });
});

describe('buildRules', () => {

  it('bloqueio e intenção são redirecionamentos simples para páginas da extensão (sem regex)', () => {
    const redirects = rules.filter((r) => r.action.type === 'redirect');
    expect(redirects).toHaveLength(3);
    for (const r of redirects) {
      expect(r.action.redirect?.url).toMatch(/^chrome-extension:\/\/abc\/src\/ui\/(blocked|intent)\/index\.html\?site=/);
      expect(r.action.redirect).not.toHaveProperty('regexSubstitution');
      expect(r.condition).not.toHaveProperty('regexFilter');
      expect(r.condition.resourceTypes).toEqual(['main_frame']);
    }
    expect(rules.find((r) => r.id === 500)?.action.redirect?.url).toContain('/intent/index.html?site=reddit.com');
    expect(rules.find((r) => r.id === 1)?.action.redirect?.url).toContain('/blocked/index.html?site=facebook.com');
  });

  it('ids únicos, prioridades crescentes (bloqueio < intenção < exceção) e domínios certos', () => {
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
    const byId = Object.fromEntries(rules.map((r) => [r.id, r]));
    expect(byId[1]!.priority).toBeLessThan(byId[500]!.priority!);
    expect(byId[500]!.priority).toBeLessThan(byId[1000]!.priority!);
    expect(byId[500]!.condition.requestDomains).toEqual(['reddit.com']);
    expect(byId[1000]!.action.type).toBe('allow');
  });

  it('intentPageUrl codifica o endereço de volta (usado só para abas já abertas)', () => {
    expect(intentPageUrl('reddit.com', 'https://www.reddit.com/r/x?a=1&b=2')).toBe(
      'chrome-extension://abc/src/ui/intent/index.html?site=reddit.com&next=https%3A%2F%2Fwww.reddit.com%2Fr%2Fx%3Fa%3D1%26b%3D2',
    );
    expect(intentPageUrl('reddit.com')).toBe('chrome-extension://abc/src/ui/intent/index.html?site=reddit.com');
  });
});
