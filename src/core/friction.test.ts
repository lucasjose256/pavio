import { describe, expect, it } from 'vitest';
import { GIVE_UP_PHRASE, RELEASE_PHRASE, evaluateFriction, frictionFor, frictionForRelease, normalizePhrase } from './friction';

const base = { elapsedMs: 0, typed: '', confirmed: false, challengesPassed: [] as string[] };

describe('frictionFor (apagar a vela)', () => {
  it('sem espera: leve = só confirmar; foco = digitar a frase', () => {
    expect(frictionFor('light')).toEqual([{ type: 'confirm' }]);
    expect(frictionFor('focus')).toEqual([{ type: 'typePhrase', phrase: 'eu quero desistir do meu foco agora' }]);
  });
});

describe('evaluateFriction (modo leve)', () => {
  const steps = frictionFor('light');
  it('libera ao confirmar', () => {
    expect(evaluateFriction(steps, base).done).toBe(false);
    expect(evaluateFriction(steps, { ...base, confirmed: true }).done).toBe(true);
  });
});

describe('evaluateFriction (modo foco)', () => {
  const steps = frictionFor('focus');
  it('a frase certa libera na hora (sem espera)', () => {
    expect(evaluateFriction(steps, base).done).toBe(false);
    expect(evaluateFriction(steps, { ...base, typed: GIVE_UP_PHRASE }).done).toBe(true);
    expect(evaluateFriction(steps, { ...base, typed: GIVE_UP_PHRASE }).waitRemainingMs).toBe(0);
  });
  it('frase errada não libera', () => {
    expect(evaluateFriction(steps, { ...base, typed: 'eu quero desistir' })).toMatchObject({ done: false, phraseOk: false });
  });
  it('tolera maiúsculas, espaços e acentos', () => {
    expect(normalizePhrase('  EU  quero   desístir do meu FOCO agora ')).toBe(GIVE_UP_PHRASE);
    expect(evaluateFriction(steps, { ...base, typed: ' Eu quero desistir do meu foco agora ' }).done).toBe(true);
  });
});

describe('espera (passo reservado)', () => {
  it('ainda funciona se alguém usar', () => {
    const steps = [{ type: 'wait' as const, seconds: 10 }];
    expect(evaluateFriction(steps, { ...base, elapsedMs: 3_500 })).toMatchObject({ done: false, waitRemainingMs: 6_500 });
    expect(evaluateFriction(steps, { ...base, elapsedMs: 10_000 }).done).toBe(true);
  });
});

describe('frictionForRelease (liberar / afrouxar)', () => {
  it('leve = confirmar; firme = a frase própria (a de desistir da vela não vale)', () => {
    expect(frictionForRelease('light')).toEqual([{ type: 'confirm' }]);
    const firm = frictionForRelease('focus');
    expect(evaluateFriction(firm, { ...base, typed: RELEASE_PHRASE }).done).toBe(true);
    expect(evaluateFriction(firm, { ...base, typed: GIVE_UP_PHRASE }).done).toBe(false);
  });
});

describe('desafios (reservado)', () => {
  it('um passo challenge só cumpre quando o desafio foi resolvido', () => {
    const steps = [...frictionFor('light'), { type: 'challenge' as const, challengeId: 'math' }];
    const input = { ...base, confirmed: true };
    expect(evaluateFriction(steps, input).done).toBe(false);
    expect(evaluateFriction(steps, { ...input, challengesPassed: ['math'] }).done).toBe(true);
  });
});

