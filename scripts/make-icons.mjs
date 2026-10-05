// Gera os PNGs do ícone (16/32/48/128) a partir de public/icons/icon.svg.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/icons/icon-${size}.png`, png);
}
console.log('ícones gerados');
