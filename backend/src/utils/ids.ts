import { HttpError } from '../middleware/httpError';

export function parseId(rawValue: string, label = 'id'): number {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `Invalid ${label}: ${rawValue}`);
  }
  return parsed;
}
