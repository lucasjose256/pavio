import { CANDLE, VIEW } from '../geometry';
import { Tear } from '../Drips';
import type { CandleSkin, SkinBodyProps } from '../types';

const LINE = '#d8d2c4';

/** Gordinha e de traço fino, sem pires: a chama é o único ponto de cor. */
function Body({ uid, geo }: SkinBodyProps) {
  const { cx, width, baseY } = CANDLE;
  const x = cx - width / 2;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect x={0} y={0} width={VIEW.width} height={baseY} />
        </clipPath>
      </defs>

      <ellipse class="pv-puddle" cx={cx} cy={baseY} rx={geo.puddleRx} ry={geo.puddleRy} fill="#1b1922" stroke={LINE} stroke-width={3} />

      <g clip-path={`url(#${uid}-clip)`}>
        <g class="pv-rise" style={{ transform: `translateY(${geo.topY}px)` }}>
          <rect x={x} y={0} width={width} height={VIEW.height} rx={28} fill="#1b1922" stroke={LINE} stroke-width={3} />
          <rect x={x + 14} y={22} width={5} height={100} rx={2.5} fill={LINE} opacity={0.2} />
          <Tear length={geo.dripLength * 0.9} fill="#1b1922" stroke={LINE} strokeWidth={3} />
        </g>
      </g>
    </g>
  );
}

export const minimalSkin: CandleSkin = {
  id: 'minimal',
  name: 'Minimalista',
  flame: { outer: '#f7d58f', mid: '#e8a84c', inner: '#fff8e6', glow: '#e8a84c' },
  Body,
};
