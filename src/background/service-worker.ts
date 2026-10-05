import { systemClock } from '../core/ports';
import { migrate } from '../core/migrations';
import { planFor } from '../core/blocking';
import { domainFromIntentAlarm } from '../core/intent-service';
import { SCHEDULE_ALARM } from '../core/schedule-service';
import { POMODORO_ALARM, SESSION_ALARM } from '../core/session-service';
import { INTENT_NOTIFICATION_PREFIX } from '../platform/chrome/notifications';
import { createServices } from '../platform/chrome/services';

const { storage, sessions, intents, blocker, scheduleService, intentService } = createServices();

// Serializa: várias mudanças seguidas não podem mexer em regras/sessões ao mesmo tempo.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = (task: () => Promise<unknown>) => (queue = queue.then(task, task));

/** Alinha as regras de rede com a sessão e as permissões de intenção atuais. */
async function syncBlocking() {
  const session = await sessions.get();
  if (session?.status !== 'active') await intentService.clearAll(); // fim da sessão: sem permissões penduradas
  await blocker.apply(planFor(session?.status === 'active' ? session : undefined, await intents.list()));
}

/**
 * Tudo que depende do relógio e das configurações, em ordem: conclui o que venceu, acende a vela se uma
 * faixa de horário estiver valendo, agenda o início da próxima e aplica o bloqueio. Idempotente.
 */
const syncAll = () =>
  enqueue(async () => {
    await scheduleService.sync();
    await syncBlocking();
  });

async function boot() {
  await migrate(storage, systemClock);
  await syncAll();
}

// Listeners precisam ser registrados de forma síncrona, no topo do módulo.
chrome.runtime.onInstalled.addListener(() => void boot());
chrome.runtime.onStartup.addListener(() => void boot());
chrome.alarms.onAlarm.addListener((alarm) => {
  // Fim da vela, início de faixa e troca de fase do Pomodoro: tudo passa pelo mesmo sync idempotente.
  if (alarm.name === SESSION_ALARM || alarm.name === SCHEDULE_ALARM || alarm.name === POMODORO_ALARM) return void syncAll();
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
// Sessão (iniciada/encerrada), permissões de intenção e faixas de horário só gravam no storage; a reação é aqui.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.activeSession || changes.schedule) void syncAll();
  else if (changes.intents) void enqueue(syncBlocking);
});

void boot();
