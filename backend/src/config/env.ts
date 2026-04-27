import { config } from 'dotenv';

config();

function parsePort(rawValue: string | undefined): number {
  const parsed = Number(rawValue ?? '3000');
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${rawValue ?? '(undefined)'}`);
  }
  return parsed;
}

function parseSessionHours(rawValue: string | undefined): number {
  const parsed = Number(rawValue ?? '12');
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 168) {
    throw new Error(`Invalid AUTH_SESSION_HOURS value: ${rawValue ?? '(undefined)'}`);
  }
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL ?? '',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
  adminApiKey: process.env.ADMIN_API_KEY ?? '',
  authSessionSecret: process.env.AUTH_SESSION_SECRET ?? process.env.ADMIN_API_KEY ?? '',
  authSessionHours: parseSessionHours(process.env.AUTH_SESSION_HOURS),
};

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is required. Copy backend/.env.example to backend/.env');
}

if (!env.authSessionSecret) {
  throw new Error('AUTH_SESSION_SECRET or ADMIN_API_KEY is required for authentication.');
}

export const isDevelopment = env.nodeEnv !== 'production';
