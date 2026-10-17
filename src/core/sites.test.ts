import { describe, expect, it } from 'vitest';
import { instagramDecision, linkedinDecision, xDecision } from './sites';

const f = (...ids: string[]) => new Set(ids);
const DEFAULT_IG = f('feed', 'reels', 'explore', 'stories');

describe('instagramDecision (padrão: feed, Reels, Explorar e Stories escondidos)', () => {
  it('mensagens, perfis e publicações passam', () => {
    for (const p of ['/direct/inbox/', '/direct/t/123/', '/accounts/login/', '/someuser/', '/p/abc/'])
      expect(instagramDecision(p, DEFAULT_IG).action, p).toBe('allow');
  });
  it('cada recurso escondido bloqueia a sua parte', () => {
    expect(instagramDecision('/reels/', DEFAULT_IG)).toEqual({ action: 'block', reason: 'reels' });
    expect(instagramDecision('/reel/Cx12/', DEFAULT_IG)).toEqual({ action: 'block', reason: 'reels' });
    expect(instagramDecision('/explore/tags/x/', DEFAULT_IG)).toEqual({ action: 'block', reason: 'explore' });
    expect(instagramDecision('/stories/fulano/123/', DEFAULT_IG)).toEqual({ action: 'block', reason: 'stories' });
  });
  it('o início é o feed: sem feed vai para as mensagens', () => {
    expect(instagramDecision('/', DEFAULT_IG)).toEqual({ action: 'redirect', to: '/direct/inbox/' });
    expect(instagramDecision('/', f('reels'))).toEqual({ action: 'allow' }); // feed liberado
    expect(instagramDecision('/', f('feed', 'messages'))).toEqual({ action: 'block', reason: 'feed' }); // sem para onde ir
  });
  it('recurso desligado não bloqueia', () => {
    expect(instagramDecision('/reels/', f('feed')).action).toBe('allow');
    expect(instagramDecision('/explore/', f()).action).toBe('allow');
  });
  it('mensagens podem ser escondidas', () => {
    expect(instagramDecision('/direct/inbox/', f('messages'))).toEqual({ action: 'block', reason: 'messages' });
  });
  it('"posts" é o modo rígido: só mensagens e login passam', () => {
    const strict = f('feed', 'reels', 'explore', 'stories', 'posts');
    expect(instagramDecision('/direct/inbox/', strict).action).toBe('allow');
    expect(instagramDecision('/accounts/login/', strict).action).toBe('allow');
    expect(instagramDecision('/someuser/', strict)).toEqual({ action: 'block', reason: 'posts' });
    expect(instagramDecision('/p/abc/', strict).action).toBe('block');
  });
});

describe('xDecision', () => {
  it('Explorar e tendências só bloqueiam com o recurso ligado', () => {
    expect(xDecision('/explore', f('explore'))).toEqual({ action: 'block', reason: 'explore' });
    expect(xDecision('/i/trends', f('explore')).action).toBe('block');
    expect(xDecision('/explore', f('forYou')).action).toBe('allow');
    expect(xDecision('/home', f('explore', 'forYou')).action).toBe('allow');
  });
});

describe('linkedinDecision', () => {
  const dflt = f('feed', 'videos', 'news');
  it('feed redireciona para as mensagens; publicações individuais continuam abrindo', () => {
    expect(linkedinDecision('/feed/', dflt)).toEqual({ action: 'redirect', to: '/messaging/' });
    expect(linkedinDecision('/', dflt).action).toBe('redirect');
    expect(linkedinDecision('/feed/update/urn:li:activity:123/', dflt).action).toBe('allow');
    expect(linkedinDecision('/in/alguem/', dflt).action).toBe('allow');
    expect(linkedinDecision('/jobs/', dflt).action).toBe('allow');
  });
  it('vídeos e mensagens só bloqueiam com o recurso ligado', () => {
    expect(linkedinDecision('/video/live/x', dflt)).toEqual({ action: 'block', reason: 'videos' });
    expect(linkedinDecision('/video/live/x', f('feed')).action).toBe('allow');
    expect(linkedinDecision('/messaging/', dflt).action).toBe('allow');
    expect(linkedinDecision('/messaging/', f('messages'))).toEqual({ action: 'block', reason: 'messages' });
  });
  it('sem o recurso feed, o início passa', () => {
    expect(linkedinDecision('/feed/', f('videos')).action).toBe('allow');
  });
});

describe('pesquisa do Instagram (parte própria)', () => {
  const hide = (...f: string[]) => new Set(f);
  it('esconder o Explorar não derruba a pesquisa', () => {
    expect(instagramDecision('/explore', hide('explore'))).toEqual({ action: 'block', reason: 'explore' });
    expect(instagramDecision('/explore/search', hide('explore'))).toEqual({ action: 'allow' });
    expect(instagramDecision('/explore/search/keyword/', hide('feed', 'reels', 'explore', 'stories'))).toEqual({ action: 'allow' });
    expect(instagramDecision('/explore/tags/foco', hide('explore'))).toEqual({ action: 'block', reason: 'explore' });
  });
  it('marcando "Pesquisa" (ou no modo rígido), a pesquisa também fica de fora', () => {
    expect(instagramDecision('/explore/search', hide('search'))).toEqual({ action: 'block', reason: 'search' });
    expect(instagramDecision('/explore/search', hide('posts'))).toEqual({ action: 'block', reason: 'search' });
    expect(instagramDecision('/explore', hide('search'))).toEqual({ action: 'allow' }); // só a pesquisa
  });
});

describe('recursos novos de X e LinkedIn (por endereço)', () => {
  it('X: notificações e mensagens', () => {
    expect(xDecision('/notifications', new Set(['notifications']))).toEqual({ action: 'block', reason: 'notifications' });
    expect(xDecision('/notifications', new Set(['explore']))).toEqual({ action: 'allow' });
    expect(xDecision('/messages/123', new Set(['messages']))).toEqual({ action: 'block', reason: 'messages' });
    expect(xDecision('/home', new Set(['messages', 'notifications']))).toEqual({ action: 'allow' });
  });
  it('LinkedIn: vagas, notificações e minha rede', () => {
    expect(linkedinDecision('/jobs/view/1', new Set(['jobs']))).toEqual({ action: 'block', reason: 'jobs' });
    expect(linkedinDecision('/notifications/', new Set(['notifications']))).toEqual({ action: 'block', reason: 'notifications' });
    expect(linkedinDecision('/mynetwork/', new Set(['network']))).toEqual({ action: 'block', reason: 'network' });
    expect(linkedinDecision('/jobs', new Set(['feed']))).toEqual({ action: 'allow' });
  });
});
