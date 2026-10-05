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
- Encerrar antes da hora: o popup abre a aba `ui/friction/` (o popup fecha ao perder foco). Só essa aba chama `sessionService.abandon()`.

## Bloqueio (`core/blocking.ts`, `platform/chrome/blocking.ts`)
- `planFor(session)` → `BlockPlan { block, allow }`: só `blocked` vira regra de rede (`restricted` passa; é dos content scripts). Subdomínio não bloqueado de um domínio bloqueado vira exceção `allow` (prioridade maior).
- `ChromeBlocker.apply` troca as regras dinâmicas (só `main_frame`, `redirect` para `blocked/index.html?site=...`), é idempotente e, ao bloquear um domínio novo, redireciona as abas já abertas (usa `chrome.tabs.query` por padrão de host; não precisa da permissão `tabs`).
- O background chama `syncBlocking()` ao acordar e em todo `storage.onChanged` de `activeSession`. Sem sessão ativa não há regras.
- O redirect exige permissão de host: o popup chama `ensureHostAccess` no clique de "Acender vela"; se negada, a sessão não inicia.
- **Armadilha de build:** `blocked/index.html` só está em `web_accessible_resources`, e o CRXJS copia esse HTML sem compilar (página em branco). Por isso ele é entrada explícita em `vite.config.ts` (`build.rollupOptions.input`). Toda página nova só acessível por redirect/link externo precisa disso; confira que `dist/.../index.html` aponta para `/assets/...`.
- A página de bloqueio conta a tentativa (`recordBlockedAttempt`) e, com a vela já apagada, oferece abrir o site.

## Fricção (`core/friction.ts`, `ui/friction/`)
- `frictionFor(strictness)` devolve passos; `evaluateFriction(steps, input)` diz se pode encerrar (todos os passos cumpridos). `light` = `confirm`; `focus` = `wait` 10s + `typePhrase` ("eu quero desistir do meu foco agora", tolera caixa/acentos/espaços). `challenge` está previsto no tipo e na avaliação (desafios futuros = novos passos), sem UI ainda.
- Textos ficam em `ui/i18n/pt-BR.ts` (`friction`); o domínio só tem a regra.
- A tela bloqueia colar (de propósito) e o botão "Apagar a vela" só habilita com tudo cumprido. O cronômetro conta desde a abertura da aba (recarregar reinicia).
- Páginas que o CRXJS não compila sozinho (bloqueio, fricção) são entradas explícitas em `vite.config.ts`.

## Modo restrito do YouTube (`core/youtube.ts`, `content/youtube.iife.ts`, `content/selectors.ts`)
- Decisão pura por página (`youtubeDecision`): **sem lista** = "sem feed" (busca e vídeos liberados; Shorts e feeds de descoberta redirecionam); **com lista** = só vídeos/playlists/canais colados, e vídeos de canais permitidos (`check-channel`: o content script confere os links do dono no DOM, esperando o `video-id` da página para não ler o vídeo anterior). Links aceitos: watch, youtu.be, shorts/embed/live, playlist, `@handle`, `/channel/UC…`, `/c/…`, `/user/…`.
- CSS (feed da home, recomendados, comentários, Shorts, sugestões no fim do vídeo) vem de `selectors.ts`, **validado no YouTube real em 2026-10-05**. Quando algo reaparecer, atualize só esse arquivo.
- Content script estático (`document_start`), **nomeado `.iife.ts` de propósito**: sem isso o CRXJS usa um loader assíncrono e o script não roda no início exato (o feed piscaria). Mantenha o sufixo em novos content scripts `document_start`.
- O script roda em `www.youtube.com`/`m.youtube.com` e só age com sessão ativa cujo ambiente tem youtube.com como `restricted`/`youtube`. Isso gera o aviso de instalação "ler dados do youtube.com" (aceito: é o único jeito de rodar em `document_start`).
- Páginas bloqueadas vão para `blocked/index.html?site=youtube.com&why=shorts|feed|not-allowed`.
- Limitação: o dono do vídeo só é checado por link de canal no DOM; vídeo sem nenhum link de canal visível é bloqueado.

