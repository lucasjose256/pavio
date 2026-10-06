# Pavio

Extensão Chrome (Manifest V3) de foco para TDAH/procrastinação. Slogan: "Você não controla você, mas pode controlar seu ambiente."
**Tudo local**: sem backend, sem coleta de dados, sem contas, sem rede (não há `fetch`/XHR/WebSocket/`eval` no código).

## Modelo mental (leia primeiro)
O produto tem **duas camadas que se somam**:
1. **Rotina** (o centro): por **site**, **faixas** de dia/hora em que ele fica **bloqueado** ou com **partes escondidas** (feed, Shorts, Reels…), ou **bloqueio rápido** do app inteiro. Funciona **sozinha, sem vela**.
2. **Timer** (foco extra): uma **vela** que queima por X minutos, com um **Ambiente** (perfil de regras por site), fricção para desistir e **Pomodoro** opcional. As regras do ambiente valem **por cima** da rotina durante o timer.

O que vale **agora** é a **Política** = regras da rotina ativas agora + regras do timer (se estiver valendo), por site **vale a mais rigorosa**. Bloqueio de rede e content scripts só leem a Política. O timer **nunca afrouxa nem apaga** a rotina (a pausa do Pomodoro e o fim da vela tiram só a parte do timer). Um terceiro controle por app, o **limite de tempo diário**, também entra na política como bloqueio (veja a seção própria).

## Convenções e comandos
- Interface em pt-BR (textos compartilhados em `src/ui/i18n/pt-BR.ts`; os das telas grandes ficam nos componentes). Código, nomes e valores de enum em inglês.
- Visual: aconchegante, calmo, minimalista; a vela é a protagonista. **Tema creme é o padrão**; **noite** (escuro quente) nas opções. Nunca use cores fixas: use tokens de `src/ui/theme.css`.
- `npm test` (Vitest), `npm run typecheck`, `npm run lint`, `npm run build` (gera `dist/`), `npm run dev`, `npm run icons`, `npm run package` (zip da loja), `npm run store:assets`.
- Uma entrega = um commit pequeno e testável; ao mexer em comportamento, atualize testes e este arquivo.

## Arquitetura (decisão central: domínio separado do Chrome)
- `src/core/`: lógica **pura** (modelos, rotina, política, sessão, pomodoro, fricção, migrações, repositórios). **Proibido** importar `chrome.*`, DOM, Preact, `platform/` ou `ui/` (ESLint reforça). Será reaproveitado no app macOS.
- `src/core/ports.ts`: interfaces (`StoragePort`, `Clock`, `SchedulerPort`, `NotifierPort`, `BlockerPort`). `src/platform/chrome/` implementa; testes usam `MemoryStorage` e fakes.
- `src/background/service-worker.ts`: orquestra. `src/content/`: scripts por site. `src/ui/`: popup, opções, bloqueio, intenção, fricção.
- Stack: Vite + `@crxjs/vite-plugin` (manifest tipado em `manifest.ts`), TypeScript strict, Preact, CSS puro com variáveis, Vitest.

### Fluxo de dados (quem escreve / quem lê)
- UI só **grava** no storage (`routine`, `settings`, `activeSession`, `environments`, `intents`). Reações vêm do **background** via `chrome.storage.onChanged`.
- **`syncAll()`** (background, serializado numa fila): `PolicyService.sync()` → `syncBlocking()`. Roda ao acordar, nos alarmes `session-end` / `pomodoro-phase` / `routine-boundary` e quando mudam `activeSession`, `routine` ou o interruptor `routineEnabled`. Mudou só `intents` → só `syncBlocking()`.
- `PolicyService.sync()` (idempotente): conclui a vela vencida (`SessionService.reconcile`), calcula a Política, grava só se mudou, descarta permissões de intenção que não valem mais (`IntentService.prune`) e agenda `routine-boundary` para a próxima virada de faixa.
- **Content scripts e DNR leem só a chave `policy`** (`restrictionFor(policy, …)`, `youtubeRestriction(policy)`, `planFor(policy)`), nunca a sessão nem a rotina.
- Diagnóstico: no console do service worker, `await __pavio.state()` mostra política, permissões de intenção, plano esperado e as regras de rede **realmente** ativas. Erros de sincronização vão para o console (`[Pavio] falhou ao sincronizar`).

