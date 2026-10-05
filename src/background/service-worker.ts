import { systemClock } from '../core/ports';
import { migrate } from '../core/migrations';
import { planFor } from '../core/blocking';
import { domainFromIntentAlarm } from '../core/intent-service';
import { SESSION_ALARM } from '../core/session-service';
import { INTENT_NOTIFICATION_PREFIX } from '../platform/chrome/notifications';
import { createServices } from '../platform/chrome/services';

const { storage, sessions, intents, blocker, sessionService, intentService } = createServices();

// Serializa: várias mudanças seguidas não podem aplicar regras ao mesmo tempo.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = (task: () => Promise<unknown>) => (queue = queue.then(task, task));

/** Alinha as regras de rede com a sessão e as permissões de intenção atuais. */
const syncBlocking = () =>
  enqueue(async () => {
    const session = await sessions.get();
    if (session?.status !== 'active') await intentService.clearAll(); // fim da sessão: sem permissões penduradas
    await blocker.apply(planFor(session?.status === 'active' ? session : undefined, await intents.list()));
  });

/** Idempotente: roda sempre que o service worker acorda. */
async function boot() {
  await migrate(storage, systemClock);
  await sessionService.reconcile(); // conclui sessão que venceu com o navegador fechado
  await syncBlocking();
}

// Listeners precisam ser registrados de forma síncrona, no topo do módulo.
chrome.runtime.onInstalled.addListener(() => void boot());
chrome.runtime.onStartup.addListener(() => void boot());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_ALARM) return void sessionService.reconcile();
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
// Sessão e permissões de intenção só gravam no storage; o bloqueio reage aqui.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.activeSession || changes.intents)) void syncBlocking();
});

void boot();
