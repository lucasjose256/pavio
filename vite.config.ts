import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.ts';

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  test: { include: ['src/**/*.test.ts'] },
});
