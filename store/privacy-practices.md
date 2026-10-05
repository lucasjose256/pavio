# Aba "Práticas de privacidade" — respostas prontas

Textos para colar no Painel do Desenvolvedor → **Práticas de privacidade**. As justificativas foram escritas a partir do que o código realmente faz (conferido em 2026-10-05: não há `fetch`, `XMLHttpRequest`, `WebSocket`, `eval` nem código remoto no projeto; as únicas APIs do Chrome usadas estão listadas abaixo).

## Finalidade única
```
Ajudar o usuário a manter o foco: ele monta ambientes e horários com regras por site, e o Pavio bloqueia ou limita os sites que distraem durante sessões de foco, usando uma vela como timer.
```

## Justificativa de cada permissão

### `storage`
```
Guarda, no próprio navegador, a rotina e os ambientes do usuário (regras por site e horário), a sessão em andamento, as configurações e o histórico local de sessões. Nenhum desses dados sai do dispositivo.
```

### `alarms`
```
Precisa disparar eventos no horário certo mesmo com o service worker suspenso: o fim da vela (sessão), o início e o fim das faixas da rotina (para ligar e desligar os bloqueios na hora marcada), a troca de fase do Pomodoro (foco/pausa) e o fim do tempo declarado no modo intenção.
```

### `notifications`
```
Mostra avisos locais ao usuário: "a vela acabou", "hora da pausa / de volta ao foco" e "ainda está na tarefa?". Não exibe anúncios nem conteúdo promocional.
```

### `declarativeNetRequest`
```
Redireciona a navegação principal (main_frame) dos sites que o usuário escolheu bloquear para uma página do próprio Pavio (a vela). As regras são dinâmicas e valem apenas nos dias e horários que o próprio usuário definiu na sua rotina, ou enquanto uma vela (timer) está acesa; são removidas ao fim da faixa, do timer ou na pausa do Pomodoro. A API declarativa é usada justamente para que o Pavio não precise ler o conteúdo das páginas.
```

### Permissão de host opcional (`optional_host_permissions: <all_urls>`)
```
O redirecionamento do declarativeNetRequest exige acesso ao site de destino, e o Pavio não sabe de antemão quais sites o usuário vai bloquear. Por isso a permissão é OPCIONAL: nunca é pedida na instalação. Quando o usuário adiciona um site a um ambiente (ou acende uma vela com ele), o Pavio pede acesso apenas àquele domínio (padrão *://*.dominio/*), a partir de um clique. Ela serve só para redirecionar essas páginas; o Pavio não lê, não armazena nem transmite o conteúdo delas.
```

### Scripts de conteúdo — acesso a `youtube.com`, `instagram.com`, `linkedin.com`, `x.com` e `twitter.com`
```
Executam apenas no navegador do usuário e só agem nos horários em que a rotina do usuário (ou o timer) trata esse serviço como "restrito". Escondem, por CSS, as partes que o usuário marcou (ex.: feed, Shorts, Reels, recomendados, comentários, aba "Para você") e redirecionam páginas específicas (ex.: /shorts, /reels, /explore) para a vela, decidindo apenas pelo caminho (URL). No YouTube, com uma lista de links permitidos, o script compara o link do canal do vídeo aberto com os canais permitidos; no X, lê apenas os rótulos das abas para esconder "Para você". Eles não leem mensagens, publicações, perfis nem dados pessoais, e não enviam nada para fora. Precisam rodar no início da página (document_start) para o conteúdo escondido não aparecer por um instante.
```

### Recursos acessíveis pela web (`web_accessible_resources`)
```
Expõe apenas duas páginas do próprio Pavio ("vela" de bloqueio e "o que você vai fazer aqui?"), que são o destino dos redirecionamentos feitos em sites arbitrários escolhidos pelo usuário. Não contêm dados do usuário.
```

## Código remoto
**Não**, não uso código remoto. Todo o código está empacotado na extensão (Manifest V3); não há scripts carregados de servidores, `eval` nem código dinâmico.

## Uso de dados
Marque **nenhuma** das categorias de dados coletados. Justificativa:
- O Pavio não coleta, não transmite, não vende e não compartilha dados do usuário. Não há servidor, conta, análise de uso nem terceiros.
- Tudo fica em `chrome.storage.local` (não é sincronizado com a conta Google).
- O texto que o usuário digita no modo intenção ("o que vai fazer aqui") e o histórico de sessões ficam só no dispositivo e podem ser apagados pelo usuário.

> ⚠️ Atenção: a definição de "coletar" do Google se refere a dados transmitidos para fora do dispositivo. Se a revisão questionar o histórico local ou a leitura de URLs/DOM pelos scripts de conteúdo, a resposta é que são processados **somente localmente** e nunca transmitidos (ver política de privacidade).

## Certificações (as três caixas)
- Não vendo nem transfiro dados de usuários a terceiros, exceto nos casos de uso aprovados. ✅
- Não uso nem transfiro dados de usuários para finalidades não relacionadas à função única do item. ✅
- Não uso nem transfiro dados de usuários para determinar capacidade de crédito ou para fins de empréstimo. ✅

## URL da política de privacidade
Hospede `store/privacy-policy.html` em um endereço público (veja `store/README.md`) e cole a URL aqui.

## Instruções para o revisor (campo "Instruções de teste")
```
Não é necessária conta nem login para testar o fluxo principal.

1. Instale a extensão: as Opções abrem sozinhas na aba "Rotina", com uma programação pronta DESLIGADA.
2. Em "Adicionar site à rotina" digite reddit.com e clique em "Adicionar"; no editor deixe "Bloqueado", marque "Dia todo" e todos os dias (atalho "Sempre") e clique em "Salvar faixa". Depois clique em "Ligar a rotina" e permita o acesso quando o Chrome pedir.
3. Abra reddit.com em uma nova aba: a navegação é redirecionada para a página da vela (bloqueio). Desligue o interruptor da rotina e o site volta a abrir.
4. Timer: clique no ícone do Pavio, escolha "Outro" e 2 (minutos), ambiente "Estudo", e "Acender vela" (o Chrome pede acesso aos sites do ambiente). "Preciso parar antes da hora" abre a tela de atrito (espera de 10 s + frase "eu quero desistir do meu foco agora").
5. Modo restrito (sem login): com a rotina ligada e o Instagram/LinkedIn/YouTube restritos pela rotina pronta nos horários dela (ou criando uma faixa "Sempre" restrita), abrir instagram.com/reels/, instagram.com/explore/ ou linkedin.com/video/ redireciona para a vela (a decisão é só pela URL). No YouTube, youtube.com/shorts/... redireciona e a home mostra um aviso no lugar do feed.
6. Pomodoro: no timer, ligue "Pomodoro automático" com foco 1 min e pausa 1 min: na pausa os bloqueios do timer se desligam.
```
