import type { RestrictedKind, Session } from './models';
import { findRule } from './matching';
import { enforcing } from './pomodoro';

/** Há sessão ativa cujo ambiente trata algum destes domínios como `restricted` do tipo `kind`? */
export function restrictedKindActive(
  session: Pick<Session, 'status' | 'environmentSnapshot' | 'pomodoro'> | undefined,
  kind: RestrictedKind,
  domains: string[],
): boolean {
  if (!session || !enforcing(session)) return false;
  return domains.some((d) => {
    const rule = findRule(session.environmentSnapshot, d);
    return rule?.mode === 'restricted' && rule.restrictedKind === kind;
  });
}

export type InstagramDecision =
  | { action: 'allow' }
  /** Início do Instagram: leva direto à caixa de mensagens, que é o que o modo permite. */
  | { action: 'redirect-inbox' }
  | { action: 'block'; reason: 'dm-only' };

/** Caminhos que o modo "só mensagens" deixa passar (mensagens + o necessário para entrar na conta). */
const INSTAGRAM_ALLOWED_PREFIXES = ['/direct', '/accounts/login', '/accounts/logout', '/accounts/password', '/accounts/onetap', '/challenge', '/auth_platform'];

export function instagramDecision(pathname: string): InstagramDecision {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { action: 'redirect-inbox' };
  const allowed = INSTAGRAM_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  return allowed ? { action: 'allow' } : { action: 'block', reason: 'dm-only' };
}
