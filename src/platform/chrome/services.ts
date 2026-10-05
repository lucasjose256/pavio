import { systemClock } from '../../core/ports';
import {
  EnvironmentRepository, HistoryRepository, SessionRepository, SettingsRepository,
} from '../../core/repositories';
import { ChromeStorage } from './storage';

/** Composição das dependências para UI e background (páginas da extensão). */
export function createServices() {
  const storage = new ChromeStorage();
  return {
    storage,
    environments: new EnvironmentRepository(storage, systemClock),
    settings: new SettingsRepository(storage),
    sessions: new SessionRepository(storage),
    history: new HistoryRepository(storage),
  };
}
