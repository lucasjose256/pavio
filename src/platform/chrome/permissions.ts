/** Padrão de host que cobre o domínio e seus subdomínios, em http e https. */
export const hostPattern = (domain: string) => `*://*.${domain}/*`;

/**
 * Pede acesso aos sites (permissão opcional). Precisa ser chamada direto de um
 * clique do usuário. Retorna true se já tinha ou se o usuário concedeu.
 */
export async function ensureHostAccess(domains: string[]): Promise<boolean> {
  const origins = [...new Set(domains)].map(hostPattern);
  if (origins.length === 0) return true;
  if (await chrome.permissions.contains({ origins })) return true;
  return chrome.permissions.request({ origins });
}
