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
- `planFor(policy)` (política = rotina + Timer; ver seção Rotina) → `BlockPlan { block, intent, allow }`: só `blocked` vira regra de rede (`restricted` passa; é dos content scripts). Subdomínio não bloqueado de um domínio bloqueado vira exceção `allow` (prioridade maior).
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

## Recursos por serviço (`core/restrictions.ts`) — substitui o "tudo ou nada" do modo restrito
- Uma regra `restricted` de YouTube/Instagram/X/LinkedIn tem `features`: os **recursos escondidos** (ids de `FEATURE_DEFS`). Sem lista = padrão do serviço (`defaultFeatures`). A UI mostra cada recurso como botão liga/desliga na regra (`EnvironmentsTab`); "Modo intenção" continua sendo a alternativa (select "Como restringir").
- YouTube: `home` (feed Início/Inscrições/Em alta), `shorts`, `related` (lateral + fim do vídeo), `comments`. Instagram: `feed`, `reels`, `explore`, `stories` (padrão) + `messages` e `posts` (perfis e publicações; é o modo rígido de antes: marque tudo menos mensagens). X: `forYou`, `explore`. LinkedIn: `feed`, `videos`, `news` (padrão) + `messages`. Só entram coisas que o site realmente tem; para um recurso novo: adicionar em `FEATURE_DEFS`, rótulo em `i18n/pt-BR.ts` (`featureLabel`), regra em `core/sites.ts`/`selectors.ts`.
- Os content scripts leem a chave `policy` e usam `restrictionFor(policy, kind, domains)` → `{ features }` (null se a política não restringe o serviço agora). Decisões por URL são puras (`instagramDecision`, `xDecision`, `linkedinDecision`, `youtubeDecision`) e testadas.
- **LinkedIn é padrão** nos ambientes de exemplo (restrito em Estudo e Trabalho profundo; bloqueado em Noite). Migração de schema v2 acrescenta o LinkedIn aos exemplos já salvos. LinkedIn: o feed é só `/feed` (publicações `/feed/update/…` abrem) e, sem feed, o início leva a `/messaging/`. **Seletores de CSS do LinkedIn (notícias etc.) não foram validados** (exige login); o bloqueio por URL é o confiável.

## Instagram e X (`core/sites.ts`, `content/instagram.iife.ts`, `content/x.iife.ts`)
- (Esta seção descreve a primeira versão "só mensagens"; o comportamento atual é por recursos, acima. O padrão do Instagram agora **libera** mensagens, perfis e publicações e esconde feed, Reels, Explorar e Stories.)
- **Instagram "só mensagens"**: decisão pura por caminho (`instagramDecision`): `/direct…` e o necessário para login passam; `/` vai para `/direct/inbox/`; todo o resto (Reels, Explorar, feed, perfis, stories) vai para `blocked/…?why=dm-only`. Atalhos de Reels/Explorar no menu são escondidos por CSS. SPA: `content/navigation.ts` (`onNavigate`) combina Navigation API, popstate e checagem a cada 500 ms.
- **X sem "Para você"**: o script acha as abas por `[data-testid=primaryColumn] [role=tablist] [role=tab]` + texto (`classifyXTab`: en/pt/es), esconde "Para você" (atributo `data-pavio-x`) e, se ela estiver selecionada, clica em "Seguindo". Ao fim da sessão desfaz tudo. Vale para `x.com`/`twitter.com` (regra restrita tipo `x`).
- **Validação:** a lógica foi testada (unitário + script compilado numa página que imita a estrutura do X). **Os seletores do DOM real do Instagram e do X NÃO foram validados** (exigem login). Se algo falhar, ajuste `selectors.ts` (`instagram`, `x`). Textos de aba em outros idiomas entram em `x.forYouLabels`/`followingLabels`.
- Timer (`setTimeout`), não `requestAnimationFrame`, nos content scripts: rAF pausa em aba oculta.