## Modelo de dados (`src/core/models.ts`)
- `Rule { domain, mode: allowed|blocked|restricted, restrictedKind?: youtube|instagram|x|linkedin|intent, features? }`; `Environment { rules }` (perfil do Timer; 3 de exemplo em `environments.ts`).
- `RoutineSite { domain, enabled, slots: RoutineSlot[], blockAll?, limitMin? }`; `RoutineSlot { days, startMin, endMin, mode, restrictedKind?, features? }` (0 = domingo; `endMin <= startMin` vira a noite; `endMin = 1440` = fim do dia; dia todo + todos os dias = "para sempre").
- `Session` (guarda `environmentSnapshot` congelado, `endsAt` absoluto, `strictness: light|focus`, `youtubeAllowlist`, `pomodoro?`), `HistoryEntry`, `IntentGrant`, `Settings { candleSkin, theme, routineEnabled }`, `Policy { rules, youtubeAllowlist, nextChange?, routineActive, timerActive, limitReached? }`.
- Sites sem regra = liberados. Tempo: `endsAt` é a fonte da verdade (nunca contador). Editar ambiente durante o timer não o afeta (snapshot).
- **Storage** (`chrome.storage.local`, chaves em `KEYS`): `schemaVersion`, `environments`, `settings`, `activeSession`, `history` (máx. 1000), `intents`, `routine`, `policy` (derivada), `usage` (tempo de uso por dia e app, só dos apps com limite, últimos 90 dias). Formato mudou? Suba `CURRENT_SCHEMA_VERSION` (hoje **4**) e adicione passo em `core/migrations.ts`: v1 semeia ambientes/configurações; v2 acrescenta LinkedIn aos exemplos; v3 cria a rotina (converte as antigas "faixas de horário" por ambiente, ligadas); v4 limpa a antiga "programação pronta" **se nunca foi alterada** e liga os horários.

## Rotina (`core/routine.ts`, `core/timeslots.ts`, `core/routine-defaults.ts`, `ui/options/RoutineTab.tsx`)
- **Rotina LIMPA por padrão** (`defaultRoutine() = []`): nada vem bloqueado nem programado. `Settings.routineEnabled` vem **ligado** e controla só as **faixas** ("Horários ligados/desligados"). Faixa nova **não vem com Bloqueado/Restrito pré-escolhido** (o editor exige escolher; erro `mode:invalid`).
- **Bloqueio rápido** (`RoutineSite.blockAll`, `setBlockAll`/`isBlockedAll`): bloqueia o **app inteiro, sempre**, com um clique. Painel no topo da Rotina (botão por app, "Bloquear/Liberar todos", campo para outro site). **Vale mesmo com os horários desligados** (ação direta); desligar o site na rotina o libera. Entra como `blocked` em `activeRules`/`rulesAnyTime`; a linha vira barra cheia.
- Funções puras testadas: `activeRules(routine, enabled, now)`, `nextBoundary`, `mergeRules`, `rulesAnyTime` (tratamento mais rigoroso em qualquer faixa, para pedir permissões), `loosensNow`, `validateSite`.
- **Confirmação ao afrouxar:** `loosensNow(antes, depois, agora)` detecta o que **protege agora** e vai ser afrouxado (apagar/desligar site ou faixa, mudar horário, bloqueado→esconder partes, esconder menos partes, liberar bloqueio rápido); a UI pede `confirm()` (decisão do dono: confirmação simples). Adicionar/endurecer não pede.
- **Tela da Rotina:** barra de 24 h por site (um dia por vez, abas Seg…Dom), cores vivas por tipo (vermelho bloqueado / âmbar restrito) com legenda, linha do "agora".
  - **Gestos na barra** (pointer events + `setPointerCapture`; estado também em refs `dragRef`/`ghostRef`): arrastar **ponta** = início/fim; arrastar **faixa** = mover; arrastar no **vazio** = criar (abre o editor com o intervalo; rascunho tracejado). Encaixe de 15 min (`SNAP_MIN`); vale para todos os dias da faixa; faixas que viram a noite só mudam pelas pontas (`segmentsForDay` marca `head`/`tail`/`whole`). Clique sem arrastar abre o editor (com campos de hora; também por teclado).
  - **Faixas que se cruzam** ficam em **pistas empilhadas** (`layoutLanes`); vale a mais rigorosa.
  - **Várias faixas:** botão **+** em cada site (abre num horário livre, `suggestFreeTime`), editor lista as **faixas do site**, "Salvar e adicionar outra", "Duplicar".
  - **Horário por recurso:** seta ▸ em YouTube/Instagram/X/LinkedIn expande **uma barra por recurso**. O modelo não muda: mexer no horário de um recurso que dividia a faixa com outros o **separa numa faixa própria** (`retimeFeature`); criar numa barra de recurso gera faixa só dele (`newFeatureSlot`). Esconder partes do mesmo serviço soma recursos ("recomendados o dia todo + feed só 9h–18h" = duas faixas).
