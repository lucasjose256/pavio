/** Ícones de traço da navegação das opções (24×24, cor = currentColor). */
const P = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
const paths: Record<string, preact.JSX.Element> = {
  clock: <><circle cx="12" cy="12" r="8.5" {...P} /><path d="M12 7.5V12l3 2" {...P} /></>,
  ban: <><circle cx="12" cy="12" r="8.5" {...P} /><path d="M6 6l12 12" {...P} /></>,
  hourglass: <path d="M7 3.5h10M7 20.5h10M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4.5-8 8.5s8 4 8 8.5" {...P} />,
  key: <><circle cx="8" cy="15" r="4.5" {...P} /><path d="M11.5 12L20 3.5M16.5 7l2.5 2.5M14.5 9l2 2" {...P} /></>,
  chart: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" {...P} />,
  palette: <><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.4-2.2-.6-1.1 0-2.3 1.4-2.3H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.2 16.7 3.5 12 3.5z" {...P} /><circle cx="8" cy="11" r="1.2" fill="currentColor" /><circle cx="11.5" cy="7.8" r="1.2" fill="currentColor" /><circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" /></>,
};
export type IconName = keyof typeof paths;
export const Icon = ({ name }: { name: string }) => <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">{paths[name]}</svg>;
