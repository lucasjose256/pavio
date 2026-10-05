import { systemClock } from '../core/ports';
import { migrate } from '../core/migrations';
import { SESSION_ALARM } from '../core/session-service';
import { createServices } from '../platform/chrome/services';

const { storage, sessionService } = createServices();

/** Idempotente: roda sempre que o service worker acorda. */
async function boot() {
  await migrate(storage, systemClock);
  await sessionService.reconcile(); // conclui sessão que venceu com o navegador fechado
}

// Listeners precisam ser registrados de forma síncrona, no topo do módulo.
chrome.runtime.onInstalled.addListener(() => void boot());
chrome.runtime.onStartup.addListener(() => void boot());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_ALARM) void sessionService.reconcile();
});

void boot();
