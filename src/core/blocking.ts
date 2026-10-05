import type { BlockPlan, IntentGrant, Policy, Rule } from './models';
import { hostMatchesDomain } from './matching';

export const EMPTY_PLAN: BlockPlan = { block: [], intent: [], allow: [] };

const isSub = (domain: string, parent: string) => domain !== parent && hostMatchesDomain(domain, parent);

/**
 * - `blocked`  → `block` (vela).
 * - `restricted` + kind `intent` → `intent` (pergunta "o que você vai fazer aqui?"), a menos que já exista permissão.
 * - `restricted` youtube/instagram/x/linkedin → passa pela rede (content scripts cuidam).
 * Regra mais específica (subdomínio) que não é bloqueio vira exceção `allow`.
 */
export function planForRules(rules: Rule[], grants: IntentGrant[] = []): BlockPlan {
  const granted = new Set(grants.map((g) => g.domain));
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  const block = uniq(rules.filter((r) => r.mode === 'blocked').map((r) => r.domain));
  const intent = uniq(
    rules
      .filter((r) => r.mode === 'restricted' && r.restrictedKind === 'intent' && !granted.has(r.domain))
      .map((r) => r.domain),
  );
  const guarded = [...block, ...intent];
  const allow = uniq(
    rules
      .filter((r) => !block.includes(r.domain) && !intent.includes(r.domain) && guarded.some((g) => isSub(r.domain, g)))
      .map((r) => r.domain),
  );
  return { block, intent, allow };
}

/** Domínios que precisam de acesso opcional ao site (permissão pedida ao usuário): bloqueados e com intenção. */
export function accessDomains(source: { rules: Rule[] }): string[] {
  const plan = planForRules(source.rules);
  return [...plan.block, ...plan.intent];
}

/** Plano para a política atual (rotina + Timer). Sem política = nada bloqueado. */
export function planFor(policy: Pick<Policy, 'rules'> | undefined, grants: IntentGrant[] = []): BlockPlan {
  return policy ? planForRules(policy.rules, grants) : EMPTY_PLAN;
}

/** Domínios com "modo intenção" na política (permissões de intenção de outros sites são descartadas). */
export const intentDomains = (rules: Rule[]): string[] =>
  rules.filter((r) => r.mode === 'restricted' && r.restrictedKind === 'intent').map((r) => r.domain);
