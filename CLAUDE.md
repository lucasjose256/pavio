# Pavio

Extensão Chrome (MV3) de foco para TDAH/procrastinação. Slogan: "Você não controla você, mas pode controlar seu ambiente."
Conceito: **ambientes** (perfis com regra por site: liberado/bloqueado/restrito), **sessões** com uma **vela** que queima, e **fricção progressiva** para desistir.
Tudo local: sem backend, sem coleta de dados, sem contas.

## Convenções
- Interface em pt-BR (textos em `src/ui/i18n/pt-BR.ts`); código, nomes e valores de enum em inglês.
- Visual: aconchegante, calmo e minimalista; a vela é a protagonista. **Padrão = tema creme** (papel quente, marrom suave, âmbar); variante **noite** (escuro quente) escolhida nas opções. (Decisão revista: o briefing original dizia "escuro por padrão"; o dono pediu tons cremes e quentes.)
- Comandos: `npm test` (Vitest), `npm run typecheck`, `npm run lint`, `npm run build` (gera `dist/`), `npm run dev`.

## Arquitetura (decisão central: domínio separado do Chrome)
- `src/core/`: lógica pura (modelos, regras, sessão, fricção, migrations, repositórios). **Proibido** importar `chrome.*`, DOM, Preact ou `platform/`/`ui/` (ESLint reforça). Será reaproveitado no app macOS.
- `src/core/ports.ts`: interfaces (`StoragePort`, `Clock`, ids). Chrome implementa em `src/platform/chrome/`; testes usam `MemoryStorage`.
- `src/platform/chrome/`: adaptadores (storage, alarms, notifications, declarativeNetRequest).
- `src/background/`, `src/content/`, `src/ui/`: consumem core + platform.
- Content scripts: **todos os seletores de sites ficam em `src/content/selectors.ts`** (mudam com frequência).

## Stack
Vite + `@crxjs/vite-plugin` (manifest tipado em `manifest.ts`), TypeScript strict, Preact, CSS puro com variáveis (skins da vela = troca de variáveis/SVG), Vitest.

## Modelo de dados (`src/core/models.ts`)
`Environment { rules: Rule[] }`, `Rule { domain, mode: allowed|blocked|restricted, restrictedKind?: youtube|instagram|x|intent }`,
`Session` (guarda `environmentSnapshot` congelado, `endsAt` absoluto, `strictness: light|focus`, `youtubeAllowlist`), `HistoryEntry`, `Settings`.
- Sites sem regra = liberados.
- Tempo: `endsAt` (timestamp) é a fonte da verdade, nunca contador. `chrome.alarms` com `when: endsAt`; ao acordar o service worker reconcilia.
- Editar ambiente durante sessão não afeta a sessão (snapshot).
- Fricção = lista ordenada de passos (`confirm`, `wait`, `typePhrase`, `challenge` reservado) para encaixar desafios depois.

## Sessão e timer (`core/session.ts`, `core/session-service.ts`)
- `SessionService` (start / reconcile / abandon) usa ports (`SchedulerPort`, `NotifierPort`, `Clock`); no Chrome: alarms + notifications.
- `reconcile()` é idempotente e roda: ao acordar o service worker, no `onStartup`/`onInstalled`, quando o alarme `session-end` dispara e ao abrir o popup. Se `now >= endsAt`: grava histórico (concluída = tempo planejado inteiro), limpa a sessão, cancela alarme e notifica. Senão, reagenda o alarme (alarmes se perdem ao reiniciar o navegador).
- Quem inicia a sessão só grava no storage; reações (ex.: sincronizar regras DNR na etapa 4) vêm de `chrome.storage.onChanged` no background, não de chamadas diretas.
- **Pendência temporária:** "Encerrar antes da hora" no popup usa `confirm()` para os dois modos; a etapa 5 troca por uma aba de fricção (modo `focus`: 10s + frase).

## Bloqueio (`core/blocking.ts`, `platform/chrome/blocking.ts`)
- `planFor(session)` → `BlockPlan { block, allow }`: só `blocked` vira regra de rede (`restricted` passa; é dos content scripts). Subdomínio não bloqueado de um domínio bloqueado vira exceção `allow` (prioridade maior).
- `ChromeBlocker.apply` troca as regras dinâmicas (só `main_frame`, `redirect` para `blocked/index.html?site=...`), é idempotente e, ao bloquear um domínio novo, redireciona as abas já abertas (usa `chrome.tabs.query` por padrão de host; não precisa da permissão `tabs`).
- O background chama `syncBlocking()` ao acordar e em todo `storage.onChanged` de `activeSession`. Sem sessão ativa não há regras.
- O redirect exige permissão de host: o popup chama `ensureHostAccess` no clique de "Acender vela"; se negada, a sessão não inicia.
- **Armadilha de build:** `blocked/index.html` só está em `web_accessible_resources`, e o CRXJS copia esse HTML sem compilar (página em branco). Por isso ele é entrada explícita em `vite.config.ts` (`build.rollupOptions.input`). Toda página nova só acessível por redirect/link externo precisa disso; confira que `dist/.../index.html` aponta para `/assets/...`.
- A página de bloqueio conta a tentativa (`recordBlockedAttempt`) e, com a vela já apagada, oferece abrir o site.

