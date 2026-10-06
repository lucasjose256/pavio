import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, type Settings } from '../../core/models';
import { STORE_LABEL, offersFor } from '../../core/shop';
import { ShopImage } from '../shared/ShopImage';
import { shopUi } from '../i18n/pt-BR';
import { AFFILIATE_NOTE, ShopLink } from '../shared/ShopLink';
import { services } from './shared';

/** Velas de verdade: a vitrine (links de afiliado), com a vela que combina com a skin da pessoa em destaque. */
export function ShopTab({ active }: { active: boolean }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => { if (active) void services.settings.get().then(setSettings); }, [active]);
  const update = async (patch: Partial<Settings>) => setSettings(await services.settings.update(patch));
  const offers = offersFor(settings.candleSkin);
  const [featured, ...rest] = offers;

  return (
    <main class="pane" hidden={!active}>
      <section class="card shop-hero">
        <div class="grow">
          <h2 class="section-title">{shopUi.title}</h2>
          <p class="shop-lead">{shopUi.lead}</p>
          <p class="section-sub">{shopUi.intro}</p>
        </div>
        <label class="master" title="Mostrar ou esconder as sugestões de velas">
          <span class="switch"><input type="checkbox" checked={settings.shopSuggestions} aria-label="Mostrar sugestões de velas"
            onChange={() => update({ shopSuggestions: !settings.shopSuggestions })} /><span /></span>
          <strong>{settings.shopSuggestions ? 'Sugestões ligadas' : 'Sugestões desligadas'}</strong>
        </label>
      </section>

      {settings.shopSuggestions && featured && (
        <>
          <section class="card offer-featured" aria-label="Combina com a sua vela">
            <ShopImage offer={featured} class="offer-featured-candle" />
            <div class="grow">
              {featured.skin === settings.candleSkin && <span class="kicker">Combina com a sua vela</span>}
              <h3>{featured.name}</h3>
              <p class="hint">{featured.note}</p>
              <ShopLink offer={featured} class="btn btn-primary">{shopUi.see(STORE_LABEL[featured.store])} ↗</ShopLink>
            </div>
          </section>

          {rest.length > 0 && (
            <ul class="offers">
              {rest.map((o) => (
                <li key={o.id} class="offer">
                  <ShopImage offer={o} class="offer-candle" />
                  <strong>{o.name}</strong>
                  <span class="hint">{o.note}</span>
                  <ShopLink offer={o} class="btn">{shopUi.see(STORE_LABEL[o.store])} ↗</ShopLink>
                </li>
              ))}
            </ul>
          )}

          <section class="card shop-foot">
            <label class="check">
              <input type="checkbox" checked={settings.shopInPopup} onChange={() => update({ shopInPopup: !settings.shopInPopup })} />
              {shopUi.inPopup}
            </label>
            <p class="hint"><span class="tag-ad">link de afiliado</span> {AFFILIATE_NOTE}</p>
          </section>
        </>
      )}
    </main>
  );
}
