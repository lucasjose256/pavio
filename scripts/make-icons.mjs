// Gera os PNGs do ícone (16/32/48/128) a partir de public/icons/icon.svg:
//   icon-<tamanho>.png         → ícone normal (fundo transparente)
//   icon-active-<tamanho>.png  → ícone com a vela acesa (fundo âmbar, mostrado na barra do Chrome durante a vela)
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const ACTIVE_BG = '#ffcf66';
const svg = readFileSync('public/icons/icon.svg', 'utf8');
const body = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1];
const activeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="26" fill="${ACTIVE_BG}"/><g transform="translate(64 66) scale(.86) translate(-64 -64)">${body}</g></svg>`;
writeFileSync('public/icons/icon-active.svg', activeSvg);

for (const size of [16, 32, 48, 128]) {
  const render = (source) => new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/icons/icon-${size}.png`, render(svg));
  writeFileSync(`public/icons/icon-active-${size}.png`, render(activeSvg));
}
console.log('ícones gerados');
