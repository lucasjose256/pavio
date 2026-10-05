import type { StoragePort } from '../../core/ports';

/** StoragePort sobre chrome.storage (local por padrão; `session` apaga ao fechar o navegador). */
export class ChromeStorage implements StoragePort {
  constructor(private area: chrome.storage.StorageArea = chrome.storage.local) {}

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.area.get(key);
    return result[key] as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await this.area.set({ [key]: value });
  }
  async remove(key: string): Promise<void> {
    await this.area.remove(key);
  }
}
