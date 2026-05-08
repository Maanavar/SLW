import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './httpError';
import { verifyAuthToken } from '../services/authService';

export interface AuthenticatedUser {
  id: number | null;
  name: string;
  role: 'admin';
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function getAuthUser(req: Request): AuthenticatedUser | null {
  const authReq = req as AuthenticatedRequest;
  return authReq.authUser ?? null;
}

function parseCookieToken(req: Request): string | null {
  return (req.cookies as Record<string, string>)?.slw_session ?? null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  void (async () => {
    const token = parseCookieToken(req);
    if (!token) {
      throw new HttpError(401, 'Authentication required');
    }

    const claims = await verifyAuthToken(token);
    if (!claims) {
      throw new HttpError(401, 'Session expired or invalid token');
    }

    (req as AuthenticatedRequest).authUser = {
      id: claims.sub,
      name: claims.name,
      role: claims.role,
    };

    next();
  })().catch(next);
}
