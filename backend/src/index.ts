import * as Sentry from '@sentry/node';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { env, isDevelopment } from './config/env';
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

const requestedPort = env.port;
let activePort = requestedPort;
let hasStarted = false;

const server = app.listen(requestedPort);

server.on('listening', () => {
  if (hasStarted) {
    return;
  }
  hasStarted = true;
  const address = server.address();
  if (address && typeof address !== 'string') {
    activePort = (address as AddressInfo).port;
  }
  console.log(`SLW backend running on http://localhost:${activePort}`);
  startBackupScheduler();
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE' && isDevelopment) {
    activePort += 1;
    console.warn(
      `Port ${activePort - 1} is already in use. Retrying on http://localhost:${activePort}`
    );
    server.listen(activePort);
    return;
  }

  throw error;
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
