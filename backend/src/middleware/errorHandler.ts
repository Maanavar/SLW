import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { ZodError } from 'zod';
import { HttpError } from './httpError';
import { isDevelopment } from '../config/env';

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
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

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  ) {
    return res.status(503).json({
      error: 'Database schema is out of date. Run pending Prisma migrations and restart the backend.',
      code: error.code,
    });
  }

  const correlationId = randomUUID();
  const message = error instanceof Error ? error.message : 'Unknown server error';
  console.error(`Unhandled error [${correlationId}]:`, error);
  Sentry.captureException(error);

  if (isDevelopment) {
    return res.status(500).json({
      error: message,
      correlationId,
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    correlationId,
  });
}
