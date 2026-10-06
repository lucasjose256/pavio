import { useEffect, useState } from 'preact/hooks';
import { DONATION, SUGGESTED_AMOUNTS, donationLinks, pixPayload, validPix } from '../../core/donate';
import { Candle } from '../candle/Candle';
import { donateUi } from '../i18n/pt-BR';
import { services } from './shared';

/** Apoio voluntário: Pix (copia e cola com valor sugerido) e links de apoio. Tudo local; nada é registrado. */
export function DonateTab({ active }: { active: boolean }) {
  const pix = validPix(DONATION.pix);
  const links = donationLinks();
  const [amount, setAmount] = useState<number | undefined>(SUGGESTED_AMOUNTS[1]);
  const [copied, setCopied] = useState('');
  const [skin, setSkin] = useState('classic');
  useEffect(() => void services.settings.get().then((s) => setSkin(s.candleSkin)), []);

  /** Copia para a área de transferência; se o navegador negar, tenta o método antigo. */
  async function copy(text: string, what: string) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const box = Object.assign(document.createElement('textarea'), { value: text });
      box.style.cssText = 'position:fixed;opacity:0';
      document.body.append(box);
      box.select();
      ok = document.execCommand('copy');
      box.remove();
    }
    setCopied(ok ? what : 'fail');
    setTimeout(() => setCopied(''), 5000);
  }
  const payload = pixPayload(pix, amount);

  return (
    <main class="pane" hidden={!active}>
      <section class="card donate-hero">
        <div class="donate-candle" aria-hidden="true"><Candle skin={skin} progress={0.7} /></div>
        <div class="grow">
          <h2 class="section-title">{donateUi.title}</h2>
          <p class="shop-lead">{donateUi.lead}</p>
          <p class="section-sub">{donateUi.intro}</p>
        </div>
      </section>

      {pix && (
        <section class="card" aria-label="Pix">
          <h3>{donateUi.pixTitle}</h3>
          <p class="hint">{donateUi.pixHint}</p>
          <div class="amounts" role="group" aria-label="Valor">
            {SUGGESTED_AMOUNTS.map((n) => (
              <button key={n} class="btn" aria-pressed={amount === n} onClick={() => setAmount(n)}>{donateUi.amount(n)}</button>
            ))}
            <button class="btn" aria-pressed={amount === undefined} onClick={() => setAmount(undefined)}>{donateUi.anyAmount}</button>
          </div>
          <div class="donate-actions">
            <button class="btn btn-primary" disabled={!payload} onClick={() => payload && copy(payload, 'code')}>{donateUi.copy}</button>
            <button class="btn btn-ghost" onClick={() => copy(pix.key, 'key')}>{donateUi.copyKey}</button>
          </div>
          {copied === 'fail'
            ? <p class="notice warn" role="status">{donateUi.copyFailed} <code>{payload}</code></p>
            : copied && <p class="notice ok" role="status">{donateUi.copied}</p>}
          <p class="hint donate-meta">{donateUi.keyLabel}: <code>{pix.key}</code> · {donateUi.recipient(pix.name)}</p>
        </section>
      )}

      {links.length > 0 && (
        <section class="card" aria-label="Outras formas de apoiar">
          <h3>{donateUi.otherTitle}</h3>
          <div class="donate-actions">
            {links.map((l) => <a key={l.url} class="btn" href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}
          </div>
        </section>
      )}

      <p class="hint footnote">{donateUi.thanks} {donateUi.privacy}</p>
    </main>
  );
}
