import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Material AI Summary Endpoints & Quota Verification', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];
  let semAId: string;
  let courseAId: string;
  let readyMaterialAId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.summary.' } },
    });

    // Create User A
    const emailA = `test.summary.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Summary User A',
        email: emailA,
        password: 'PasswordSangatKuat123!',
      });
    const loginA = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: emailA,
        password: 'PasswordSangatKuat123!',
      });
    userAId = loginA.body.user.id;
    cookieA = loginA.headers['set-cookie'] as unknown as string[];

    // Create User B
    const emailB = `test.summary.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Summary User B',
        email: emailB,
        password: 'PasswordSangatKuat123!',
      });
    const loginB = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: emailB,
        password: 'PasswordSangatKuat123!',
      });
    userBId = loginB.body.user.id;
    cookieB = loginB.headers['set-cookie'] as unknown as string[];

    // Create Semester & Course for User A
    const semResA = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Ganjil 2026', academicYear: '2026/2027' });
    semAId = semResA.body.semester.id;

    const courseResA = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ semesterId: semAId, name: 'Kecerdasan Buatan', code: 'IF3110' });
    courseAId = courseResA.body.course.id;

    // Create a READY Material with extracted pages for User A
    const mat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Materi Kuliah AI Bab 1',
        originalFilename: 'kuliah-ai-bab1.pdf',
        storageKey: `materials/${userAId}/test-ai.pdf`,
        mimeType: 'application/pdf',
        bytes: 15000,
        pageCount: 2,
        status: 'READY',
      },
    });
    readyMaterialAId = mat.id;

    await prisma.materialPage.createMany({
      data: [
        {
          materialId: readyMaterialAId,
          pageNumber: 1,
          extractedText:
            'Kecerdasan Buatan adalah bidang ilmu komputer yang menekankan penciptaan mesin cerdas.',
          characterCount: 88,
        },
        {
          materialId: readyMaterialAId,
          pageNumber: 2,
          extractedText:
            'Aplikasi AI mencakup pengolahan bahasa alami, visi komputer, dan sistem pakar.',
          characterCount: 80,
        },
      ],
    });
  });

  it('GET /api/materials/usage/ai should return initial AI quota status', async () => {
    const res = await request(app)
      .get('/api/materials/usage/ai')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(res.status).toBe(200);
    expect(res.body.quota).toBeDefined();
    expect(res.body.quota.dailyLimit).toBe(20);
    expect(res.body.quota.dailyUsed).toBe(0);
    expect(res.body.quota.dailyRemaining).toBe(20);
    expect(res.body.quota.activeJobsLimit).toBe(2);
    expect(res.body.quota.activeJobsCount).toBe(0);
  });

  it('POST /api/materials/:id/summary should enqueue summary generation and reserve quota', async () => {
    const res = await request(app)
      .post(`/api/materials/${readyMaterialAId}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});

    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.status).toBe('QUEUED');
    expect(res.body.summary.materialId).toBe(readyMaterialAId);

    // Verify database state: AiUsage incremented
    const usage = await prisma.aiUsage.findUnique({
      where: { userId: userAId },
    });
    expect(usage?.dailyGenerationCount).toBe(1);
    expect(usage?.activeJobsCount).toBe(1);

    // Verify OutboxEvent created
    const outbox = await prisma.outboxEvent.findFirst({
      where: { eventType: 'AI_SUMMARY_REQUESTED', aggregateId: res.body.jobId },
    });
    expect(outbox).not.toBeNull();
  });

  it('POST /api/materials/:id/summary duplicate request should not reserve duplicate quota', async () => {
    // First request
    const res1 = await request(app)
      .post(`/api/materials/${readyMaterialAId}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});
    expect(res1.status).toBe(202);

    // Second request while first is still QUEUED (duplicate click)
    const res2 = await request(app)
      .post(`/api/materials/${readyMaterialAId}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});
    expect(res2.status).toBe(202);
    expect(res2.body.jobId).toBe(res1.body.jobId);

    // Verify daily count is still 1, NOT 2
    const usage = await prisma.aiUsage.findUnique({
      where: { userId: userAId },
    });
    expect(usage?.dailyGenerationCount).toBe(1);
    expect(usage?.activeJobsCount).toBe(1);
  });

  it('POST /api/materials/:id/summary should reject if material belongs to another user', async () => {
    const res = await request(app)
      .post(`/api/materials/${readyMaterialAId}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({});

    expect(res.status).toBe(403);
  });

  it('POST /api/materials/:id/summary should reject if course is archived', async () => {
    await prisma.course.update({
      where: { id: courseAId },
      data: { archivedAt: new Date() },
    });

    const res = await request(app)
      .post(`/api/materials/${readyMaterialAId}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COURSE_ARCHIVED');
  });

  it('POST /api/materials/:id/summary should reject if material is not READY', async () => {
    const unreadyMat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Unready Material',
        originalFilename: 'unready.pdf',
        storageKey: `materials/${userAId}/unready.pdf`,
        mimeType: 'application/pdf',
        bytes: 5000,
        status: 'PROCESSING',
      },
    });

    const res = await request(app)
      .post(`/api/materials/${unreadyMat.id}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATERIAL_NOT_READY');
  });

  it('POST /api/materials/:id/summary should enforce daily quota limit (20)', async () => {
    // Seed user usage to dailyLimit = 20
    await prisma.aiUsage.upsert({
      where: { userId: userAId },
      create: {
        userId: userAId,
        dailyGenerationCount: 20,
        activeJobsCount: 0,
      },
      update: {
        dailyGenerationCount: 20,
        activeJobsCount: 0,
      },
    });

    const res = await request(app)
      .post(`/api/materials/${readyMaterialAId}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AI_DAILY_QUOTA_EXCEEDED');
  });

  it('POST /api/materials/:id/summary should enforce max concurrent jobs limit (2)', async () => {
    // Seed user usage to activeJobsCount = 2
    await prisma.aiUsage.upsert({
      where: { userId: userAId },
      create: {
        userId: userAId,
        dailyGenerationCount: 5,
        activeJobsCount: 2,
      },
      update: {
        dailyGenerationCount: 5,
        activeJobsCount: 2,
      },
    });

    const res = await request(app)
      .post(`/api/materials/${readyMaterialAId}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AI_CONCURRENT_LIMIT_EXCEEDED');
  });

  it('POST /api/materials/:id/summary parallel requests (double-click) should result in exactly 1 job and 1 quota reservation', async () => {
    // Fire 5 concurrent requests on the same material simultaneously
    const responses = await Promise.all([
      request(app).post(`/api/materials/${readyMaterialAId}/summary`).set('Origin', TRUSTED_ORIGIN).set('Cookie', cookieA).send({}),
      request(app).post(`/api/materials/${readyMaterialAId}/summary`).set('Origin', TRUSTED_ORIGIN).set('Cookie', cookieA).send({}),
      request(app).post(`/api/materials/${readyMaterialAId}/summary`).set('Origin', TRUSTED_ORIGIN).set('Cookie', cookieA).send({}),
      request(app).post(`/api/materials/${readyMaterialAId}/summary`).set('Origin', TRUSTED_ORIGIN).set('Cookie', cookieA).send({}),
      request(app).post(`/api/materials/${readyMaterialAId}/summary`).set('Origin', TRUSTED_ORIGIN).set('Cookie', cookieA).send({}),
    ]);

    // All should return 202 Accepted (idempotent response)
    for (const res of responses) {
      expect(res.status).toBe(202);
      expect(res.body.jobId).toBe(responses[0].body.jobId);
    }

    // AiUsage should only have 1 generation and 1 active job
    const usage = await prisma.aiUsage.findUnique({ where: { userId: userAId } });
    expect(usage?.dailyGenerationCount).toBe(1);
    expect(usage?.activeJobsCount).toBe(1);

    // Only 1 ProcessingJob should exist
    const jobs = await prisma.processingJob.findMany({
      where: { materialId: readyMaterialAId, type: 'AI_SUMMARY_GENERATION' },
    });
    expect(jobs.length).toBe(1);
  });

  it('POST /api/materials/:id/summary should enforce concurrent active jobs limit (2) under parallel load', async () => {
    // Create 4 distinct READY materials for User A
    const matIds: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const mat = await prisma.material.create({
        data: {
          userId: userAId,
          courseId: courseAId,
          title: `Concurrent Test Material ${i}`,
          originalFilename: `mat-${i}.pdf`,
          storageKey: `materials/${userAId}/mat-${i}.pdf`,
          mimeType: 'application/pdf',
          bytes: 10000,
          pageCount: 1,
          status: 'READY',
        },
      });
      await prisma.materialPage.create({
        data: {
          materialId: mat.id,
          pageNumber: 1,
          extractedText: `Isi materi uji konkurensi ${i} untuk pengujian batas paralel sistem.`,
          characterCount: 65,
        },
      });
      matIds.push(mat.id);
    }

    // Fire 4 parallel requests for the 4 distinct materials
    const responses = await Promise.all(
      matIds.map((id) =>
        request(app)
          .post(`/api/materials/${id}/summary`)
          .set('Origin', TRUSTED_ORIGIN)
          .set('Cookie', cookieA)
          .send({})
      )
    );

    const successResponses = responses.filter((r) => r.status === 202);
    const limitResponses = responses.filter((r) => r.status === 429);

    // Exactly 2 must succeed and 2 must receive AI_CONCURRENT_LIMIT_EXCEEDED
    expect(successResponses.length).toBe(2);
    expect(limitResponses.length).toBe(2);
    for (const r of limitResponses) {
      expect(r.body.error.code).toBe('AI_CONCURRENT_LIMIT_EXCEEDED');
    }

    // Database activeJobsCount must be exactly 2
    const usage = await prisma.aiUsage.findUnique({ where: { userId: userAId } });
    expect(usage?.activeJobsCount).toBe(2);
  });

  it('POST /api/materials/:id/summary should reject upfront with 400 DOCUMENT_TOO_LARGE when material exceeds bounds', async () => {
    const largeMat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Buku Ajar 150 Halaman',
        originalFilename: 'huge-book.pdf',
        storageKey: `materials/${userAId}/huge.pdf`,
        mimeType: 'application/pdf',
        bytes: 5000000,
        pageCount: 105, // > 100 pages
        status: 'READY',
      },
    });

    const res = await request(app)
      .post(`/api/materials/${largeMat.id}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DOCUMENT_TOO_LARGE');
  });

  it('POST /api/materials/:id/summary should reject upfront with 400 DOCUMENT_TOO_LARGE when a single page exceeds 40,000 characters', async () => {
    const matWithHugePage = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Materi Satu Halaman 45rb Karakter',
        originalFilename: 'huge-page.pdf',
        storageKey: `materials/${userAId}/huge-page.pdf`,
        mimeType: 'application/pdf',
        bytes: 60000,
        pageCount: 1,
        status: 'READY',
      },
    });

    await prisma.materialPage.create({
      data: {
        materialId: matWithHugePage.id,
        pageNumber: 1,
        extractedText: 'A'.repeat(45000),
        characterCount: 45000,
      },
    });

    const res = await request(app)
      .post(`/api/materials/${matWithHugePage.id}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DOCUMENT_TOO_LARGE');
    expect(res.body.error.message).toContain('Halaman 1');
    expect(res.body.error.message).toContain('40.000');
  });

  it('POST /api/materials/:id/summary should reject upfront with 400 DOCUMENT_TOO_LARGE when total characters exceed 120,000 characters', async () => {
    const matOverLimit = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Materi Total 130rb Karakter',
        originalFilename: 'huge-total.pdf',
        storageKey: `materials/${userAId}/huge-total.pdf`,
        mimeType: 'application/pdf',
        bytes: 140000,
        pageCount: 4,
        status: 'READY',
      },
    });

    await prisma.materialPage.createMany({
      data: [
        { materialId: matOverLimit.id, pageNumber: 1, extractedText: 'A'.repeat(35000), characterCount: 35000 },
        { materialId: matOverLimit.id, pageNumber: 2, extractedText: 'B'.repeat(35000), characterCount: 35000 },
        { materialId: matOverLimit.id, pageNumber: 3, extractedText: 'C'.repeat(35000), characterCount: 35000 },
        { materialId: matOverLimit.id, pageNumber: 4, extractedText: 'D'.repeat(35000), characterCount: 35000 },
      ],
    });

    const res = await request(app)
      .post(`/api/materials/${matOverLimit.id}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DOCUMENT_TOO_LARGE');
    expect(res.body.error.message).toContain('120.000');
  });

  it('GET /api/materials/:id/summary should return summary and quota', async () => {
    await prisma.materialSummary.create({
      data: {
        userId: userAId,
        materialId: readyMaterialAId,
        status: 'READY',
        title: 'Ringkasan Kecerdasan Buatan',
        overview: 'Overview testing',
        keyConcepts: [{ concept: 'C1', explanation: 'E1', pageReferences: [1] }],
        sections: [{ heading: 'S1', content: 'Cont1', pageReferences: [1] }],
        keyTerms: [{ term: 'T1', definition: 'D1', pageReferences: [1] }],
        sourcePageCount: 2,
        sourceCharacterCount: 168,
      },
    });

    const res = await request(app)
      .get(`/api/materials/${readyMaterialAId}/summary`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.status).toBe('READY');
    expect(res.body.summary.title).toBe('Ringkasan Kecerdasan Buatan');
    expect(res.body.quota).toBeDefined();
  });
});
