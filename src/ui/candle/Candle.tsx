import { useId } from 'preact/hooks';
import { CANDLE, VIEW, candleGeometry } from './geometry';
import { Flame, FlameDefs, Smoke } from './Flame';
import { getSkin } from './skins';
import './candle.css';

interface Props {
  /** 1 = vela cheia, 0 = apagada. */
  progress: number;
  skin?: string;
  /** Padrão: acesa enquanto houver cera. */
  lit?: boolean;
  label?: string;
  class?: string;
}

export function Candle({ progress, skin: skinId, lit, label, class: className }: Props) {
  const uid = `pv${useId().replace(/\W/g, '')}`;
  const skin = getSkin(skinId);
  const geo = candleGeometry(progress);
  const isLit = lit ?? geo.progress > 0;
  const wickY = geo.topY - 14;

  return (
    <svg
      class={`pv-candle ${className ?? ''}`}
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-label={label ?? 'Vela'}
      overflow="visible"
    >
      <defs>
        <FlameDefs uid={uid} colors={skin.flame} />
      </defs>
      <skin.Body uid={uid} geo={geo} lit={isLit} />
      <g class="pv-rise" style={{ transform: `translate(${CANDLE.cx}px, ${wickY}px)` }}>
        {isLit ? <Flame uid={uid} colors={skin.flame} /> : <Smoke />}
      </g>
    </svg>
  );
}
