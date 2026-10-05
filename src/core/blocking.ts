import type { BlockPlan, Environment, Session } from './models';
import { hostMatchesDomain } from './matching';

export const EMPTY_PLAN: BlockPlan = { block: [], allow: [] };

/**
 * Só `blocked` vira bloqueio de rede. `restricted` passa (os content scripts cuidam dele).
 * Regras não bloqueadas que são subdomínio de um domínio bloqueado viram exceção
 * (ex.: youtube.com bloqueado, music.youtube.com liberado).
 */
export function planForEnvironment(env: Environment): BlockPlan {
  const block = [...new Set(env.rules.filter((r) => r.mode === 'blocked').map((r) => r.domain))].sort();
  const allow = env.rules
    .filter((r) => r.mode !== 'blocked' && block.some((b) => r.domain !== b && hostMatchesDomain(r.domain, b)))
    .map((r) => r.domain)
    .sort();
  return { block, allow };
}

export function planFor(session: Pick<Session, 'status' | 'environmentSnapshot'> | undefined): BlockPlan {
  return session?.status === 'active' ? planForEnvironment(session.environmentSnapshot) : EMPTY_PLAN;
}
