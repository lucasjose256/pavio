import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.ts';

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  // Páginas que o manifest não referencia como popup/opções (bloqueio: alvo de redirect;
  // fricção: aberta via chrome.tabs.create) não são compiladas pelo CRXJS: entradas explícitas.
  build: { rollupOptions: { input: { blocked: 'src/ui/blocked/index.html', friction: 'src/ui/friction/index.html' } } },
  test: { include: ['src/**/*.test.ts'] },
});
