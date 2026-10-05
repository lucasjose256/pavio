import { describe, expect, it } from 'vitest';
import { CANDLE, candleGeometry } from './geometry';

describe('candleGeometry', () => {
  it('vela cheia é alta e a poça é pequena; vazia é o oposto', () => {
    const full = candleGeometry(1);
    const empty = candleGeometry(0);
    expect(full.waxHeight).toBe(CANDLE.maxHeight);
    expect(full.topY).toBe(CANDLE.baseY - CANDLE.maxHeight);
    expect(empty.waxHeight).toBe(CANDLE.minHeight);
    expect(empty.puddleRx).toBeGreaterThan(full.puddleRx);
  });
  it('limita valores fora de 0..1', () => {
    expect(candleGeometry(5).progress).toBe(1);
    expect(candleGeometry(-1).progress).toBe(0);
  });
});
