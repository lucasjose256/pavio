/**
 * TODOS os seletores dos sites ficam aqui. Sites mudam o HTML com frequência: quando algo
 * "voltar a aparecer", o conserto quase sempre é só atualizar uma linha deste arquivo.
 * (Última revisão: etapa 6, YouTube. Instagram e X entram na etapa 7.)
 */

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

/** CSS do modo restrito do YouTube. `feedFree` = sem lista de links (a home mostra um aviso no lugar do feed). */
export function youtubeCss(): string {
  return [
    hide(youtube.homeFeed),
    hide(youtube.related),
    hide(youtube.comments),
    hide(youtube.shorts),
    hide(youtube.endScreen),
    'html.pavio-yt-pending body { visibility: hidden !important; }',
    `html.pavio-yt-feedfree ytd-browse[page-subtype="home"]::before {
       content: "${FEED_FREE_MESSAGE}"; display: block; padding: 96px 24px; text-align: center;
       font: 500 18px/1.5 system-ui, sans-serif; color: var(--yt-spec-text-secondary, #888);
     }`,
  ].join('\n');
}
