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
  // Pedida por site, no clique do usuário (ao salvar um ambiente com sites bloqueados/restritos).
  optional_host_permissions: ['<all_urls>'],
  action: { default_popup: 'src/ui/popup/index.html', default_title: 'Pavio' },
  options_ui: { page: 'src/ui/options/index.html', open_in_tab: true },
  // Alvo dos redirecionamentos do bloqueio (etapa 4).
  web_accessible_resources: [{ resources: ['src/ui/blocked/index.html'], matches: ['<all_urls>'] }],
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
});
