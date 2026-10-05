import type { FunctionComponent } from 'preact';
import type { CandleGeometry } from './geometry';

export interface FlameColors {
  outer: string;
  mid: string;
  inner: string;
  glow: string;
  /** Contorno da chama (estilo cartoon). */
  outline?: string;
}

export interface SkinBodyProps {
  /** Prefixo único para ids de gradientes/clipPaths (várias velas na mesma página). */
  uid: string;
  geo: CandleGeometry;
  lit: boolean;
}

/**
 * Uma skin = cores da chama + o desenho do corpo (suporte, cera, gotas, poça).
 * Pavio, chama e fumaça são comuns a todas as skins (ver Candle.tsx).
 * Para criar uma skin nova: um arquivo em skins/ e registrar em skins/index.ts.
 */
export interface CandleSkin {
  id: string;
  name: string;
  flame: FlameColors;
  Body: FunctionComponent<SkinBodyProps>;
}
