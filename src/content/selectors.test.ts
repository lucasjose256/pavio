import { describe, expect, it } from 'vitest';
import { classifyXTab, instagramCss, linkedinCss, xCss, youtubeCss } from './selectors';

describe('classifyXTab', () => {
  it('reconhece "Para você" e "Seguindo" em vários idiomas', () => {
    expect(classifyXTab('For you')).toBe('for-you');
    expect(classifyXTab('  Para  você ')).toBe('for-you');
    expect(classifyXTab('Following')).toBe('following');
    expect(classifyXTab('Seguindo')).toBe('following');
    expect(classifyXTab('Trending')).toBe('other');
    expect(classifyXTab('')).toBe('other');
  });
  it('o CSS usa o atributo marcado pelo script', () => {
    expect(xCss()).toContain('[data-pavio-x="for-you"]');
  });
});

describe('CSS por recurso', () => {
  it('YouTube: só esconde o que está marcado', () => {
    const all = youtubeCss(new Set(['home', 'shorts', 'related', 'comments']));
    expect(all).toContain('ytd-comments#comments');
    expect(all).toContain('ytd-reel-shelf-renderer');
    expect(all).toContain('ytd-watch-next-secondary-results-renderer');
    const onlyShorts = youtubeCss(new Set(['shorts']));
    expect(onlyShorts).toContain('ytd-reel-shelf-renderer');
    expect(onlyShorts).not.toContain('ytd-comments#comments');
    expect(onlyShorts).not.toContain('ytd-rich-grid-renderer');
    expect(onlyShorts).not.toContain('pavio-yt-feedfree');
  });
  it('Instagram: atalhos do menu só dos recursos escondidos', () => {
    expect(instagramCss(new Set(['feed', 'reels', 'explore', 'stories']))).toContain('a[href="/reels/"]');
    expect(instagramCss(new Set(['reels']))).not.toContain('/explore');
    expect(instagramCss(new Set(['feed']))).toBe('');
    expect(instagramCss(new Set(['messages']))).toContain('/direct/');
  });
  it('LinkedIn: notícias, vídeos e mensagens por recurso', () => {
    expect(linkedinCss(new Set(['news']))).toContain('news-module');
    expect(linkedinCss(new Set(['news']))).not.toContain('msg-overlay');
    expect(linkedinCss(new Set(['messages']))).toContain('msg-overlay');
    expect(linkedinCss(new Set(['feed']))).toBe('');
  });
});
