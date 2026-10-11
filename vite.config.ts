import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.ts';

export default defineConfig({
  // Os ícones são referenciados pelo manifest (public/icons/...); a cópia automática da pasta public
  // duplicaria tudo na raiz do pacote (e levaria o icon.svg de origem).
  publicDir: false,
  plugins: [preact(), crx({ manifest })],
  // Páginas que o manifest não referencia como popup/opções (bloqueio: alvo de redirect;
  // fricção: aberta via chrome.tabs.create; janela da vela: chrome.windows.create) não são compiladas pelo CRXJS: entradas explícitas.
  build: { rollupOptions: { input: { blocked: 'src/ui/blocked/index.html', friction: 'src/ui/friction/index.html', intent: 'src/ui/intent/index.html', float: 'src/ui/float/index.html', newtab: 'src/ui/newtab/index.html' } } },
  test: { include: ['src/**/*.test.ts'] },
});
