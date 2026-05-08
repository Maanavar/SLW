import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { env, isDevelopment } from './config/env';
import { apiRouter } from './routes';
import { notFoundHandler } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  if (!isDevelopment) {
    app.set('trust proxy', 1);
  }

  app.set('json replacer', (_key: string, value: unknown) =>
    Prisma.Decimal.isDecimal(value) ? value.toNumber() : value
  );

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(isDevelopment ? 'dev' : 'combined'));

  app.get('/', (_req, res) => {
    res.json({
      service: 'slw-backend',
      status: 'running',
      docs: '/api/health',
    });
  });

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
