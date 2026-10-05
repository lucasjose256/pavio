// Gera os banners promocionais da Chrome Web Store (store/assets/promo-*.png) com o mesmo desenho da vela.
// Uso: node scripts/make-store-assets.mjs   (depois, converta para JPEG sem transparência: veja store/README.md)
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const INK = '#3a2b33';
const candle = (x, y, s) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="64" cy="40" r="120" fill="url(#glow)"/>
    <ellipse cx="64" cy="112" rx="50" ry="9" fill="#f0b25e" stroke="${INK}" stroke-width="5"/>
    <rect x="31" y="58" width="66" height="50" rx="16" fill="#fff1d6" stroke="${INK}" stroke-width="5"/>
    <rect x="40" y="66" width="6" height="26" rx="3" fill="#fff" opacity=".75"/>
    <rect x="61" y="46" width="6" height="14" rx="3" fill="${INK}"/>
    <path d="M64 6 C70 20 84 28 84 42 A20 20 0 0 1 44 42 C44 28 58 20 64 6Z" fill="#ff9a3c" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M64 28 C67 35 74 39 74 46 A10 10 0 0 1 54 46 C54 39 61 35 64 28Z" fill="#fff1b8"/>
  </g>`;

const tile = (w, h, { title, tagline, candleX, candleY, scale, titleSize, tagSize, textX, textY }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="glow"><stop offset="0" stop-color="#ffa043" stop-opacity=".5"/><stop offset=".5" stop-color="#ffa043" stop-opacity=".12"/><stop offset="1" stop-color="#ffa043" stop-opacity="0"/></radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf6e8"/><stop offset="1" stop-color="#f7e8cc"/></linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${candle(candleX, candleY, scale)}
  <text x="${textX}" y="${textY}" font-family="Iowan Old Style, Palatino, Georgia, serif" font-weight="700" font-size="${titleSize}" fill="#a8531c">${title}</text>
  <text x="${textX}" y="${textY + tagSize * 1.9}" font-family="Iowan Old Style, Palatino, Georgia, serif" font-style="italic" font-size="${tagSize}" fill="#4a3426">${tagline[0]}</text>
  <text x="${textX}" y="${textY + tagSize * 3.1}" font-family="Iowan Old Style, Palatino, Georgia, serif" font-style="italic" font-size="${tagSize}" fill="#4a3426">${tagline[1]}</text>
</svg>`;

const out = 'store/assets';
mkdirSync(out, { recursive: true });
const render = (svg, name) => writeFileSync(`${out}/${name}.png`, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());

render(tile(440, 280, { title: 'Pavio', tagline: ['Foco com calma,', 'uma vela por vez.'], candleX: 262, candleY: 52, scale: 1.45, titleSize: 62, tagSize: 22, textX: 30, textY: 120 }), 'promo-small-440x280');
render(tile(1400, 560, { title: 'Pavio', tagline: ['Você não controla você,', 'mas pode controlar seu ambiente.'], candleX: 930, candleY: 70, scale: 3.4, titleSize: 150, tagSize: 46, textX: 90, textY: 260 }), 'promo-marquee-1400x560');
console.log('banners gerados em', out);
