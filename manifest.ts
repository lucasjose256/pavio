import { defineManifest } from '@crxjs/vite-plugin';

// Permissões são adicionadas etapa por etapa, só quando necessárias.
// Veja a justificativa de cada uma no CLAUDE.md.
export default defineManifest({
  manifest_version: 3,
  name: 'Pavio',
  version: '0.1.0',
  description: 'Você não controla você, mas pode controlar seu ambiente.',
  minimum_chrome_version: '120',
  permissions: ['storage', 'alarms', 'notifications', 'declarativeNetRequest'],
  // Pedida por site, no clique do usuário (ao salvar um ambiente com sites bloqueados/restritos).
  optional_host_permissions: ['<all_urls>'],
  icons: { 16: 'public/icons/icon-16.png', 32: 'public/icons/icon-32.png', 48: 'public/icons/icon-48.png', 128: 'public/icons/icon-128.png' },
  action: { default_popup: 'src/ui/popup/index.html', default_title: 'Pavio', default_icon: { 16: 'public/icons/icon-16.png', 32: 'public/icons/icon-32.png', 48: 'public/icons/icon-48.png', 128: 'public/icons/icon-128.png' } },
  options_ui: { page: 'src/ui/options/index.html', open_in_tab: true },
  // Alvo dos redirecionamentos do bloqueio (etapa 4).
  web_accessible_resources: [{ resources: ['src/ui/blocked/index.html'], matches: ['<all_urls>'] }],
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
});
