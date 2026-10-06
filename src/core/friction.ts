import type { Strictness } from './models';

export const GIVE_UP_PHRASE = 'eu quero desistir do meu foco agora';
export const FOCUS_WAIT_SECONDS = 10;
/** Frase para pedir mais tempo num app que estourou o limite (o número acompanha `EXTEND_MIN` = 5). */
export const EXTEND_PHRASE = 'eu quero mais cinco minutos';

/**
 * Fricção = lista de passos que TODOS precisam estar cumpridos para encerrar a sessão.
 * Novos desafios entram como novos passos `challenge`, sem mudar o resto.
 * Os textos ficam na UI (i18n); aqui só a regra.
 */
export type FrictionStep =
  | { type: 'confirm' }
  | { type: 'wait'; seconds: number }
  | { type: 'typePhrase'; phrase: string }
  | { type: 'challenge'; challengeId: string };

export function frictionFor(strictness: Strictness): FrictionStep[] {
  if (strictness === 'light') return [{ type: 'confirm' }];
  return [
    { type: 'wait', seconds: FOCUS_WAIT_SECONDS },
    { type: 'typePhrase', phrase: GIVE_UP_PHRASE },
  ];
}

/** Pedir "mais um pouco" num app que estourou o limite do dia: sempre a fricção completa (espera + frase). */
export function frictionForExtension(): FrictionStep[] {
  return [{ type: 'wait', seconds: FOCUS_WAIT_SECONDS }, { type: 'typePhrase', phrase: EXTEND_PHRASE }];
}

export interface FrictionInput {
  /** Tempo desde que a tela de fricção abriu. */
  elapsedMs: number;
  typed: string;
  confirmed: boolean;
  challengesPassed: string[];
}

export interface FrictionStatus {
  done: boolean;
  waitRemainingMs: number;
  phraseOk: boolean;
}

/** Ignora maiúsculas, acentos e espaços repetidos; não ignora palavras erradas. */
export function normalizePhrase(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function evaluateFriction(steps: FrictionStep[], input: FrictionInput): FrictionStatus {
  let done = true;
  let waitRemainingMs = 0;
  let phraseOk = true;
  for (const step of steps) {
    switch (step.type) {
      case 'confirm':
        if (!input.confirmed) done = false;
        break;
      case 'wait': {
        const left = Math.max(0, step.seconds * 1000 - input.elapsedMs);
        waitRemainingMs = Math.max(waitRemainingMs, left);
        if (left > 0) done = false;
        break;
      }
      case 'typePhrase':
        if (normalizePhrase(input.typed) !== normalizePhrase(step.phrase)) {
          phraseOk = false;
          done = false;
        }
        break;
      case 'challenge':
        if (!input.challengesPassed.includes(step.challengeId)) done = false;
        break;
    }
  }
  return { done, waitRemainingMs, phraseOk };
}
