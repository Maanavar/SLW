import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './httpError';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}