## Storage (`chrome.storage.local`)
Chaves em `KEYS` (`repositories.ts`): `schemaVersion`, `environments`, `settings`, `activeSession`, `history` (máx. 1000).
Mudou o formato? Suba `CURRENT_SCHEMA_VERSION` e adicione um passo em `core/migrations.ts`.
Estado do modo intenção irá em `chrome.storage.session`.

## Permissões (peça só o necessário; justificar cada uma na Web Store)
| Permissão | Motivo | Status |
|---|---|---|
| `storage` | Ambientes, sessão ativa, histórico, tudo local | ✅ etapa 1 |
| `alarms` | Fim da sessão e aviso do modo intenção com service worker suspenso | ✅ etapa 3 |
| `notifications` | Avisar que a vela acabou | ✅ etapa 3 |
| `declarativeNetRequest` | Bloquear/redirecionar sites sem ler conteúdo | ✅ etapa 4 |
| `host_permissions` youtube/instagram/x | Content scripts do modo restrito | planejada (etapas 6-7) |
| `optional_host_permissions: <all_urls>` | Redirect do DNR exige acesso ao host; pedido por site (`*://*.dominio/*`), no clique em Salvar da página de opções (`platform/chrome/permissions.ts`) | ✅ etapa 2 |
Evitar: `tabs`, `history`, `webNavigation`, `<all_urls>` obrigatório.

## Identidade visual: a vela (`src/ui/candle/`)
- `<Candle progress skin lit />`: `progress` 1 = cheia, 0 = apagada. Cera e chama descem juntas (transição CSS de 1s linear, por isso o popup atualiza a cada 1s); a poça na base cresce e a cera do topo escorre. `prefers-reduced-motion` desliga animações.
- Estilo: gordinha, cartoon e minimalista (largura 116 × altura 150 no viewBox; cores chapadas, contorno grosso na skin Clássica). Ícone da extensão: `public/icons/icon.svg` → `npm run icons` gera os PNGs (resvg).
- Skin = `{ id, name, flame (cores), Body }` em `skins/`; pavio/chama/fumaça são comuns. Nova skin: criar arquivo + registrar em `skins/index.ts`. Geometria em `geometry.ts` (testada).
- Tema: `src/ui/theme.css` define tokens para `creme` (padrão) e `noite` (`data-theme` no `<html>`). `Settings.theme` guarda a escolha; `ui/shared/theme.ts` (`initTheme`, chamado em cada página) aplica e evita piscar via cache em localStorage. Nunca use cores fixas na UI: use os tokens (`--bg`, `--surface`, `--accent`, `--glow`...). A skin Minimalista usa `--min-line`/`--min-body`. Tipografia: `--font-display` (serifa, títulos/tempo/frases) e `--font-body` (arredondada do sistema); sem fontes externas. Frases motivacionais em `ui/i18n/pt-BR.ts` (`quotes`).
- Popup mostra a vela derretendo com o tempo restante quando há sessão; `blocked/` mostra a vela grande, chama animada, frase e tempo restante.

## Fora da V1
Agenda recorrente, desafios, compartilhamento, loja de skins, Safari/Firefox, app macOS, contas, backend.

## Roadmap (uma etapa = um commit)
1. ✅ Modelos + storage (+ testes do core)
2. ✅ Página de opções (ambientes/regras, sugestões, permissão por site) + identidade visual da vela
3. ✅ Sessão + timer (alarms) + iniciar sessão no popup + notificação
4. ✅ Bloqueio (DNR) + página de bloqueio
5. Página de fricção
6. Modo restrito do YouTube (+ allowlist)
7. Instagram (só DMs) e X (sem "Para você")
8. Histórico
Modo intenção ("o que você vai fazer aqui?") entra junto com o modo restrito (etapa 6).

## Decisões em aberto / assumidas
- "Fora de sessão = confirmação simples" foi interpretado como `strictness: 'light'` (confirmação simples) vs `'focus'` (10s + frase). Confirmar com o dono.
