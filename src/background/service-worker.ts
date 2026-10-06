import type { Settings } from '../core/models';
import { systemClock } from '../core/ports';
import { migrate } from '../core/migrations';
import { planFor } from '../core/blocking';
import { domainFromIntentAlarm } from '../core/intent-service';
import { ROUTINE_ALARM } from '../core/policy-service';
import { POMODORO_ALARM, SESSION_ALARM } from '../core/session-service';
import { INTENT_NOTIFICATION_PREFIX } from '../platform/chrome/notifications';
import { createServices } from '../platform/chrome/services';
import { USAGE_ALARM, observeHost, setTracking } from '../platform/chrome/usage-tracker';

const { storage, routine, policies, intents, blocker, policyService, intentService, usageService } = createServices();

// Serializa: várias mudanças seguidas não podem mexer em regras/sessões ao mesmo tempo.
let queue: Promise<unknown> = Promise.resolve();
// Um erro (ex.: regra de rede recusada pelo Chrome) aparece no console do service worker em vez de sumir.
const enqueue = (task: () => Promise<unknown>) =>
  (queue = queue.then(task).catch((error) => console.error('[Pavio] falhou ao sincronizar:', error)));

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
// Vela (iniciada/encerrada), rotina e o interruptor da rotina só gravam no storage; a reação é aqui.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const flag = (v: unknown) => (v as Partial<Settings> | undefined)?.routineEnabled;
  const routineToggled = !!changes.settings && flag(changes.settings.oldValue) !== flag(changes.settings.newValue);
  if (changes.activeSession || changes.routine || changes.usage || routineToggled) void syncAll();
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
