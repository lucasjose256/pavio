import { useId } from 'preact/hooks';
import { monogram, siteBrand, type SiteBrand } from '../../core/site-brand';
import './site-icon.css';

/** Logos simplificados, desenhados aqui (viewBox 24×24). Sem imagens externas. */
/** `uid` evita ids repetidos (as abas escondidas também estão na página e um degradê lá não é resolvido). */
const LOGOS = (uid: string): Record<SiteBrand, preact.JSX.Element> => ({
  youtube: (
    <>
      <rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#ff0000" />
      <path d="M10 8.8v6.4l5.6-3.2z" fill="#fff" />
    </>
  ),
  instagram: (
    <>
      <defs>
        <linearGradient id={`${uid}-ig`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#feda75" />
          <stop offset=".35" stop-color="#fa7e1e" />
          <stop offset=".6" stop-color="#d62976" />
          <stop offset="1" stop-color="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill={`url(#${uid}-ig)`} />
      <circle cx="12" cy="12" r="4.3" fill="none" stroke="#fff" stroke-width="1.9" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="#fff" />
    </>
  ),
  x: (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#111" stroke="#6b6b6b" stroke-width=".8" />
      <path d="M7 7l10 10M17 7L7 17" stroke="#fff" stroke-width="2.1" stroke-linecap="round" />
    </>
  ),
  tiktok: (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#111" stroke="#6b6b6b" stroke-width=".8" />
      <circle cx="10" cy="15.6" r="3.1" fill="none" stroke="#25f4ee" stroke-width="2" transform="translate(-.7 0)" />
      <circle cx="10" cy="15.6" r="3.1" fill="none" stroke="#fe2c55" stroke-width="2" transform="translate(.7 0)" />
      <path d="M13.2 15.6V6c.4 2.3 1.8 3.4 3.6 3.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" />
      <circle cx="10" cy="15.6" r="3.1" fill="none" stroke="#fff" stroke-width="1.7" />
    </>
  ),
  facebook: (
    <>
      <circle cx="12" cy="12" r="10.5" fill="#1877f2" />
      <path d="M13.3 21v-7.3h2.4l.4-2.9h-2.8V9c0-.8.3-1.400 1.500-1.400h1.400V5.100c-.3 0-1.100-.1-2.100-.1-2.200 0-3.600 1.300-3.600 3.700v2.100H8v2.900h2.500V21z" fill="#fff" />
    </>
  ),
  reddit: (
    <>
      <circle cx="12" cy="12" r="10.5" fill="#ff4500" />
      <ellipse cx="12" cy="13.4" rx="6.1" ry="4.3" fill="#fff" />
      <circle cx="6.6" cy="10.6" r="1.6" fill="#fff" />
      <circle cx="17.4" cy="10.6" r="1.6" fill="#fff" />
      <circle cx="9.7" cy="13" r="1.1" fill="#ff4500" />
      <circle cx="14.3" cy="13" r="1.1" fill="#ff4500" />
      <path d="M9.6 15.4c1.4 1 3.400 1 4.800 0" stroke="#ff4500" stroke-width="1" fill="none" stroke-linecap="round" />
      <path d="M12 9.200l.9-3.400 2.600.6" stroke="#fff" stroke-width="1.200" fill="none" stroke-linecap="round" />
      <circle cx="16.200" cy="6.600" r="1.200" fill="#fff" />
    </>
  ),
  linkedin: (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="#0a66c2" />
      <rect x="5.300" y="9.500" width="2.700" height="8.600" fill="#fff" />
      <circle cx="6.650" cy="6.500" r="1.600" fill="#fff" />
      <path d="M10.200 9.500h2.600v1.200c.5-.9 1.500-1.400 2.700-1.400 2.500 0 3.200 1.600 3.200 3.900v4.900h-2.700v-4.300c0-1.100-.3-1.900-1.400-1.900-1.200 0-1.700.9-1.700 2.100v4.100h-2.700z" fill="#fff" />
    </>
  ),
  twitch: (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#9146ff" />
      <path d="M6 5.500h12.500v8.200l-3.100 3.100h-3l-2.100 2.100v-2.100H6z" fill="#fff" />
      <rect x="10.300" y="8.300" width="1.700" height="4.200" fill="#9146ff" />
      <rect x="14.200" y="8.300" width="1.700" height="4.200" fill="#9146ff" />
    </>
  ),
  netflix: (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#111" stroke="#6b6b6b" stroke-width=".8" />
      <path d="M8.200 18.500V5.500l7.600 13V5.500" fill="none" stroke="#e50914" stroke-width="2.600" stroke-linejoin="round" />
    </>
  ),
});

/** Ícone do site (antes do nome): logo conhecido, ou uma letra colorida estável para os demais. */
export function SiteIcon({ domain, size = 18, class: className }: { domain: string; size?: number; class?: string }) {
  const uid = `si${useId().replace(/\W/g, '')}`;
  const brand = siteBrand(domain);
  if (brand) {
    return <svg class={`site-icon ${className ?? ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">{LOGOS(uid)[brand]}</svg>;
  }
  const { letter, hue } = monogram(domain);
  return (
    <span class={`site-icon mono ${className ?? ''}`} aria-hidden="true"
      style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.58)}px`, background: `hsl(${hue} 42% 42%)` }}>{letter}</span>
  );
}
