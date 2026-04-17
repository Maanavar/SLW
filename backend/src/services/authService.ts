import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

const TOKEN_VERSION = 'slw-auth-v1';

export interface AuthClaims {
  sub: number | null;
  name: string;
  role: 'admin';
}

interface AuthTokenPayload extends AuthClaims {
  ver: string;
  iat: number;
  exp: number;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function signTokenBody(tokenBody: string): string {
  const signature = createHmac('sha256', env.authSessionSecret).update(tokenBody).digest();
  return toBase64Url(signature);
}

export function createAuthToken(claims: AuthClaims): { token: string; expiresAt: string } {
  const nowMs = Date.now();
  const iat = Math.floor(nowMs / 1000);
  const exp = Math.floor((nowMs + env.authSessionHours * 60 * 60 * 1000) / 1000);

  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      ver: TOKEN_VERSION,
      sub: claims.sub,
      name: claims.name,
      role: claims.role,
      iat,
      exp,
    } satisfies AuthTokenPayload)
  );

  const tokenBody = `${header}.${payload}`;
  const signature = signTokenBody(tokenBody);
  return {
    token: `${tokenBody}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyAuthToken(token: string): AuthClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) {
    return null;
  }

  const tokenBody = `${headerB64}.${payloadB64}`;
  const expectedSignature = signTokenBody(tokenBody);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signatureB64);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }

  try {
    const decodedPayload = JSON.parse(fromBase64Url(payloadB64).toString('utf8')) as Partial<AuthTokenPayload>;
    if (
      decodedPayload.ver !== TOKEN_VERSION ||
      decodedPayload.role !== 'admin' ||
      typeof decodedPayload.name !== 'string' ||
      !decodedPayload.name.trim() ||
      typeof decodedPayload.exp !== 'number' ||
      Date.now() >= decodedPayload.exp * 1000
    ) {
      return null;
    }

    return {
      sub:
        typeof decodedPayload.sub === 'number' && Number.isInteger(decodedPayload.sub) && decodedPayload.sub > 0
          ? decodedPayload.sub
          : null,
      name: decodedPayload.name.trim(),
      role: 'admin',
    };
  } catch {
    return null;
  }
}
