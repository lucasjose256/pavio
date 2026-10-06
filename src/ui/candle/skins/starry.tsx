import type { CandleSkin, SkinBodyProps } from '../types';
import { CARTOON_FLAME, PillarBody } from './pillar';

/** Estrelinha de 4 pontas centrada em (x, y). */
const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`;
const STARS = [[88, 40, 7], [150, 30, 5], [128, 74, 8], [80, 100, 5], [160, 112, 6], [110, 140, 5], [146, 168, 7], [90, 190, 6]] as const;
const DOTS = [[104, 52], [168, 70], [96, 128], [136, 120], [120, 182], [170, 150]] as const;

/** Azul de noite com estrelas, pires prateado como a lua. */
function Body(props: SkinBodyProps) {
  return (
    <PillarBody {...props} colors={{ wax: '#3d4b8f', drip: '#5568b0', saucer: '#d5dbe8', puddle: '#5568b0', shine: '#9fb0ff' }}
      decor={(
        <g>
          {STARS.map(([x, y, r]) => <path key={`${x}-${y}`} d={star(x, y, r * 1.5)} fill="#ffe08a" />)}
          {DOTS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3} fill="#ffe08a" opacity={0.8} />)}
        </g>
      )} />
  );
}

export const starrySkin: CandleSkin = { id: 'starry', name: 'Noite estrelada', flame: { ...CARTOON_FLAME, glow: '#ffd36b' }, Body };
