import type { RestrictedKind, RuleMode } from '../../core/models';

export const modeLabel: Record<RuleMode, string> = {
  allowed: 'Liberado',
  blocked: 'Bloqueado',
  restricted: 'Restrito',
};

export const serviceName: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', x: 'X', linkedin: 'LinkedIn' };

export const kindLabel: Record<RestrictedKind, string> = {
  youtube: 'Esconder partes',
  instagram: 'Esconder partes',
  x: 'Esconder partes',
  linkedin: 'Esconder partes',
  intent: 'Modo intenção',
};

/** Partes que dá para esconder em cada serviço (ids em core/restrictions.ts). */
export const featureLabel: Record<string, Record<string, string>> = {
  youtube: {
    home: 'Feed (Início, Inscrições, Em alta)',
    shorts: 'Shorts',
    related: 'Recomendados (ao lado e no fim do vídeo)',
    comments: 'Comentários',
  },
  instagram: {
    feed: 'Feed',
    reels: 'Reels',
    explore: 'Explorar',
    stories: 'Stories',
    messages: 'Mensagens',
    posts: 'Perfis e publicações de outras pessoas',
    search: 'Pesquisa',
  },
  x: { forYou: 'Aba "Para você"', explore: 'Explorar e tendências', notifications: 'Notificações', messages: 'Mensagens' },
  linkedin: { feed: 'Feed', videos: 'Vídeos', news: 'LinkedIn Notícias', messages: 'Mensagens', jobs: 'Vagas', notifications: 'Notificações', network: 'Minha rede' },
};

export const featureHelp = 'Marque o que fica escondido durante a sessão. O que não estiver marcado continua liberado.';

export const modeHelp: Record<RuleMode, string> = {
  allowed: 'Acesso normal.',
  blocked: 'Durante a sessão, a vela te recebe no lugar do site.',
  restricted: 'Acesso limitado, conforme o tipo escolhido.',
};

/** Frases da página de bloqueio. */
export const quotes = [
  'A vela ainda está acesa. Fique mais um pouquinho.',
  'Isso pode esperar. O que você começou, não.',
  'Respire fundo. Volte com calma para o que importa agora.',
  'Cada minuto aqui é um minuto devolvido a você.',
  'Você não precisa de força de vontade, só de um ambiente a seu favor.',
  'Um passo pequeno agora vale mais que um plano perfeito depois.',
  'A distração é barulhenta. Seu foco é silencioso, e é seu.',
  'Deixe a chama trabalhar. Você também.',
];

export const pomodoroError = (code: string): string =>
  ({
    'pomodoro:focus': 'O foco do Pomodoro deve ter entre 1 e 180 minutos.',
    'pomodoro:break': 'A pausa deve ter entre 1 e 60 minutos.',
    'pomodoro:long': 'A pausa longa deve ter entre 1 e 60 minutos.',
    'pomodoro:cycles': 'A pausa longa vem a cada 2 a 10 focos.',
  })[code] ?? 'Pomodoro inválido.';

export const releasedUi = {
  title: 'Liberado agora',
  message: (site: string | null) => `${site ?? 'O site'} não está mais bloqueado. Pode abrir.`,
  until: (when: string) => `Volta a liberar ${when}`,
  returning: (site: string | null) => `Voltando para ${site ?? 'o site'}…`,
  backAt: (time: string) => `O bloqueio volta às ${time}`,
};

export const limitUi = {
  title: 'Você chegou ao limite de hoje',
  message: (site: string | null) => `${site ?? 'O app'} usou o tempo que você combinou consigo. Amanhã ele volta, e você também.`,
};

/** Opção da página "Para liberar": a tela de bloqueio oferece mais tempo? */
export const releaseOfferUi = {
  title: 'Pedir mais tempo na tela de bloqueio',
  on: 'Mostrar "Precisa dele agora?"',
  onNote: 'Na tela de bloqueio aparecem as opções de liberar por 5, 15 ou 30 min.',
  offNote: 'A tela de bloqueio mostra só a vela e o "Voltar", sem oferecer mais tempo. Dá para pausar pelas Opções, em Horários.',
};

export const releaseUi = {
  ask: 'Precisa dele agora?',
  option: (min: number) => `${min} min`,
  confirmQuestion: (site: string, min: number) => `Liberar ${site} por ${min} min? Depois o bloqueio volta sozinho.`,
  action: (min: number) => `Liberar por ${min} min`,
  forever: 'Desligar de vez nas opções',
};

export const breakUi = {
  title: 'Hora da pausa',
  message: (site: string | null, until: string) => `${site ? `O ${site} está liberado` : 'Os sites estão liberados'} até ${until}. Respire, levante, beba água.`,
  open: (site: string) => `Abrir ${site}`,
};

