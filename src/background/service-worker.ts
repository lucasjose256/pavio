import type { Settings } from '../core/models';
import { systemClock } from '../core/ports';
import { migrate } from '../core/migrations';
import { planFor } from '../core/blocking';
import { domainFromIntentAlarm } from '../core/intent-service';
import { ROUTINE_ALARM } from '../core/policy-service';
import { POMODORO_ALARM, SESSION_ALARM } from '../core/session-service';
import { OWN_TAB_MESSAGE, blocksNewTabs, shouldCloseNewTab } from '../core/new-tabs';
import { toolbarIconFor } from '../core/toolbar-icon';
import { setToolbarIcon } from '../platform/chrome/toolbar-icon';
import { INTENT_NOTIFICATION_PREFIX } from '../platform/chrome/notifications';
import { createServices } from '../platform/chrome/services';
import { USAGE_ALARM, observeHost, setTracking } from '../platform/chrome/usage-tracker';

const { storage, routine, settings, policies, intents, sessions, blocker, policyService, intentService, usageService } = createServices();

// Serializa: várias mudanças seguidas não podem mexer em regras/sessões ao mesmo tempo.
let queue: Promise<unknown> = Promise.resolve();
// Um erro (ex.: regra de rede recusada pelo Chrome) aparece no console do service worker em vez de sumir.
const enqueue = (task: () => Promise<unknown>) =>
  (queue = queue.then(task).catch((error) => console.error('[Pavio] falhou ao sincronizar:', error)));

/** O ícone do Pavio na barra do Chrome fica com o fundo âmbar enquanto a vela está acesa (se a opção estiver ligada). */
async function syncToolbarIcon() {
  const [session, config] = await Promise.all([sessions.get(), settings.get()]);
  await setToolbarIcon(toolbarIconFor(session, config.iconOnCandle, Date.now()));
}

/** Alinha as regras de rede com a política atual (rotina + Timer) e as permissões de intenção. */
async function syncBlocking() {
  await blocker.apply(planFor(await policies.get(), await intents.list()));
}

/**
 * Tudo que depende do relógio e das configurações, em ordem: conclui a vela que venceu, recalcula o que vale
 * agora (rotina + Timer), agenda a próxima virada e aplica o bloqueio. Idempotente.
 */
const syncAll = () =>
  enqueue(async () => {
    await policyService.sync();
    await syncBlocking();
    await syncToolbarIcon();
    // A medição de uso só roda se algum app tem limite.
    await setTracking((await routine.list()).some((site) => site.enabled && !!site.limitMin));
  });

async function boot() {
  await migrate(storage, systemClock);
  await syncAll();
}

