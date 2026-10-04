import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { getStorageAdapter, MockStorageAdapter } from '../services/storage.service.js';

describe('Material Endpoints & Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';
  const mockStorage = getStorageAdapter() as MockStorageAdapter;

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];
  let semAId: string;
  let semBId: string;
  let courseAId: string;
  let courseBId: string;

  beforeEach(async () => {
    mockStorage.clear();

    await prisma.user.deleteMany({
      where: { email: { contains: 'test.mat.' } },
    });

    // Create User A & login
    const emailA = `test.mat.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Material User A',
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

    const semResA = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester A', academicYear: '2026/2027' });
    semAId = semResA.body.semester.id;

    const courseResA = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ semesterId: semAId, name: 'Sistem Operasi', code: 'CS101' });
    courseAId = courseResA.body.course.id;

    // Create User B & login
    const emailB = `test.mat.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Material User B',
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

    const semResB = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ name: 'Semester B', academicYear: '2026/2027' });
    semBId = semResB.body.semester.id;

    const courseResB = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ semesterId: semBId, name: 'Struktur Data', code: 'CS102' });
    courseBId = courseResB.body.course.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.mat.' } },
    });
  });

  describe('POST /api/materials/initiate-upload', () => {
    it('should successfully initiate upload for valid text-based PDF', async () => {
      const res = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'Modul 1 Proses dan Thread',
          filename: 'modul1.pdf',
          fileSize: 1024 * 500, // 500 KB
          mimeType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.materialId).toBeDefined();
      expect(res.body.storageKey).toContain(userAId);
      expect(res.body.uploadUrl).toBeDefined();

      const created = await prisma.material.findUnique({
        where: { id: res.body.materialId },
      });
      expect(created?.status).toBe('UPLOADING');
      expect(created?.courseId).toBe(courseAId);
      expect(created?.userId).toBe(userAId);
    });

    it('should reject non-PDF mime types', async () => {
      const res = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'Dokumen Word',
          filename: 'doc.docx',
          fileSize: 1024 * 100,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

      expect(res.status).toBe(400);
    });

    it('should reject oversized file (>20MB)', async () => {
      const res = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'File Terlalu Besar',
          filename: 'big.pdf',
          fileSize: 25 * 1024 * 1024, // 25 MB
          mimeType: 'application/pdf',
        });

      expect(res.status).toBe(400);
    });

    it('should reject cross-tenant course upload', async () => {
      // User A tries to upload to User B's course
      const res = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseBId,
          title: 'Modul Hack',
          filename: 'modul.pdf',
          fileSize: 1024 * 100,
          mimeType: 'application/pdf',
        });

      expect(res.status).toBe(404);
    });

    it('should reject upload to archived course', async () => {
      await request(app)
        .post(`/api/courses/${courseAId}/archive`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);

      const res = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'Modul Arsip',
          filename: 'modul.pdf',
          fileSize: 1024 * 100,
          mimeType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COURSE_ARCHIVED');
    });

    it('should enforce daily upload quota of 10 uploads per day', async () => {
      // Simulate 10 uploads
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/materials/initiate-upload')
          .set('Origin', TRUSTED_ORIGIN)
          .set('Cookie', cookieA)
          .send({
            courseId: courseAId,
            title: `Modul Ke-${i + 1}`,
            filename: `modul_${i + 1}.pdf`,
            fileSize: 1024,
            mimeType: 'application/pdf',
          });
        expect(res.status).toBe(201);
      }

      // 11th upload should be rejected
      const excess = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'Modul Ke-11 Melebihi Batas',
          filename: 'modul_11.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        });

      expect(excess.status).toBe(429);
      expect(excess.body.error.code).toBe('DAILY_UPLOAD_LIMIT_EXCEEDED');
    });
  });

  describe('POST /api/materials/finalize-upload', () => {
    it('should fail if file is not present in storage', async () => {
      const initRes = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'Materi Belum Upload',
          filename: 'materi.pdf',
          fileSize: 1024 * 100,
          mimeType: 'application/pdf',
        });

      const finalizeRes = await request(app)
        .post('/api/materials/finalize-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ materialId: initRes.body.materialId });

      expect(finalizeRes.status).toBe(400);
      expect(finalizeRes.body.error.code).toBe('FILE_NOT_UPLOADED');
    });

    it('should finalize successfully when file is in storage and enqueue job', async () => {
      const initRes = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'Materi Lengkap',
          filename: 'materi.pdf',
          fileSize: 1024 * 200,
          mimeType: 'application/pdf',
        });

      const { materialId, storageKey } = initRes.body;

      // Simulate client upload to mock storage
      mockStorage.putMockFile(storageKey, Buffer.from('%PDF-1.4 mock pdf content'));

      const finalizeRes = await request(app)
        .post('/api/materials/finalize-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ materialId });

      expect(finalizeRes.status).toBe(202);
      expect(finalizeRes.body.material.id).toBe(materialId);
      expect(finalizeRes.body.material.status).toBe('QUEUED');
      expect(finalizeRes.body.jobId).toBeDefined();

      // Check DB outbox event and processing job
      const job = await prisma.processingJob.findUnique({
        where: { id: finalizeRes.body.jobId },
      });
      expect(job).not.toBeNull();
      expect(job?.materialId).toBe(materialId);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { aggregateId: materialId, eventType: 'DOCUMENT_PROCESSING_REQUESTED' },
      });
      expect(outbox).not.toBeNull();
    });

    it('should prevent User B from finalizing User A material', async () => {
      const initRes = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'Materi A',
          filename: 'materiA.pdf',
          fileSize: 1024 * 100,
          mimeType: 'application/pdf',
        });

      const finalizeRes = await request(app)
        .post('/api/materials/finalize-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieB)
        .send({ materialId: initRes.body.materialId });

      expect(finalizeRes.status).toBe(404);
    });
  });

  describe('GET, PATCH, DELETE & Invariant Protection', () => {
    let readyMaterialId: string;

    beforeEach(async () => {
      // Create a ready material for User A
      const initRes = await request(app)
        .post('/api/materials/initiate-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          title: 'Slide Kuliah Bab 1',
          filename: 'slide1.pdf',
          fileSize: 1024 * 150,
          mimeType: 'application/pdf',
        });

      readyMaterialId = initRes.body.materialId;
      mockStorage.putMockFile(initRes.body.storageKey, Buffer.from('%PDF-1.4 test content'));

      await request(app)
        .post('/api/materials/finalize-upload')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ materialId: readyMaterialId });

      // Simulate worker marked READY and saved pages
      await prisma.material.update({
        where: { id: readyMaterialId },
        data: {
          status: 'READY',
          pageCount: 15,
        },
      });
      await prisma.materialPage.create({
        data: {
          materialId: readyMaterialId,
          pageNumber: 1,
          extractedText: 'Halaman 1 Pendahuluan Sistem Operasi',
          characterCount: 35,
        },
      });
    });

    it('should list materials with course filter', async () => {
      const res = await request(app)
        .get(`/api/materials?courseId=${courseAId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.materials).toHaveLength(1);
      expect(res.body.materials[0].id).toBe(readyMaterialId);
      expect(res.body.materials[0].title).toBe('Slide Kuliah Bab 1');
    });

    it('should isolate User B from User A materials', async () => {
      const listRes = await request(app)
        .get('/api/materials')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieB);

      expect(listRes.status).toBe(200);
      expect(listRes.body.materials).toHaveLength(0);

      const detailRes = await request(app)
        .get(`/api/materials/${readyMaterialId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieB);

      expect(detailRes.status).toBe(404);
    });

    it('should update material title', async () => {
      const res = await request(app)
        .patch(`/api/materials/${readyMaterialId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ title: 'Slide Kuliah Bab 1 (Revisi)' });

      expect(res.status).toBe(200);
      expect(res.body.material.title).toBe('Slide Kuliah Bab 1 (Revisi)');
    });

    it('should generate signed download URL for owner', async () => {
      const res = await request(app)
        .get(`/api/materials/${readyMaterialId}/download`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBeDefined();
      expect(res.body.expiresInSeconds).toBeGreaterThan(0);
    });

    it('should block course deletion when course has materials', async () => {
      const delCourseRes = await request(app)
        .delete(`/api/courses/${courseAId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);

      expect(delCourseRes.status).toBe(409);
      expect(delCourseRes.body.error.code).toBe('COURSE_HAS_MATERIALS');
    });

    it('should unlink note when material is deleted without deleting note', async () => {
      // Create a note linked to this material
      const noteRes = await request(app)
        .post('/api/notes')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          courseId: courseAId,
          materialId: readyMaterialId,
          title: 'Catatan Kuliah Bab 1',
          content: 'Pembahasan ringkas mengenai thread.',
        });
      const noteId = noteRes.body.note.id;

      // Verify note is linked
      const noteBefore = await prisma.note.findUnique({ where: { id: noteId } });
      expect(noteBefore?.materialId).toBe(readyMaterialId);

      // Delete material
      const delMatRes = await request(app)
        .delete(`/api/materials/${readyMaterialId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);

      expect(delMatRes.status).toBe(200);

      // Verify material is soft-deleted
      const matAfter = await prisma.material.findUnique({ where: { id: readyMaterialId } });
      expect(matAfter?.deletedAt).not.toBeNull();

      // Note still exists and materialId is unlinked (null)
      const noteAfter = await prisma.note.findUnique({ where: { id: noteId } });
      expect(noteAfter).not.toBeNull();
      expect(noteAfter?.materialId).toBeNull();
      expect(noteAfter?.title).toBe('Catatan Kuliah Bab 1');
    });

    it('should return storage usage quota accurately', async () => {
      const res = await request(app)
        .get('/api/materials/usage')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.limitBytes).toBe(200 * 1024 * 1024);
      expect(res.body.dailyUploadsLimit).toBe(10);
      expect(res.body.dailyUploadsCount).toBeGreaterThanOrEqual(1);
      expect(res.body.dailyResetUtc).toBe('00:00 UTC');
    });

    it('should return 503 STORAGE_UNAVAILABLE gracefully when storage adapter is unconfigured', async () => {
      const { StorageUnavailableAdapter, setStorageAdapterForTesting } = await import(
        '../services/storage.service.js'
      );
      setStorageAdapterForTesting(new StorageUnavailableAdapter());

      try {
        // Course operations should still work normally
        const courseRes = await request(app)
          .get(`/api/courses/${courseAId}`)
          .set('Origin', TRUSTED_ORIGIN)
          .set('Cookie', cookieA);
        expect(courseRes.status).toBe(200);

        // Upload initiation returns 503 STORAGE_UNAVAILABLE with safe message
        const uploadRes = await request(app)
          .post('/api/materials/initiate-upload')
          .set('Origin', TRUSTED_ORIGIN)
          .set('Cookie', cookieA)
          .send({
            courseId: courseAId,
            title: 'Materi Uji Storage Unavailable',
            filename: 'test.pdf',
            fileSize: 1024 * 1024,
            mimeType: 'application/pdf',
          });

        expect(uploadRes.status).toBe(503);
        expect(uploadRes.body.error.code).toBe('STORAGE_UNAVAILABLE');
      } finally {
        setStorageAdapterForTesting(mockStorage);
      }
    });

    it('should sweep abandoned uploads and release reserved quota', async () => {
      const { sweepAbandonedUploads } = await import('../services/material.service.js');

      // Create an abandoned upload manually
      const abandonedMat = await prisma.material.create({
        data: {
          userId: userAId,
          courseId: courseAId,
          title: 'Materi Terbengkalai',
          originalFilename: 'abandoned.pdf',
          storageKey: `materials/${userAId}/abandoned.pdf`,
          mimeType: 'application/pdf',
          bytes: 2 * 1024 * 1024,
          status: 'UPLOADING',
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        },
      });

      // Reserve quota
      await prisma.storageUsage.upsert({
        where: { userId: userAId },
        update: { reservedBytes: { increment: BigInt(2 * 1024 * 1024) } },
        create: {
          userId: userAId,
          usedBytes: BigInt(0),
          reservedBytes: BigInt(2 * 1024 * 1024),
        },
      });

      const swept = await sweepAbandonedUploads(2 * 60 * 60 * 1000);
      expect(swept).toBeGreaterThanOrEqual(1);

      const checkMat = await prisma.material.findUnique({
        where: { id: abandonedMat.id },
      });
      expect(checkMat?.status).toBe('FAILED');
      expect(checkMat?.errorCode).toBe('UPLOAD_ABANDONED');
    });

    it('should test local storage route authorization with tokens', async () => {
      const { generateLocalStorageToken } = await import('../services/storage.service.js');
      const testKey = 'test/document.pdf';
      const validToken = generateLocalStorageToken(testKey, 300);

      // Upload with valid token
      const uploadRes = await request(app)
        .put(`/api/storage/local/upload/${encodeURIComponent(testKey)}?token=${validToken}`)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4 test local content'));

      expect(uploadRes.status).toBe(200);

      // Upload with invalid token should be 403 Forbidden
      const invalidRes = await request(app)
        .put(`/api/storage/local/upload/${encodeURIComponent(testKey)}?token=invalid.token`)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4 test local content'));

      expect(invalidRes.status).toBe(403);
      expect(invalidRes.body.error.code).toBe('INVALID_STORAGE_TOKEN');

      // Download with valid token
      const downloadRes = await request(app)
        .get(`/api/storage/local/download/${encodeURIComponent(testKey)}?token=${validToken}`);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toContain('application/pdf');

      // Download with invalid token should be 403 Forbidden
      const downloadInvalid = await request(app)
        .get(`/api/storage/local/download/${encodeURIComponent(testKey)}?token=invalid.token`);

      expect(downloadInvalid.status).toBe(403);
    });
  });
});