- Permissão de host opcional é pedida no clique de salvar/ligar/bloquear (`accessDomains`).

## Limite de tempo por app (`core/usage.ts`, `core/usage-service.ts`, `platform/chrome/usage-tracker.ts`) 
- **Decisões do dono:** limite **diário por app** (`RoutineSite.limitMin`), contando só **aba ativa e em foco**; ao estourar o app fica **bloqueado até a meia-noite** e há **"mais 5 min" que passa pela fricção** de desistir (espera + frase). Fora da v1: limite por dia da semana, por recurso (ex.: só o feed) e semanal.
- É um conceito **separado** do bloqueio rápido (cota que acumula e zera por dia vs. liga/desliga), mas usa o mesmo `RoutineSite`. **Vale mesmo com os horários desligados** (controle direto) e some se o app for desligado na rotina.
- Puro e testado: `UsageData` (por dia local → `ms` por app + `extraMin`), `addUsage`, `limitReached`, `remainingMsFor`, `extendLimit` (vale só no dia), `limitedSiteFor` (subdomínio; o mais específico vence), `limitRules` (apps que estouraram viram `blocked`, id `limit:<domínio>`), `limitStatuses` (para a tela), `pruneUsage`, `nextMidnight`.
- `computePolicy({ …, usage })` junta `limitRules` às regras (a mais rigorosa vence; **a pausa do Pomodoro não libera**), preenche `Policy.limitReached` e põe a meia-noite em `nextChange`; `PolicyService` agenda o alarme da virada. `loosensNow(…, usage)` trata tirar/subir o limite de um app que já estourou como **afrouxar** (pede confirmação).
- `UsageService.record(host, elapsedMs)`: soma o tempo de uma medição (limita a 2 intervalos se o alarme atrasou), ignora host nulo/sem limite e devolve `crossed` **uma vez**, no minuto do estouro; `extend(domain, 5)` e `statuses()`. A mudança da chave `usage` (inclusive "mais 5 min" vindo da UI) faz o background recalcular a política.
- **Medição no Chrome (passo 2, feito):** alarme periódico `usage-tick` (1 min, `platform/chrome/usage-tracker.ts`), **ligado só se algum app ativo tem limite** (`setTracking`, chamado no fim do `syncAll`). A cada tick `observeHost()` junta `chrome.idle.queryState(60)`, `windows.getLastFocused().focused` e a aba ativa da janela em foco, e `trackableHost` (puro) decide o host (só http(s), computador em uso, janela em foco). O endereço da aba só é visível para sites com acesso concedido, então **não precisa de `tabs`**; por isso `rulesAnyTime` inclui apps com limite (o acesso é pedido junto, como para bloqueados). Nova permissão **`idle`** (sem aviso de instalação, confirmado na tabela oficial). `usageService.record` grava em `usage`; o `storage.onChanged` dispara `syncAll`, que bloqueia ao estourar (as abas abertas do app são levadas à página de bloqueio pelo `ChromeBlocker`). Contagem aproximada (±1 min). `__pavio.state()` mostra o uso (`usage`).
- **Loja:** `privacy-practices.md` e `privacy-policy.md` já citam `idle` e o dado novo (minutos por app e dia, local; sem endereços).
- **Telas (passo 3, feito):** cartão "Limite de tempo" na Rotina (medidor + campo; `setLimit` puro; passa por `commit()` com `loosensNow(…, usage)`); página de bloqueio mostra "Você chegou ao limite de hoje" quando `policy.limitReached` cobre o site, com botão "Mais 5 min" que abre `friction/index.html?extend=<domínio>` (`frictionForExtension`: espera 10 s + frase `EXTEND_PHRASE`; confere o limite de novo e chama `usageService.extend`; não encerra a vela); Histórico lista o uso por app (`usageByApp`, 7 dias) e "Apagar histórico" também limpa o uso; passo 7 nas instruções do revisor. **Não verificado no Chrome real:** o ciclo medição → estouro → bloqueio → "mais 5 min".

