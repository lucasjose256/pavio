/**
 * TODOS os seletores dos sites ficam aqui. Sites mudam o HTML com frequência: quando algo
 * "voltar a aparecer", o conserto quase sempre é só atualizar uma linha deste arquivo.
 * (Última revisão: YouTube validado no site real na etapa 6; Instagram e X na etapa 7 — ver notas em cada bloco.)
 */

import { instagramSearchOpen } from '../core/sites';

const hide = (selectors: readonly string[]) => `${selectors.join(',\n')} { display: none !important; }`;

export const youtube = {
  /** Feed da página inicial. */
  homeFeed: [
    'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer',
    'ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer',
  ],
  /** Vídeos recomendados ao lado do player (a lista da playlist em andamento fica). */
  related: ['ytd-watch-flexy #related', 'ytd-watch-next-secondary-results-renderer'],
  comments: ['ytd-comments#comments', '#comments'],
  shorts: [
    'ytd-rich-shelf-renderer[is-shorts]',
    'ytd-reel-shelf-renderer',
    'ytd-guide-entry-renderer:has(a[title="Shorts"])',
    'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
    'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
    'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
  ],
  /** Sugestões que aparecem no fim do vídeo e cartões sobre o player. */
  endScreen: [
    '.ytp-endscreen-content',
    '.html5-endscreen',
    '.ytp-ce-element',
    '.ytp-suggestion-set',
    '.ytp-pause-overlay',
    '.ytp-cards-teaser',
  ],
  /**
   * Links do dono do vídeo (checar se o canal está na lista). O YouTube usa "/@handle" num lugar e
   * "/channel/UC..." em outro: lemos todos, e basta um bater com o que o usuário colou.
   */
  ownerLinks: [
    'ytd-watch-metadata ytd-video-owner-renderer a[href]',
    'ytd-watch-metadata ytd-channel-name a[href]',
  ],
  /** Elemento da página de vídeo e o atributo com o id do vídeo exibido (evita ler dados do vídeo anterior). */
  watchPage: 'ytd-watch-flexy',
  watchVideoIdAttr: 'video-id',
} as const;

export const FEED_FREE_MESSAGE = 'O feed está escondido pela sua vela. Use a busca ou cole links permitidos.';

/**
 * CSS do modo restrito do YouTube, só para os recursos escondidos (`features`).
 * Com `home`, o feed da página inicial dá lugar a um aviso (se não houver lista de links).
 */
export function youtubeCss(features: ReadonlySet<string>): string {
  return [
    features.has('home') && hide(youtube.homeFeed),
    features.has('related') && hide(youtube.related),
    features.has('related') && hide(youtube.endScreen),
    features.has('comments') && hide(youtube.comments),
    features.has('shorts') && hide(youtube.shorts),
    'html.pavio-yt-pending body { visibility: hidden !important; }',
    features.has('home') &&
      `html.pavio-yt-feedfree ytd-browse[page-subtype="home"]::before {
       content: "${FEED_FREE_MESSAGE}"; display: block; padding: 96px 24px; text-align: center;
       font: 500 18px/1.5 system-ui, sans-serif; color: var(--yt-spec-text-secondary, #888);
     }`,
  ]
    .filter(Boolean)
    .join('\n');
}

export const instagram = {
  /** Atalhos do menu por recurso (as páginas em si já são bloqueadas por URL). */
  navLinks: {
    reels: ['a[href="/reels/"]', 'a[href^="/reels/"]'],
    explore: ['a[href="/explore/"]', 'a[href^="/explore"]'],
    messages: ['a[href^="/direct/inbox"]', 'a[href="/direct/"]'],
  },
} as const;

/**
 * Com a pesquisa liberada, o atalho do Explorar fica visível: no layout estreito ele é o único caminho para
 * pesquisar, e a página dele é trocada pela pesquisa (`instagramDecision`).
 */
export const instagramCss = (features: ReadonlySet<string>): string =>
  (['reels', 'explore', 'messages'] as const)
    .filter((f) => features.has(f) && (f !== 'explore' || !instagramSearchOpen(features)))
    .map((f) => hide(instagram.navLinks[f]))
    .join('\n');

export const x = {
  /** Abas do topo da timeline ("Para você" / "Seguindo"). Textos por idioma da interface. */
  tabs: '[data-testid="primaryColumn"] [role="tablist"] [role="tab"]',
  forYouLabels: ['for you', 'para você', 'para voce', 'para ti'],
  followingLabels: ['following', 'seguindo', 'siguiendo'],
  /** Atributo que o content script põe na aba "Para você" para o CSS escondê-la. */
  hiddenAttr: 'data-pavio-x',
  timeline: '[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]',
} as const;

const normalizeLabel = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ');

export function classifyXTab(label: string): 'for-you' | 'following' | 'other' {
  const l = normalizeLabel(label);
  if ((x.forYouLabels as readonly string[]).includes(l)) return 'for-you';
  if ((x.followingLabels as readonly string[]).includes(l)) return 'following';
  return 'other';
}

/** `pending` esconde a timeline por um instante, enquanto trocamos "Para você" por "Seguindo". */
export const xCss = (): string =>
  [
    `[${x.hiddenAttr}="for-you"] { display: none !important; }`,
    `html.pavio-x-pending ${x.timeline} { visibility: hidden !important; }`,
  ].join('\n');

/**
 * LinkedIn. ATENÇÃO: o LinkedIn exige login e usa classes ofuscadas; só o bloqueio por URL (feed, vídeos,
 * mensagens) é confiável. Os seletores abaixo são o melhor esforço e NÃO foram validados no site real.
 */
export const linkedin = {
  /** Módulo "LinkedIn Notícias" na lateral do feed. */
  news: ['#feed-news-module', '.news-module', 'aside[aria-label*="notícias" i]', 'aside[aria-label*="news" i]'],
  videoLinks: ['a[href*="linkedin.com/video/"]', 'a[href^="/video/"]'],
  /** Atalho e janela flutuante de mensagens. */
  messages: ['a[href*="/messaging/"]', '#msg-overlay', '.msg-overlay-container'],
} as const;

export const linkedinCss = (features: ReadonlySet<string>): string =>
  [
    features.has('news') && hide(linkedin.news),
    features.has('videos') && hide(linkedin.videoLinks),
    features.has('messages') && hide(linkedin.messages),
  ]
    .filter(Boolean)
    .join('\n');
