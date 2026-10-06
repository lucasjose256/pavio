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

export const SUGGEST_EVERY_MS = 7 * 24 * 60 * 60_000;
export const SUGGEST_AFTER_COMPLETION_MS = 6 * 60 * 60_000;

/**
 * Sugerir uma vela de verdade no popup? Só se a pessoa não desligou, se concluiu uma vela nas últimas 6 h
 * (momento de comemorar, nunca no meio do foco) e no máximo uma vez por semana.
 */
export function suggestionDue(input: { enabled: boolean; lastCompletedAt?: number; lastShownAt?: number; now: number }): boolean {
  const { enabled, lastCompletedAt, lastShownAt, now } = input;
  if (!enabled || lastCompletedAt === undefined) return false;
  if (now - lastCompletedAt > SUGGEST_AFTER_COMPLETION_MS || lastCompletedAt > now) return false;
  return lastShownAt === undefined || now - lastShownAt >= SUGGEST_EVERY_MS;
}
