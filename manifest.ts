import { defineManifest } from '@crxjs/vite-plugin';

// Permissões são adicionadas etapa por etapa, só quando necessárias.
// Veja a justificativa de cada uma no CLAUDE.md.
export default defineManifest({
  manifest_version: 3,
  name: 'Pavio',
  version: '0.1.0',
  description: 'Foco com calma: bloqueie apps inteiros com um clique ou por dia e horário, com timer em vela e Pomodoro. Tudo local, sem contas.',
  minimum_chrome_version: '120',
  permissions: ['storage', 'alarms', 'notifications', 'declarativeNetRequest'],
  // Pedida por site, no clique do usuário (ao salvar um ambiente com sites bloqueados/restritos).
  optional_host_permissions: ['<all_urls>'],
  icons: { 16: 'public/icons/icon-16.png', 32: 'public/icons/icon-32.png', 48: 'public/icons/icon-48.png', 128: 'public/icons/icon-128.png' },
  action: { default_popup: 'src/ui/popup/index.html', default_title: 'Pavio', default_icon: { 16: 'public/icons/icon-16.png', 32: 'public/icons/icon-32.png', 48: 'public/icons/icon-48.png', 128: 'public/icons/icon-128.png' } },
  options_ui: { page: 'src/ui/options/index.html', open_in_tab: true },
  // Alvos dos redirecionamentos: página da vela (bloqueio) e "o que você vai fazer aqui?" (intenção).
  web_accessible_resources: [{ resources: ['src/ui/blocked/index.html', 'src/ui/intent/index.html'], matches: ['<all_urls>'] }],
  // Modo restrito do YouTube/Instagram/X. Declarado aqui (e não como permissão opcional) porque o script precisa
  // estar pronto em document_start; ele não faz nada fora de uma sessão com YouTube "restrito".
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
      js: ['src/content/youtube.iife.ts'],
      run_at: 'document_start',
    },
    // Instagram "só mensagens" e X sem "Para você". Mesmo critério do YouTube (sufixo .iife = document_start exato).
    {
      matches: ['https://www.instagram.com/*'],
      js: ['src/content/instagram.iife.ts'],
      run_at: 'document_start',
    },
    {
      matches: ['https://www.linkedin.com/*'],
      js: ['src/content/linkedin.iife.ts'],
      run_at: 'document_start',
    },
    {
      matches: ['https://x.com/*', 'https://twitter.com/*', 'https://mobile.twitter.com/*'],
      js: ['src/content/x.iife.ts'],
      run_at: 'document_start',
    },
  ],
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
});
