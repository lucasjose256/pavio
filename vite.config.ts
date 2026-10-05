import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.ts';

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  // A página de bloqueio só aparece em web_accessible_resources (alvo de redirect), e o CRXJS
  // não compila HTML assim: precisa ser entrada explícita do build.
  build: { rollupOptions: { input: { blocked: 'src/ui/blocked/index.html' } } },
  test: { include: ['src/**/*.test.ts'] },
});
