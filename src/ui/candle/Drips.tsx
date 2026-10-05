import { CANDLE } from './geometry';

/** "Cera derretida" no topo: faixa + línguas que crescem e encolhem. Origem y=0 = topo da cera. */
export function Drips({ color, length, clipId }: { color: string; length: number; clipId: string }) {
  const half = CANDLE.width / 2;
  const lobes = [
    { x: -half + 18, k: 0.6, delay: 0 },
    { x: -2, k: 1, delay: 1.6 },
    { x: half - 20, k: 0.75, delay: 3.2 },
  ];
  return (
    <g clip-path={`url(#${clipId})`}>
      <rect x={CANDLE.cx - half} y={-4} width={CANDLE.width} height={16} fill={color} />
      {lobes.map((l) => (
        <rect key={l.x} class="pv-drip" x={CANDLE.cx + l.x - 9} y={-4} width={18} height={Math.max(14, length * l.k) + 12}
          rx={9} fill={color} style={{ animationDelay: `${l.delay}s` }} />
      ))}
    </g>
  );
}

/** Gota que escorre pela lateral direita, com contorno. */
export function Tear({ length, fill, stroke, strokeWidth }: { length: number; fill: string; stroke: string; strokeWidth: number }) {
  const right = CANDLE.cx + CANDLE.width / 2;
  return (
    <rect class="pv-drip" x={right - 12} y={14} width={16} height={Math.max(16, length)} rx={8}
      fill={fill} stroke={stroke} stroke-width={strokeWidth} stroke-linejoin="round" style={{ animationDelay: '0.8s' }} />
  );
}