export const validationMessage = (code: string): string => {
  const [kind, type, domain] = code.split(':');
  if (kind === 'name') return 'Dê um nome ao ambiente.';
  if (type === 'invalid-domain') return `"${domain}" não parece um site válido.`;
  if (type === 'duplicate') return `${domain} aparece mais de uma vez.`;
  if (type === 'missing-kind') return `Escolha o tipo de restrição de ${domain}.`;
  return 'Ambiente inválido.';
};

export const notifications = {
  completedTitle: 'A vela acabou 🕯️',
  completedMessage: (env: string, minutes: number) =>
    `Sessão "${env}" concluída: ${minutes} min de foco. Você devolveu esse tempo a você.`,
  breakTitle: 'Hora da pausa ☕',
  breakMessage: (minutes: number, until: string, long: boolean) =>
    `${long ? 'Pausa longa' : 'Pausa'} de ${minutes} min: os bloqueios estão liberados até ${until}. Respire, levante, beba água.`,
  focusTitle: 'De volta ao foco 🕯️',
  focusMessage: (cycle: number) => `Foco ${cycle}: os bloqueios voltaram. Você consegue.`,
  scheduledTitle: 'Seu horário começou 🕯️',
  scheduledMessage: (name: string, until: string) => `"${name}": vela acesa até as ${until}. Cuidamos do resto.`,
  intentTitle: 'Ainda está na tarefa?',
  intentMessage: (domain: string, text: string) => `Você veio ao ${domain} para: "${text}". O tempo combinado acabou.`,
  intentMore: 'Preciso de mais 5 min',
  intentDone: 'Já terminei',
};

export const friction = {
  title: 'Antes de ir…',
  focusMessage: 'A vela ainda não acabou, ainda temos coisas a fazer...',
  lightMessage: 'Quer apagar a vela agora? A sessão será encerrada.',
  waitLeft: (s: number) => `Você poderá desistir em ${s}s`,
  waitDone: 'Se ainda quiser desistir, escreva a frase abaixo.',
  typePrompt: 'Para desistir, digite exatamente:',
  phrasePlaceholder: 'Digite a frase aqui',
  keepFocus: 'Voltar ao foco',
  giveUp: 'Apagar a vela',
  doneTitle: 'Vela apagada.',
  doneMessage: 'Sem culpa. Foi o que deu hoje, e amanhã a gente acende de novo.',
  close: 'Fechar',
  noSessionTitle: 'Não há vela acesa.',
  noSessionMessage: 'A sessão já terminou. Pode fechar esta aba.',
};

export const intentPage = {
  title: 'O que você vai fazer aqui?',
  subtitle: (site: string) => `${site} está no modo intenção. Diga seu propósito e por quanto tempo.`,
  placeholder: 'Ex.: responder uma dúvida da faculdade',
  duration: 'Por quanto tempo?',
  other: 'Outro',
  enter: 'Entrar com calma',
  back: 'Voltar',
  errors: {
    text: 'Escreva em poucas palavras o que você vai fazer.',
    minutes: 'Escolha entre 1 e 180 minutos.',
    generic: 'Não consegui liberar o site agora. Tente de novo.',
  },
};

export const blockedWhy: Record<string, string> = {
  shorts: 'Os Shorts ficam de fora durante a sessão.',
  feed: 'Esse feed fica escondido durante a sessão.',
  'not-allowed': 'Esse endereço não está na sua lista de hoje.',
  'dm-only': 'No Instagram, só as mensagens ficam disponíveis durante a sessão.',
  reels: 'Os Reels ficam de fora durante a sessão.',
  explore: 'Explorar fica de fora durante a sessão.',
  stories: 'Os Stories ficam de fora durante a sessão.',
  messages: 'As mensagens ficam de fora durante a sessão.',
  posts: 'Perfis e publicações ficam de fora durante a sessão.',
  videos: 'Os vídeos ficam de fora durante a sessão.',
  search: 'A pesquisa fica de fora durante a sessão.',
  notifications: 'As notificações ficam de fora durante a sessão.',
  jobs: 'As vagas ficam de fora durante a sessão.',
  network: 'A rede de contatos fica de fora durante a sessão.',
};

export const youtubeUi = {
  summary: 'Links permitidos do YouTube (opcional)',
  help: 'Cole vídeos, playlists ou canais, um por linha. Com a lista, todo o resto do YouTube fica bloqueado. Sem lista, o YouTube fica sem feed, mas com busca.',
  placeholder: 'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/@canal',
  invalid: (lines: string[]) => `Não entendi estes links: ${lines.join(', ')}`,
};

