import { systemClock } from '../core/ports';
import { migrate } from '../core/migrations';
import { planFor } from '../core/blocking';
import { SESSION_ALARM } from '../core/session-service';
import { createServices } from '../platform/chrome/services';

const { storage, sessions, blocker, sessionService } = createServices();

// Serializa: várias mudanças seguidas não podem aplicar regras ao mesmo tempo.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = (task: () => Promise<unknown>) => (queue = queue.then(task, task));

/** Alinha as regras de bloqueio com a sessão atual (sem sessão ativa = nada bloqueado). */
const syncBlocking = () =>
  enqueue(async () => blocker.apply(planFor(await sessions.get())));

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
  if (alarm.name === SESSION_ALARM) void sessionService.reconcile();
});
// Início, fim e abandono de sessão só gravam no storage; o bloqueio reage aqui.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.activeSession) void syncBlocking();
});

void boot();
