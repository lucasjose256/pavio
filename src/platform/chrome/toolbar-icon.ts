import type { ToolbarIcon } from '../../core/toolbar-icon';

const sizes = [16, 32, 48, 128] as const;
const pathsFor = (prefix: string) => Object.fromEntries(sizes.map((s) => [s, `public/icons/${prefix}-${s}.png`]));

/** Troca o ícone (e o texto ao passar o mouse) do Pavio na barra do Chrome. */
export async function setToolbarIcon(icon: ToolbarIcon): Promise<void> {
  await chrome.action.setIcon({ path: pathsFor(icon === 'active' ? 'icon-active' : 'icon') });
  await chrome.action.setTitle({ title: icon === 'active' ? 'Pavio · vela acesa' : 'Pavio' });
}