## Modo intenção (`core/intent-service.ts`, `ui/intent/`)
- Vale para sites `restricted` com tipo `intent` (Reddit, TikTok, Facebook e sites adicionados). YouTube/Instagram/X têm o próprio tratamento.
- Sem `scripting` e sem content script: o DNR redireciona o site (prioridade 2, `main_frame`) para `intent/index.html?site=…` com um `redirect.url` **simples, igual ao do bloqueio**. (A primeira versão usava `regexSubstitution` para carregar a URL original; foi trocada porque esse redirect para página da extensão não é garantido no Chrome e, se falhasse em silêncio, o site abriria sem perguntar.) Consequência: depois de responder, abre-se a **página inicial do site**; só as abas que já estavam abertas ao iniciar a sessão voltam à URL em que estavam (`next`, codificada). Ao responder ("o que vai fazer" + minutos), `IntentService.grant` grava a permissão, o background remove a regra daquele site e a página navega (só para o mesmo domínio).
- Diagnóstico: no console do service worker, `await __pavio.state()` mostra a sessão, as permissões de intenção, o plano esperado e as regras de rede realmente ativas. Erros ao aplicar regras vão para o console (`[Pavio] falhou ao sincronizar`).
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

## Rotina por site e horário (`core/routine.ts`, `core/policy.ts`, `core/policy-service.ts`, `ui/options/RoutineTab.tsx`)
- **Rotina** = lista de sites (`RoutineSite`), cada um com **faixas** (`RoutineSlot`: dias da semana + `startMin`/`endMin` + o que fazer: `blocked` ou `restricted` com `restrictedKind`/`features`). Fora das faixas o site fica liberado. `endMin <= startMin` vira a noite; `endMin = 1440` = até o fim do dia; **dia todo + todos os dias = "para sempre"**. Funciona **sozinha, sem vela**, e substitui as antigas "faixas de horário" (migração v3 converte as faixas existentes; quem não tinha recebe a programação pronta).
- **Rotina LIMPA por padrão** (`defaultRoutine() = []`): nada vem bloqueado nem programado; a pessoa escolhe sites, horários e o que fazer. (A v3 instalava uma "programação pronta" desligada; a migração **v4** limpa quem ficou com ela sem alterar e liga os horários; quem personalizou não é tocado.) `Settings.routineEnabled` vem **ligado** (rotina vazia não faz nada) e controla só as **faixas de horário**. Uma faixa nova **não vem com Bloqueado/Restrito pré-escolhido**: o editor exige escolher (`mode:invalid`). Na primeira instalação o service worker abre `options#rotina`.
- **Bloqueio rápido** (`RoutineSite.blockAll`, `setBlockAll`/`isBlockedAll` em `core/routine.ts`): bloqueia o **app inteiro, o tempo todo, com um clique**. Painel no topo da Rotina (um botão por app + "Bloquear/Liberar todos" + campo para outro site) (o atalho que existiu no popup foi removido: o popup é só do Timer). **Vale mesmo com os horários desligados** (é uma ação direta); desligar o site na rotina o libera. Em `activeRules`/`rulesAnyTime` entra como `blocked` (a mais rigorosa) e a linha do site vira uma barra cheia "Bloqueado o tempo todo". Pede o acesso ao site no clique e a confirmação ao liberar (`loosensNow`).
- **Timer = foco extra:** a vela (sessão) com um **Ambiente** continua existindo; as regras do ambiente valem **por cima** da rotina durante o Timer. Ambientes agora servem só ao Timer (aba "Ambientes (Timer)").
- **Política** (`Policy`, chave `policy`): `computePolicy({routine, routineEnabled, session, now})` = regras da rotina ativas agora + regras do Timer (se `enforcing`), por site **vale a mais rigorosa** (`combineSpecs`: bloqueado > esconder partes (soma os recursos) > intenção). Na pausa do Pomodoro some só a parte do Timer; a rotina continua firme. Também traz `youtubeAllowlist` (da vela) e `nextChange` (para "volta a liberar às…").
- **Quem escreve/quem lê:** `PolicyService.sync()` (idempotente) conclui a vela vencida, calcula e grava a política (só se mudou), descarta permissões de intenção que não valem mais (`IntentService.prune`) e agenda o alarme `routine-boundary` para a próxima virada de faixa. Bloqueio (DNR, `planFor(policy)`) e **content scripts** só **leem `policy`** (`restrictionFor(policy, …)`, `youtubeRestriction(policy)`), nunca a sessão.
- Background (`syncAll`): ao acordar, nos alarmes `session-end`/`pomodoro-phase`/`routine-boundary` e em mudanças de `activeSession`, `routine` ou do interruptor `routineEnabled`.
- **Editar a rotina com regra ativa:** `loosensNow(antes, depois, agora)` detecta mudança que afrouxa o que protege **agora** (apagar/desligar site ou faixa, mudar horário, bloqueado→esconder partes, esconder menos partes); a UI pede `confirm()` (decisão do dono: confirmação simples).
- UI da Rotina: barra de 24 h por site (um dia por vez, abas Seg…Dom), faixas coloridas por tipo (bloqueado/restrito), linha do "agora"; clicar numa faixa edita, clicar num espaço vazio cria uma de 2 h; atalhos de horário (`SLOT_PRESETS`); `RestrictionPicker` escolhe o que fazer (recursos escondidos). Permissão de host opcional é pedida ao ligar/salvar (`rulesAnyTime` = tratamento mais rigoroso de cada site em qualquer faixa).
- **Ajuste direto na barra** (`RoutineTab`): arrastar a **ponta** de uma faixa muda início/fim, arrastar a **faixa** a move, arrastar no **espaço vazio** desenha uma nova (abre o editor já com o intervalo; o rascunho aparece tracejado). Tudo encaixa de 15 em 15 min (`SNAP_MIN`) e vale para todos os dias da faixa. A lógica é pura e testada em `core/timeslots.ts` (`snapMinute`, `resizeSlot`, `moveSlot`; faixas que viram a noite só mudam pelas pontas: cada pedaço do dia é `head`/`tail`/`whole` em `segmentsForDay`). Gestos usam pointer events com `setPointerCapture` e referências (`dragRef`/`ghostRef`) porque pointermove/up podem chegar antes de nova renderização. Soltar passa por `commit` (confirmação se afrouxa algo ativo). Clique sem arrastar abre o editor, com os campos de hora para ajuste manual e acessível.
- **Faixas que se cruzam** ficam em **pistas empilhadas** dentro da barra (`layoutLanes` em `core/timeslots.ts`, pura e testada: nenhuma cobre outra; a altura da barra cresce com o número de pistas; pistas alternadas têm tom um pouco diferente). Vale sempre a mais rigorosa; há uma legenda de cores acima da barra. **Adicionar várias faixas:** cada site tem um botão **+** visível (abre uma faixa já num horário livre do dia mostrado, `suggestFreeTime`); o editor lista as **faixas do site** como atalhos (+ "Nova faixa"), e tem **Salvar e adicionar outra** e **Duplicar**.
- **Horário por recurso** (`core/routine.ts`: `featureSlotsOf`, `newFeatureSlot`, `retimeFeature`, `dropFeature`): em sites de serviço a seta ▸ expande **uma barra por recurso** (feed, Shorts, recomendados…), cada uma com o seu horário, desenhada e arrastada como a barra principal. O modelo de dados não mudou: a barra de um recurso mostra as faixas restritas do serviço que o incluem; **mexer no horário de um recurso que dividia a faixa com outros o separa numa faixa própria** (mesmos dias) e a original continua igual para os demais; criar numa barra de recurso gera uma faixa que esconde só aquele recurso. Como esconder partes do mesmo serviço soma os recursos, "recomendados o dia todo + feed só das 9h às 18h" são duas faixas simples. Clicar numa faixa abre o editor da faixa inteira.
- A página de bloqueio lê a política: se o site já não está restrito (faixa acabou, pausa), libera sozinha (`blockStillApplies`).

