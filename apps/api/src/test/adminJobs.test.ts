import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Admin Job Monitoring & Queue Endpoints (GET /api/admin/jobs*)', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3002';
  const WEB_ORIGIN = 'http://localhost:3000';

  let normalUserId: string;
  let normalUserEmail: string;
  let normalUserCookie: string[];

  let adminUserId: string;
  let adminUserEmail: string;
  let adminUserCookie: string[];

  let sampleJobId: string;
  let failedJobId: string;

  beforeEach(async () => {
    // Clean up any previous test accounts and jobs
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.adminjobs.' } },
    });

    // 1. Create Normal USER
    normalUserEmail = `test.adminjobs.user.${Date.now()}.${Math.random()}@example.com`;
    const regNormal = await request(app)
      .post('/api/auth/register')
      .set('Origin', WEB_ORIGIN)
      .send({
        name: 'Mahasiswa Biasa',
        email: normalUserEmail,
        password: 'PasswordNormal123!',
      });
    expect(regNormal.status).toBe(201);

    const loginNormal = await request(app)
      .post('/api/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({
        email: normalUserEmail,
        password: 'PasswordNormal123!',
      });
    expect(loginNormal.status).toBe(200);
    normalUserId = loginNormal.body.user.id;
    normalUserCookie = loginNormal.headers['set-cookie'] as unknown as string[];

    // 2. Create ADMIN user
    adminUserEmail = `test.adminjobs.boss.${Date.now()}.${Math.random()}@example.com`;
    const regAdmin = await request(app)
      .post('/api/auth/register')
      .set('Origin', WEB_ORIGIN)
      .send({
        name: 'Admin Boss',
        email: adminUserEmail,
        password: 'PasswordAdmin123!',
      });
    expect(regAdmin.status).toBe(201);
    adminUserId = regAdmin.body.user.id;

    // Promote to ADMIN directly in database
    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: 'ADMIN' },
    });

    const loginAdminRes = await request(app)
      .post('/api/admin/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: adminUserEmail,
        password: 'PasswordAdmin123!',
      });
    expect(loginAdminRes.status).toBe(200);
    adminUserCookie = loginAdminRes.headers['set-cookie'] as unknown as string[];

    // 3. Seed test processing jobs for normalUser
    const started = new Date(Date.now() - 60000);
    const completed = new Date(Date.now() - 10000);

    const job1 = await prisma.processingJob.create({
      data: {
        userId: normalUserId,
        type: 'DOCUMENT_EXTRACTION',
        status: 'COMPLETED',
        attempts: 1,
        maxAttempts: 3,
        startedAt: started,
        completedAt: completed,
        payload: { sensitivePrompt: 'Secret User Prompt', rawText: 'Private Content' },
      },
    });
    sampleJobId = job1.id;

    const failedJob = await prisma.processingJob.create({
      data: {
        userId: normalUserId,
        type: 'AI_SUMMARY_GENERATION',
        status: 'FAILED',
        attempts: 3,
        maxAttempts: 3,
        errorCode: 'AI_RATE_LIMIT_EXCEEDED',
        errorMessage: 'Raw unformatted provider error with key=sk-secret-12345678',
        startedAt: started,
        failedAt: completed,
        payload: { prompt: 'User essay prompt' },
      },
    });
    failedJobId = failedJob.id;

    // Another job for adminUser
    await prisma.processingJob.create({
      data: {
        userId: adminUserId,
        type: 'AI_QUIZ_GENERATION',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.adminjobs.' } },
    });
  });

  describe('Access Control & Boundaries', () => {
    it('rejects anonymous requests to /api/admin/jobs with 401', async () => {
      const res = await request(app).get('/api/admin/jobs');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects anonymous requests to /api/admin/jobs/:id with 401', async () => {
      const res = await request(app).get(`/api/admin/jobs/${sampleJobId}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects anonymous requests to /api/admin/jobs/queues/summary with 401', async () => {
      const res = await request(app).get('/api/admin/jobs/queues/summary');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects authenticated non-admin USER with 403 on all job monitoring endpoints', async () => {
      const resList = await request(app)
        .get('/api/admin/jobs')
        .set('Cookie', normalUserCookie);
      expect(resList.status).toBe(403);
      expect(resList.body.error.code).toBe('FORBIDDEN');

      const resDetail = await request(app)
        .get(`/api/admin/jobs/${sampleJobId}`)
        .set('Cookie', normalUserCookie);
      expect(resDetail.status).toBe(403);
      expect(resDetail.body.error.code).toBe('FORBIDDEN');

      const resQueues = await request(app)
        .get('/api/admin/jobs/queues/summary')
        .set('Cookie', normalUserCookie);
      expect(resQueues.status).toBe(403);
      expect(resQueues.body.error.code).toBe('FORBIDDEN');
    });

    it('immediately denies access with 403 on next request if ADMIN role is revoked in DB', async () => {
      // 1. Initial request works
      const res1 = await request(app)
        .get('/api/admin/jobs')
        .set('Cookie', adminUserCookie);
      expect(res1.status).toBe(200);

      // 2. Revoke role in database
      await prisma.user.update({
        where: { id: adminUserId },
        data: { role: 'USER' },
      });

      // 3. Next request rejected with 403
      const res2 = await request(app)
        .get('/api/admin/jobs')
        .set('Cookie', adminUserCookie);
      expect(res2.status).toBe(403);
      expect(res2.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('List Jobs (GET /api/admin/jobs)', () => {
    it('returns paginated job list with safe projection for ADMIN', async () => {
      const res = await request(app)
        .get('/api/admin/jobs?limit=10&page=1')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store, private');
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(typeof res.body.pagination.totalItems).toBe('number');

      const item = res.body.items[0];
      expect(item.id).toBeDefined();
      expect(item.type).toBeDefined();
      expect(item.status).toBeDefined();
      expect(item.userId).toBeDefined();
      expect(item.userName).toBeDefined();
      expect(typeof item.attempts).toBe('number');
      expect(typeof item.maxAttempts).toBe('number');
      expect(item.createdAt).toBeDefined();

      // SECURITY & PRIVACY INVARIANTS:
      // Secrets, payload, prompt, and user email MUST NOT be exposed in list
      expect((item as any).payload).toBeUndefined();
      expect((item as any).rawText).toBeUndefined();
      expect((item as any).sensitivePrompt).toBeUndefined();
      expect((item as any).email).toBeUndefined();
      expect((item as any).userEmail).toBeUndefined();
    });

    it('filters jobs accurately by status and type', async () => {
      const resFailed = await request(app)
        .get('/api/admin/jobs?status=FAILED')
        .set('Cookie', adminUserCookie);

      expect(resFailed.status).toBe(200);
      expect(resFailed.body.items.length).toBeGreaterThanOrEqual(1);
      expect(resFailed.body.items.every((j: any) => j.status === 'FAILED')).toBe(true);

      const resExtraction = await request(app)
        .get('/api/admin/jobs?type=DOCUMENT_EXTRACTION')
        .set('Cookie', adminUserCookie);

      expect(resExtraction.status).toBe(200);
      expect(resExtraction.body.items.every((j: any) => j.type === 'DOCUMENT_EXTRACTION')).toBe(true);
    });

    it('filters jobs accurately by userId and jobId', async () => {
      const resUser = await request(app)
        .get(`/api/admin/jobs?userId=${normalUserId}`)
        .set('Cookie', adminUserCookie);

      expect(resUser.status).toBe(200);
      expect(resUser.body.items.length).toBe(2);
      expect(resUser.body.items.every((j: any) => j.userId === normalUserId)).toBe(true);

      const resJob = await request(app)
        .get(`/api/admin/jobs?jobId=${sampleJobId}`)
        .set('Cookie', adminUserCookie);

      expect(resJob.status).toBe(200);
      expect(resJob.body.items.length).toBe(1);
      expect(resJob.body.items[0].id).toBe(sampleJobId);
    });

    it('enforces maximum 90-day date range and validates startDate <= endDate', async () => {
      // 1. startDate > endDate -> 400
      const resReversed = await request(app)
        .get('/api/admin/jobs?startDate=2026-10-15T00:00:00.000Z&endDate=2026-10-10T00:00:00.000Z')
        .set('Cookie', adminUserCookie);

      expect(resReversed.status).toBe(400);
      expect(resReversed.body.error.code).toBe('VALIDATION_ERROR');

      // 2. Range > 90 days -> 400
      const resTooWide = await request(app)
        .get('/api/admin/jobs?startDate=2026-01-01T00:00:00.000Z&endDate=2026-06-01T00:00:00.000Z')
        .set('Cookie', adminUserCookie);

      expect(resTooWide.status).toBe(400);
      expect(resTooWide.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Detail Job (GET /api/admin/jobs/:id)', () => {
    it('returns 404 for non-existent job ID', async () => {
      const res = await request(app)
        .get('/api/admin/jobs/cuid_non_existent_job_123')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('returns safe operational detail for successful completed job', async () => {
      const res = await request(app)
        .get(`/api/admin/jobs/${sampleJobId}`)
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store, private');
      expect(res.body.id).toBe(sampleJobId);
      expect(res.body.type).toBe('DOCUMENT_EXTRACTION');
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.userId).toBe(normalUserId);
      expect(res.body.userName).toBe('Mahasiswa Biasa');
      expect(res.body.attempts).toBe(1);
      expect(res.body.maxAttempts).toBe(3);
      expect(typeof res.body.durationMs).toBe('number');
      expect(res.body.durationMs).toBe(50000); // 60000 - 10000 = 50000ms
      expect(res.body.errorCode).toBeNull();
      expect(res.body.safeErrorMessage).toBeNull();

      // Database history preserved even if not present in transient BullMQ memory
      expect(['waiting', 'active', 'delayed', 'completed', 'failed', 'not_found', 'unavailable']).toContain(
        res.body.queueStatus
      );

      // SECURITY CHECK:
      expect((res.body as any).payload).toBeUndefined();
      expect((res.body as any).rawText).toBeUndefined();
      expect((res.body as any).sensitivePrompt).toBeUndefined();
      expect((res.body as any).email).toBeUndefined();
    });

    it('returns safe error explanation for failed job without leaking provider secret or stack trace', async () => {
      const res = await request(app)
        .get(`/api/admin/jobs/${failedJobId}`)
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(failedJobId);
      expect(res.body.status).toBe('FAILED');
      expect(res.body.errorCode).toBe('AI_RATE_LIMIT_EXCEEDED');
      // Safe mapped explanation in Indonesian
      expect(res.body.safeErrorMessage).toBe('Batas frekuensi permintaan AI terlampaui (rate limit).');

      // CRITICAL SECURITY: Raw provider error containing secret token MUST NEVER be exposed
      expect((res.body as any).errorMessage).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('sk-secret-12345678');
      expect((res.body as any).payload).toBeUndefined();
    });

    it('does not retrigger jobs or invoke external AI providers on read queries', async () => {
      // Fetching job status 3 times in a row should be completely idempotent and read-only
      const res1 = await request(app).get(`/api/admin/jobs/${sampleJobId}`).set('Cookie', adminUserCookie);
      const res2 = await request(app).get(`/api/admin/jobs/${sampleJobId}`).set('Cookie', adminUserCookie);
      const res3 = await request(app).get(`/api/admin/jobs/${sampleJobId}`).set('Cookie', adminUserCookie);

      expect(res1.body.status).toBe('COMPLETED');
      expect(res2.body.status).toBe('COMPLETED');
      expect(res3.body.status).toBe('COMPLETED');
      expect(res1.body.attempts).toBe(1);
      expect(res3.body.attempts).toBe(1);
    });
  });

  describe('Queues Summary (GET /api/admin/jobs/queues/summary)', () => {
    it('returns structured queue states with retention disclaimer notice', async () => {
      const res = await request(app)
        .get('/api/admin/jobs/queues/summary')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store, private');
      expect(Array.isArray(res.body.queues)).toBe(true);
      expect(res.body.queues.length).toBe(2);

      const docQueue = res.body.queues.find((q: any) => q.name.includes('document'));
      expect(docQueue).toBeDefined();
      expect(docQueue.label).toBe('Pemrosesan Dokumen');
      expect(['available', 'unavailable']).toContain(docQueue.status);

      const aiQueue = res.body.queues.find((q: any) => q.name.includes('ai'));
      expect(aiQueue).toBeDefined();
      expect(aiQueue.label).toContain('Generasi AI');
      expect(['available', 'unavailable']).toContain(aiQueue.status);

      // Verify disclaimer note is present
      expect(res.body.retentionNotice).toBeDefined();
      expect(res.body.retentionNotice).toContain('retensi');
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
