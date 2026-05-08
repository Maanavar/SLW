export const CUSTOMER_SHORT_CODES = {
  RMP: 'rmp',
  WW: 'ww',
  NM: 'nm',
  WP: 'wp',
  WGN: 'wgn',
  AKR: 'akr',
} as const;

export const CUSTOMER_NAME_TOKENS = {
  RAMANI_MOTORS: 'ramani motors',
  RAMANI_CARS: 'ramani cars',
  WAGEN_AUTOS: 'wagen autos',
  MAHALING: 'mahaling',
  MAHALINGAM: 'mahalingam',
  MAHALINGHAM: 'mahalingham',
  MAHALINHAM: 'mahalinham',
} as const;

export function normalizeCustomerCode(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

export function normalizeCustomerLabel(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

export function normalizeCustomerToken(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export function isRmpCustomer(shortCode?: string | null, name?: string | null): boolean {
  const code = normalizeCustomerCode(shortCode).replace(/\s/g, '');
  const label = normalizeCustomerLabel(name);
  return code === CUSTOMER_SHORT_CODES.RMP || label.includes(CUSTOMER_NAME_TOKENS.RAMANI_MOTORS);
}

export function isWwCustomer(shortCode?: string | null, name?: string | null): boolean {
  const code = normalizeCustomerCode(shortCode).replace(/\s/g, '');
  const label = normalizeCustomerLabel(name);
  return code === CUSTOMER_SHORT_CODES.WW || label.includes(CUSTOMER_NAME_TOKENS.RAMANI_CARS);
}

export function isMahalingamCustomerLabel(
  shortCode?: string | null,
  name?: string | null
): boolean {
  const code = normalizeCustomerCode(shortCode);
  const token = normalizeCustomerToken(name);
  return (
    code === CUSTOMER_SHORT_CODES.NM ||
    token.includes(CUSTOMER_NAME_TOKENS.MAHALING) ||
    token.includes(CUSTOMER_NAME_TOKENS.MAHALINGAM) ||
    token.includes(CUSTOMER_NAME_TOKENS.MAHALINGHAM) ||
    token.includes(CUSTOMER_NAME_TOKENS.MAHALINHAM)
  );
}

export function isWagenAutosCustomerLabel(name?: string | null, shortCode?: string | null): boolean {
  const code = normalizeCustomerCode(shortCode);
  const label = normalizeCustomerLabel(name);
  return (
    code === CUSTOMER_SHORT_CODES.WP ||
    code === CUSTOMER_SHORT_CODES.WGN ||
    label === CUSTOMER_NAME_TOKENS.WAGEN_AUTOS
  );
}

