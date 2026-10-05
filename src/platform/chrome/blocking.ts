import type { BlockPlan } from '../../core/models';
import type { BlockerPort } from '../../core/ports';
import { hostPattern } from './permissions';

const BLOCK_BASE = 1;
const ALLOW_BASE = 1000;

export const blockedPageUrl = (domain: string) =>
  chrome.runtime.getURL(`src/ui/blocked/index.html?site=${encodeURIComponent(domain)}`);

function buildRules(plan: BlockPlan): chrome.declarativeNetRequest.Rule[] {
  const block = plan.block.map((domain, i): chrome.declarativeNetRequest.Rule => ({
    id: BLOCK_BASE + i,
    priority: 1,
    action: { type: 'redirect', redirect: { url: blockedPageUrl(domain) } },
    condition: { requestDomains: [domain], resourceTypes: ['main_frame'] },
  }));
  const allow = plan.allow.map((domain, i): chrome.declarativeNetRequest.Rule => ({
    id: ALLOW_BASE + i,
    priority: 2,
    action: { type: 'allow' },
    condition: { requestDomains: [domain], resourceTypes: ['main_frame'] },
  }));
  return [...block, ...allow];
}

const domainsOf = (rules: chrome.declarativeNetRequest.Rule[], type: string) =>
  rules.filter((r) => r.action.type === type).map((r) => r.condition.requestDomains?.[0] ?? '').sort();

/**
 * Regras dinâmicas do declarativeNetRequest. Só main_frame: o site inteiro é redirecionado
 * para a página da vela. O redirect exige permissão de host (pedida no clique do usuário).
 */
export class ChromeBlocker implements BlockerPort {
  async apply(plan: BlockPlan): Promise<void> {
    const current = await chrome.declarativeNetRequest.getDynamicRules();
    const wasBlocked = domainsOf(current, 'redirect');
    const sameBlock = JSON.stringify(wasBlocked) === JSON.stringify(plan.block);
    const sameAllow = JSON.stringify(domainsOf(current, 'allow')) === JSON.stringify(plan.allow);
    if (sameBlock && sameAllow) return; // nada mudou (ex.: só o contador de tentativas)

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: current.map((r) => r.id),
      addRules: buildRules(plan),
    });

    // Abas já abertas nesses sites não passam pelo DNR: leva-as para a página da vela.
    for (const domain of plan.block.filter((d) => !wasBlocked.includes(d))) {
      const tabs = await chrome.tabs.query({ url: hostPattern(domain) });
      for (const tab of tabs) if (tab.id !== undefined) await chrome.tabs.update(tab.id, { url: blockedPageUrl(domain) });
    }
  }
}
