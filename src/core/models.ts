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
}

/** creme = claro e quente (padrão); noite = escuro e quente. */
export type ThemeName = 'cream' | 'night';

export interface Settings {
  candleSkin: string;
  theme: ThemeName;
  /** Faixas de horário da rotina ligadas? (Vem ligado; a rotina nasce vazia. O bloqueio rápido não depende disto.) */
  routineEnabled: boolean;
  /**
   * Fricção para liberar algo que protege agora (liberar por um tempo, afrouxar a rotina) e o modo da vela que já vem
   * escolhido no popup. `light` = só confirmar (padrão); `focus` = "Firme": digitar a frase. Sem espera em nenhum caso.
   */
  friction: Strictness;
  /** Sugestões de velas de verdade (links de afiliado) nas opções e, raramente, no popup após uma vela concluída. */
  shopSuggestions: boolean;
  /** Mostrar a linha de sugestão também no popup (o "esconder" do popup desliga só isto). */
  shopInPopup: boolean;
}

export const DEFAULT_SETTINGS: Settings = { candleSkin: 'classic', theme: 'cream', routineEnabled: true, friction: 'light', shopSuggestions: true, shopInPopup: true };

/**
 * Pausa temporária: até `until` (epoch ms) as regras da rotina e do limite do app saem (ou só as de UMA faixa,
 * com `slotId`). Vem de "Precisa dele agora?" (tela de bloqueio) e de "Pausar" (Rotina).
 */
export interface Release {
  domain: string;
  until: number;
  /** Ausente = o app inteiro; presente = só esta faixa. */
  slotId?: string;
}

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

/** Como um site é tratado numa faixa da rotina (subconjunto de `Rule`). Fora das faixas o site fica liberado. */
export interface RestrictionSpec {
  mode: 'blocked' | 'restricted';
  restrictedKind?: RestrictedKind;
  features?: string[];
}

/**
 * Faixa de uma rotina: nos `days` (0 = domingo … 6 = sábado), de `startMin` a `endMin` (minutos desde 00:00),
 * o site recebe a restrição. `endMin <= startMin` = termina no dia seguinte (22:00 → 06:00); `endMin = 1440`
 * = até o fim do dia. Dia todo, todos os dias = "para sempre".
 */
export interface RoutineSlot extends RestrictionSpec {
  id: string;
  /** Faixa pausada até a pessoa religar (não vale, mas continua desenhada e guardada). */
  off?: boolean;
  days: number[];
  startMin: number;
  endMin: number;
}

export interface RoutineSite {
  id: string;
  /** Domínio normalizado (youtube.com). */
  domain: string;
  enabled: boolean;
  slots: RoutineSlot[];
  /**
   * Bloqueio rápido: o app INTEIRO bloqueado o tempo todo, sem depender das faixas nem do interruptor dos horários.
   * (Desligar o site na rotina também o libera.)
   */
  blockAll?: boolean;
  /**
   * Limite de tempo: minutos por dia que o app pode ser usado (aba ativa e em foco). Estourou, fica bloqueado até a
   * meia-noite. Ausente = sem limite. Vale mesmo com os horários desligados (controle direto, como o bloqueio rápido).
   */
  limitMin?: number;
}

/**
 * O que vale AGORA: regras da rotina (pelas faixas ativas) somadas às do Timer (ambiente da sessão).
 * Derivada e gravada pelo service worker; bloqueio e content scripts só leem isto.
 */
export interface Policy {
  rules: Rule[];
  /** Lista de links do YouTube da sessão do Timer (vazia fora dela). */
  youtubeAllowlist: AllowedLink[];
  /** Quando a política muda de novo (fim de faixa, fim da vela, fim da pausa…), para avisar "volta a liberar às…". */
  nextChange?: number;
  routineActive: boolean;
  timerActive: boolean;
  /** Apps bloqueados hoje por terem estourado o limite de tempo. */
  limitReached?: string[];
  /** Domínios restritos só pela rotina/limite (não pelo Timer): liberar por um tempo resolve. */
  releasable?: string[];
  /** Liberações temporárias valendo agora. */
  released?: Release[];
}
