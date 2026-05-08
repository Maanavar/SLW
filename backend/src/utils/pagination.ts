import type { Request } from 'express';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export function getPagination(req: Request): { limit: number; offset: number } {
  const rawLimit = typeof req.query.limit === 'string' ? req.query.limit : undefined;
  const rawOffset = typeof req.query.offset === 'string' ? req.query.offset : undefined;

  const parsedLimit = parseNonNegativeInteger(rawLimit);
  const parsedOffset = parseNonNegativeInteger(rawOffset);

  return {
    limit: Math.min(Math.max(parsedLimit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    offset: parsedOffset ?? 0,
  };
}
