import type { RoutineSlot } from './models';
import { serviceKindFor } from './restrictions';
import { validateSlot } from './routine';

/** Atalhos de dia do "Nova regra" (0 = domingo). */
export const DAY_PRESETS: { id: string; label: string; days: number[] }[] = [
  { id: 'every', label: 'Todos os dias', days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'weekdays', label: 'Dias úteis', days: [1, 2, 3, 4, 5] },
  { id: 'weekend', label: 'Fim de semana', days: [0, 6] },
];

/** Atalhos de horário. `endMin = 1440` = até o fim do dia; `endMin <= startMin` termina no dia seguinte. */
export const TIME_PRESETS: { id: string; label: string; startMin: number; endMin: number }[] = [
  { id: 'all', label: 'O dia todo', startMin: 0, endMin: 1440 },
  { id: 'work', label: 'Horário comercial', startMin: 9 * 60, endMin: 18 * 60 },
  { id: 'morning', label: 'Manhã', startMin: 6 * 60, endMin: 12 * 60 },
  { id: 'night', label: 'À noite', startMin: 22 * 60, endMin: 6 * 60 },
];

export type QuickAction = 'block' | 'hide';

/** Qual atalho de dias corresponde a esta seleção (para destacar o chip), se algum. */
export function dayPresetOf(days: number[]): string | undefined {
  return DAY_PRESETS.find((p) => p.days.length === days.length && p.days.every((d) => days.includes(d)))?.id;
}

/** Alterna um dia (mantém a lista sem repetição e em ordem). */
export function toggleDay(days: number[], day: number): number[] {
  return (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]).sort((a, b) => a - b);
}

/** "Esconder partes" vale para YouTube/Instagram/X/LinkedIn; nos demais sites vira "perguntar a intenção". */
export const hideKindFor = (domain: string) => serviceKindFor(domain) ?? 'intent';

/**
 * Monta a faixa do "Nova regra". `action: 'block'` = bloqueado; `'hide'` = restrito (partes padrão do serviço, ou
 * modo intenção). Devolve os erros da faixa (vazio = válida).
 */
export function quickSlot(
  input: { domain: string; days: number[]; startMin: number; endMin: number; action: QuickAction },
  newId: () => string,
): { slot: RoutineSlot; errors: string[] } {
  const base = { id: newId(), days: [...input.days].sort((a, b) => a - b), startMin: input.startMin, endMin: input.endMin };
  const slot: RoutineSlot = input.action === 'block' ? { ...base, mode: 'blocked' } : { ...base, mode: 'restricted', restrictedKind: hideKindFor(input.domain) };
  return { slot, errors: validateSlot(slot) };
}
