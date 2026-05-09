import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('customers CRUD', () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let client: ReturnType<typeof request.agent>;
  let sessionCookie: string;
  let testCustomerId = 0;

  async function getApp() {
    const { createApp } = await import('./app');
    return createApp();
  }

  function extractSessionCookie(headers: Record<string, unknown>): string {
    const raw = headers['set-cookie'] as unknown;
    const cookies = Array.isArray(raw)
      ? (raw as string[]).filter((c) => typeof c === 'string')
      : [];
    return cookies.find((c) => c.startsWith('slw_session=')) ?? '';
  }

  beforeAll(async () => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb';
    process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-admin-password';
    process.env.AUTH_SESSION_SECRET =
      process.env.AUTH_SESSION_SECRET || 'test-auth-secret';
    process.env.AUTH_SESSION_HOURS = process.env.AUTH_SESSION_HOURS || '12';

    app = await getApp();
    client = request.agent(app);

    const loginRes = await client
      .post('/api/auth/login')
      .send({ password: process.env.ADMIN_API_KEY });
    expect(loginRes.status).toBe(200);
    sessionCookie = extractSessionCookie(loginRes.headers);
    expect(sessionCookie).toBeTruthy();
  }, 15000);

  afterAll(async () => {
    if (testCustomerId) {
      await client.delete(`/api/customers/${testCustomerId}`).set('Cookie', sessionCookie);
    }
  });

  it('rejects a customer payload missing required fields (400)', async () => {
    const res = await client
      .post('/api/customers')
      .set('Cookie', sessionCookie)
      .send({ name: 'Missing fields only' });
    expect(res.status).toBe(400);
  });

  it('creates a customer (POST /api/customers → 201)', async () => {
    const res = await client
      .post('/api/customers')
      .set('Cookie', sessionCookie)
      .send({
        name: '__vitest_customer__',
        shortCode: 'VITC1',
        type: 'Monthly',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('__vitest_customer__');
    expect(typeof res.body.id).toBe('number');
    testCustomerId = res.body.id as number;
  });

  it('reads back the customer (GET /api/customers/:id → 200)', async () => {
    const res = await client
      .get(`/api/customers/${testCustomerId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testCustomerId);
    expect(res.body.shortCode).toBe('VITC1');
    expect(res.body.isActive).toBe(true);
  });

  it('lists all customers and includes the test customer (GET /api/customers → 200)', async () => {
    const res = await client.get('/api/customers').set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as Array<{ id: number }>).find((c) => c.id === testCustomerId);
    expect(found).toBeDefined();
  });

  it('updates the customer name (PUT /api/customers/:id → 200)', async () => {
    const res = await client
      .put(`/api/customers/${testCustomerId}`)
      .set('Cookie', sessionCookie)
      .send({ name: '__vitest_customer_updated__' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('__vitest_customer_updated__');
    expect(res.body.id).toBe(testCustomerId);
  });

  it('returns 404 for a non-existent customer id', async () => {
    const res = await client
      .get('/api/customers/999999999')
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(404);
  });

  it('deletes the customer (DELETE /api/customers/:id → 204)', async () => {
    const res = await client
      .delete(`/api/customers/${testCustomerId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(204);
  });

  it('returns 404 after deletion (GET /api/customers/:id → 404)', async () => {
    const res = await client
      .get(`/api/customers/${testCustomerId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(404);
    testCustomerId = 0;
  });
});
