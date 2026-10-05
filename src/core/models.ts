/** Modelos de domínio do Pavio. Puro TypeScript: sem Chrome, sem DOM. */

/** liberado | bloqueado | restrito */
export type RuleMode = 'allowed' | 'blocked' | 'restricted';

/** Como um site `restricted` é tratado. `intent` = modo intenção genérico. */
export type RestrictedKind = 'youtube' | 'instagram' | 'x' | 'intent';

export interface Rule {
  id: string;
  /** Domínio normalizado, ex.: "youtube.com". Cobre subdomínios. */
  domain: string;
  mode: RuleMode;
  /** Obrigatório quando mode === 'restricted'. */
  restrictedKind?: RestrictedKind;
}

export interface Environment {
  id: string;
  name: string;
  /** Sites sem regra são liberados. */
  rules: Rule[];
  /** Ambiente de exemplo que acompanha a extensão. */
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AllowedLink {
  kind: 'video' | 'playlist' | 'channel';
  id: string;
  url: string;
}

/** `light`: confirmação simples ao encerrar. `focus`: fricção completa. */
export type Strictness = 'light' | 'focus';
export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface Session {
  id: string;
  /** Cópia congelada: editar o ambiente no meio da sessão não altera a sessão. */
  environmentSnapshot: Environment;
  startedAt: number;
  /** Fonte da verdade do tempo (epoch ms). Nunca use contadores. */
  endsAt: number;
  plannedMs: number;
  strictness: Strictness;
  youtubeAllowlist: AllowedLink[];
  status: SessionStatus;
  blockedAttempts: number;
}

/** Sessão encerrada, guardada para o futuro relatório de "horas devolvidas". */
export interface HistoryEntry {
  sessionId: string;
  environmentName: string;
  startedAt: number;
  endedAt: number;
  plannedMs: number;
  actualMs: number;
  outcome: 'completed' | 'abandoned';
  blockedAttempts: number;
}

/** creme = claro e quente (padrão); noite = escuro e quente. */
export type ThemeName = 'cream' | 'night';

export interface Settings {
  candleSkin: string;
  theme: ThemeName;
}

export const DEFAULT_SETTINGS: Settings = { candleSkin: 'classic', theme: 'cream' };

/** Regras de rede desejadas agora. `allow` = exceções (subdomínios de um domínio bloqueado/com intenção). */
export interface BlockPlan {
  /** Redireciona para a página da vela. */
  block: string[];
  /** Redireciona para "o que você vai fazer aqui?" (modo intenção), exceto se já houver permissão. */
  intent: string[];
  allow: string[];
}

/** Permissão temporária para um site `restricted` (modo intenção). */
export interface IntentGrant {
  domain: string;
  /** "O que você vai fazer aqui?" */
  text: string;
  minutes: number;
  startedAt: number;
  endsAt: number;
}
