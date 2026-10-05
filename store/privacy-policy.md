# Política de Privacidade — Pavio

**Última atualização:** 5 de outubro de 2026

O Pavio é uma extensão do Chrome que ajuda você a manter o foco. Esta política explica, de forma direta, o que a extensão guarda e o que ela **não** faz.

## Em resumo
- **O Pavio não coleta dados pessoais.** Não existe conta, servidor, análise de uso, anúncio nem rastreamento.
- **Tudo fica no seu navegador**, em armazenamento local da extensão. Nada é enviado para a internet.
- **Você tem controle total:** pode apagar o histórico, exportar seus dados ou desinstalar a extensão (o que remove tudo).

## O que o Pavio guarda (somente no seu dispositivo)
Esses dados ficam em `chrome.storage.local`, que **não é sincronizado** com a sua conta Google:
- **Sua rotina:** os sites e, para cada um, os dias, os horários e o que fazer (bloquear ou esconder partes).
- **Ambientes** do timer (regras por site) e configurações (tema, estilo da vela, se a rotina está ligada).
- **Timer em andamento:** quando começou, quando termina, o ambiente e o estado do Pomodoro.
- **Histórico de sessões:** data, duração, ambiente, se foi concluída e quantas vezes você tentou abrir um site bloqueado.
- **Modo intenção:** o texto que você digita ("o que você vai fazer aqui") e o tempo escolhido, apenas durante a sessão.

## O que o Pavio **não** faz
- Não envia nenhum dado para servidores, terceiros ou para o desenvolvedor.
- Não usa cookies, identificadores, análise de uso ou publicidade.
- Não vende nem compartilha dados.
- Não lê nem guarda o conteúdo das páginas que você visita (mensagens, publicações, perfis, e-mails, formulários, senhas).

## Como o Pavio atua nas páginas
- **Bloqueio de sites:** nos dias e horários da sua rotina, ou enquanto uma vela (timer) está acesa, o Pavio usa a API `declarativeNetRequest` do Chrome para redirecionar os sites que você escolheu bloquear para uma página do próprio Pavio. Isso não exige ler o conteúdo das páginas.
- **Abas já abertas:** quando um bloqueio começa a valer, o Pavio consulta o endereço das abas abertas nos sites que você bloqueou, só para levá-las à página da vela.
- **YouTube, Instagram, LinkedIn e X:** nos horários em que sua rotina (ou o timer) trata o serviço como "restrito", um script local esconde as partes que você marcou (por exemplo, feed, Shorts, Reels, comentários) e redireciona páginas específicas com base no **endereço (URL)**. No YouTube, se você usa uma lista de vídeos/canais permitidos, o script compara o link do canal do vídeo aberto com a sua lista. No X, o script lê os rótulos das abas ("Para você", "Seguindo") para identificar qual esconder. Tudo acontece no seu navegador; nada é lido para outro fim nem transmitido.

## Permissões e por que são necessárias
| Permissão | Para que serve |
|---|---|
| Armazenamento (`storage`) | Guardar localmente seus ambientes, horários, sessão e histórico. |
| Alarmes (`alarms`) | Disparar o fim da vela, o início e o fim das faixas da rotina, as trocas do Pomodoro e o aviso do modo intenção no momento certo. |
| Notificações (`notifications`) | Avisar "a vela acabou", "hora da pausa" e "ainda está na tarefa?". |
| Bloqueio de rede declarativo (`declarativeNetRequest`) | Redirecionar os sites bloqueados para a página da vela nos horários da sua rotina ou durante o timer. |
| Acesso opcional a sites | Necessário para o redirecionamento. É **opcional**: só é pedido, site a site, quando você liga a rotina ou adiciona o site a uma faixa ou ambiente. |
| Acesso a youtube.com, instagram.com, linkedin.com, x.com e twitter.com | Para esconder as partes que você escolheu desses serviços durante a sessão. |

## Seus direitos e controles
- **Apagar o histórico:** Opções › Histórico › "Apagar histórico".
- **Exportar seus dados:** Opções › Histórico › "Exportar (JSON)".
- **Remover tudo:** desinstalar a extensão apaga todos os dados guardados.
- Como o Pavio não coleta nem recebe seus dados, não há conta a excluir nem dados em servidores a solicitar.

## Crianças
O Pavio não é direcionado a crianças e não coleta dados de ninguém, inclusive de menores.

## Mudanças nesta política
Se algo mudar, esta página será atualizada com a nova data. Qualquer mudança que passe a coletar dados exigiria aviso claro e novo consentimento.

## Contato
Dúvidas sobre privacidade: **[SEU E-MAIL DE CONTATO]**
