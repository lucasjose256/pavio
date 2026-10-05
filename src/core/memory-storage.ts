import type { StoragePort } from './ports';

/** Implementação em memória do StoragePort: usada em testes (e útil em protótipos). */
export class MemoryStorage implements StoragePort {
  private data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.data.get(key)) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, structuredClone(value));
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}
