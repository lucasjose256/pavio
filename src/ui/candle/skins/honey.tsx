import { CANDLE } from '../geometry';
import type { CandleSkin, SkinBodyProps } from '../types';
import { CARTOON_FLAME, PillarBody } from './pillar';

/** Favos (hexágonos de lado 13) cobrindo a cera, desenhados uma vez em coordenadas da cera. */
const S = 13;
const H = Math.sqrt(3) * S;
function hex(cx: number, cy: number): string {
  const p = [[S, 0], [S / 2, H / 2], [-S / 2, H / 2], [-S, 0], [-S / 2, -H / 2], [S / 2, -H / 2]];
  return `M${p.map(([dx, dy]) => `${(cx + dx!).toFixed(1)} ${(cy + dy!).toFixed(1)}`).join(' L')}Z`;
}
const COMB = (() => {
  const x0 = CANDLE.cx - CANDLE.width / 2 - S;
  const parts: string[] = [];
  for (let col = 0; col * 1.5 * S < CANDLE.width + 2 * S; col++) {
    for (let row = 0; row * H < 170; row++) parts.push(hex(x0 + col * 1.5 * S, 8 + row * H + (col % 2 ? H / 2 : 0)));
  }
  return parts.join(' ');
})();

/** Cera de abelha: âmbar com favos, pires de madeira. */
function Body(props: SkinBodyProps) {
  return (
    <PillarBody {...props} colors={{ wax: '#f6c453', drip: '#f9d77e', saucer: '#c98b55', puddle: '#f9d77e', shine: '#fff6d6' }}
      decor={<path d={COMB} fill="none" stroke="#d99a2b" stroke-width={3} opacity={0.6} />} />
  );
}

export const honeySkin: CandleSkin = { id: 'honey', name: 'Cera de abelha', flame: CARTOON_FLAME, Body };
