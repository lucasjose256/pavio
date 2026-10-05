import type { FlameColors } from './types';

/** Chama gordinha e animada. Origem (0,0) = ponta do pavio. */
export function Flame({ uid, colors }: { uid: string; colors: FlameColors }) {
  return (
    <g transform="scale(1.2)">
      <circle class="pv-glow" cx={0} cy={-40} r={120} fill={`url(#${uid}-glow)`} />
      <rect x={-2.5} y={0} width={5} height={16} rx={2.5} fill="#3a2b33" />
      <g class="pv-flame-body">
        <path
          d="M0 -76 C8 -56 23 -43 23 -23 A23 23 0 0 1 -23 -23 C-23 -43 -8 -56 0 -76Z"
          fill={`url(#${uid}-flame)`}
          stroke={colors.outline}
          stroke-width={colors.outline ? 5 : 0}
          stroke-linejoin="round"
        />
        <path class="pv-flame-inner" d="M0 -47 C5 -36 13 -30 13 -19 A13 13 0 0 1 -13 -19 C-13 -30 -5 -36 0 -47Z" fill={colors.inner} />
      </g>
    </g>
  );
}

export function FlameDefs({ uid, colors }: { uid: string; colors: FlameColors }) {
  return (
    <>
      <radialGradient id={`${uid}-glow`}>
        <stop offset="0" stop-color={colors.glow} stop-opacity="0.45" />
        <stop offset="0.5" stop-color={colors.glow} stop-opacity="0.12" />
        <stop offset="1" stop-color={colors.glow} stop-opacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}-flame`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={colors.outer} />
        <stop offset="1" stop-color={colors.mid} />
      </linearGradient>
    </>
  );
}

/** Fio de fumaça quando a vela apaga. */
export function Smoke() {
  return (
    <g class="pv-smoke">
      <rect x={-2.5} y={0} width={5} height={16} rx={2.5} fill="#3a2b33" />
      <path d="M0 -2 C-10 -18 10 -30 0 -48 C-8 -60 8 -70 0 -84" fill="none" stroke="#b9b3c4" stroke-width={4} stroke-linecap="round" />
    </g>
  );
}
