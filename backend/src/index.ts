import * as Sentry from '@sentry/node';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { startBackupScheduler, stopBackupScheduler } from './services/backupService';

if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.nodeEnv === 'production' ? 0.1 : 1.0,
  });
}

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`SLW backend running on http://localhost:${env.port}`);
  startBackupScheduler();
});

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  stopBackupScheduler();
  server.close(() => {
    void prisma.$disconnect().finally(() => {
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