## Pomodoro automático (`core/pomodoro.ts`)
- Opção de qualquer sessão (manual no popup, ou por faixa de horário via `ScheduleBlock.pomodoro`). Alterna **foco** (bloqueios ligados) e **pausa** (bloqueios desligados) sozinho, até o fim da vela; o tempo total da vela corre durante as pausas. Pausa longa opcional a cada N focos (padrão 25/5, longa 15 a cada 4).
- `pomodoroAt(config, startedAt, endsAt, now)` é puro e determinístico (por isso vale mesmo com o navegador fechado). A fase atual fica gravada em `Session.pomodoro` (`phase`, `cycle`, `long`, `phaseEndsAt`).
- `SessionService.syncPomodoro` (chamado em `start`, `startScheduled` e `reconcile`) mantém a fase gravada em dia, notifica a troca ("Hora da pausa" / "De volta ao foco") e agenda o alarme `pomodoro-phase` para a próxima troca. Quem bloqueia/restringe **só lê a política**: `computePolicy` usa `enforcing(session)` (sessão ativa e fora da pausa) para incluir ou não a parte do Timer. Gravar a nova fase dispara `syncAll` via `storage.onChanged`, que regrava a política.
- Na pausa: as regras **do Timer** saem da política (a rotina continua), então DNR e content scripts soltam só o que o Timer acrescentava, a página de bloqueio mostra "Hora da pausa" com botão para abrir o site e a de intenção segue direto. Concedidas permissões de intenção são mantidas.
- Popup: mostra "Foco N · pausa em mm:ss" / "Pausa · mm:ss · bloqueios liberados" (calculado pelo relógio local). Campos compartilhados: `ui/shared/PomodoroFields.tsx`.
- **Popup minimalista (só o Timer):** vela, ambiente, duração (faixa contínua 25/50/90/Outro) e "Acender vela"; modo (foco/leve), Pomodoro e links do YouTube ficam em **"Mais opções"** recolhido; rodapé "Opções · Histórico". Bordas levemente arredondadas (`--r: 8px`, sem pílulas) só no popup. Parado tem ~390 px (limite do Chrome: ~600 px); com Mais opções aberto e tudo ligado passa disso e rola. Sem bloqueio rápido nem status da rotina aqui (isso é da aba Rotina).

