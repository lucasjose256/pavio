import { crossesMidnight, formatMinutes } from '../../core/schedule';
import type { ScheduleBlock } from '../../core/models';

/** 0 = domingo … 6 = sábado. */
export const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
/** Ordem de exibição: a semana começa na segunda. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

export function formatDays(days: number[]): string {
  if (sameSet(days, [0, 1, 2, 3, 4, 5, 6])) return 'Todos os dias';
  if (sameSet(days, [1, 2, 3, 4, 5])) return 'Dias úteis';
  if (sameSet(days, [0, 6])) return 'Fim de semana';
  return WEEK_ORDER.filter((d) => days.includes(d)).map((d) => DAY_SHORT[d]).join(', ');
}

/** "09:00 – 12:00" ou "22:00 – 06:00 (dia seguinte)". */
export function formatRange(b: Pick<ScheduleBlock, 'startMin' | 'endMin'>): string {
  return `${formatMinutes(b.startMin)} – ${formatMinutes(b.endMin)}${crossesMidnight(b) ? ' (dia seguinte)' : ''}`;
}

/** "hoje 09:00", "amanhã 09:00" ou "seg 09:00". */
export function formatWhen(ts: number, now: number): string {
  const d = new Date(ts);
  const time = formatMinutes(d.getHours() * 60 + d.getMinutes());
  const dayDiff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime()) / 86_400_000);
  if (dayDiff === 0) return `hoje ${time}`;
  if (dayDiff === 1) return `amanhã ${time}`;
  return `${DAY_SHORT[d.getDay()]!.toLowerCase()} ${time}`;
}
