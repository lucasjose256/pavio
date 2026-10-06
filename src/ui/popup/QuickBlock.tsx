import { accessDomains } from '../../core/blocking';
import type { RoutineSite, Settings } from '../../core/models';
import { randomId } from '../../core/ports';
import { isBlockedAll, loosensNow, rulesAnyTime, setBlockAll } from '../../core/routine';
import { ROUTINE_SUGGESTIONS } from '../../core/routine-defaults';
import { ensureHostAccess } from '../../platform/chrome/permissions';
import { createServices } from '../../platform/chrome/services';
import { useStorageValue } from '../shared/useStorageValue';

const services = createServices();

/** Bloqueio rápido no popup: um clique bloqueia o app inteiro, o tempo todo. Recolhido para poupar altura. */
export function QuickBlock() {
  const { value: routine, loaded } = useStorageValue<RoutineSite[]>('routine');
  const { value: settings } = useStorageValue<Settings>('settings');
  if (!loaded) return null;

  const sites = routine ?? [];
  const enabled = settings?.routineEnabled ?? true;
  const domains = [...new Set([...ROUTINE_SUGGESTIONS, ...sites.map((s) => s.domain)])];
  const count = domains.filter((d) => isBlockedAll(sites, d)).length;

  async function toggle(domain: string) {
    const on = !isBlockedAll(sites, domain);
    const next = setBlockAll(sites, domain, on, randomId);
    if (loosensNow({ sites, enabled }, { sites: next, enabled }, Date.now()) && !confirm(`Liberar ${domain}? Ele está bloqueado agora.`)) return;
    // O redirecionamento precisa de acesso ao site: pedido aqui, direto do clique.
    if (on && !(await ensureHostAccess(accessDomains({ rules: rulesAnyTime(next.map((s) => ({ ...s, slots: [] }))) })))) return;
    await services.routine.save(next);
  }

  return (
    <details class="quick">
      <summary>Bloqueio rápido{count ? ` · ${count} bloqueado${count === 1 ? '' : 's'}` : ''}</summary>
      <div class="quick-chips">
        {domains.map((d) => (
          <button key={d} class="chip block" aria-pressed={isBlockedAll(sites, d)} onClick={() => void toggle(d)}
            title={isBlockedAll(sites, d) ? `Liberar ${d}` : `Bloquear ${d} por inteiro`}>
            {isBlockedAll(sites, d) ? '🔒 ' : ''}{d.replace(/\.(com|tv)$/, '')}
          </button>
        ))}
      </div>
      <p class="hint">Bloqueia o app inteiro, sempre. Horários e recursos: nas opções.</p>
    </details>
  );
}
