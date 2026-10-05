import { CANDLE } from './geometry';

interface Props {
  color: string;
  length: number;
}

/** Gotas de cera escorrendo pela lateral (origem em y=0 = topo da cera). */
export function Drips({ color, length }: Props) {
  const half = CANDLE.width / 2;
  const drips = [
    { x: -half + 7, k: 0.9, delay: 0 },
    { x: -half + 26, k: 0.45, delay: 2.4 },
    { x: half - 20, k: 1, delay: 1.2 },
    { x: half - 5, k: 0.55, delay: 3.6 },
  ];
  return (
    <g>
      {drips.map((d) => {
        const len = Math.max(6, length * d.k);
        return (
          <g key={d.x} transform={`translate(${CANDLE.cx + d.x} 0)`}>
            <rect class="pv-drip" x={-4} y={0} width={8} height={len} rx={4} fill={color} style={{ animationDelay: `${d.delay}s` }} />
            <circle class="pv-drop" cx={0} cy={len} r={3} fill={color} style={{ animationDelay: `${d.delay}s` }} />
          </g>
        );
      })}
    </g>
  );
}
