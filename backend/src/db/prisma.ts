import { PrismaClient } from '@prisma/client';
import { isDevelopment } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __slwPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__slwPrisma ??
  new PrismaClient({
    log: isDevelopment ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (isDevelopment) {
  global.__slwPrisma = prisma;
}
