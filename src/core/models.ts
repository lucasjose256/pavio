/** Modelos de domínio do Pavio. Puro TypeScript: sem Chrome, sem DOM. */

/** liberado | bloqueado | restrito */
export type RuleMode = 'allowed' | 'blocked' | 'restricted';

/** Como um site `restricted` é tratado. `intent` = modo intenção genérico. */
export type RestrictedKind = 'youtube' | 'instagram' | 'x' | 'linkedin' | 'intent';

export interface Rule {
  id: string;
  /** Domínio normalizado, ex.: "youtube.com". Cobre subdomínios. */
  domain: string;
  mode: RuleMode;
  /** Obrigatório quando mode === 'restricted'. */
  restrictedKind?: RestrictedKind;
  /**
   * Partes do serviço que ficam ESCONDIDAS (ids de `core/restrictions.ts`). Ausente = padrão do serviço.
   * Só vale para youtube/instagram/x/linkedin.
   */
  features?: string[];
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
  /** Quem acendeu a vela. Ausente = manual (sessões antigas). */
  source?: 'manual' | 'schedule';
  /** Só em sessões de horário: a faixa, a ocorrência (`faixa:dia`) e o nome para exibir. */
  scheduleBlockId?: string;
  occurrenceKey?: string;
  scheduleName?: string;
  /** Pomodoro automático: alterna foco e pausa dentro da sessão. Na pausa os bloqueios ficam desligados. */
  pomodoro?: PomodoroSession;
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
  source?: 'manual' | 'schedule';
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

/**
 * Faixa de horário: nos `days` (0 = domingo … 6 = sábado), de `startMin` a `endMin` (minutos desde 00:00),
 * o `environmentId` vale automaticamente. `endMin <= startMin` = termina no dia seguinte (ex.: 22:00 → 06:00).
 */
export interface ScheduleBlock {
  id: string;
  name: string;
  environmentId: string;
  days: number[];
  startMin: number;
  endMin: number;
  strictness: Strictness;
  enabled: boolean;
  /** Se definido, as sessões desta faixa usam Pomodoro automático. */
  pomodoro?: PomodoroConfig;
  createdAt: number;
  updatedAt: number;
}

/** Ciclos de foco/pausa. `longBreakMin = 0` desliga a pausa longa. */
export interface PomodoroConfig {
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  /** A cada quantos focos vem a pausa longa. */
  cyclesBeforeLong: number;
}

export type PomodoroPhase = 'focus' | 'break';

/** Config + fase atual, gravada na sessão (o service worker mantém em dia; as demais partes só leem). */
export interface PomodoroSession extends PomodoroConfig {
  phase: PomodoroPhase;
  /** Número do foco (1, 2, 3…) a que esta fase pertence. */
  cycle: number;
  long: boolean;
  phaseEndsAt: number;
}
