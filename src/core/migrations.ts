import { createBuiltinEnvironment, createBuiltinEnvironments } from './environments';
import type { Environment, RoutineSite } from './models';
import { defaultRoutine } from './routine-defaults';
import { DEFAULT_SETTINGS } from './models';
import type { Clock, StoragePort } from './ports';
import { KEYS } from './repositories';

export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Roda ao instalar/atualizar e ao acordar o service worker (é idempotente).
 * Para mudar o formato dos dados: aumente CURRENT_SCHEMA_VERSION e
 * adicione um passo `if (version < N) { ... }` abaixo.
 */
/** Faixa de horário do formato antigo (antes da Rotina). */
export interface LegacyBlock {
  id: string;
  environmentId: string;
  days: number[];
  startMin: number;
  endMin: number;
  enabled: boolean;
}

/**
 * Converte as faixas antigas (dias + hora + ambiente) para a rotina por site: para cada regra do ambiente
 * (bloqueado/restrito) nasce uma faixa naquele site, com os mesmos dias e horário.
 */
export function routineFromLegacy(blocks: LegacyBlock[], envs: Environment[]): RoutineSite[] {
  const sites = new Map<string, RoutineSite>();
  for (const block of blocks) {
    const env = envs.find((e) => e.id === block.environmentId);
    if (!block.enabled || !env) continue;
    for (const rule of env.rules) {
      if (rule.mode === 'allowed') continue;
      const site = sites.get(rule.domain) ?? { id: `site:${rule.domain}`, domain: rule.domain, enabled: true, slots: [] };
      site.slots.push({
        id: `${block.id}:${rule.domain}`,
        days: [...block.days],
        startMin: block.startMin,
        endMin: block.endMin,
        mode: rule.mode,
        ...(rule.restrictedKind ? { restrictedKind: rule.restrictedKind } : {}),
        ...(rule.features ? { features: rule.features } : {}),
      });
      sites.set(rule.domain, site);
    }
  }
  return [...sites.values()];
}

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

  if (version < 2) {
    // LinkedIn passou a vir por padrão: entra nos ambientes de exemplo que ainda não o têm (sem mexer em nada do usuário).
    const envs = await storage.get<Environment[]>(KEYS.environments);
    if (envs) {
      for (const env of envs) {
        const preset = env.builtin ? createBuiltinEnvironment(env.id, clock.now()) : undefined;
        const linkedin = preset?.rules.find((r) => r.domain === 'linkedin.com');
        if (linkedin && !env.rules.some((r) => r.domain === 'linkedin.com')) env.rules.push(linkedin);
      }
      await storage.set(KEYS.environments, envs);
    }
  }

  if (version < 3) {
    // Rotina por site. Quem tinha faixas de horário ganha a rotina equivalente (já ligada, como antes);
    // os demais recebem a programação pronta, DESLIGADA até o usuário conferir e ligar.
    if ((await storage.get(KEYS.routine)) === undefined) {
      const blocks = (await storage.get<LegacyBlock[]>('schedule')) ?? [];
      const envs = (await storage.get<Environment[]>(KEYS.environments)) ?? [];
      const converted = routineFromLegacy(blocks, envs);
      await storage.set(KEYS.routine, converted.length ? converted : defaultRoutine());
      if (converted.length) {
        const settings = (await storage.get<Record<string, unknown>>(KEYS.settings)) ?? {};
        await storage.set(KEYS.settings, { ...DEFAULT_SETTINGS, ...settings, routineEnabled: true });
      }
    }
    await storage.remove('schedule');
    await storage.remove('skippedOccurrences');
  }

  if (version < CURRENT_SCHEMA_VERSION) {
    await storage.set(KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
  }
}
