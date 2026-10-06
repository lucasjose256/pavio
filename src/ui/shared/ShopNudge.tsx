import { useEffect, useState } from 'preact/hooks';
import type { Settings } from '../../core/models';
import { STORE_LABEL, offerOfTheDay, popupMoment } from '../../core/shop';
import { createServices } from '../../platform/chrome/services';
import { shopUi } from '../i18n/pt-BR';
import { ShopLink } from './ShopLink';
import './shop-nudge.css';

const services = createServices();

/** Uma linha calma no popup, com a frase do momento (antes / durante / depois da vela). */
export function ShopNudge({ skin, running }: { skin: string; running: boolean }) {
  const [settings, setSettings] = useState<Settings>();
  const [lastCompletedAt, setLastCompletedAt] = useState<number>();
  useEffect(() => {
    void services.settings.get().then(setSettings);
    void services.history.list().then((h) => {
      const done = h.filter((e) => e.outcome === 'completed').map((e) => e.endedAt);
      setLastCompletedAt(done.length ? Math.max(...done) : undefined);
    });
  }, []);
  if (!settings) return null;
  const now = Date.now();
  const moment = popupMoment({ enabled: settings.shopSuggestions, inPopup: settings.shopInPopup, running, lastCompletedAt, now });
  const offer = moment && offerOfTheDay(skin, now);
  if (!moment || !offer) return null;
  const copy = shopUi.moments[moment];
  return (
    <aside class={`nudge ${moment}`} aria-label="Sugestão de vela">
      <span class="nudge-kicker">{copy.kicker}</span>
      <span class="nudge-line">{copy.line}</span>
      <span class="nudge-foot">
        <ShopLink offer={offer} class="nudge-link">{offer.name} ↗</ShopLink>
        <span class="tag-ad" title={`Link de afiliado do ${STORE_LABEL[offer.store]}`}>afiliado</span>
        <button class="nudge-off" onClick={async () => setSettings(await services.settings.update({ shopInPopup: false }))}>{shopUi.hide}</button>
      </span>
    </aside>
  );
}
