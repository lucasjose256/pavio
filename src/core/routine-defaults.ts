import type { RoutineSite, RoutineSlot } from './models';
import { defaultSpec } from './restrictions';

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const slot = (id: string, days: number[], startMin: number, endMin: number, spec: ReturnType<typeof defaultSpec>): RoutineSlot => ({
  id,
  days,
  startMin,
  endMin,
  ...spec,
});

/**
 * Programação pronta (vem DESLIGADA; o usuário confere e liga):
 * - dias úteis, 9h–18h: redes sociais bloqueadas ou com as partes de distração escondidas;
 * - todos os dias, 22h–6h: noite sem telas.
 */
export function defaultRoutine(): RoutineSite[] {
  const work = (domain: string, mode: 'blocked' | 'restricted') => slot(`default:${domain}:work`, WEEKDAYS, 9 * 60, 18 * 60, defaultSpec(domain, mode));
  const night = (domain: string, mode: 'blocked' | 'restricted') => slot(`default:${domain}:night`, EVERY_DAY, 22 * 60, 6 * 60, defaultSpec(domain, mode));
  const site = (domain: string, ...slots: RoutineSlot[]): RoutineSite => ({ id: `default:${domain}`, domain, enabled: true, slots });

  return [
    site('youtube.com', work('youtube.com', 'restricted'), night('youtube.com', 'restricted')),
    site('instagram.com', work('instagram.com', 'restricted'), night('instagram.com', 'blocked')),
    site('tiktok.com', work('tiktok.com', 'blocked'), night('tiktok.com', 'blocked')),
    site('x.com', work('x.com', 'restricted'), night('x.com', 'restricted')),
    site('facebook.com', work('facebook.com', 'blocked'), night('facebook.com', 'blocked')),
    site('reddit.com', work('reddit.com', 'restricted'), night('reddit.com', 'blocked')),
    site('linkedin.com', work('linkedin.com', 'restricted')),
  ];
}

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
