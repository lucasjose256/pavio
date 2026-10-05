import type { RestrictedKind, RuleMode } from '../../core/models';

export const modeLabel: Record<RuleMode, string> = {
  allowed: 'Liberado',
  blocked: 'Bloqueado',
  restricted: 'Restrito',
};

export const kindLabel: Record<RestrictedKind, string> = {
  youtube: 'YouTube (sem feed)',
  instagram: 'Instagram (só mensagens)',
  x: 'X (sem "Para você")',
  intent: 'Modo intenção',
};

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
  scheduledBadge: (name?: string) => `Seu horário${name ? ` “${name}”` : ''} acendeu esta vela.`,
  scheduledNote: 'Só por hoje: amanhã, no mesmo horário, a vela acende de novo.',
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
};

export const youtubeUi = {
  summary: 'Links permitidos do YouTube (opcional)',
  help: 'Cole vídeos, playlists ou canais, um por linha. Com a lista, todo o resto do YouTube fica bloqueado. Sem lista, o YouTube fica sem feed, mas com busca.',
  placeholder: 'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/@canal',
  invalid: (lines: string[]) => `Não entendi estes links: ${lines.join(', ')}`,
};
