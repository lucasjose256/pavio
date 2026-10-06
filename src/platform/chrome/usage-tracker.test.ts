import { beforeEach, describe, expect, it } from 'vitest';
import { USAGE_ALARM, observeHost, setTracking } from './usage-tracker';

type Fake = { idle: string; focused: boolean; url?: string; alarm?: unknown; created: unknown[]; cleared: string[] };
let f: Fake;

beforeEach(() => {
  f = { idle: 'active', focused: true, url: 'https://www.youtube.com/watch?v=1', created: [], cleared: [] };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    idle: { queryState: async () => f.idle },
    windows: { getLastFocused: async () => ({ focused: f.focused }) },
    tabs: { query: async () => [{ url: f.url }] },
    alarms: {
      get: async () => f.alarm,
      create: async (name: string, info: unknown) => { f.alarm = { name, ...(info as object) }; f.created.push([name, info]); },
      clear: async (name: string) => { f.alarm = undefined; f.cleared.push(name); },
    },
  };
});

describe('observeHost', () => {
  it('computador em uso, janela em foco e aba http(s): devolve o host', async () => {
    expect(await observeHost()).toBe('www.youtube.com');
  });
  it('parado, bloqueado, janela sem foco ou aba sem endereço visível: não conta', async () => {
    f.idle = 'idle';
    expect(await observeHost()).toBeNull();
    f.idle = 'locked';
    expect(await observeHost()).toBeNull();
    f.idle = 'active';
    f.focused = false;
    expect(await observeHost()).toBeNull();
    f.focused = true;
    f.url = undefined; // sem acesso ao site: o Chrome não mostra o endereço
    expect(await observeHost()).toBeNull();
    f.url = 'chrome://extensions';
    expect(await observeHost()).toBeNull();
  });
});

describe('setTracking', () => {
  it('liga o alarme de 1 minuto uma vez só e o desliga quando não há mais limites', async () => {
    await setTracking(true);
    await setTracking(true);
    expect(f.created).toEqual([[USAGE_ALARM, { periodInMinutes: 1 }]]);
    await setTracking(false);
    await setTracking(false);
    expect(f.cleared).toEqual([USAGE_ALARM]);
  });
});
