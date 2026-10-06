import type { CandleSkin, SkinBodyProps } from '../types';
import { CARTOON_FLAME, PillarBody } from './pillar';

/** Cartoon: vela gordinha, cores chapadas, contorno grosso, pires de latão. */
function Body(props: SkinBodyProps) {
  return <PillarBody {...props} colors={{ wax: '#fff1d6', drip: '#ffd9a1', saucer: '#f0b25e', puddle: '#ffdca0' }} />;
}

export const classicSkin: CandleSkin = { id: 'classic', name: 'Clássica', flame: CARTOON_FLAME, Body };
