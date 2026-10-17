type Features = ReadonlySet<string>;

/** Caminhos de entrada na conta: nunca bloqueados. */
const INSTAGRAM_AUTH = ['/accounts/login', '/accounts/logout', '/accounts/password', '/accounts/onetap', '/challenge', '/auth_platform'];

export type SiteDecision =
  | { action: 'allow' }
  /** Em vez de bloquear, leva a uma área permitida (ex.: início do Instagram → caixa de mensagens). */
  | { action: 'redirect'; to: string }
  | { action: 'block'; reason: string };

const norm = (pathname: string) => pathname.replace(/\/+$/, '') || '/';
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Instagram: cada recurso escondido bloqueia a sua parte. Início = feed. `posts` (perfis e publicações de
 * outros) é o modo mais rígido: só passa o que não é conteúdo (mensagens e entrada na conta).
 */
export function instagramDecision(pathname: string, features: Features): SiteDecision {
  const path = norm(pathname);
  if (INSTAGRAM_AUTH.some((p) => under(path, p))) return { action: 'allow' };

  if (path === '/') {
    if (!features.has('feed')) return { action: 'allow' };
    return features.has('messages') ? { action: 'block', reason: 'feed' } : { action: 'redirect', to: '/direct/inbox/' };
  }
  if (under(path, '/direct')) return features.has('messages') ? { action: 'block', reason: 'messages' } : { action: 'allow' };
  if ((under(path, '/reels') || under(path, '/reel')) && features.has('reels')) return { action: 'block', reason: 'reels' };
  // A pesquisa é parte própria: esconder o Explorar (a grade) não derruba a pesquisa. `posts` (modo rígido) bloqueia tudo.
  if (under(path, '/explore/search')) return features.has('search') || features.has('posts') ? { action: 'block', reason: 'search' } : { action: 'allow' };
  if (under(path, '/explore') && features.has('explore')) return { action: 'block', reason: 'explore' };
  if (under(path, '/stories') && features.has('stories')) return { action: 'block', reason: 'stories' };
  if (features.has('posts')) return { action: 'block', reason: 'posts' }; // perfis, /p/…, etc.
  return { action: 'allow' };
}

/** X: a aba "Para você" é tratada no DOM; aqui só a página Explorar/tendências. */
export function xDecision(pathname: string, features: Features): SiteDecision {
  const path = norm(pathname);
  if (features.has('explore') && (under(path, '/explore') || under(path, '/i/trends'))) return { action: 'block', reason: 'explore' };
  if (features.has('notifications') && under(path, '/notifications')) return { action: 'block', reason: 'notifications' };
  if (features.has('messages') && under(path, '/messages')) return { action: 'block', reason: 'messages' };
  return { action: 'allow' };
}

/**
 * LinkedIn: o feed é só `/feed` (as publicações individuais, `/feed/update/…`, continuam abrindo).
 * Sem o feed, o início leva às mensagens (se liberadas).
 */
export function linkedinDecision(pathname: string, features: Features): SiteDecision {
  const path = norm(pathname);
  if ((path === '/feed' || path === '/') && features.has('feed')) {
    return features.has('messages') ? { action: 'block', reason: 'feed' } : { action: 'redirect', to: '/messaging/' };
  }
  if (under(path, '/video') && features.has('videos')) return { action: 'block', reason: 'videos' };
  if (under(path, '/messaging') && features.has('messages')) return { action: 'block', reason: 'messages' };
  if (under(path, '/jobs') && features.has('jobs')) return { action: 'block', reason: 'jobs' };
  if (under(path, '/notifications') && features.has('notifications')) return { action: 'block', reason: 'notifications' };
  if (under(path, '/mynetwork') && features.has('network')) return { action: 'block', reason: 'network' };
  return { action: 'allow' };
}

