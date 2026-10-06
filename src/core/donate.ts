/**
 * Apoio voluntário ao Pavio. Puro: a configuração, a validação dos links e o "Pix copia e cola" (BR Code estático).
 * Nada é enviado: a pessoa copia o código e paga no app do banco dela; o Pavio não vê nem registra nada.
 */

export interface DonationLink {
  label: string;
  url: string;
}

export interface PixConfig {
  /** Chave Pix: CPF/CNPJ (só dígitos), e-mail, telefone (+55…) ou chave aleatória (UUID). */
  key: string;
  /** Nome do recebedor (até 25 letras, sem acento). */
  name: string;
  /** Cidade do recebedor (até 15 letras, sem acento). */
  city: string;
}

export interface DonationConfig {
  pix?: PixConfig;
  links: DonationLink[];
}

/**
 * **Preencha com os seus dados.** Vazio = a aba "Apoie o Pavio" fica escondida.
 * Exemplo: pix: { key: 'voce@email.com', name: 'SEU NOME', city: 'SAO PAULO' }
 *          links: [{ label: 'Apoia.se', url: 'https://apoia.se/pavio' }]
 */
export const DONATION: DonationConfig = { pix: undefined, links: [] };

/** Valores sugeridos (R$). Livre = a pessoa escolhe o valor no app do banco. */
export const SUGGESTED_AMOUNTS = [5, 10, 20] as const;

export function hasDonation(config: DonationConfig = DONATION): boolean {
  return validPix(config.pix) !== undefined || donationLinks(config).length > 0;
}

/** Só links https (qualquer site de apoio). */
export function donationLinks(config: DonationConfig = DONATION): DonationLink[] {
  return config.links.flatMap((l) => {
    try {
      const url = new URL(l.url.trim());
      return url.protocol === 'https:' && l.label.trim() ? [{ label: l.label.trim(), url: url.toString() }] : [];
    } catch {
      return [];
    }
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^\+55\d{10,11}$/;
const DIGITS = /^\d{11}$|^\d{14}$/;

export const isValidPixKey = (key: string): boolean => EMAIL.test(key) || UUID.test(key) || PHONE.test(key) || DIGITS.test(key);

/** Config de Pix válida, ou undefined. */
export function validPix(pix: PixConfig | undefined): PixConfig | undefined {
  if (!pix || !isValidPixKey(pix.key.trim()) || !pix.name.trim() || !pix.city.trim()) return undefined;
  return { key: pix.key.trim(), name: pix.name, city: pix.city };
}

/** CRC16-CCITT (poly 0x1021, init 0xFFFF), exigido no fim do BR Code. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const field = (id: string, value: string): string => `${id}${String(value.length).padStart(2, '0')}${value}`;
/** Sem acento, maiúsculas, só o que o BR Code aceita, limitado ao tamanho do campo. */
const plain = (text: string, max: number): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * "Pix copia e cola" estático. Com `amount` (R$), o valor já vem preenchido; sem, a pessoa digita no app do banco.
 * Devolve undefined se a config for inválida ou o valor não couber (≤ 0 ou > 999999,99).
 */
export function pixPayload(pix: PixConfig | undefined, amount?: number): string | undefined {
  const cfg = validPix(pix);
  if (!cfg) return undefined;
  if (amount !== undefined && !(amount > 0 && amount <= 999_999.99)) return undefined;
  const body = [
    field('00', '01'),
    field('26', field('00', 'br.gov.bcb.pix') + field('01', cfg.key)),
    field('52', '0000'),
    field('53', '986'),
    ...(amount !== undefined ? [field('54', amount.toFixed(2))] : []),
    field('58', 'BR'),
    field('59', plain(cfg.name, 25) || 'PAVIO'),
    field('60', plain(cfg.city, 15) || 'BRASIL'),
    field('62', field('05', '***')),
  ].join('');
  const withCrcId = `${body}6304`;
  return withCrcId + crc16(withCrcId);
}
