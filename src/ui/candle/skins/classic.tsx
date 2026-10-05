import { CANDLE, VIEW } from '../geometry';
import { Drips } from '../Drips';
import type { CandleSkin, SkinBodyProps } from '../types';

/** Vela de cera creme sobre um castiçal de latão. */
function Body({ uid, geo, lit }: SkinBodyProps) {
  const { cx, width, baseY } = CANDLE;
  const x = cx - width / 2;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-wax`} x1="0" x2="1">
          <stop offset="0" stop-color="#cfc2a4" />
          <stop offset="0.4" stop-color="#f6ecd3" />
          <stop offset="0.75" stop-color="#e6d9b9" />
          <stop offset="1" stop-color="#b9ab8a" />
        </linearGradient>
        <linearGradient id={`${uid}-brass`} x1="0" x2="1">
          <stop offset="0" stop-color="#6f5321" />
          <stop offset="0.5" stop-color="#d9b25a" />
          <stop offset="1" stop-color="#6f5321" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x={0} y={0} width={VIEW.width} height={baseY} />
        </clipPath>
      </defs>

      {/* castiçal */}
      <ellipse cx={cx} cy={baseY + 14} rx={82} ry={14} fill={`url(#${uid}-brass)`} />
      <ellipse cx={cx} cy={baseY + 8} rx={74} ry={11} fill="#8a6a2c" />
      <path d={`M${cx + 70} ${baseY + 6} q 26 -4 22 18 q -3 12 -26 8`} fill="none" stroke="#b38b3a" stroke-width={5} stroke-linecap="round" />

      {/* cera (desce conforme a vela derrete) */}
      <g clip-path={`url(#${uid}-clip)`}>
        <g class="pv-rise" style={{ transform: `translateY(${geo.topY}px)` }}>
          <rect x={x} y={0} width={width} height={VIEW.height} fill={`url(#${uid}-wax)`} />
          <Drips color="#f3e8cc" length={geo.dripLength} />
          <ellipse cx={cx} cy={0} rx={width / 2} ry={9} fill="#fbf3de" />
          <ellipse cx={cx} cy={1} rx={width / 2 - 12} ry={5} fill={lit ? '#f4c26b' : '#d8cdb0'} opacity={lit ? 0.8 : 1} class="pv-pool" />
        </g>
      </g>

      {/* poça na base */}
      <ellipse class="pv-puddle" cx={cx} cy={baseY} rx={geo.puddleRx} ry={geo.puddleRy} fill="#efe3c6" />
    </g>
  );
}

export const classicSkin: CandleSkin = {
  id: 'classic',
  name: 'Clássica',
  flame: { outer: '#ffd27a', mid: '#ff8a2b', inner: '#fff3c4', glow: '#ffa043' },
  Body,
};
