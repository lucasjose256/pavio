import { CANDLE, VIEW } from '../geometry';
import { Drips } from '../Drips';
import type { CandleSkin, SkinBodyProps } from '../types';

/** Traço fino, sem castiçal: a chama é o único ponto de cor. */
function Body({ uid, geo, lit }: SkinBodyProps) {
  const { cx, width, baseY } = CANDLE;
  const x = cx - width / 2;
  const stroke = '#d8d2c4';
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect x={0} y={0} width={VIEW.width} height={baseY} />
        </clipPath>
      </defs>
      <line x1={cx - 70} x2={cx + 70} y1={baseY + 6} y2={baseY + 6} stroke={stroke} stroke-width={1.5} stroke-linecap="round" opacity={0.6} />

      <g clip-path={`url(#${uid}-clip)`}>
        <g class="pv-rise" style={{ transform: `translateY(${geo.topY}px)` }}>
          <rect x={x} y={0} width={width} height={VIEW.height} fill="#1b1922" stroke={stroke} stroke-width={1.5} />
          <Drips color="#1b1922" length={geo.dripLength} />
          <ellipse cx={cx} cy={0} rx={width / 2} ry={9} fill="#24212c" stroke={stroke} stroke-width={1.5} />
          <ellipse cx={cx} cy={1} rx={width / 2 - 16} ry={4} fill={lit ? '#e8a84c' : 'none'} opacity={0.55} class="pv-pool" />
        </g>
      </g>

      <ellipse class="pv-puddle" cx={cx} cy={baseY} rx={geo.puddleRx} ry={geo.puddleRy} fill="#1b1922" stroke={stroke} stroke-width={1.5} />
    </g>
  );
}

export const minimalSkin: CandleSkin = {
  id: 'minimal',
  name: 'Minimalista',
  flame: { outer: '#f7d58f', mid: '#e8a84c', inner: '#fff8e6', glow: '#e8a84c' },
  Body,
};
