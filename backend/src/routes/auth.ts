import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { createAuthToken } from '../services/authService';
import { getAuthUser, requireAuth } from '../middleware/auth';
import {
  hashPassword,
  isLegacyPasswordHash,
  verifyPassword,
} from '../services/passwordService';

const loginSchema = z.object({
  password: z.string().min(1),
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(160).optional(),
});

const router = Router();

const SESSION_COOKIE = 'slw_session';
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

function getSessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: env.nodeEnv === 'production',
    expires: new Date(expiresAt),
    path: '/',
  };
}

async function getLoginUser(email: string | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  try {
    if (normalizedEmail) {
      return prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          role: 'admin',
          isActive: true,
        },
      });
    }

    const defaultAdmin = await prisma.user.findFirst({
      where: {
        email: env.authDefaultAdminEmail.trim().toLowerCase(),
        role: 'admin',
        isActive: true,
      },
    });
    if (defaultAdmin) {
      return defaultAdmin;
    }

    return prisma.user.findFirst({
      where: {
        role: 'admin',
        isActive: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  } catch {
    // If DB is unavailable, legacy ADMIN_API_KEY fallback may still be allowed.
    return null;
  }
}

router.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await getLoginUser(payload.email);

    let claims:
      | {
          sub: number | null;
          name: string;
          role: 'admin';
        }
      | null = null;

    if (user) {
      const storedHash = user.passwordHash ?? '';
      let passwordValid = storedHash
        ? await verifyPassword(storedHash, payload.password)
        : false;

      if (
        !passwordValid &&
        isLegacyPasswordHash(storedHash) &&
        env.allowLegacyApiKeyLogin &&
        env.adminApiKey &&
        payload.password === env.adminApiKey
      ) {
        passwordValid = true;
        const upgradedHash = await hashPassword(payload.password);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: upgradedHash },
        });
      }

      if (passwordValid) {
        claims = {
          sub: user.id,
          name: payload.name?.trim() || user.name,
          role: 'admin',
        };
      }
    }

    if (
      !claims &&
      env.allowLegacyApiKeyLogin &&
      env.adminApiKey &&
      payload.password === env.adminApiKey
    ) {
      claims = {
        sub: null,
        name: payload.name?.trim() || 'SLW Admin',
        role: 'admin',
      };
    }

    if (!claims) {
      throw new HttpError(401, 'Invalid credentials');
    }

    const session = await createAuthToken(claims);

    res.cookie(SESSION_COOKIE, session.token, getSessionCookieOptions(session.expiresAt));

    res.json({
      expiresAt: session.expiresAt,
      user: claims,
    });
  })
);

router.get(
  '/session',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authUser = getAuthUser(req);
    if (!authUser) {
      throw new HttpError(401, 'Authentication required');
    }

    res.json({
      user: {
        id: authUser.id,
        name: authUser.name,
        role: authUser.role,
      },
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    res.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: env.nodeEnv === 'production',
    });
    res.status(204).send();
  })
);

export { router as authRouter };
