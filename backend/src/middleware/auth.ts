import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
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

function parseBearerToken(req: Request): string | null {
  const authorization = req.header('authorization');
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim() || null;
}

export function getAuthUser(req: Request): AuthenticatedUser | null {
  const authReq = req as AuthenticatedRequest;
  return authReq.authUser ?? null;
}

function getUserFromAdminKey(req: Request): AuthenticatedUser | null {
  if (!env.adminApiKey) {
    return null;
  }

  const provided = req.header('x-admin-key');
  if (provided !== env.adminApiKey) {
    return null;
  }

  const actorName = req.header('x-actor-name')?.trim();
  return {
    id: null,
    name: actorName || 'Admin Key User',
    role: 'admin',
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const bearer = parseBearerToken(req);
  if (bearer) {
    const claims = verifyAuthToken(bearer);
    if (!claims) {
      throw new HttpError(401, 'Session expired or invalid token');
    }
    (req as AuthenticatedRequest).authUser = {
      id: claims.sub,
      name: claims.name,
      role: claims.role,
    };
    return next();
  }

  const adminKeyUser = getUserFromAdminKey(req);
  if (adminKeyUser) {
    (req as AuthenticatedRequest).authUser = adminKeyUser;
    return next();
  }

  throw new HttpError(401, 'Authentication required');
}
