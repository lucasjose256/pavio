import type { FlameColors } from './types';

/** Chama animada. Origem (0,0) = ponta do pavio. */
export function Flame({ uid, colors }: { uid: string; colors: FlameColors }) {
  return (
    <g>
      <circle class="pv-glow" cx={0} cy={-34} r={110} fill={`url(#${uid}-glow)`} />
      <rect x={-1.5} y={0} width={3} height={15} rx={1.5} fill="#2a2420" />
      <g class="pv-flame-body">
        <path
          d="M0 -66 C6 -48 18 -36 18 -19 A18 18 0 0 1 -18 -19 C-18 -36 -6 -48 0 -66Z"
          fill={`url(#${uid}-flame)`}
        />
        <path class="pv-flame-inner" d="M0 -40 C4 -30 10 -24 10 -14 A10 10 0 0 1 -10 -14 C-10 -24 -4 -30 0 -40Z" fill={colors.inner} />
        <ellipse cx={0} cy={-5} rx={5} ry={6} fill="#7aa7ff" opacity={0.55} />
      </g>
    </g>
  );
}

export function FlameDefs({ uid, colors }: { uid: string; colors: FlameColors }) {
  return (
    <>
      <radialGradient id={`${uid}-glow`}>
        <stop offset="0" stop-color={colors.glow} stop-opacity="0.55" />
        <stop offset="0.45" stop-color={colors.glow} stop-opacity="0.16" />
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
      <rect x={-1.5} y={0} width={3} height={15} rx={1.5} fill="#2a2420" />
      <path d="M0 -2 C-8 -18 8 -30 0 -48 C-6 -60 6 -70 0 -84" fill="none" stroke="#b9b3c4" stroke-width={3} stroke-linecap="round" />
    </g>
  );
}