## Instagram e X (`core/sites.ts`, `content/instagram.iife.ts`, `content/x.iife.ts`)
- **Instagram "só mensagens"**: decisão pura por caminho (`instagramDecision`): `/direct…` e o necessário para login passam; `/` vai para `/direct/inbox/`; todo o resto (Reels, Explorar, feed, perfis, stories) vai para `blocked/…?why=dm-only`. Atalhos de Reels/Explorar no menu são escondidos por CSS. SPA: `content/navigation.ts` (`onNavigate`) combina Navigation API, popstate e checagem a cada 500 ms.
- **X sem "Para você"**: o script acha as abas por `[data-testid=primaryColumn] [role=tablist] [role=tab]` + texto (`classifyXTab`: en/pt/es), esconde "Para você" (atributo `data-pavio-x`) e, se ela estiver selecionada, clica em "Seguindo". Ao fim da sessão desfaz tudo. Vale para `x.com`/`twitter.com` (regra restrita tipo `x`).
- **Validação:** a lógica foi testada (unitário + script compilado numa página que imita a estrutura do X). **Os seletores do DOM real do Instagram e do X NÃO foram validados** (exigem login). Se algo falhar, ajuste `selectors.ts` (`instagram`, `x`). Textos de aba em outros idiomas entram em `x.forYouLabels`/`followingLabels`.
- Timer (`setTimeout`), não `requestAnimationFrame`, nos content scripts: rAF pausa em aba oculta.

## Modo intenção (`core/intent-service.ts`, `ui/intent/`)
- Vale para sites `restricted` com tipo `intent` (Reddit, TikTok, Facebook e sites adicionados). YouTube/Instagram/X têm o próprio tratamento.
- Sem `scripting` e sem content script: o DNR redireciona o site para `intent/index.html?site=…&next=<url original>` (prioridade 2; `next` vai por último, sem codificar, porque o DNR não codifica). Ao responder ("o que vai fazer" + minutos), `IntentService.grant` grava a permissão, o background remove a regra daquele site e a página navega de volta (só para o mesmo domínio).
- Passou do tempo: `chrome.alarms` (`intent:<domínio>`) → notificação "Ainda está na tarefa?" com botões "mais 5 min" / "já terminei" (aviso gentil, não bloqueia à força). "Já terminei" volta a pedir intenção (abas abertas são levadas à página de intenção).
- Permissões de intenção são apagadas quando a sessão termina.

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
| Content scripts em `youtube.com`, `instagram.com`, `x.com`/`twitter.com` (via `content_scripts.matches`, geram aviso de instalação) | Modo restrito de cada site em `document_start` | ✅ etapas 6-7 |
| `optional_host_permissions: <all_urls>` | Redirect do DNR exige acesso ao host; pedido por site (`*://*.dominio/*`), no clique em Salvar da página de opções (`platform/chrome/permissions.ts`) | ✅ etapa 2 |
Evitar: `tabs`, `history`, `webNavigation`, `scripting`, `<all_urls>` obrigatório. (`chrome.tabs.query/update` por padrão de host funcionam sem `tabs`; modo intenção usa DNR em vez de `scripting`.)

## Identidade visual: a vela (`src/ui/candle/`)
- `<Candle progress skin lit />`: `progress` 1 = cheia, 0 = apagada. Cera e chama descem juntas (transição CSS de 1s linear, por isso o popup atualiza a cada 1s); a poça na base cresce e a cera do topo escorre. `prefers-reduced-motion` desliga animações.
- Estilo: gordinha, cartoon e minimalista (largura 116 × altura 150 no viewBox; cores chapadas, contorno grosso na skin Clássica). Ícone da extensão: `public/icons/icon.svg` → `npm run icons` gera os PNGs (resvg).
- Skin = `{ id, name, flame (cores), Body }` em `skins/`; pavio/chama/fumaça são comuns. Nova skin: criar arquivo + registrar em `skins/index.ts`. Geometria em `geometry.ts` (testada).
- Tema: `src/ui/theme.css` define tokens para `creme` (padrão) e `noite` (`data-theme` no `<html>`). `Settings.theme` guarda a escolha; `ui/shared/theme.ts` (`initTheme`, chamado em cada página) aplica e evita piscar via cache em localStorage. Nunca use cores fixas na UI: use os tokens (`--bg`, `--surface`, `--accent`, `--glow`...). A skin Minimalista usa `--min-line`/`--min-body`. Tipografia: `--font-display` (serifa, títulos/tempo/frases) e `--font-body` (arredondada do sistema); sem fontes externas. Frases motivacionais em `ui/i18n/pt-BR.ts` (`quotes`).
- Popup mostra a vela derretendo com o tempo restante quando há sessão; `blocked/` mostra a vela grande, chama animada, frase e tempo restante.

