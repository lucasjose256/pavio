import { createBuiltinEnvironments } from './environments';
import { DEFAULT_SETTINGS } from './models';
import type { Clock, StoragePort } from './ports';
import { KEYS } from './repositories';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Roda ao instalar/atualizar e ao acordar o service worker (é idempotente).
 * Para mudar o formato dos dados: aumente CURRENT_SCHEMA_VERSION e
 * adicione um passo `if (version < N) { ... }` abaixo.
 */
export async function migrate(storage: StoragePort, clock: Clock): Promise<void> {
  const version = (await storage.get<number>(KEYS.schemaVersion)) ?? 0;

  if (version < 1) {
    // Instalação nova: ambientes de exemplo + configurações padrão.
    if ((await storage.get(KEYS.environments)) === undefined) {
      await storage.set(KEYS.environments, createBuiltinEnvironments(clock.now()));
    }
    if ((await storage.get(KEYS.settings)) === undefined) {
      await storage.set(KEYS.settings, DEFAULT_SETTINGS);
    }
  }

  if (version < CURRENT_SCHEMA_VERSION) {
    await storage.set(KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
  }
}
