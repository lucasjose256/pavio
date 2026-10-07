import { useEffect, useState } from 'preact/hooks';
import { GIVE_UP_PHRASE, RELEASE_PHRASE } from '../../core/friction';
import type { Strictness } from '../../core/models';
import { RELEASE_OPTIONS_MIN } from '../../core/release';
import { releaseOfferUi } from '../i18n/pt-BR';
import { services } from './shared';

const LEVELS: { id: Strictness; name: string; note: string }[] = [
  { id: 'light', name: 'Leve', note: 'Basta confirmar. Para quem quer só um lembrete antes de liberar.' },
  { id: 'focus', name: 'Firme', note: 'É preciso digitar uma frase. Para quando o impulso costuma vencer.' },
];

/** Quanto custa liberar algo que protege agora. Sem espera em nenhum caso (decisão do dono). */
export function FrictionTab({ active }: { active: boolean }) {
  const [level, setLevel] = useState<Strictness>('light');
  const [offer, setOffer] = useState(true);
  useEffect(() => void services.settings.get().then((s) => { setLevel(s.friction); setOffer(s.releaseOffer); }), []);

  async function pick(friction: Strictness) {
    setLevel((await services.settings.update({ friction })).friction);
  }

  async function toggleOffer() {
    setOffer((await services.settings.update({ releaseOffer: !offer })).releaseOffer);
  }

  return (
    <main class="pane" hidden={!active}>
      <section class="card offer-toggle">
        <div class="grow">
          <h2 class="section-title">{releaseOfferUi.title}</h2>
          <p class="section-sub">{offer ? releaseOfferUi.onNote : releaseOfferUi.offNote}</p>
        </div>
        <label class="master" title={releaseOfferUi.on}>
          <span class="switch"><input type="checkbox" checked={offer} onChange={toggleOffer} aria-label={releaseOfferUi.on} /><span /></span>
          <strong>{offer ? 'Oferecer' : 'Não oferecer'}</strong>
        </label>
      </section>

      <section class="card" hidden={!offer}>
        <h2 class="section-title">Para liberar</h2>
        <p class="section-sub">Quando um app está bloqueado e você precisa dele, a tela de bloqueio oferece <strong>liberar por {RELEASE_OPTIONS_MIN.join(', ')} min</strong>; depois o bloqueio volta sozinho. Escolha quanto isso deve custar.</p>
        <div class="themes">
          {LEVELS.map((l) => (
            <button key={l.id} class={`theme-card ${level === l.id ? 'on' : ''}`} aria-pressed={level === l.id} onClick={() => pick(l.id)}>
              <strong>{l.name}</strong>
              <span class="hint">{l.note}</span>
            </button>
          ))}
        </div>
        <ul class="friction-notes">
          <li>Vale para liberar por um tempo e para afrouxar a rotina enquanto ela protege{level === 'focus' && <> (frase: <q>{RELEASE_PHRASE}</q>)</>}.</li>
          <li>É também o modo que a vela já traz no popup: {level === 'focus' ? <>para apagá-la antes da hora, digita-se <q>{GIVE_UP_PHRASE}</q></> : 'para apagá-la antes da hora, basta confirmar'}. Dá para trocar em "Mais opções" ao acender.</li>
          <li>Endurecer regras ou mexer em horários que não estão valendo agora nunca pede nada.</li>
        </ul>
      </section>
    </main>
  );
}
