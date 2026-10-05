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

export interface Settings {
  candleSkin: string;
}

export const DEFAULT_SETTINGS: Settings = { candleSkin: 'classic' };