## Política (`core/policy.ts`, `core/policy-service.ts`)
- `computePolicy({ routine, routineEnabled, session, now })`: regras da rotina ativas + regras do ambiente do timer (só se `enforcing(session)`: ativa e fora da pausa). Por domínio, `combineSpecs` (`core/restrictions.ts`): **bloqueado > esconder partes (une os recursos) > intenção > liberado**. O timer não libera o que a rotina restringe, nem com regra "liberado" no ambiente.
- `youtubeAllowlist` vem só do timer; `nextChange` = próxima virada (faixa, fim da vela, fim da fase) para "volta a liberar às…".
- `blockStillApplies(policy, site, veioDeRecurso)`: a página de bloqueio que ficou aberta se libera sozinha quando a política já não restringe o site.

## Timer: sessão, Pomodoro e fricção
- `SessionService` (`start` / `reconcile` / `abandon` / `recordBlockedAttempt`). `reconcile()` é idempotente: se `now >= endsAt` grava histórico (concluída = tempo planejado inteiro), limpa, cancela alarmes e notifica; senão reagenda (alarmes se perdem ao reiniciar o navegador) e mantém o Pomodoro em dia.
- **Pomodoro** (`core/pomodoro.ts`): foco/pausa automáticos dentro da sessão; o tempo da vela corre nas pausas; pausa longa opcional (padrão 25/5, longa 15 a cada 4). `pomodoroAt` é puro e determinístico (vale com o navegador fechado); a fase atual fica em `Session.pomodoro`; `syncPomodoro` notifica a troca e agenda `pomodoro-phase`. **Na pausa só a parte do timer sai da política; a rotina continua firme** (testado: pausa/fim da vela nunca sobrescrevem a rotina).
- **Fricção** (`core/friction.ts`, aba `ui/friction/`): passos `confirm` / `wait` / `typePhrase` / `challenge` (reservado). `light` = confirmar; `focus` = 10 s + digitar "eu quero desistir do meu foco agora" (tolera caixa/acentos; **colar é bloqueado de propósito**). Só essa aba chama `abandon()` (o popup fecha ao perder o foco).

## Bloqueio de rede (`core/blocking.ts`, `platform/chrome/blocking.ts`)
- `planFor(policy)` → `BlockPlan { block, intent, allow }`: só `blocked` e `restricted/intent` viram regra; `restricted` de serviço passa (content scripts). Subdomínio não bloqueado de domínio bloqueado vira exceção `allow`.
- `ChromeBlocker.apply`: regras dinâmicas `main_frame` com `redirect.url` **simples** para `blocked/…` ou `intent/…` (ids: bloqueio 1.., intenção 500.., exceção 1000..; prioridades 1/2/3), idempotente; ao bloquear domínio novo, leva as abas abertas (`tabs.query` por padrão de host, sem permissão `tabs`).
- **Armadilha de build:** páginas só acessíveis por redirect/`chrome.tabs.create` (bloqueio, intenção, fricção) são **entradas explícitas** em `vite.config.ts` (`build.rollupOptions.input`); senão o CRXJS copia o HTML sem compilar (página em branco). Confira que `dist/.../index.html` aponta para `/assets/...`. `publicDir: false`: ícones só em `public/icons/`.
- Páginas de bloqueio contam a tentativa (`blockedAttempts`).

