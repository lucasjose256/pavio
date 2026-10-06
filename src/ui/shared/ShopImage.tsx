import { Candle } from '../candle/Candle';
import type { CandleOffer } from '../../core/shop';

// Fotos embutidas no pacote (src/ui/assets/shop/*). O Vite copia e devolve o endereço interno de cada uma.
const PHOTOS = import.meta.glob<string>('../assets/shop/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' });
const photoUrl = (name: string | undefined) => (name ? PHOTOS[`../assets/shop/${name}`] : undefined);

/** Foto do produto, se embutida; senão a vela do Pavio que combina com ele. */
export function ShopImage({ offer, class: className }: { offer: CandleOffer; class?: string }) {
  const src = photoUrl(offer.image);
  return src
    ? <img class={`shop-photo ${className ?? ''}`} src={src} alt={offer.name} loading="lazy" decoding="async" />
    : <div class={className} aria-hidden="true"><Candle skin={offer.skin} progress={0.85} /></div>;
}
