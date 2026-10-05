/**
 * Ports: o que o domínio precisa do mundo exterior.
 * O Chrome implementa em platform/chrome; o app macOS implementará os seus.
 */

export interface StoragePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export type IdGenerator = () => string;
export const randomId: IdGenerator = () => crypto.randomUUID();
