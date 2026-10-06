// Harness de telas sem o Chrome: `npm run harness` e abra http://localhost:5199/harness/options.html
// (parâmetros: ?theme=night, ?skin=jar, ?running=1; hash = seção, ex.: #limite). O `chrome` é simulado em harness/mock.ts.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({ root: fileURLToPath(new URL('..', import.meta.url)), plugins: [preact()], server: { port: 5199 } });