// Listeners precisam ser registrados de forma síncrona, no topo do módulo.
chrome.runtime.onInstalled.addListener((details) => {
  void boot();
  // Primeira instalação: abre as opções na Rotina para o usuário conferir a programação pronta e ligá-la.
  if (details.reason === 'install') void chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/options/index.html#rotina') });
});
chrome.runtime.onStartup.addListener(() => void boot());
chrome.alarms.onAlarm.addListener((alarm) => {
  // Fim da vela, troca de fase do Pomodoro e virada de faixa da rotina: tudo passa pelo mesmo sync idempotente.
  if (alarm.name === SESSION_ALARM || alarm.name === POMODORO_ALARM || alarm.name === ROUTINE_ALARM) return void syncAll();
  // A cada minuto: soma o tempo do app em uso. Gravar o uso aciona o `syncAll` (via storage.onChanged), que bloqueia ao estourar.
  if (alarm.name === USAGE_ALARM) return void enqueue(async () => void (await usageService.record(await observeHost())));
  const domain = domainFromIntentAlarm(alarm.name);
  if (domain) void intentService.timeUp(domain);
});
// Aviso gentil do modo intenção: botão 0 = mais 5 min, 1 = já terminei.
chrome.notifications.onButtonClicked.addListener((id, button) => {
  if (!id.startsWith(INTENT_NOTIFICATION_PREFIX)) return;
  const domain = id.slice(INTENT_NOTIFICATION_PREFIX.length);
  void (button === 0 ? intentService.extend(domain) : intentService.revoke(domain));
  void chrome.notifications.clear(id);
});
// ---- Bloquear abas novas durante a vela (opção da vela) ----
// Sem permissão `tabs`: o Chrome avisa que nasceu uma aba e a extensão pode fechá-la. As páginas do próprio Pavio
// (opções, "preciso parar", janela da vela…) se anunciam por mensagem e ficam de fora; janelinhas `popup` (logins) também.
const OWN_TABS_KEY = 'ownTabs';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((message, sender) => {
  const id = sender.tab?.id;
  if (message?.type !== OWN_TAB_MESSAGE || id === undefined) return;
  void chrome.storage.session.get(OWN_TABS_KEY).then(async (r) => {
    const list = [...new Set([...((r[OWN_TABS_KEY] as number[] | undefined) ?? []), id])].slice(-60);
    await chrome.storage.session.set({ [OWN_TABS_KEY]: list });
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  const id = tab.id;
  if (id === undefined) return;
  void (async () => {
    if (!blocksNewTabs(await sessions.get(), Date.now())) return;
    await sleep(1200); // dá tempo de uma página do Pavio se anunciar
    if (!blocksNewTabs(await sessions.get(), Date.now())) return;
    const current = await chrome.tabs.get(id).catch(() => undefined);
    if (!current) return;
    const ownTabs = ((await chrome.storage.session.get(OWN_TABS_KEY))[OWN_TABS_KEY] as number[] | undefined) ?? [];
    const here = chrome.runtime.getURL('');
    const own = ownTabs.includes(id) || (current.url ?? current.pendingUrl ?? '').startsWith(here);
    const win = await chrome.windows.get(current.windowId).catch(() => undefined);
    if (!shouldCloseNewTab({ own, windowType: win?.type })) return;
    await chrome.tabs.update(id, { url: chrome.runtime.getURL('src/ui/newtab/index.html') });
  })().catch((error) => console.error('[Pavio] falhou ao tratar a aba nova:', error));
});

// Vela (iniciada/encerrada), rotina e o interruptor da rotina só gravam no storage; a reação é aqui.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const flag = (v: unknown) => { const s = v as Partial<Settings> | undefined; return `${s?.routineEnabled}|${s?.routinePausedUntil}`; };
  // Ligar/desligar os horários ou pausá-los por um tempo muda o que vale agora.
  const routineToggled = !!changes.settings && flag(changes.settings.oldValue) !== flag(changes.settings.newValue);
  const iconFlag = (v: unknown) => (v as Partial<Settings> | undefined)?.iconOnCandle;
  const iconToggled = !!changes.settings && iconFlag(changes.settings.oldValue) !== iconFlag(changes.settings.newValue);
  if (iconToggled && !changes.activeSession) void enqueue(syncToolbarIcon);
  if (changes.activeSession || changes.routine || changes.usage || changes.releases || routineToggled) void syncAll();
  else if (changes.intents) void enqueue(syncBlocking);
});

// Diagnóstico: no console do service worker (chrome://extensions › Pavio › service worker), rode `await __pavio.state()`.
(self as unknown as { __pavio: unknown }).__pavio = {
  /** Regras de rede ativas agora. */
  rules: () => chrome.declarativeNetRequest.getDynamicRules(),
  /** A política que vale agora, as permissões de intenção, o plano de bloqueio esperado e as regras reais do Chrome. */
  state: async () => {
    const policy = await policies.get();
    const grants = await intents.list();
    return { policy, intents: grants, plan: planFor(policy, grants), usage: await usageService.statuses(), rules: await chrome.declarativeNetRequest.getDynamicRules() };
  },
  sync: syncAll,
};

void boot();
