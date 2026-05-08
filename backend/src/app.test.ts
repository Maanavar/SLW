import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

function getErrorMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return '';
  }
  const errorValue = (body as { error?: unknown }).error;
  return typeof errorValue === 'string' ? errorValue : '';
}

function getSessionRole(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('user' in body)) {
    return null;
  }

  const userValue = (body as { user?: unknown }).user;
  if (typeof userValue !== 'object' || userValue === null || !('role' in userValue)) {
    return null;
  }

  const roleValue = (userValue as { role?: unknown }).role;
  return typeof roleValue === 'string' ? roleValue : null;
}

describe('backend API essential guards', () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let client: ReturnType<typeof request.agent>;

  beforeAll(() => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    process.env.PORT = process.env.PORT || '3001';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb';
    process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-admin-password';
    process.env.AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || 'test-auth-secret';
    process.env.AUTH_SESSION_HOURS = process.env.AUTH_SESSION_HOURS || '12';
  });

  async function getApp() {
    const { createApp } = await import('./app');
    return createApp();
  }

  beforeAll(async () => {
    app = await getApp();
    client = request.agent(app);
  });

  async function loginAndGetCookie() {
    const res = await client
      .post('/api/auth/login')
      .send({ password: process.env.ADMIN_API_KEY });
    expect(res.status).toBe(200);
    const cookiesHeader = res.headers['set-cookie'] as unknown;
    const cookies = Array.isArray(cookiesHeader)
      ? cookiesHeader.filter((cookie): cookie is string => typeof cookie === 'string')
      : [];
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('slw_session='));
    expect(typeof sessionCookie).toBe('string');
    return sessionCookie as string;
  }

  it(
    'returns 401 for protected APIs without authentication',
    async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(401);
      expect(getErrorMessage(res.body)).toContain('Authentication required');
    },
    15000
  );

  it('authenticates login and exposes /api/auth/session with cookie session', async () => {
    const cookie = await loginAndGetCookie();
    const session = await client
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(session.status).toBe(200);
    expect(getSessionRole(session.body)).toBe('admin');
  });

  it('rejects invalid job payload shape (zod validation)', async () => {
    const cookie = await loginAndGetCookie();

    const res = await client
      .post('/api/jobs')
      .set('Cookie', cookie)
      .send({
        customerId: 1,
        date: '2026-05-05',
        amount: 10,
      });

    expect(res.status).toBe(400);
  });

  it('rejects invalid payment payload shape (zod validation)', async () => {
    const cookie = await loginAndGetCookie();

    const res = await client
      .post('/api/payments')
      .set('Cookie', cookie)
      .send({
        customerId: 1,
        amount: -10,
        date: 'bad-date',
        paymentMode: 'Cash',
      });

    expect(res.status).toBe(400);
  });

  it('rejects invalid expense payload shape (zod validation)', async () => {
    const cookie = await loginAndGetCookie();

    const res = await client
      .post('/api/expenses')
      .set('Cookie', cookie)
      .send({
        category: 'Other',
        description: '',
        amount: 0,
        date: '2026-05-05',
      });

    expect(res.status).toBe(400);
  });

  it('guards bulk-delete endpoints unless ?all=true is explicitly set', async () => {
    const cookie = await loginAndGetCookie();

    const [jobsRes, paymentsRes, expensesRes] = await Promise.all([
      client.delete('/api/jobs').set('Cookie', cookie),
      client.delete('/api/payments').set('Cookie', cookie),
      client.delete('/api/expenses').set('Cookie', cookie),
    ]);

    expect(jobsRes.status).toBe(400);
    expect(paymentsRes.status).toBe(400);
    expect(expensesRes.status).toBe(400);
  });
});
