import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DATE = '2026-05-05';

describe('jobs CRUD', () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let client: ReturnType<typeof request.agent>;
  let sessionCookie: string;
  let testCustomerId = 0;
  let testJobId = 0;

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
      .send({ name: '__vitest_jobs_customer__', shortCode: 'VITJC', type: 'Monthly' });
    expect(customerRes.status).toBe(201);
    testCustomerId = customerRes.body.id as number;
  }, 20000);

  afterAll(async () => {
    if (testJobId) {
      await client.delete(`/api/jobs/${testJobId}`).set('Cookie', sessionCookie);
    }
    if (testCustomerId) {
      await client.delete(`/api/customers/${testCustomerId}`).set('Cookie', sessionCookie);
    }
  });

  it('rejects a job payload missing required fields (400)', async () => {
    const res = await client
      .post('/api/jobs')
      .set('Cookie', sessionCookie)
      .send({ customerId: testCustomerId, date: TEST_DATE, amount: 100 }); // missing workTypeName and quantity
    expect(res.status).toBe(400);
  });

  it('creates a job (POST /api/jobs → 201)', async () => {
    const res = await client
      .post('/api/jobs')
      .set('Cookie', sessionCookie)
      .send({
        customerId: testCustomerId,
        workTypeName: 'Test Work',
        quantity: 2,
        amount: 500,
        date: TEST_DATE,
      });
    expect(res.status).toBe(201);
    expect(res.body.customerId).toBe(testCustomerId);
    expect(res.body.workTypeName).toBe('Test Work');
    expect(typeof res.body.id).toBe('number');
    testJobId = res.body.id as number;
  });

  it('lists jobs filtered by customer (GET /api/jobs?customerId → 200)', async () => {
    const res = await client
      .get(`/api/jobs?customerId=${testCustomerId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as Array<{ id: number }>).find((j) => j.id === testJobId);
    expect(found).toBeDefined();
  });

  it('returns paginated jobs with correct envelope shape (GET /api/jobs/page → 200)', async () => {
    const res = await client
      .get(`/api/jobs/page?customerId=${testCustomerId}&limit=10&offset=0`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('reads back the single job (GET /api/jobs/:id → 200)', async () => {
    const res = await client
      .get(`/api/jobs/${testJobId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testJobId);
    expect(res.body.workTypeName).toBe('Test Work');
  });

  it('updates the job work type name (PUT /api/jobs/:id → 200)', async () => {
    const res = await client
      .put(`/api/jobs/${testJobId}`)
      .set('Cookie', sessionCookie)
      .send({ workTypeName: 'Updated Work' });
    expect(res.status).toBe(200);
    expect(res.body.workTypeName).toBe('Updated Work');
    expect(res.body.id).toBe(testJobId);
  });

  it('returns 404 for a non-existent job id', async () => {
    const res = await client.get('/api/jobs/999999999').set('Cookie', sessionCookie);
    expect(res.status).toBe(404);
  });

  it('deletes the job (DELETE /api/jobs/:id → 204)', async () => {
    const res = await client
      .delete(`/api/jobs/${testJobId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(204);
  });

  it('returns 404 after deletion (GET /api/jobs/:id → 404)', async () => {
    const res = await client
      .get(`/api/jobs/${testJobId}`)
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(404);
    testJobId = 0;
  });
});
