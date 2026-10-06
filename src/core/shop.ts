/**
 * Velas de verdade (links de afiliado). Puro: a lista, a validação dos links e quando sugerir.
 * O Pavio não rastreia nada: o link só abre a loja quando a pessoa clica; a comissão é contada pela loja.
 */

export type ShopStore = 'mercadolivre';

export interface CandleOffer {
  id: string;
  name: string;
  /** Uma linha sobre a vela (aroma, cera…). */
  note: string;
  store: ShopStore;
  /** Link de afiliado (o gerado no portal de afiliados da loja). */
  url: string;
  /** Skin do Pavio que combina (ilustração do cartão e sugestão para quem usa essa skin). */
  skin: string;
}

export const STORE_LABEL: Record<ShopStore, string> = { mercadolivre: 'Mercado Livre' };

/** Só links destas lojas são aceitos (um link errado não leva a pessoa a um site qualquer). */
const STORE_HOSTS: Record<ShopStore, string[]> = {
  mercadolivre: ['mercadolivre.com.br', 'mercadolivre.com', 'mercadolibre.com'],
};

/**
 * Parâmetros de rastreio de busca/anúncio que vêm ao copiar o endereço da barra (não são do afiliado).
 * Os do programa de afiliados (ex.: `matt_tool`, `matt_word`) e os links curtos `/sec/…` passam intactos.
 */
const TRACKING_PARAMS = ['pdp_filters', 'searchVariation', 'backend_model', 'be_origin', 'position', 'search_layout', 'type', 'tracking_id', 'ad_domain', 'ad_position', 'ad_click_id', 'reco_id', 'reco_backend', 'reco_client', 'c_id', 'c_uid'];

/** Link limpo e seguro (https, loja certa, sem rastreio de anúncio), ou null se não for da loja. */
export function cleanOfferUrl(raw: string, store: ShopStore): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (!STORE_HOSTS[store].some((h) => host === h || host.endsWith(`.${h}`))) return null;
  url.protocol = 'https:';
  url.hash = '';
  for (const p of TRACKING_PARAMS) url.searchParams.delete(p);
  return url.toString();
}

/**
 * A vitrine. **Troque os `url` pelos seus links de afiliado** (Mercado Livre › Programa de Afiliados › gerador de links).
 * Por enquanto todos apontam para o produto de exemplo.
 */
const EXAMPLE = 'https://www.mercadolivre.com.br/vela-aromatica-lavanda-150g-100-cera-coco-com-tampa-premium-vegana-pavio-algodao-aromaterapia-relaxante-presente-decoracao-livre-parafina/p/MLB69706454';
export const CANDLE_OFFERS: CandleOffer[] = [
  { id: 'lavender-jar', name: 'Vela de lavanda em pote', note: 'Cera de coco, 150 g, pavio de algodão', store: 'mercadolivre', url: EXAMPLE, skin: 'jar' },
  { id: 'lavender', name: 'Vela aromática de lavanda', note: 'Aroma calmo para estudar à noite', store: 'mercadolivre', url: EXAMPLE, skin: 'lavender' },
  { id: 'beeswax', name: 'Vela de cera de abelha', note: 'Queima limpa, cheiro suave de mel', store: 'mercadolivre', url: EXAMPLE, skin: 'honey' },
];

/** Só ofertas com link válido; a que combina com a skin da pessoa vem primeiro. */
export function offersFor(skin: string | undefined, offers: CandleOffer[] = CANDLE_OFFERS): CandleOffer[] {
  return offers
    .flatMap((o) => {
      const url = cleanOfferUrl(o.url, o.store);
      return url ? [{ ...o, url }] : [];
    })
    .sort((a, b) => Number(b.skin === skin) - Number(a.skin === skin));
}

export const AFTER_COMPLETION_MS = 6 * 60 * 60_000;

/** Em que momento o popup está: muda a frase, nunca a insistência (sempre uma linha discreta, fácil de esconder). */
export type ShopMoment = 'before' | 'during' | 'after';

/**
 * Qual sugestão mostrar no popup (ou nenhuma). Antes de acender = convite ao ritual; com a vela acesa = uma linha
 * calma; logo depois de concluir (até 6 h) = celebração. Desligada pelas opções ou pelo "esconder" do popup = nada.
 */
export function popupMoment(input: { enabled: boolean; inPopup: boolean; running: boolean; lastCompletedAt?: number; now: number }): ShopMoment | null {
  const { enabled, inPopup, running, lastCompletedAt, now } = input;
  if (!enabled || !inPopup) return null;
  if (running) return 'during';
  if (lastCompletedAt !== undefined && lastCompletedAt <= now && now - lastCompletedAt <= AFTER_COMPLETION_MS) return 'after';
  return 'before';
}

/** Uma vela por dia: a da skin da pessoa, se houver; senão, gira pela vitrine (a mesma o dia todo, sem piscar). */
export function offerOfTheDay(skin: string | undefined, now: number, offers: CandleOffer[] = CANDLE_OFFERS): CandleOffer | undefined {
  const list = offersFor(skin, offers);
  if (list[0]?.skin === skin) return list[0];
  const d = new Date(now);
  const day = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  return list[day % Math.max(1, list.length)];
}
