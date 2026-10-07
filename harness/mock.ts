// Harness de desenvolvimento (temporário): `chrome` simulado em memória para ver as telas no navegador.
import { createBuiltinEnvironments } from '../src/core/environments';
import { addUsage, extendLimit } from '../src/core/usage';

const now = Date.now();
let usage = addUsage({}, 'youtube.com', 18 * 60_000, now);
usage = addUsage(usage, 'instagram.com', 31 * 60_000, now);
usage = extendLimit(usage, 'instagram.com', 5, now);
usage = addUsage(usage, 'x.com', 9 * 60_000, now - 86_400_000);
const params = new URLSearchParams(location.search);
const data: Record<string, unknown> = {
  schemaVersion: 4,
  environments: createBuiltinEnvironments(now),
  settings: { candleSkin: params.get('skin') ?? 'classic', theme: params.get('theme') ?? 'cream', routineEnabled: true, friction: params.get('friction') ?? 'light', releaseOffer: params.get('offer') !== '0' },
  policy: { rules: [{ id: 'r', domain: params.get('site') ?? 'reddit.com', mode: 'blocked' }], youtubeAllowlist: [], routineActive: true, timerActive: false, releasable: [params.get('site') ?? 'reddit.com'], released: [] },
  routine: [
    { id: 'a', domain: 'youtube.com', enabled: true, limitMin: 30, slots: [{ id: 's1', days: [1, 2, 3, 4, 5], startMin: 540, endMin: 1080, mode: 'restricted', restrictedKind: 'youtube' }] },
    { id: 'b', domain: 'instagram.com', enabled: true, limitMin: 30, slots: [] },
    { id: 'c', domain: 'reddit.com', enabled: true, blockAll: true, slots: [] },
  ],
  usage,
  history: params.get('done') ? [{ sessionId: 'h', environmentName: 'Estudo', startedAt: now - 40 * 60_000, endedAt: now - 15 * 60_000, plannedMs: 25 * 60_000, actualMs: 25 * 60_000, outcome: 'completed', blockedAttempts: 2 }] : [],
};
if (params.get('running')) {
  const env = (data.environments as { id: string }[])[0];
  data.activeSession = { id: 'x', environmentSnapshot: env, startedAt: now - 10 * 60_000, endsAt: now + 15 * 60_000, plannedMs: 25 * 60_000, strictness: 'focus', youtubeAllowlist: [], status: 'active', blockedAttempts: 0 };
}
type L = (c: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;
const listeners = new Set<L>();
const ev = () => ({ addListener: () => {}, removeListener: () => {} });
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (k?: string | string[]) => (k === undefined ? { ...data } : Object.fromEntries([k].flat().filter((x) => x in data).map((x) => [x, structuredClone(data[x])]))),
      set: async (o: Record<string, unknown>) => { const c: Record<string, { oldValue?: unknown; newValue?: unknown }> = {}; for (const [k, v] of Object.entries(o)) { c[k] = { oldValue: data[k], newValue: v }; data[k] = structuredClone(v); } listeners.forEach((l) => l(c, 'local')); },
      remove: async (k: string) => { delete data[k]; listeners.forEach((l) => l({ [k]: { newValue: undefined } }, 'local')); },
    },
    session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
    onChanged: { addListener: (l: L) => listeners.add(l), removeListener: (l: L) => listeners.delete(l) },
  },
  permissions: { contains: async () => true, request: async () => true },
  runtime: { getURL: (p: string) => `/${p}`, onMessage: ev(), openOptionsPage: () => {}, getContexts: async () => [], ContextType: { TAB: 'TAB' } },
  windows: { create: async () => {}, update: async () => {}, getCurrent: async () => ({ id: 1 }) },
  tabs: { create: async ({ url }: { url: string }) => { location.href = url; }, getCurrent: async () => undefined, update: async () => {}, query: async () => [] },
  declarativeNetRequest: { getDynamicRules: async () => [] },
  alarms: { create: async () => {}, clear: async () => true, onAlarm: ev() },
  notifications: { create: async () => '', clear: async () => true, onClicked: ev(), onButtonClicked: ev() },
};
