import type { BlockPlan } from '../../core/models';
import type { BlockerPort } from '../../core/ports';
import { hostPattern } from './permissions';

// Faixas de id por tipo de regra (permite ler o estado atual a partir dos ids).
const BLOCK_BASE = 1;
const INTENT_BASE = 500;
const ALLOW_BASE = 1000;

/**
 * Página de bloqueio. `next` (opcional) é onde a pessoa estava, para voltar sozinha quando o site for liberado; vai por
 * último na query. `back` = a aba já estava aberta e a página original ficou no histórico: ao liberar, a tela volta
 * pelo histórico (o Chrome restaura a página com rolagem, vídeo e o que estava digitado) em vez de recarregá-la.
 * Só se conhece ao levar abas JÁ abertas ou nos content scripts: nas regras de rede o redirect é
 * simples (sem `regexSubstitution`, que não é garantido), então ali a volta é para a página inicial do site.
 */
export const blockedPageUrl = (domain: string, why?: string, next?: string, back?: boolean) =>
  chrome.runtime.getURL(`src/ui/blocked/index.html?site=${encodeURIComponent(domain)}${why ? `&why=${why}` : ''}${back ? '&back=1' : ''}${next ? `&next=${encodeURIComponent(next)}` : ''}`);

/**
 * Página "o que você vai fazer aqui?". `next` (opcional) é a URL a abrir depois da resposta; só é usado ao levar
 * abas JÁ abertas (onde sabemos a URL). Nas regras de rede o redirecionamento é simples, igual ao do bloqueio:
 * um redirect com `regexSubstitution` para página da extensão não é garantido pelo Chrome, e sem ele o site
 * abriria sem perguntar nada.
 */
export const intentPageUrl = (domain: string, next?: string) =>
  chrome.runtime.getURL(`src/ui/intent/index.html?site=${encodeURIComponent(domain)}${next ? `&next=${encodeURIComponent(next)}` : ''}`);

type Rule = chrome.declarativeNetRequest.Rule;
const main = ['main_frame'] as chrome.declarativeNetRequest.ResourceType[];

export function buildRules(plan: BlockPlan): Rule[] {
  const block = plan.block.map((domain, i): Rule => ({
    id: BLOCK_BASE + i,
    priority: 1,
    action: { type: 'redirect', redirect: { url: blockedPageUrl(domain) } },
    condition: { requestDomains: [domain], resourceTypes: main },
  }));
  const intent = plan.intent.map((domain, i): Rule => ({
    id: INTENT_BASE + i,
    priority: 2,
    action: { type: 'redirect', redirect: { url: intentPageUrl(domain) } },
    condition: { requestDomains: [domain], resourceTypes: main },
  }));
  const allow = plan.allow.map((domain, i): Rule => ({
    id: ALLOW_BASE + i,
    priority: 3,
    action: { type: 'allow' },
    condition: { requestDomains: [domain], resourceTypes: main },
  }));
  return [...block, ...intent, ...allow];
}

const domainsIn = (rules: Rule[], from: number, to: number) =>
  rules.filter((r) => r.id >= from && r.id < to).map((r) => r.condition.requestDomains?.[0] ?? '').sort();

/**
 * Regras dinâmicas do declarativeNetRequest (só main_frame). O redirect exige permissão de host,
 * pedida no clique do usuário. Idempotente: só mexe se o plano mudou.
 */
export class ChromeBlocker implements BlockerPort {
  async apply(plan: BlockPlan): Promise<void> {
    const current = await chrome.declarativeNetRequest.getDynamicRules();
    const was = {
      block: domainsIn(current, BLOCK_BASE, INTENT_BASE),
      intent: domainsIn(current, INTENT_BASE, ALLOW_BASE),
      allow: domainsIn(current, ALLOW_BASE, Infinity),
    };
    if (JSON.stringify(was) === JSON.stringify(plan)) return;

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: current.map((r) => r.id),
      addRules: buildRules(plan),
    });

    // Abas já abertas não passam pelo DNR: leva-as para o destino certo.
    await this.redirectOpenTabs(plan.block.filter((d) => !was.block.includes(d)), (d, tab) => blockedPageUrl(d, undefined, tab.url, true));
    await this.redirectOpenTabs(plan.intent.filter((d) => !was.intent.includes(d)), (d, tab) => intentPageUrl(d, tab.url));
  }

  private async redirectOpenTabs(domains: string[], target: (domain: string, tab: chrome.tabs.Tab) => string) {
    for (const domain of domains) {
      const tabs = await chrome.tabs.query({ url: hostPattern(domain) });
      for (const tab of tabs) if (tab.id !== undefined) await chrome.tabs.update(tab.id, { url: target(domain, tab) });
    }
  }
}
