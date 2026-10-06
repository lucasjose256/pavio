import type { CandleOffer } from '../../core/shop';
import { STORE_LABEL } from '../../core/shop';

/** Link de afiliado: abre a loja numa aba nova, sem enviar a página de origem (`noreferrer`) e marcado como patrocinado. */
export function ShopLink({ offer, children, class: className }: { offer: CandleOffer; children?: preact.ComponentChildren; class?: string }) {
  return (
    <a class={className} href={offer.url} target="_blank" rel="sponsored noopener noreferrer" title={`Abre no ${STORE_LABEL[offer.store]} (link de afiliado)`}>
      {children ?? `Ver no ${STORE_LABEL[offer.store]} ↗`}
    </a>
  );
}

export const AFFILIATE_NOTE = 'Links de afiliado: se você comprar, o Pavio pode receber uma comissão, sem custo extra para você. Nenhum dado seu é enviado.';
