/** Atalhos de dia do editor de faixa (0 = domingo). */
export const DAY_PRESETS: { id: string; label: string; days: number[] }[] = [
  { id: 'every', label: 'Todos os dias', days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'weekdays', label: 'Dias úteis', days: [1, 2, 3, 4, 5] },
  { id: 'weekend', label: 'Fim de semana', days: [0, 6] },
];

/** Qual atalho de dias corresponde a esta seleção (para destacar o chip), se algum. */
export function dayPresetOf(days: number[]): string | undefined {
  return DAY_PRESETS.find((p) => p.days.length === days.length && p.days.every((d) => days.includes(d)))?.id;
}

/** Alterna um dia (mantém a lista sem repetição e em ordem). */
export function toggleDay(days: number[], day: number): number[] {
  return (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]).sort((a, b) => a - b);
}
