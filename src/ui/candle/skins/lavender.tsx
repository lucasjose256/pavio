import type { CandleSkin, SkinBodyProps } from '../types';
import { CARTOON_FLAME, INK, PillarBody } from './pillar';

/** Raminho de lavanda deitado no pires. */
function Sprig() {
  const buds = [0, 1, 2, 3, 4];
  return (
    <g transform="translate(176 284) rotate(8) scale(-1.3 1.3)">
      <path d="M0 0 C14 -2 30 -2 46 2" fill="none" stroke="#6f8f5a" stroke-width={4} stroke-linecap="round" />
      {buds.map((i) => <ellipse key={i} cx={-4 - i * 7} cy={i % 2 ? 3 : -3} rx={5} ry={3.6} fill="#9b7fd1" stroke={INK} stroke-width={2.5} />)}
    </g>
  );
}

/** Lilás suave, pires de cerâmica verde-sálvia e um raminho de lavanda. */
function Body(props: SkinBodyProps) {
  return (
    <PillarBody {...props} colors={{ wax: '#ece0f7', drip: '#d7c3ef', saucer: '#b9cfa8', puddle: '#e2d2f4' }} saucerDecor={<Sprig />} />
  );
}

export const lavenderSkin: CandleSkin = {
  id: 'lavender',
  name: 'Lavanda',
  flame: { ...CARTOON_FLAME, glow: '#c9a6ff' },
  Body,
};
