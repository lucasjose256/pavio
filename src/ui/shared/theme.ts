import type { Settings, ThemeName } from '../../core/models';

const CACHE_KEY = 'pavio-theme';

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(CACHE_KEY, theme); } catch { /* storage bloqueado: ignora */ }
}

/** Aplica o tema salvo e acompanha mudanças. Chame no topo de cada página. */
export function initTheme(): void {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached === 'night' || cached === 'cream') document.documentElement.dataset.theme = cached; // evita piscar
  } catch { /* ignora */ }
  const themeOf = (s: Partial<Settings> | undefined): ThemeName => (s?.theme === 'night' ? 'night' : 'cream');
  void chrome.storage.local.get('settings').then((r) => applyTheme(themeOf(r.settings as Partial<Settings> | undefined)));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) applyTheme(themeOf(changes.settings.newValue as Partial<Settings> | undefined));
  });
}
