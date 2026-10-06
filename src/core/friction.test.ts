import { describe, expect, it } from 'vitest';
import { EXTEND_PHRASE, GIVE_UP_PHRASE, evaluateFriction, frictionFor, frictionForExtension, normalizePhrase } from './friction';

const base = { elapsedMs: 0, typed: '', confirmed: false, challengesPassed: [] as string[] };

describe('frictionFor', () => {
  it('leve = só confirmar; foco = esperar 10s + digitar a frase', () => {
    expect(frictionFor('light')).toEqual([{ type: 'confirm' }]);
    expect(frictionFor('focus')).toEqual([
      { type: 'wait', seconds: 10 },
      { type: 'typePhrase', phrase: 'eu quero desistir do meu foco agora' },
    ]);
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
  it('exige as duas coisas: espera e frase', () => {
    expect(evaluateFriction(steps, { ...base, typed: GIVE_UP_PHRASE }).done).toBe(false); // frase ok, cedo demais
    expect(evaluateFriction(steps, { ...base, elapsedMs: 10_000 }).done).toBe(false); // tempo ok, sem frase
    expect(evaluateFriction(steps, { ...base, elapsedMs: 10_000, typed: GIVE_UP_PHRASE }).done).toBe(true);
  });
  it('informa o tempo que falta, sem ficar negativo', () => {
    expect(evaluateFriction(steps, { ...base, elapsedMs: 3_500 }).waitRemainingMs).toBe(6_500);
    expect(evaluateFriction(steps, { ...base, elapsedMs: 99_000 }).waitRemainingMs).toBe(0);
  });
  it('frase errada não libera', () => {
    const r = evaluateFriction(steps, { ...base, elapsedMs: 10_000, typed: 'eu quero desistir' });
    expect(r).toMatchObject({ done: false, phraseOk: false });
  });
  it('tolera maiúsculas, espaços e acentos', () => {
    expect(normalizePhrase('  EU  quero   desístir do meu FOCO agora ')).toBe(GIVE_UP_PHRASE);
    expect(evaluateFriction(steps, { ...base, elapsedMs: 10_000, typed: ' Eu quero desistir do meu foco agora ' }).done).toBe(true);
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

describe('fricção para "mais 5 min"', () => {
  const steps = frictionForExtension();
  it('é sempre completa: espera de 10 s e a frase própria (a de desistir não vale)', () => {
    expect(steps).toEqual([{ type: 'wait', seconds: 10 }, { type: 'typePhrase', phrase: EXTEND_PHRASE }]);
    expect(evaluateFriction(steps, { elapsedMs: 10_000, typed: EXTEND_PHRASE, confirmed: false, challengesPassed: [] }).done).toBe(true);
    expect(evaluateFriction(steps, { elapsedMs: 10_000, typed: GIVE_UP_PHRASE, confirmed: false, challengesPassed: [] }).done).toBe(false);
    expect(evaluateFriction(steps, { elapsedMs: 3_000, typed: EXTEND_PHRASE, confirmed: false, challengesPassed: [] }).done).toBe(false);
  });
});