/** Velas de verdade (links de afiliado). Tom: convite, nunca pressão; sem urgência, sem "oferta", sem "imperdível". */
export const shopUi = {
  title: 'Velas de verdade',
  lead: 'O mesmo ritual, fora da tela.',
  intro: 'Acender uma vela antes de começar é um sinal simples para o corpo: agora é hora de focar. O cheiro vira um atalho, e com o tempo o foco chega mais rápido. Escolhemos algumas que combinam com o Pavio.',
  moments: {
    before: { kicker: 'Ritual de foco', line: 'Acenda uma de verdade também: o cheiro avisa que agora é hora de focar.' },
    during: { kicker: 'Enquanto a chama queima', line: 'Uma vela de verdade ao lado deixa o ritual completo.' },
    after: { kicker: 'Vela concluída', line: 'Que tal fazer disso um ritual? Uma vela de verdade marca o começo do próximo foco.' },
  },
  see: (store: string) => `Ver no ${store}`,
  hide: 'Esconder',
  inPopup: 'Mostrar uma sugestão discreta no popup',
  timerHint: 'Dica: muita gente acende uma vela de verdade junto com a do Pavio.',
  timerLink: 'Ver velas',
};

/** Apoio voluntário. Tom: gratidão, sem culpa nem pressão; nada fica trancado por não doar. */
export const donateUi = {
  title: 'Apoie o Pavio',
  lead: 'Feito com calma, por uma pessoa só.',
  intro: 'O Pavio é gratuito, sem anúncios e sem coletar nada seu, e vai continuar assim. Se ele te ajudou a focar e você quiser contribuir, qualquer valor ajuda a manter e melhorar a extensão. Se não puder, tudo bem: nada aqui depende disso.',
  pixTitle: 'Pix',
  pixHint: 'Escolha um valor, copie o código e cole em "Pix copia e cola" no app do seu banco.',
  amount: (n: number) => `R$ ${n}`,
  anyAmount: 'Outro valor',
  copy: 'Copiar código Pix',
  copied: 'Copiado! Agora é só colar no app do banco.',
  copyKey: 'Copiar só a chave',
  copyFailed: 'Não consegui copiar sozinho. Selecione e copie o código abaixo:',
  keyLabel: 'Chave Pix',
  recipient: (name: string) => `Recebedor: ${name}`,
  otherTitle: 'Outras formas',
  thanks: 'Obrigado por fazer parte disso. 🕯️',
  privacy: 'O Pavio não registra quem doa nem quanto: o pagamento acontece fora da extensão, no seu banco ou no site de apoio.',
};

export const pauseUi = {
  titleSite: (domain: string) => `Pausar ${domain}`,
  titleSlot: (domain: string, range: string) => `Pausar a faixa ${range} de ${domain}`,
  titleFeature: (label: string, domain: string) => `Pausar ${label} em ${domain}`,
  featureHint: 'Só este recurso sai do bloqueio; os outros continuam escondidos.',
  pauseFeature: 'Pausar este recurso',
  resumeFeature: 'Retomar',
  featureOff: 'Pausado',
  hint: 'Por quanto tempo? Depois o bloqueio volta sozinho.',
  min: (m: number) => `${m} min`,
  day: 'Até o fim do dia',
  manual: 'Até eu religar',
  action: (what: string) => `Pausar · ${what}`,
  cancel: 'Manter ligado',
  pausedUntil: (until: string) => `Pausado até ${until}`,
  endOfDay: 'o fim do dia',
  inPause: (what: string, until: string) => `${what} em pausa até ${until}. Depois o bloqueio volta sozinho.`,
  resume: 'Retomar',
  slotOff: 'Pausada',
  pauseSlot: 'Pausar faixa',
  resumeSlot: 'Retomar faixa',
};

/** Aba nova barrada durante a vela. */
export const newTabUi = {
  title: 'Novas abas ficam de fora enquanto a vela queima',
  message: 'Você escolheu foco sem abas novas. Esta aba se fecha sozinha e a vela continua acesa.',
  close: (s: number) => (s > 0 ? `Fechar agora (${s})` : 'Fechando…'),
  optionTitle: 'Bloquear abas novas durante a vela',
  optionHint: 'Ctrl+T e links que abrem em nova aba ficam fechados enquanto a vela vale. Na pausa do Pomodoro volta ao normal. Janelas de login e as páginas do Pavio não são afetadas.',
  popupLabel: 'Fechar abas novas durante esta vela',
  settingNote: 'Valor inicial ao acender a vela; dá para mudar em "Mais opções" do popup.',
};

/** Bloqueio rápido por partes: esconder só o que distrai, sem bloquear o app inteiro. */
export const quickPartsUi = {
  modes: { free: 'Livre', parts: 'Só partes', all: 'Bloquear tudo' },
  hints: {
    youtube: 'Os Shorts ficam ocultos de verdade: somem do Início e do menu, e quem abrir um link de Short vê a vela.',
    instagram: 'A pesquisa continua liberada mesmo com o Explorar escondido. Marque "Pesquisa" se quiser escondê-la também.',
    x: 'Esconde só o que você marcar; o resto do X abre normal.',
    linkedin: 'Esconde só o que você marcar; o resto do LinkedIn abre normal.',
  } as Record<string, string>,
  hidden: (feature: string, site: string) => `${feature} escondido em ${site}.`,
  shown: (feature: string, site: string) => `${feature} liberado em ${site}.`,
};
