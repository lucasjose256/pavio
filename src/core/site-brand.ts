import { hostMatchesDomain } from './matching';

/** Sites conhecidos que ganham um ícone próprio (desenhado na extensão; nenhum arquivo vem da internet). */
export type SiteBrand = 'youtube' | 'instagram' | 'x' | 'tiktok' | 'facebook' | 'reddit' | 'linkedin' | 'twitch' | 'netflix';

const BRANDS: [SiteBrand, string[]][] = [
  ['youtube', ['youtube.com', 'youtu.be']],
  ['instagram', ['instagram.com']],
  ['x', ['x.com', 'twitter.com']],
  ['tiktok', ['tiktok.com']],
  ['facebook', ['facebook.com', 'fb.com']],
  ['reddit', ['reddit.com']],
  ['linkedin', ['linkedin.com']],
  ['twitch', ['twitch.tv']],
  ['netflix', ['netflix.com']],
];

/** O ícone próprio do site (subdomínios incluídos: `m.youtube.com`), se for um dos conhecidos. */
export function siteBrand(domain: string): SiteBrand | undefined {
  return BRANDS.find(([, domains]) => domains.some((d) => hostMatchesDomain(domain, d)))?.[0];
}

/** Letra e tom (0–359) estáveis para sites sem ícone próprio: o mesmo site tem sempre a mesma cor. */
export function monogram(domain: string): { letter: string; hue: number } {
  const clean = domain.toLowerCase().replace(/^www\./, '');
  let hash = 0;
  for (const ch of clean) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { letter: (clean[0] ?? '?').toUpperCase(), hue: hash % 360 };
}
