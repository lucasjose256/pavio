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
  blocked: 'Redireciona para a vela durante a sessão.',
  restricted: 'Acesso limitado, conforme o tipo escolhido.',
};

/** Frases da página de bloqueio. */
export const quotes = [
  'A vela ainda está acesa. Fique mais um pouco.',
  'Isso pode esperar. O que você começou, não.',
  'Respire. Volte para o que importa agora.',
  'Cada minuto aqui é um minuto devolvido a você.',
  'Você não precisa de força de vontade, só de um ambiente a seu favor.',
  'Um passo pequeno agora vale mais que um plano perfeito depois.',
  'A distração é barulhenta. Seu foco é silencioso, e é seu.',
  'Deixe a chama trabalhar. Você também.',
];

export const validationMessage = (code: string): string => {
  const [kind, type, domain] = code.split(':');
  if (kind === 'name') return 'Dê um nome ao ambiente.';
  if (type === 'invalid-domain') return `"${domain}" não parece um site válido.`;
  if (type === 'duplicate') return `${domain} aparece mais de uma vez.`;
  if (type === 'missing-kind') return `Escolha o tipo de restrição de ${domain}.`;
  return 'Ambiente inválido.';
};