## Histórico e página de opções (`core/history.ts`, `ui/options/`)
- `summarizeHistory(entries, now)` (puro, testado): "horas devolvidas" (= tempo com a vela acesa, inclui a parte vivida das encerradas antes), concluídas/encerradas, tentativas bloqueadas, sequência de dias (hoje sem sessão não zera) e últimos 7 dias. `formatDuration` formata "2 h 05 min".
- Opções em 3 abas por hash (`#ambientes`, `#historico`, `#aparencia`), todas montadas (trocar de aba não perde edição): `EnvironmentsTab` (cartões de ambiente, seletor segmentado por tipo de regra, duplicar, barra de salvar fixa, aviso "Conceder acesso" quando faltam permissões), `HistoryTab` (resumo, gráfico, lista, exportar JSON, apagar), `AppearanceTab` (tema + skin da vela).
- Permissão de host opcional é pedida só para `accessDomains(env)` (bloqueados + intenção); YouTube/Instagram/X restritos usam content scripts e não precisam.
- Cores dos tipos de regra: tokens `--mode-allowed|blocked|restricted`. Textos das páginas grandes ficam nos componentes; os compartilhados, em `i18n/pt-BR.ts`.

## Horários / faixas recorrentes (`core/schedule.ts`, `core/schedule-service.ts`, `ui/options/ScheduleTab.tsx`)
- Recurso adicionado depois da V1 original (antes estava "fora do escopo"). **Faixa** (`ScheduleBlock`) = dias da semana (0 = dom) + `startMin`/`endMin` + **um ambiente** (a grade de permissões do momento) + modo `focus|light` + ativa/inativa. `endMin <= startMin` = vira a noite. O **Timer** "bloquear agora" é a sessão manual do popup.
- `scheduleState(blocks, now, skipped)` (puro) devolve a faixa valendo agora e a próxima; sobreposição → vale a que **começou por último**; a UI avisa (`findOverlaps`). `weekSegments` divide faixas noturnas para a grade semanal.
- `ScheduleService.sync()` (idempotente): conclui o que venceu, **acende a vela sozinho** (`Session.source = 'schedule'`, de `start` ao `end` da faixa, snapshot do ambiente, sem allowlist do YouTube) e agenda o alarme `schedule-next` para a próxima. Não interrompe sessão manual; quando ela acaba dentro da faixa, a faixa assume.
- **Desistir de uma faixa vale só por hoje**: `SessionService.abandon` grava a `occurrenceKey` (`idFaixa:AAAA-MM-DD`) em `skippedOccurrences` antes de limpar; amanhã volta.
- Background: `syncAll()` roda ao acordar, nos alarmes `session-end`/`schedule-next` e em mudanças de `activeSession`/`schedule` no storage (editar faixas tem efeito imediato).
- Ambiente em uso por faixa não pode ser apagado. Permissão de host do ambiente é pedida ao salvar a faixa.
- Não há permissão nova (usa alarms/notifications). Notificação "Seu horário começou".

## Fora da V1
Desafios, compartilhamento, loja de skins, Safari/Firefox, app macOS, contas, backend.

## Roadmap (uma etapa = um commit)
1. ✅ Modelos + storage (+ testes do core)
2. ✅ Página de opções (ambientes/regras, sugestões, permissão por site) + identidade visual da vela
3. ✅ Sessão + timer (alarms) + iniciar sessão no popup + notificação
4. ✅ Bloqueio (DNR) + página de bloqueio
5. ✅ Página de fricção
6. ✅ Modo restrito do YouTube (+ allowlist) e modo intenção
7. ✅ Instagram (só DMs) e X (sem "Para você")
8. ✅ Histórico (+ redesenho da página de opções)
9. ✅ Horários recorrentes (faixas por dia/hora, cada uma com seu ambiente)

## Decisões em aberto / assumidas
- "Fora de sessão = confirmação simples" foi interpretado como `strictness: 'light'` (confirmação simples) vs `'focus'` (10s + frase). Confirmar com o dono.