## Recursos por serviço e content scripts
- `core/restrictions.ts` (`FEATURE_DEFS`): o que dá para **esconder** em cada serviço (só o que o site realmente tem). YouTube: `home`, `shorts`, `related`, `comments`. Instagram: `feed`, `reels`, `explore`, `stories` (padrão) + `messages`, `posts`. X: `forYou`, `explore`. LinkedIn: `feed`, `videos`, `news` (padrão) + `messages`. Regra sem lista = padrão do serviço (`defaultFeatures`). Recurso novo: `FEATURE_DEFS` + rótulo em `featureLabel` + regra em `core/sites.ts`/`selectors.ts`.
- Decisões por URL **puras e testadas** (`core/sites.ts`: `instagramDecision`, `xDecision`, `linkedinDecision`; `core/youtube.ts`: `youtubeDecision`). Todos os **seletores de sites** vivem em `src/content/selectors.ts` (mudam com frequência; CSS gerado por recurso).
- Content scripts (`*.iife.ts`, `document_start`) leem `policy`, aplicam CSS por recurso, redirecionam para `blocked/…?why=…` e reagem a `storage.onChanged`; SPAs via `content/navigation.ts` (`onNavigate`). **Sufixo `.iife.ts` é obrigatório** (senão o CRXJS usa loader assíncrono e o feed pisca). Use timers, não `requestAnimationFrame` (pausa em aba oculta).
- **YouTube:** sem lista = só os recursos escondidos; com lista (do timer) = só links/playlists/canais colados (`check-channel` confere os links do dono no DOM esperando o `video-id`). Seletores **validados no YouTube real (2026-10-05)**.
- **Instagram:** início = feed (vai à caixa de mensagens ou à vela); mensagens, perfis e publicações **liberados por padrão**; "posts" é o modo rígido. **X:** acha abas por `role=tab` + texto (`classifyXTab`, en/pt/es), esconde "Para você" e troca para "Seguindo". **LinkedIn:** feed é só `/feed` (`/feed/update/…` abre); sem feed o início vai a `/messaging/`.
- **Não validados no DOM real** (exigem login): seletores de Instagram, X e LinkedIn (CSS de notícias etc.). O bloqueio por URL é o confiável; ajuste `selectors.ts` se algo vazar.

## Modo intenção (`core/intent-service.ts`, `ui/intent/`)
- Vale para `restricted` do tipo `intent` (Reddit, TikTok, Facebook e sites adicionados). O DNR redireciona (`redirect.url` simples) para `intent/index.html?site=…`; ao responder ("o que vai fazer" + minutos) `IntentService.grant` grava a permissão, o background remove a regra do site e a página abre a **página inicial** do site (só abas já abertas voltam à URL, via `next` codificada). **Não use `regexSubstitution`** para isso (não garantido no Chrome; se falhasse, o site abriria sem perguntar).
- Fim do tempo: alarme `intent:<domínio>` → notificação "Ainda está na tarefa?" (mais 5 min / já terminei). Permissões somem quando o site deixa de estar em intenção (`prune`).
- **Status:** corrigido, mas **ainda sem confirmação de teste no Chrome real**.

## Interface
- **Vela** (`ui/candle/`): `<Candle progress skin lit />`; cera e chama descem juntas; skins `{ id, name, flame, Body }` em `skins/`: Clássica, Minimalista, Pote de vidro (`jar`: a cera desce dentro do pote), Cera de abelha (`honey`, favos), Lavanda (raminho no pires), Noite estrelada (`starry`). As de pilar cartoon usam `skins/pillar.tsx` (`PillarBody` + `decor` que desce com a cera e `saucerDecor` parado). Skin nova: arquivo em `skins/` + registro em `skins/index.ts` (id desconhecido cai na Clássica); geometria e ids testados. Ícone: `public/icons/icon.svg` → `npm run icons`.
- **Tema:** tokens para `creme`/`noite` (`data-theme`); `Settings.theme`; `ui/shared/theme.ts` (`initTheme` em cada página, cache em localStorage). Tipografia: `--font-display` (serifa) e `--font-body`. Cores dos tipos de regra: `--mode-allowed|blocked|restricted` (vivas; texto escuro sobre âmbar).
- **Popup (só o Timer, minimalista):** vela, ambiente, duração (25/50/90/Outro) e "Acender vela"; modo, Pomodoro e links do YouTube em **"Mais opções"** recolhido; rodapé "Opções · Histórico"; bordas de 8 px (`--r`), sem pílulas. Parado ~390 px (limite do Chrome ~600 px; com tudo aberto rola). Sem bloqueio rápido nem status da rotina aqui.
- **Opções** (`ui/options/App.tsx`): menu lateral (no celular vira fileira que rola). No topo, o **cartão do Timer** em destaque (vela acesa; com sessão mostra tempo e ambiente) leva a `#ambientes` (abertura "Timer: um foco a mais" com 3 passos + cartões e editor de ambientes). Grupo **Bloqueios**: `#rotina` Horários (padrão), `#bloqueio` Bloqueio rápido, `#limite` Limite de tempo — as três são o **mesmo `RoutineTab`** com `view` (`schedule|quick|limits`), dividindo estado e `commit()`. Grupo **Você**: `#historico` (horas devolvidas, 7 dias, sessões, tempo por app, exportar/apagar; `core/history.ts`) e `#aparencia` "Vela e tema" (vela primeiro, depois o tema). Ícones de traço em `options/icons.tsx`. Todas as seções ficam montadas (trocar não perde edição). Na primeira instalação o service worker abre `#rotina`.
- Páginas auxiliares: `blocked/` (vela grande, frase, tempo; libera sozinha), `intent/`, `friction/`.

