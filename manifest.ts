import { defineManifest } from '@crxjs/vite-plugin';

// Permissões são adicionadas etapa por etapa, só quando necessárias.
// Veja a justificativa de cada uma no CLAUDE.md.
export default defineManifest({
  manifest_version: 3,
  name: 'Pavio',
  version: '0.1.0',
  description: 'Você não controla você, mas pode controlar seu ambiente.',
  minimum_chrome_version: '120',
  permissions: ['storage'],
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
});
