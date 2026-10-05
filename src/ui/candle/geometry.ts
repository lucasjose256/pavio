/** Geometria da vela (coordenadas do viewBox). `progress`: 1 = cheia, 0 = apagada. */
export const VIEW = { width: 240, height: 400 };
export const CANDLE = { cx: 120, width: 72, baseY: 350, maxHeight: 230, minHeight: 10 };

export interface CandleGeometry {
  progress: number;
  waxHeight: number;
  /** Y do topo da cera (onde ficam o pavio e a chama). */
  topY: number;
  puddleRx: number;
  puddleRy: number;
  dripLength: number;
}

export function candleGeometry(progress: number): CandleGeometry {
  const p = Math.min(1, Math.max(0, progress));
  const waxHeight = CANDLE.minHeight + (CANDLE.maxHeight - CANDLE.minHeight) * p;
  return {
    progress: p,
    waxHeight,
    topY: CANDLE.baseY - waxHeight,
    // quanto mais derrete, maior a poça de cera na base
    puddleRx: 50 + (1 - p) * 36,
    puddleRy: 7 + (1 - p) * 5,
    dripLength: Math.min(46, waxHeight * 0.6),
  };
}