## Chrome Web Store (`store/`, `scripts/`)
- `npm run package` → build + `release/pavio-<versão>.zip` (confere se a versão do manifest bate com a do package.json; `release/` está no `.gitignore`). `publicDir: false` no Vite: os ícones vão só em `public/icons/` (referenciados pelo manifest), sem duplicar.
- `store/README.md` é o roteiro: pendências que só o dono resolve (e-mail de contato na política, hospedar `privacy-policy.html`, conta de desenvolvedor, versão 1.0.0), passo a passo de envio, pontos que a revisão pode questionar. `listing.pt-BR.md` (textos), `privacy-practices.md` (justificativa de cada permissão, instruções ao revisor), `privacy-policy.md` → `npm run store:assets` / `node scripts/make-privacy-html.mjs` gera o HTML.
- Capturas 1280×800 e banners em `store/assets/` (JPEG, sem transparência). **Se mudar permissões, content scripts ou o que a extensão guarda/lê, atualize `privacy-practices.md` e `privacy-policy.md` junto** (as justificativas foram escritas a partir do código: sem fetch/XHR/WebSocket/eval, só `chrome.storage.local`).
- Ao incluir novo domínio em `content_scripts`, o aviso de instalação cresce: documentar na justificativa e na descrição.

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
9. ✅ Horários recorrentes por faixas de ambiente (SUBSTITUÍDO pela Rotina por site, item 12)
10. ✅ Pomodoro automático (pausas que desligam os bloqueios)

## Decisões em aberto / assumidas
- "Fora de sessão = confirmação simples" foi interpretado como `strictness: 'light'` (confirmação simples) vs `'focus'` (10s + frase). Confirmar com o dono.
12. ✅ **Rotina por site e horário** (rotina limpa por padrão, bloqueio rápido do app inteiro, política efetiva, Timer como foco extra)
