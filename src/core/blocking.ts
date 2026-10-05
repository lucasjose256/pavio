import type { BlockPlan, Environment, IntentGrant, Session } from './models';
import { hostMatchesDomain } from './matching';

export const EMPTY_PLAN: BlockPlan = { block: [], intent: [], allow: [] };

const isSub = (domain: string, parent: string) => domain !== parent && hostMatchesDomain(domain, parent);

/**
 * - `blocked`  → `block` (vela).
 * - `restricted` + kind `intent` → `intent` (pergunta "o que você vai fazer aqui?"), a menos que já exista permissão.
 * - `restricted` youtube/instagram/x → passa pela rede (content scripts cuidam).
 * Regra mais específica (subdomínio) que não é bloqueio vira exceção `allow`.
 */
export function planForEnvironment(env: Environment, grants: IntentGrant[] = []): BlockPlan {
  const granted = new Set(grants.map((g) => g.domain));
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  const block = uniq(env.rules.filter((r) => r.mode === 'blocked').map((r) => r.domain));
  const intent = uniq(
    env.rules
      .filter((r) => r.mode === 'restricted' && r.restrictedKind === 'intent' && !granted.has(r.domain))
      .map((r) => r.domain),
  );
  const guarded = [...block, ...intent];
  const allow = uniq(
    env.rules
      .filter((r) => !block.includes(r.domain) && !intent.includes(r.domain) && guarded.some((g) => isSub(r.domain, g)))
      .map((r) => r.domain),
  );
  return { block, intent, allow };
}

export function planFor(
  session: Pick<Session, 'status' | 'environmentSnapshot'> | undefined,
  grants: IntentGrant[] = [],
): BlockPlan {
  return session?.status === 'active' ? planForEnvironment(session.environmentSnapshot, grants) : EMPTY_PLAN;
}