## Permissões (justificar cada uma na Web Store)
`storage`, `alarms` (fim da vela, virada de faixa, fases do Pomodoro, intenção e a medição de 1 min do limite de tempo, com o service worker suspenso), `notifications`, `declarativeNetRequest`, `idle` (não contar tempo com o computador parado); **`optional_host_permissions: <all_urls>`** (pedida por domínio, `*://*.dominio/*`, no clique do usuário, só para o redirect); **content scripts** em `youtube.com`, `instagram.com`, `linkedin.com`, `x.com`/`twitter.com` (geram o aviso de instalação). Evitar: `tabs`, `history`, `webNavigation`, `scripting`, `<all_urls>` obrigatório.

## Chrome Web Store (`store/`, `scripts/`)
- `npm run package` → build + `release/pavio-<versão>.zip` (confere versão manifest = package.json; `release/` no `.gitignore`).
- `store/README.md` é o roteiro (pendências do dono: e-mail de contato na política, hospedar `privacy-policy.html`, conta de desenvolvedor, versão 1.0.0; riscos de revisão). `listing.pt-BR.md`, `privacy-practices.md` (justificativas e instruções ao revisor), `privacy-policy.md` → `node scripts/make-privacy-html.mjs`. Capturas 1280×800 e banners em `store/assets/` (JPEG sem transparência).
- **Se mudar permissões, content scripts ou o que a extensão guarda/lê, atualize `privacy-practices.md` e `privacy-policy.md` junto.**

## Como verificar sem o Chrome real (e o que ainda não foi)
- Lógica: `npm test` (24 arquivos, ~210 testes). Telas: `npm run harness` → `http://localhost:5199/harness/options.html` (`chrome` simulado em memória com dados de exemplo em `harness/mock.ts`; `?theme=night`, `?skin=jar`, `?running=1`, hash = seção) no navegador do app ou Chrome headless (`--screenshot`, 1280×800; o headless não encolhe abaixo de ~500 px, use o navegador do app para celular).
- O Chrome estável não carrega extensões por linha de comando: **alarmes, notificações, DNR, content scripts e troca de fases do Pomodoro só se confirmam com a extensão carregada** (`chrome://extensions` › Carregar sem compactação › `dist/`). Pendente de confirmação real: modo intenção, rotina nos horários, seletores de Instagram/X/LinkedIn.

## Decisões do dono (histórico)
- Tema **creme por padrão** (o briefing original dizia escuro). Ambientes **só para o Timer**; a **Rotina** substituiu as "faixas de horário por ambiente". Rotina **limpa** por padrão e faixa nova sem tipo pré-escolhido; **bloqueio rápido** do app inteiro. **Confirmação simples** ao afrouxar regra ativa. Popup **minimalista**. Pausa do Pomodoro **não** libera a rotina. Instagram: mensagens/perfis liberados por padrão.

## Fora de escopo / em aberto
- Fora: desafios (arquitetura de fricção já aceita passos `challenge`), compartilhamento, loja de skins, Safari/Firefox, app macOS, contas, backend.
- Em aberto: aviso opcional (notificação) na virada de cada faixa da rotina; ajuste de um único dia de uma faixa multi-dia (hoje vale para todos os dias dela); mostrar no popup, na pausa, o que a rotina ainda bloqueia.
