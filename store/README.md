# Pavio — pacote para a Chrome Web Store

Tudo o que é preciso para enviar a extensão está nesta pasta e no `.zip` gerado por `npm run package`.

## O que tem aqui
| Arquivo | Para quê |
|---|---|
| `release/pavio-0.1.0.zip` (gerado) | O pacote que você envia à loja (`npm run package`) |
| `listing.pt-BR.md` | Nome, resumo, descrição, categoria e legendas (copiar e colar) |
| `listing.en.md` | Versão em inglês (opcional; veja a seção "Inglês") |
| `privacy-practices.md` | Respostas da aba **Práticas de privacidade**: justificativa de cada permissão, código remoto, uso de dados, instruções para o revisor |
| `privacy-policy.md` / `privacy-policy.html` | Política de privacidade (o `.html` é a página para hospedar) |
| `assets/screenshots/*.jpg` | 5 capturas 1280×800 |
| `assets/promo-*.jpg` | Banner pequeno (440×280) e de destaque (1400×560) |

## Antes de enviar: o que só você pode fazer
1. **E-mail de contato.** Troque `[SEU E-MAIL DE CONTATO]` em `privacy-policy.md` e rode `node scripts/make-privacy-html.mjs`. (Deixei em branco de propósito: é um dado seu e vai ficar público.)
2. **Hospedar a política de privacidade** em um endereço público, porque o Painel pede uma URL. A forma mais simples:
   - crie um repositório no GitHub, envie `store/privacy-policy.html` como `index.html`, e ative *Settings → Pages*; a URL será `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
   - Cole essa URL no Painel e no texto da descrição (`[URL DA POLÍTICA]` em `listing.pt-BR.md`).
3. **Conta de desenvolvedor** em <https://chrome.google.com/webstore/devconsole>: tem uma taxa única de cadastro (confirme o valor atual no painel) e exige verificação em duas etapas na conta Google.
4. **Testar no Chrome de verdade** (veja "O que eu não consegui verificar" abaixo) e só então enviar.
5. **Versão:** o `manifest.ts` e o `package.json` estão em `0.1.0`. Para a primeira versão pública, sugiro `1.0.0` (mude nos dois e rode `npm run package`).

## Passo a passo de envio
1. `npm run package` → gera `release/pavio-<versão>.zip` (e confere que a versão do manifest bate com a do `package.json`).
2. Painel do Desenvolvedor → **Novo item** → envie o `.zip`.
3. **Listagem da loja:** cole os textos de `listing.pt-BR.md`; envie o ícone `public/icons/icon-128.png`, as 5 capturas e os 2 banners; categoria *Produtividade*; idioma *Português (Brasil)*; URL da política.
4. **Práticas de privacidade:** use `privacy-practices.md` (finalidade única, cada permissão, código remoto = não, nenhum dado coletado, as 3 certificações, instruções de teste).
5. **Distribuição:** gratuito; países à sua escolha. Para o primeiro envio, considere **Visibilidade: Não listada**: você valida o fluxo pela página da loja antes de abrir ao público (dá para mudar depois).
6. **Enviar para revisão.** A revisão costuma levar de alguns dias a algumas semanas; extensões com acesso amplo a sites (como esta) tendem a ser olhadas com mais atenção.

## Pontos que a revisão pode questionar (e a resposta)
| Ponto | Por que aparece | O que dizer |
|---|---|---|
| `optional_host_permissions: <all_urls>` | Acesso amplo a sites | É **opcional**, nunca pedida na instalação, e pedida por domínio (`*://*.dominio/*`), no clique do usuário, só para redirecionar sites que ele escolheu bloquear. Está em `privacy-practices.md`. |
| Scripts de conteúdo em 5 domínios | Gera o aviso de instalação "ler dados em youtube.com, instagram.com, linkedin.com, x.com, twitter.com" | Só agem durante uma sessão e só nos recursos que o usuário marcou; decidem por URL/CSS; nada sai do navegador. Precisam de `document_start` para não "piscar" o conteúdo escondido. |
| `web_accessible_resources` com `<all_urls>` | Páginas da extensão acessíveis por sites | São só as 2 páginas de destino dos redirecionamentos (vela e intenção); não têm dados do usuário. |
| Nomes de marcas (YouTube, Instagram, X, LinkedIn) | Uso de marca de terceiros | Citados só de forma descritiva; a descrição traz o aviso de que o Pavio é independente e não afiliado. |
| Linguagem sobre saúde | Políticas de conteúdo | A descrição **não** promete tratar TDAH nem tem alegação médica; traz o aviso de que não é dispositivo médico. |

## Se algum seletor de site quebrar depois de publicado
Os sites mudam o HTML. Os seletores ficam em `src/content/selectors.ts`; ajuste, suba a versão, `npm run package` e envie uma atualização (a revisão de atualizações costuma ser mais rápida).

## Inglês (opcional)
A interface do Pavio é em português (Brasil). O texto em `listing.en.md` serve para listar também em inglês, **mas** a loja espera que o idioma da listagem corresponda ao do produto; se for publicar em inglês, o ideal é traduzir a interface antes (hoje os textos estão em `src/ui/i18n/pt-BR.ts` e em alguns componentes). Para localizar o nome/descrição da loja, use `_locales/pt_BR/messages.json` e `_locales/en/messages.json` com `default_locale` no manifest.

## Regenerar as imagens
- Banners: `npm run store:assets` (gera PNG em `store/assets/`; depois converta para JPEG sem transparência: `sips -s format jpeg -s formatOptions 94 arquivo.png --out arquivo.jpg`).
- Capturas: foram geradas com o Chrome em modo headless (1280×800) sobre páginas de demonstração com dados de exemplo. Se a interface mudar, peça para regerar.

## O que eu não consegui verificar
- **A extensão carregada no Chrome real.** Alarmes, notificações, bloqueio por `declarativeNetRequest` e troca de fases do Pomodoro dependem dela. Faça o roteiro de testes de cada etapa antes de enviar.
- **Seletores do Instagram, do X e do LinkedIn** (exigem login). Os do YouTube foram conferidos no site real. O bloqueio por endereço (URL) dos quatro serviços é independente dos seletores.
- **O comportamento exato da revisão da loja** (prazos e critérios mudam).
