import type { ComponentChildren } from 'preact';
import { CANDLE, VIEW } from '../geometry';
import { Drips, Tear } from '../Drips';
import type { SkinBodyProps } from '../types';

export const INK = '#3a2b33';
export const SW = 5;

export interface PillarColors {
  wax: string;
  drip: string;
  saucer: string;
  puddle: string;
  /** Brilho vertical à esquerda (padrão: branco). */
  shine?: string;
}

/**
 * Vela de pilar cartoon (gordinha, contorno grosso, pires): base das skins Clássica, Lavanda, Mel e Noite estrelada.
 * `decor` é desenhado sobre a cera e desce com ela (coordenadas: y=0 = topo da cera); `saucerDecor` fica parado no pires.
 */
export function PillarBody({ uid, geo, colors, decor, saucerDecor }: SkinBodyProps & { colors: PillarColors; decor?: ComponentChildren; saucerDecor?: ComponentChildren }) {
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

      <ellipse cx={cx} cy={baseY + 8} rx={98} ry={16} fill={colors.saucer} stroke={INK} stroke-width={SW} />
      <ellipse class="pv-puddle" cx={cx} cy={baseY} rx={geo.puddleRx} ry={geo.puddleRy} fill={colors.puddle} stroke={INK} stroke-width={SW} />
      {saucerDecor}

      <g clip-path={`url(#${uid}-clip)`}>
        <g class="pv-rise" style={{ transform: `translateY(${geo.topY}px)` }}>
          <rect x={x} y={0} width={width} height={VIEW.height} rx={28} fill={colors.wax} />
          {decor && <g clip-path={`url(#${uid}-body)`}>{decor}</g>}
          <rect x={x + 14} y={22} width={9} height={110} rx={4.5} fill={colors.shine ?? '#fff'} opacity={0.6} />
          <Drips color={colors.drip} length={geo.dripLength} clipId={`${uid}-body`} />
          <rect x={x} y={0} width={width} height={VIEW.height} rx={28} fill="none" stroke={INK} stroke-width={SW} />
          <Tear length={geo.dripLength * 0.9} fill={colors.wax} stroke={INK} strokeWidth={SW} />
        </g>
      </g>
    </g>
  );
}

/** Chama padrão das velas cartoon. */
export const CARTOON_FLAME = { outer: '#ffc94d', mid: '#ff7a2f', inner: '#fff1b8', glow: '#ffa043', outline: INK };
