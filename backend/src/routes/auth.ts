import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { createAuthToken } from '../services/authService';
import { getAuthUser, requireAuth } from '../middleware/auth';

const loginSchema = z.object({
  password: z.string().min(1),
  name: z.string().trim().min(2).max(80).optional(),
});

const router = Router();

const SESSION_COOKIE = 'slw_session';

function getSessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: env.nodeEnv === 'production',
    expires: new Date(expiresAt),
    path: '/',
  };
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);

    if (!env.adminApiKey) {
      throw new HttpError(503, 'Login is disabled because ADMIN_API_KEY is not configured');
    }

    if (payload.password !== env.adminApiKey) {
      throw new HttpError(401, 'Invalid password');
    }

    const claims = {
      sub: null,
      name: payload.name?.trim() || 'SLW Admin',
      role: 'admin' as const,
    };
    const session = createAuthToken(claims);

    // Set httpOnly cookie (secure) in addition to returning the token in the body
    // The body token is kept for backward compatibility with the existing localStorage flow
    res.cookie(SESSION_COOKIE, session.token, getSessionCookieOptions(session.expiresAt));

    res.json({
      token: session.token,
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
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'strict' });
    res.status(204).send();
  })
);

export { router as authRouter };
