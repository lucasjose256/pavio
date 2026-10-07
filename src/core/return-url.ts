import { hostMatchesDomain } from './matching';

/** O que vem depois de `next=` na query (a URL de volta vai sempre por último e pode ter `&` e `?` próprios). */
export function rawNextParam(search: string): string {
  const at = search.indexOf('next=');
  return at === -1 ? '' : search.slice(at + 5);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Para onde voltar quando um site é liberado: o endereço em que a pessoa estava (`rawNext`, codificado ou não) se
 * for http(s) do MESMO site (nunca vira redirecionador aberto); senão, a página inicial do site.
 */
export function returnTarget(site: string, rawNext: string | undefined): string {
  for (const candidate of [rawNext ?? '', safeDecode(rawNext ?? '')]) {
    try {
      const url = new URL(candidate);
      if (/^https?:$/.test(url.protocol) && hostMatchesDomain(url.hostname, site)) return url.href;
    } catch {
      /* tenta o próximo */
    }
  }
  return `https://${site}/`;
}

/** Tem um endereço exato para voltar (e não só a página inicial)? */
export const hasExactReturn = (site: string, rawNext: string | undefined): boolean => returnTarget(site, rawNext) !== `https://${site}/`;
