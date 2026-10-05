import { systemClock } from '../core/ports';
import { migrate } from '../core/migrations';
import { ChromeStorage } from '../platform/chrome/storage';

// Idempotente: roda ao instalar/atualizar e sempre que o service worker acorda.
void migrate(new ChromeStorage(), systemClock);
