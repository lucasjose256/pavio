import type { RoutineSite } from './models';

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/**
 * Rotina inicial: LIMPA. Nada vem bloqueado nem programado: a pessoa escolhe os sites, os horários e o que fazer
 * (ou usa o bloqueio rápido para bloquear um app inteiro).
 */
export const defaultRoutine = (): RoutineSite[] => [];

/** Sites populares sugeridos ao montar a rotina. */
export const ROUTINE_SUGGESTIONS = [
  'youtube.com', 'instagram.com', 'tiktok.com', 'x.com', 'facebook.com', 'reddit.com', 'linkedin.com',
];

/** Atalhos de horário no editor. */
export const SLOT_PRESETS: { label: string; days: number[]; startMin: number; endMin: number }[] = [
  { label: 'Horário comercial', days: WEEKDAYS, startMin: 9 * 60, endMin: 18 * 60 },
  { label: 'Manhã', days: EVERY_DAY, startMin: 6 * 60, endMin: 12 * 60 },
  { label: 'Noite', days: EVERY_DAY, startMin: 22 * 60, endMin: 6 * 60 },
  { label: 'Fim de semana', days: [0, 6], startMin: 0, endMin: 1440 },
  { label: 'Sempre', days: EVERY_DAY, startMin: 0, endMin: 1440 },
];
