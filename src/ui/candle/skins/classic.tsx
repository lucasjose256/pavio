import { CANDLE, VIEW } from '../geometry';
import { Drips, Tear } from '../Drips';
import type { CandleSkin, SkinBodyProps } from '../types';

const INK = '#3a2b33';
const SW = 5;

/** Cartoon: vela gordinha, cores chapadas, contorno grosso, pires de latão. */
function Body({ uid, geo }: SkinBodyProps) {
  const { cx, width, baseY } = CANDLE;
  const x = cx - width / 2;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect x={0} y={0} width={VIEW.width} height={baseY} />
        </clipPath>
        <clipPath id={`${uid}-body`}>
          <rect x={x} y={0} width={width} height={VIEW.height} rx={28} />
        </clipPath>
      </defs>

      <ellipse cx={cx} cy={baseY + 8} rx={98} ry={16} fill="#f0b25e" stroke={INK} stroke-width={SW} />
      <ellipse class="pv-puddle" cx={cx} cy={baseY} rx={geo.puddleRx} ry={geo.puddleRy} fill="#ffdca0" stroke={INK} stroke-width={SW} />

      <g clip-path={`url(#${uid}-clip)`}>
        <g class="pv-rise" style={{ transform: `translateY(${geo.topY}px)` }}>
          <rect x={x} y={0} width={width} height={VIEW.height} rx={28} fill="#fff1d6" />
          <rect x={x + 14} y={22} width={9} height={110} rx={4.5} fill="#fff" opacity={0.75} />
          <Drips color="#ffd9a1" length={geo.dripLength} clipId={`${uid}-body`} />
          <rect x={x} y={0} width={width} height={VIEW.height} rx={28} fill="none" stroke={INK} stroke-width={SW} />
          <Tear length={geo.dripLength * 0.9} fill="#fff1d6" stroke={INK} strokeWidth={SW} />
        </g>
      </g>
    </g>
  );
}

export const classicSkin: CandleSkin = {
  id: 'classic',
  name: 'Clássica',
  flame: { outer: '#ffc94d', mid: '#ff7a2f', inner: '#fff1b8', glow: '#ffa043', outline: INK },
  Body,
};
