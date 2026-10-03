import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { HealthResponseSchema, ReadinessResponseSchema } from '@studyflow/shared';

describe('API Health and Readiness Endpoints', () => {
  const app = createApp();

  it('GET /health should return 200 OK and valid health response schema', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('studyflow-api');

    const parseResult = HealthResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);
  });

  it('GET /ready should return valid schema structure and not leak secrets', async () => {
    const res = await request(app).get('/ready');

    // When DB/Redis are down in unit test, status is 503; if running, 200.
    expect([200, 503]).toContain(res.status);
    expect(res.body.service).toBe('studyflow-api');
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.dependencies.database).toBeDefined();
    expect(res.body.dependencies.redis).toBeDefined();

    const parseResult = ReadinessResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('studyflow_dev_password');
    expect(bodyStr).not.toContain('postgresql://');
    expect(bodyStr).not.toContain('redis://');
  });

  it('GET /non-existent-route should return 404 with structured error', async () => {
    const res = await request(app).get('/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
  });
});
