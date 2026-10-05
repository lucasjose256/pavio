import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS } from '../../core/models';
import type { Settings, ThemeName } from '../../core/models';
import { Candle } from '../candle/Candle';
import { SKINS } from '../candle/skins';
import { applyTheme } from '../shared/theme';
import { services } from './shared';

const THEMES: { id: ThemeName; name: string; note: string }[] = [
  { id: 'cream', name: 'Creme', note: 'Claro e quente, como papel' },
  { id: 'night', name: 'Noite', note: 'Escuro e quente, para a luz baixa' },
];

export function AppearanceTab({ active }: { active: boolean }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [preview, setPreview] = useState(0.7);
  const [melting, setMelting] = useState(false);

  useEffect(() => void services.settings.get().then(setSettings).then(() => undefined), []);

  // Simulação do derretimento na prévia das velas.
  useEffect(() => {
    if (!melting) return;
    const id = setInterval(() => setPreview((p) => (p <= 0.02 ? (setMelting(false), 0) : p - 0.02)), 150);
    return () => clearInterval(id);
  }, [melting]);

  async function pickTheme(theme: ThemeName) {
    applyTheme(theme);
    setSettings(await services.settings.update({ theme }));
  }

  return (
    <main class="pane" hidden={!active}>
      <section class="card">
        <h2 class="section-title">Clima da tela</h2>
        <div class="themes">
          {THEMES.map((t) => (
            <button key={t.id} class={`theme-card ${settings.theme === t.id ? 'on' : ''}`} aria-pressed={settings.theme === t.id} onClick={() => pickTheme(t.id)}>
              <span class={`swatch ${t.id}`} aria-hidden="true"><i /><i /><i /></span>
              <strong>{t.name}</strong>
              <span class="hint">{t.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section class="card">
        <h2 class="section-title">Estilo da vela</h2>
        <div class="preview-bar">
          <label class="grow">
            <span class="lbl">Cera restante: {Math.round(preview * 100)}%</span>
            <input type="range" min={0} max={1} step={0.01} value={preview} class="full"
              onInput={(e) => { setMelting(false); setPreview(Number(e.currentTarget.value)); }} />
          </label>
          <button class="btn" onClick={() => { if (preview <= 0.02) setPreview(1); setMelting((m) => !m); }}>
            {melting ? 'Pausar' : 'Ver derretendo'}
          </button>
        </div>
        <div class="skins">
          {SKINS.map((s) => (
            <button key={s.id} class={`skin ${settings.candleSkin === s.id ? 'on' : ''}`} aria-pressed={settings.candleSkin === s.id}
              onClick={async () => setSettings(await services.settings.update({ candleSkin: s.id }))}>
              <div class="skin-candle"><Candle skin={s.id} progress={preview} /></div>
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
