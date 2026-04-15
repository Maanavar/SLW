import { config } from 'dotenv';

config();

function parsePort(rawValue: string | undefined): number {
  const parsed = Number(rawValue ?? '3000');
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${rawValue ?? '(undefined)'}`);
  }
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  adminApiKey: process.env.ADMIN_API_KEY ?? '',
};

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is required. Copy backend/.env.example to backend/.env');
}

export const isDevelopment = env.nodeEnv !== 'production';
