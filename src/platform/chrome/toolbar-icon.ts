import type { CandleBadge, ToolbarIcon } from '../../core/toolbar-icon';

const sizes = [16, 32, 48, 128] as const;
const pathsFor = (prefix: string) => Object.fromEntries(sizes.map((s) => [s, `public/icons/${prefix}-${s}.png`]));

/** Troca o ícone (e o texto ao passar o mouse) do Pavio na barra do Chrome. */
export async function setToolbarIcon(icon: ToolbarIcon): Promise<void> {
  await chrome.action.setIcon({ path: pathsFor(icon === 'active' ? 'icon-active' : 'icon') });
  await chrome.action.setTitle({ title: icon === 'active' ? 'Pavio · vela acesa' : 'Pavio' });
}

/** Alarme que troca o número do selo no minuto exato (o Chrome atrasa alarmes para no mínimo ~30 s). */
export const BADGE_ALARM = 'candle-badge';
const BADGE_COLORS = { focus: '#a9541f', break: '#4f7a45' } as const;

/** Mostra (ou tira) o selo com os minutos da vela e agenda a próxima troca. */
export async function setCandleBadge(badge: CandleBadge): Promise<void> {
  await chrome.action.setBadgeText({ text: badge.text });
  if (badge.phase) {
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[badge.phase] });
    await chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
  }
  if (badge.nextUpdate) await chrome.alarms.create(BADGE_ALARM, { when: badge.nextUpdate });
  else await chrome.alarms.clear(BADGE_ALARM);
}
