import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const HASH_SCHEME = 'scrypt';
const HASH_VERSION = 'v1';
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export const LEGACY_PASSWORD_PLACEHOLDER = 'NOT_USED_USE_ADMIN_API_KEY';

function toBase64(value: Buffer): string {
  return value.toString('base64');
}

function fromBase64(value: string): Buffer | null {
  try {
    return Buffer.from(value, 'base64');
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    HASH_SCHEME,
    HASH_VERSION,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    toBase64(salt),
    toBase64(derived),
  ].join('$');
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const parts = hash.split('$');
  if (parts.length !== 7) {
    return false;
  }

  const [scheme, version, nRaw, rRaw, pRaw, saltRaw, digestRaw] = parts;
  if (scheme !== HASH_SCHEME || version !== HASH_VERSION) {
    return false;
  }

  const n = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const salt = fromBase64(saltRaw);
  const expected = fromBase64(digestRaw);
  if (!salt || !expected || expected.length === 0) {
    return false;
  }

  const actual = scryptSync(password, salt, expected.length, {
    N: n,
    r,
    p,
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isLegacyPasswordHash(hash: string): boolean {
  return hash === LEGACY_PASSWORD_PLACEHOLDER;
}
