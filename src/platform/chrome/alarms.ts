import type { SchedulerPort } from '../../core/ports';

/** chrome.alarms sobrevive à suspensão do service worker; `when` é um timestamp absoluto. */
export class ChromeScheduler implements SchedulerPort {
  async schedule(name: string, when: number): Promise<void> {
    await chrome.alarms.create(name, { when });
  }
  async cancel(name: string): Promise<void> {
    await chrome.alarms.clear(name);
  }
}
