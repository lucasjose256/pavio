# Pavio

Extensão Chrome (MV3) de foco para TDAH/procrastinação. Slogan: "Você não controla você, mas pode controlar seu ambiente."
Conceito: **ambientes** (perfis com regra por site: liberado/bloqueado/restrito), **sessões** com uma **vela** que queima, e **fricção progressiva** para desistir.
Tudo local: sem backend, sem coleta de dados, sem contas.

## Convenções
- Interface em pt-BR (textos em `src/ui/i18n/pt-BR.ts`); código, nomes e valores de enum em inglês.
- Visual: calmo, escuro por padrão, minimalista; a vela é a protagonista.
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

## Storage (`chrome.storage.local`)
Chaves em `KEYS` (`repositories.ts`): `schemaVersion`, `environments`, `settings`, `activeSession`, `history` (máx. 1000).
Mudou o formato? Suba `CURRENT_SCHEMA_VERSION` e adicione um passo em `core/migrations.ts`.
Estado do modo intenção irá em `chrome.storage.session`.

## Permissões (peça só o necessário; justificar cada uma na Web Store)
| Permissão | Motivo | Status |
|---|---|---|
| `storage` | Ambientes, sessão ativa, histórico, tudo local | ✅ etapa 1 |
| `alarms` | Fim da sessão e aviso do modo intenção com service worker suspenso | planejada (etapa 3) |
| `notifications` | Avisar que a vela acabou | planejada (etapa 3) |
| `declarativeNetRequest` | Bloquear/redirecionar sites sem ler conteúdo | planejada (etapa 4) |
| `host_permissions` youtube/instagram/x | Content scripts do modo restrito | planejada (etapas 6-7) |
| `optional_host_permissions: <all_urls>` | Redirect do DNR exige acesso ao host; pedido por site, no clique do usuário, ao adicionar na página de opções | planejada (etapa 2/4) |
Evitar: `tabs`, `history`, `webNavigation`, `<all_urls>` obrigatório.

## Fora da V1
Agenda recorrente, desafios, compartilhamento, loja de skins, Safari/Firefox, app macOS, contas, backend.

## Roadmap (uma etapa = um commit)
1. ✅ Modelos + storage (+ testes do core)
2. Página de opções (ambientes/regras, sugestões, permissão por site)
3. Sessão + timer + vela no popup
4. Bloqueio (DNR) + página de bloqueio
5. Página de fricção
6. Modo restrito do YouTube (+ allowlist)
7. Instagram (só DMs) e X (sem "Para você")
8. Histórico
Modo intenção ("o que você vai fazer aqui?") entra junto com o modo restrito (etapa 6).

## Decisões em aberto / assumidas
- "Fora de sessão = confirmação simples" foi interpretado como `strictness: 'light'` (confirmação simples) vs `'focus'` (10s + frase). Confirmar com o dono.
