import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../config/env';

const TOKEN_VERSION = 'slw-auth-v1';
const AUTH_ALGORITHM = 'HS256';

export interface AuthClaims {
  sub: number | null;
  name: string;
  role: 'admin';
}

interface AuthTokenPayload extends JWTPayload {
  ver: string;
  uid: number | null;
  name: string;
  role: 'admin';
}

const signingKey = new TextEncoder().encode(env.authSessionSecret);

function getExpiresAtIso(nowMs: number): string {
  const expiresAt = new Date(nowMs + env.authSessionHours * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

export async function createAuthToken(
  claims: AuthClaims
): Promise<{ token: string; expiresAt: string }> {
  const nowMs = Date.now();
  const payload: AuthTokenPayload = {
    ver: TOKEN_VERSION,
    uid: claims.sub,
    name: claims.name,
    role: claims.role,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: AUTH_ALGORITHM, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${env.authSessionHours}h`)
    .sign(signingKey);

  return {
    token,
    expiresAt: getExpiresAtIso(nowMs),
  };
}

export async function verifyAuthToken(token: string): Promise<AuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: [AUTH_ALGORITHM],
    });

    const version = payload.ver;
    const role = payload.role;
    const name = payload.name;
    const uid = payload.uid;

    if (version !== TOKEN_VERSION || role !== 'admin' || typeof name !== 'string' || !name.trim()) {
      return null;
    }

    const userId = typeof uid === 'number' && Number.isInteger(uid) && uid > 0 ? uid : null;

    return {
      sub: userId,
      name: name.trim(),
      role: 'admin',
    };
  } catch {
    return null;
  }
}
