import { describe, expect, it } from 'vitest';
import { createBuiltinEnvironment } from './environments';
import type { AllowedLink } from './models';
import { channelAllowed, parseYouTubeLink, parseYouTubeLinks, youtubeDecision, youtubeRestriction } from './youtube';

const video = (id: string): AllowedLink => ({ kind: 'video', id, url: '' });
const playlist = (id: string): AllowedLink => ({ kind: 'playlist', id, url: '' });
const channel = (id: string): AllowedLink => ({ kind: 'channel', id, url: '' });
const at = (pathname: string, search = '') => ({ pathname, search });

describe('parseYouTubeLink', () => {
  it('reconhece vídeos em vários formatos', () => {
    expect(parseYouTubeLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toMatchObject({ kind: 'video', id: 'dQw4w9WgXcQ' });
    expect(parseYouTubeLink('youtu.be/dQw4w9WgXcQ?si=abc')).toMatchObject({ kind: 'video', id: 'dQw4w9WgXcQ' });
    expect(parseYouTubeLink('https://m.youtube.com/shorts/abc123XYZ_-')).toMatchObject({ kind: 'video', id: 'abc123XYZ_-' });
  });
  it('reconhece playlists e canais', () => {
    expect(parseYouTubeLink('https://www.youtube.com/playlist?list=PLabc')).toMatchObject({ kind: 'playlist', id: 'PLabc' });
    expect(parseYouTubeLink('youtube.com/watch?list=PLabc')).toMatchObject({ kind: 'playlist', id: 'PLabc' });
    expect(parseYouTubeLink('https://www.youtube.com/@Fireship/videos')).toMatchObject({ kind: 'channel', id: '@fireship' });
    expect(parseYouTubeLink('https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA')).toMatchObject({ kind: 'channel', id: 'UCsBjURrPoezykLs9EqgamOA' });
    expect(parseYouTubeLink('youtube.com/c/Nome')).toMatchObject({ kind: 'channel', id: 'c/nome' });
  });
  it('rejeita o que não é do YouTube', () => {
    expect(parseYouTubeLink('')).toBeNull();
    expect(parseYouTubeLink('https://example.com/watch?v=abc')).toBeNull();
    expect(parseYouTubeLink('https://www.youtube.com/')).toBeNull();
    expect(parseYouTubeLink('texto solto')).toBeNull();
  });
  it('parseYouTubeLinks separa válidos, inválidos e duplicados', () => {
    const r = parseYouTubeLinks('youtu.be/aaaaaaaaaaa\n\nlixo\nhttps://www.youtube.com/watch?v=aaaaaaaaaaa');
    expect(r.links).toHaveLength(1);
    expect(r.invalid).toEqual(['lixo']);
  });
});

describe('youtubeDecision sem lista (YouTube sem feed)', () => {
  it('libera vídeos, busca e home (a home é só escondida por CSS); bloqueia Shorts e feeds', () => {
    expect(youtubeDecision(at('/watch', '?v=x'), []).action).toBe('allow');
    expect(youtubeDecision(at('/results', '?search_query=js'), []).action).toBe('allow');
    expect(youtubeDecision(at('/'), []).action).toBe('allow');
    expect(youtubeDecision(at('/shorts/abc'), [])).toEqual({ action: 'block', reason: 'shorts' });
    expect(youtubeDecision(at('/feed/subscriptions'), [])).toEqual({ action: 'block', reason: 'feed' });
  });
});

describe('youtubeDecision com lista', () => {
  const list = [video('vid1'), playlist('PL1'), channel('@canal')];
  it('libera item da lista', () => {
    expect(youtubeDecision(at('/watch', '?v=vid1'), list).action).toBe('allow');
    expect(youtubeDecision(at('/watch', '?v=outro&list=PL1'), list).action).toBe('allow'); // vídeo de playlist permitida
    expect(youtubeDecision(at('/playlist', '?list=PL1'), list).action).toBe('allow');
    expect(youtubeDecision(at('/@canal/videos'), list).action).toBe('allow');
  });
  it('bloqueia o resto, incluindo home e busca', () => {
    expect(youtubeDecision(at('/'), list)).toEqual({ action: 'block', reason: 'not-allowed' });
    expect(youtubeDecision(at('/results', '?search_query=x'), list).action).toBe('block');
    expect(youtubeDecision(at('/@outro'), list).action).toBe('block');
    expect(youtubeDecision(at('/playlist', '?list=PL2'), list).action).toBe('block');
  });
  it('vídeo desconhecido pede checagem de canal só se houver canal na lista', () => {
    expect(youtubeDecision(at('/watch', '?v=zzz'), list)).toEqual({ action: 'check-channel' });
    expect(youtubeDecision(at('/watch', '?v=zzz'), [video('vid1')])).toEqual({ action: 'block', reason: 'not-allowed' });
  });
  it('channelAllowed compara o link do dono do vídeo com os canais permitidos', () => {
    expect(channelAllowed('/@Canal', list)).toBe(true);
    expect(channelAllowed('https://www.youtube.com/@outro', list)).toBe(false);
    expect(channelAllowed('/watch?v=1', list)).toBe(false);
  });
});

describe('youtubeRestriction', () => {
  it('só ativa com sessão ativa e regra restrita do tipo youtube', () => {
    const study = createBuiltinEnvironment('builtin-study', 0)!;
    const deep = createBuiltinEnvironment('builtin-deep-work', 0)!;
    const base = { status: 'active' as const, youtubeAllowlist: [video('a')] };
    expect(youtubeRestriction({ ...base, environmentSnapshot: study })?.allowlist).toHaveLength(1);
    expect(youtubeRestriction({ ...base, environmentSnapshot: deep })).toBeNull(); // youtube bloqueado, não restrito
    expect(youtubeRestriction({ ...base, status: 'completed' as never, environmentSnapshot: study })).toBeNull();
    expect(youtubeRestriction(undefined)).toBeNull();
  });
});
