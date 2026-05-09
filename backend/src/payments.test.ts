import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DATE = '2026-05-05';

describe('payments CRUD', () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let client: ReturnType<typeof request.agent>;
  let sessionCookie: string;
  let testCustomerId = 0;
  let testPaymentId = 0;

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

    const customerRes = await client
      .post('/api/customers')
      .set('Cookie', sessionCookie)
      .send({ name: '__vitest_payments_customer__', shortCode: 'VITPC', type: 'Monthly' });
    expect(customerRes.status).toBe(201);
    testCustomerId = customerRes.body.id as number;
  }, 20000);

  afterAll(async () => {
    if (testPaymentId) {
      await client.delete(`/api/payments/${testPaymentId}`).set('Cookie', sessionCookie);
    }
    if (testCustomerId) {
      await client.delete(`/api/customers/${testCustomerId}`).set('Cookie', sessionCookie);
    }
  });

  it('rejects a payment with a negative amount (400)', async () => {
    const res = await client
      .post('/api/payments')
      .set('Cookie', sessionCookie)
      .send({
        customerId: testCustomerId,
        amount: -50,
        date: TEST_DATE,
        paymentMode: 'Cash',
      });
    expect(res.status).toBe(400);
  });

  it('rejects a payment with an invalid date format (400)', async () => {
    const res = await client
      .post('/api/payments')
      .set('Cookie', sessionCookie)
      .send({
        customerId: testCustomerId,
        amount: 100,
        date: '05-05-2026',
        paymentMode: 'Cash',
      });
    expect(res.status).toBe(400);
  });

  it('creates a payment (POST /api/payments → 201)', async () => {
    const res = await client
      .post('/api/payments')
      .set('Cookie', sessionCookie)
      .send({
        customerId: testCustomerId,
        amount: 1500,
        date: TEST_DATE,
        paymentMode: 'Cash',
        notes: 'vitest test payment',
      });
    expect(res.status).toBe(201);
    expect(res.body.customerId).toBe(testCustomerId);
    expect(Number(res.body.amount)).toBe(1500);
    expect(res.body.paymentMode).toBe('Cash');
    expect(typeof res.body.id).toBe('number');
    testPaymentId = res.body.id as number;
  });

  it('lists payments filtered by customer (GET /api/payments?customerId → 200)', async () => {
    const res = await client
      .get(`/api/payments?customerId=${testCustomerId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as Array<{ id: number }>).find((p) => p.id === testPaymentId);
    expect(found).toBeDefined();
  });

  it('returns paginated payments with correct envelope shape (GET /api/payments/page → 200)', async () => {
    const res = await client
      .get(`/api/payments/page?customerId=${testCustomerId}&limit=10&offset=0`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('reads back the single payment (GET /api/payments/:id → 200)', async () => {
    const res = await client
      .get(`/api/payments/${testPaymentId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testPaymentId);
    expect(res.body.paymentMode).toBe('Cash');
    expect(Number(res.body.amount)).toBe(1500);
  });

  it('updates the payment amount (PUT /api/payments/:id → 200)', async () => {
    const res = await client
      .put(`/api/payments/${testPaymentId}`)
      .set('Cookie', sessionCookie)
      .send({ amount: 2000 });
    expect(res.status).toBe(200);
    expect(Number(res.body.amount)).toBe(2000);
    expect(res.body.id).toBe(testPaymentId);
  });

  it('returns 404 for a non-existent payment id', async () => {
    const res = await client
      .get('/api/payments/999999999')
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(404);
  });

  it('deletes the payment (DELETE /api/payments/:id → 204)', async () => {
    const res = await client
      .delete(`/api/payments/${testPaymentId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(204);
  });

  it('returns 404 after deletion (GET /api/payments/:id → 404)', async () => {
    const res = await client
      .get(`/api/payments/${testPaymentId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(404);
    testPaymentId = 0;
  });
});
