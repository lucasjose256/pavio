import { hostPattern } from '../../platform/chrome/permissions';

/** Domínios (que precisam de acesso opcional) sem permissão concedida. */
export async function missingAccess(domains: string[]): Promise<string[]> {
  const granted = await Promise.all(domains.map((d) => chrome.permissions.contains({ origins: [hostPattern(d)] })));
  return domains.filter((_, i) => !granted[i]);
}
