import { CANDLE } from '../geometry';
import type { CandleSkin, SkinBodyProps } from '../types';
import { CARTOON_FLAME, INK, SW } from './pillar';

const JAR = { x: 48, w: 144, top: 98, bottom: 282 };

/** Vela de pote: a cera desce dentro de um pote de vidro com etiqueta de papel kraft. */
function Body({ uid, geo }: SkinBodyProps) {
  const inner = { x: JAR.x + 6, w: JAR.w - 12 };
  // A cera vai do topo da vela até o fundo do pote (o pote não derrete).
  const waxTop = Math.max(geo.topY, JAR.top + 14);
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-jar`}>
          <rect x={inner.x} y={JAR.top} width={inner.w} height={JAR.bottom - JAR.top - 6} rx={18} />
        </clipPath>
      </defs>
      <ellipse cx={CANDLE.cx} cy={JAR.bottom + 4} rx={86} ry={9} fill={INK} opacity={0.12} />
      {/* fundo do vidro */}
      <rect x={JAR.x} y={JAR.top} width={JAR.w} height={JAR.bottom - JAR.top} rx={24} fill="#fff8ee" opacity={0.55} />
      <g clip-path={`url(#${uid}-jar)`}>
        <g class="pv-rise" style={{ transform: `translateY(${waxTop}px)` }}>
          <rect x={inner.x} y={0} width={inner.w} height={JAR.bottom} fill="#f7e6c8" />
          <ellipse cx={CANDLE.cx} cy={0} rx={inner.w / 2} ry={9} fill="#fbefd9" stroke="#e9cf9f" stroke-width={2} />
        </g>
      </g>
      {/* etiqueta */}
      <rect x={JAR.x} y={226} width={JAR.w} height={34} fill="#d6ad7c" stroke={INK} stroke-width={3} />
      <path d={`M${CANDLE.cx - 10} 243 c0 -8 10 -8 10 -2 c0 -6 10 -6 10 2 c0 6 -10 10 -10 12 c0 -2 -10 -6 -10 -12Z`} fill="#b5453a" opacity={0.85} />
      {/* vidro: brilho e contorno */}
      <rect x={JAR.x + 14} y={JAR.top + 16} width={8} height={100} rx={4} fill="#fff" opacity={0.7} />
      <rect x={JAR.x} y={JAR.top} width={JAR.w} height={JAR.bottom - JAR.top} rx={24} fill="none" stroke={INK} stroke-width={SW} />
      <rect x={JAR.x - 4} y={JAR.top - 8} width={JAR.w + 8} height={14} rx={7} fill="#fff8ee" stroke={INK} stroke-width={SW} />
    </g>
  );
}

export const jarSkin: CandleSkin = { id: 'jar', name: 'Pote de vidro', flame: CARTOON_FLAME, Body };
