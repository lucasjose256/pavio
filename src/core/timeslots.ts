import { dayKey } from './history';

export const MINUTES_PER_DAY = 1440;

/** Um horário que se repete nos dias da semana (0 = domingo … 6 = sábado). */
export interface TimeSlot {
  id: string;
  days: number[];
  startMin: number;
  endMin: number;
}

/** `endMin <= startMin` = termina no dia seguinte. (`endMin = 1440` é "fim do dia", não vira a noite.) */
export const crossesMidnight = (s: Pick<TimeSlot, 'startMin' | 'endMin'>): boolean => s.endMin <= s.startMin;

/** Duração em minutos; 0 = inválida (início = fim). */
export function slotDurationMin(s: Pick<TimeSlot, 'startMin' | 'endMin'>): number {
  return s.endMin > s.startMin ? s.endMin - s.startMin : s.endMin === s.startMin ? 0 : s.endMin - s.startMin + MINUTES_PER_DAY;
}

/** "09:05" (1440 → "24:00"). */
export function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** "09:05" → 545. Aceita "24:00" (1440). Null se inválido. */
export function parseTime(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h === 24 && min === 0) return MINUTES_PER_DAY;
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Erros (códigos) do horário; vazio = válido. */
export function validateTimeSlot(s: Pick<TimeSlot, 'days' | 'startMin' | 'endMin'>): string[] {
  const errors: string[] = [];
  if (s.days.length === 0 || s.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errors.push('days:empty');
  const okStart = Number.isInteger(s.startMin) && s.startMin >= 0 && s.startMin < MINUTES_PER_DAY;
  const okEnd = Number.isInteger(s.endMin) && s.endMin >= 0 && s.endMin <= MINUTES_PER_DAY;
  if (!okStart || !okEnd) errors.push('time:range');
  else if (s.startMin === s.endMin) errors.push('time:same');
  return errors;
}

export interface Occurrence<T extends TimeSlot> {
  slot: T;
  /** `idDoHorário:AAAA-MM-DD` do dia em que COMEÇA. */
  key: string;
  start: number;
  end: number;
}

const at = (y: number, m: number, d: number, minutes: number) => new Date(y, m, d, 0, minutes).getTime();

/** Ocorrências entre `back` dias antes e `ahead` dias depois de `now`. */
export function occurrencesAround<T extends TimeSlot>(slots: T[], now: number, back = 1, ahead = 8): Occurrence<T>[] {
  const base = new Date(now);
  const out: Occurrence<T>[] = [];
  for (let offset = -back; offset <= ahead; offset++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
    for (const slot of slots) {
      if (slotDurationMin(slot) === 0 || !slot.days.includes(day.getDay())) continue;
      const y = day.getFullYear(), m = day.getMonth(), d = day.getDate();
      const start = at(y, m, d, slot.startMin);
      const end = crossesMidnight(slot) ? at(y, m, d + 1, slot.endMin) : at(y, m, d, slot.endMin);
      out.push({ slot, key: `${slot.id}:${dayKey(start)}`, start, end });
    }
  }
  return out;
}

/** Passo do encaixe ao arrastar na linha do tempo (minutos). */
export const SNAP_MIN = 15;

export const snapMinute = (minute: number, step = SNAP_MIN): number => Math.round(minute / step) * step;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

type Times = { startMin: number; endMin: number };

/**
 * Novo horário ao arrastar uma ponta até `minute` (com encaixe). Duração mínima = um passo.
 * Horário que vira a noite (22:00 → 06:00): o início fica à noite e o fim de manhã, sem se cruzarem.
 */
export function resizeSlot(slot: Times, edge: 'start' | 'end', minute: number, step = SNAP_MIN): Times {
  const m = snapMinute(minute, step);
  if (!crossesMidnight(slot)) {
    return edge === 'start'
      ? { startMin: clamp(m, 0, slot.endMin - step), endMin: slot.endMin }
      : { startMin: slot.startMin, endMin: clamp(m, slot.startMin + step, MINUTES_PER_DAY) };
  }
  return edge === 'start'
    ? { startMin: clamp(m, slot.endMin + step, MINUTES_PER_DAY - step), endMin: slot.endMin }
    : { startMin: slot.startMin, endMin: clamp(m, step, slot.startMin - step) };
};

/** Novo horário ao arrastar a faixa inteira `deltaMin` minutos (mantém a duração). Só para quem não vira a noite. */
export function moveSlot(slot: Times, deltaMin: number, step = SNAP_MIN): Times | null {
  if (crossesMidnight(slot)) return null;
  const duration = slot.endMin - slot.startMin;
  const start = clamp(snapMinute(slot.startMin + deltaMin, step), 0, MINUTES_PER_DAY - duration);
  return { startMin: start, endMin: start + duration };
}

export interface DaySegment {
  slotId: string;
  startMin: number;
  endMin: number;
  /**
   * `whole`: o horário inteiro cabe no dia. `head`: começa neste dia e segue na madrugada seguinte.
   * `tail`: continuação (depois da meia-noite) de um horário que começou na véspera.
   */
  part: 'whole' | 'head' | 'tail';
}

/**
 * Pedaços de um dia da semana (para desenhar a linha do tempo de 24 h): inclui a continuação, depois da
 * meia-noite, de horários que começaram na véspera.
 */
export function segmentsForDay<T extends TimeSlot>(slots: T[], day: number): DaySegment[] {
  const out: DaySegment[] = [];
  const prev = (day + 6) % 7;
  for (const s of slots) {
    if (slotDurationMin(s) === 0) continue;
    if (s.days.includes(day)) {
      out.push(crossesMidnight(s)
        ? { slotId: s.id, startMin: s.startMin, endMin: MINUTES_PER_DAY, part: 'head' }
        : { slotId: s.id, startMin: s.startMin, endMin: s.endMin, part: 'whole' });
    }
    if (crossesMidnight(s) && s.days.includes(prev) && s.endMin > 0) out.push({ slotId: s.id, startMin: 0, endMin: s.endMin, part: 'tail' });
  }
  return out;
}
