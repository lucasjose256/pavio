import { dayKey } from './history';
import type { ScheduleBlock } from './models';
import { validatePomodoro } from './pomodoro';

export const MINUTES_PER_DAY = 1440;

/** Duração em minutos (considera faixas que viram a noite). 0 = inválida (início = fim). */
export function blockDurationMin(b: Pick<ScheduleBlock, 'startMin' | 'endMin'>): number {
  return (b.endMin - b.startMin + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export const crossesMidnight = (b: Pick<ScheduleBlock, 'startMin' | 'endMin'>): boolean => b.endMin <= b.startMin;

/** "09:05". */
export function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** "09:05" → 545. Null se inválido. */
export function parseTime(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Erros (códigos) de uma faixa; vazio = válida. */
export function validateBlock(b: ScheduleBlock, knownEnvironmentIds?: string[]): string[] {
  const errors: string[] = [];
  if (b.days.length === 0 || b.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errors.push('days:empty');
  const inRange = (m: number) => Number.isInteger(m) && m >= 0 && m < MINUTES_PER_DAY;
  if (!inRange(b.startMin) || !inRange(b.endMin)) errors.push('time:range');
  else if (b.startMin === b.endMin) errors.push('time:same');
  if (knownEnvironmentIds && !knownEnvironmentIds.includes(b.environmentId)) errors.push('env:missing');
  const pomodoroError = b.pomodoro && validatePomodoro(b.pomodoro);
  if (pomodoroError) errors.push(pomodoroError);
  return errors;
}

export interface Occurrence {
  block: ScheduleBlock;
  /** `idDaFaixa:AAAA-MM-DD` do dia em que COMEÇA. Identifica "esta vez" (para pular hoje, por exemplo). */
  key: string;
  start: number;
  end: number;
}

const at = (y: number, m: number, d: number, minutes: number) => new Date(y, m, d, 0, minutes).getTime();

/** Ocorrências das faixas ativas entre `back` dias antes e `ahead` dias depois de `now`. */
export function occurrencesAround(blocks: ScheduleBlock[], now: number, back = 1, ahead = 8): Occurrence[] {
  const base = new Date(now);
  const out: Occurrence[] = [];
  for (let offset = -back; offset <= ahead; offset++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
    for (const block of blocks) {
      if (!block.enabled || blockDurationMin(block) === 0 || !block.days.includes(day.getDay())) continue;
      const y = day.getFullYear(), m = day.getMonth(), d = day.getDate();
      const start = at(y, m, d, block.startMin);
      const end = crossesMidnight(block) ? at(y, m, d + 1, block.endMin) : at(y, m, d, block.endMin);
      out.push({ block, key: `${block.id}:${dayKey(start)}`, start, end });
    }
  }
  return out;
}

export interface ScheduleState {
  /** Faixa valendo agora (se houver sobreposição, a que começou por último). */
  active?: Occurrence;
  /** Próxima faixa a começar. */
  next?: Occurrence;
}

export function scheduleState(blocks: ScheduleBlock[], now: number, skipped: Iterable<string> = []): ScheduleState {
  const skip = new Set(skipped);
  const occs = occurrencesAround(blocks, now).filter((o) => !skip.has(o.key));
  const active = occs.filter((o) => o.start <= now && now < o.end).sort((a, b) => b.start - a.start)[0];
  const next = occs.filter((o) => o.start > now).sort((a, b) => a.start - b.start)[0];
  return { active, next };
}

export interface WeekSegment {
  blockId: string;
  /** 0 = domingo … 6 = sábado. */
  day: number;
  startMin: number;
  endMin: number;
}

/** Pedaços por dia para desenhar a grade semanal (faixas que viram a noite são divididas em dois). */
export function weekSegments(blocks: ScheduleBlock[]): WeekSegment[] {
  const out: WeekSegment[] = [];
  for (const b of blocks) {
    if (blockDurationMin(b) === 0) continue;
    for (const day of b.days) {
      if (!crossesMidnight(b)) out.push({ blockId: b.id, day, startMin: b.startMin, endMin: b.endMin });
      else {
        out.push({ blockId: b.id, day, startMin: b.startMin, endMin: MINUTES_PER_DAY });
        if (b.endMin > 0) out.push({ blockId: b.id, day: (day + 1) % 7, startMin: 0, endMin: b.endMin });
      }
    }
  }
  return out;
}

/** Pares de faixas ativas que se sobrepõem em algum horário da semana. */
export function findOverlaps(blocks: ScheduleBlock[]): [string, string][] {
  const segs = weekSegments(blocks.filter((b) => b.enabled));
  const pairs = new Map<string, [string, string]>();
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i]!, b = segs[j]!;
      if (a.blockId === b.blockId || a.day !== b.day) continue;
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        const [x, y] = [a.blockId, b.blockId].sort() as [string, string];
        pairs.set(`${x}|${y}`, [x, y]);
      }
    }
  }
  return [...pairs.values()];
}
