import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './httpError';
import { isDevelopment } from '../config/env';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.flatten(),
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
  }

  const message = error instanceof Error ? error.message : 'Unknown server error';
  if (isDevelopment) {
    console.error('Unhandled error:', error);
  }

  return res.status(500).json({
    error: message,
  });
}
