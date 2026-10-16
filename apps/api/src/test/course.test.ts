import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Course Endpoints & Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];
  let semAId: string;
  let semBId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.crs.' } },
    });

    // Create User A & login
    const emailA = `test.crs.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Course User A',
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

    // Create User B & login
    const emailB = `test.crs.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Course User B',
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.crs.' } },
    });
    await prisma.$disconnect();
  });

  it('can create, read, update, archive, unarchive, and delete course', async () => {
    // 1. Create course
    const createRes = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Struktur Data & Algoritma',
        code: 'IF201',
        lecturer: 'Dr. Budi Santoso',
        description: 'Mata kuliah dasar algoritma',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.course.name).toBe('Struktur Data & Algoritma');
    expect(createRes.body.course.code).toBe('IF201');
    expect(createRes.body.course.lecturer).toBe('Dr. Budi Santoso');
    expect(createRes.body.course.description).toBe('Mata kuliah dasar algoritma');
    const courseId = createRes.body.course.id;

    // 2. Read single course
    const getRes = await request(app)
      .get(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(getRes.status).toBe(200);
    expect(getRes.body.course.id).toBe(courseId);

    // 3. Update course
    const updateRes = await request(app)
      .patch(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        name: 'Struktur Data Lanjut',
        lecturer: 'Prof. Budi Santoso',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.course.name).toBe('Struktur Data Lanjut');
    expect(updateRes.body.course.lecturer).toBe('Prof. Budi Santoso');

    // 4. Archive course
    const archRes = await request(app)
      .post(`/api/courses/${courseId}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(archRes.status).toBe(200);
    expect(archRes.body.course.archivedAt).not.toBeNull();

    // 5. Unarchive course
    const unarchRes = await request(app)
      .post(`/api/courses/${courseId}/unarchive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(unarchRes.status).toBe(200);
    expect(unarchRes.body.course.archivedAt).toBeNull();

    // 6. Delete course
    const delRes = await request(app)
      .delete(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(delRes.status).toBe(200);

    // Verify deleted
    const verifyRes = await request(app)
      .get(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(verifyRes.status).toBe(404);
  });

  it('rejects invalid inputs (short name or long code)', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'A', // Too short (< 2)
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cannot create course in an archived semester', async () => {
    // Archive semester A
    await request(app)
      .post(`/api/semesters/${semAId}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    // Try to create course
    const res = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Mata Kuliah di Semester Arsip',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SEMESTER_ARCHIVED');
  });

  it('cross-user isolation: User A cannot create course in User B semester', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semBId, // User B's semester!
        name: 'Infiltrated Course',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SEMESTER_NOT_FOUND');
  });

  it('cross-user isolation: User B cannot view, modify, archive, or delete User A course', async () => {
    // User A creates course
    const createRes = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Course User A',
      });
    const courseId = createRes.body.course.id;

    // User B tries to view
    const getRes = await request(app)
      .get(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(getRes.status).toBe(404);

    // User B tries to update
    const patchRes = await request(app)
      .patch(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ name: 'Tampered Name' });
    expect(patchRes.status).toBe(404);

    // User B tries to archive
    const archRes = await request(app)
      .post(`/api/courses/${courseId}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(archRes.status).toBe(404);

    // User B tries to delete
    const delRes = await request(app)
      .delete(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(delRes.status).toBe(404);
  });

  it('rejects course deletion (409 COURSE_HAS_MATERIALS) for any active material status (UPLOADING, QUEUED, PROCESSING, READY, FAILED)', async () => {
    const statuses = ['UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED'] as const;

    for (const status of statuses) {
      const createRes = await request(app)
        .post('/api/courses')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({
          semesterId: semAId,
          name: `Course Active Mat ${status}`,
        });
      const courseId = createRes.body.course.id;

      await prisma.material.create({
        data: {
          userId: userAId,
          courseId,
          title: `Materi ${status}`,
          originalFilename: `mat-${status.toLowerCase()}.pdf`,
          storageKey: `materials/${userAId}/crs-active-${status}-${Date.now()}.pdf`,
          bytes: 1024,
          status,
        },
      });

      const delRes = await request(app)
        .delete(`/api/courses/${courseId}`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA);

      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('COURSE_HAS_MATERIALS');
    }
  });

  it('rejects course deletion when 1 material is soft-deleted and 1 material is still active, without prematurely purging the soft-deleted material', async () => {
    const createRes = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Course Mixed Materials',
      });
    const courseId = createRes.body.course.id;

    const softDeletedMat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId,
        title: 'Materi Sudah Dihapus',
        originalFilename: 'deleted.pdf',
        storageKey: `materials/${userAId}/crs-mixed-del-${Date.now()}.pdf`,
        bytes: 2048,
        status: 'READY',
        deletedAt: new Date(),
      },
    });

    const activeMat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId,
        title: 'Materi Masih Aktif',
        originalFilename: 'active.pdf',
        storageKey: `materials/${userAId}/crs-mixed-act-${Date.now()}.pdf`,
        bytes: 4096,
        status: 'READY',
        deletedAt: null,
      },
    });

    // User B cannot delete User A's course or trigger cleanup of User A's soft-deleted material
    const userBDelRes = await request(app)
      .delete(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(userBDelRes.status).toBe(404);

    // User A tries to delete course -> rejected with 409 COURSE_HAS_MATERIALS
    const delRes = await request(app)
      .delete(`/api/courses/${courseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(delRes.status).toBe(409);
    expect(delRes.body.error.code).toBe('COURSE_HAS_MATERIALS');

    // Both materials (including the soft-deleted one) still exist in DB
    const checkSoftDeleted = await prisma.material.findUnique({ where: { id: softDeletedMat.id } });
    const checkActive = await prisma.material.findUnique({ where: { id: activeMat.id } });
    expect(checkSoftDeleted).not.toBeNull();
    expect(checkActive).not.toBeNull();
  });

  it('allows deleting course and parent semester after all materials are soft-deleted via DELETE /api/materials/:id, preserving ProcessingJob history and storage_usages quota', async () => {
    // Create a dedicated semester and course for full lifecycle deletion test
    const semRes = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Siklus Hapus', academicYear: '2026/2027' });
    const targetSemId = semRes.body.semester.id;

    const courseRes = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: targetSemId,
        name: 'Mata Kuliah Siklus Hapus',
        code: 'IF999',
      });
    const targetCourseId = courseRes.body.course.id;

    // Set up another active material in another course (semAId) so User A has non-zero storage usage (e.g. 50 KB)
    const otherCourseRes = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Mata Kuliah Lain Tetap Ada',
      });
    const otherCourseId = otherCourseRes.body.course.id;

    const otherMatBytes = 50 * 1024;
    const targetMatBytes = 30 * 1024;

    await prisma.storageUsage.upsert({
      where: { userId: userAId },
      create: {
        userId: userAId,
        usedBytes: BigInt(otherMatBytes + targetMatBytes),
        reservedBytes: BigInt(0),
      },
      update: {
        usedBytes: BigInt(otherMatBytes + targetMatBytes),
        reservedBytes: BigInt(0),
      },
    });

    const mat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: targetCourseId,
        title: 'Materi Akan Dihapus Lalu Matkul Dihapus',
        originalFilename: 'siklus.pdf',
        storageKey: `materials/${userAId}/siklus-${Date.now()}.pdf`,
        bytes: targetMatBytes,
        status: 'READY',
      },
    });

    const job = await prisma.processingJob.create({
      data: {
        userId: userAId,
        materialId: mat.id,
        type: 'DOCUMENT_EXTRACTION',
        status: 'COMPLETED',
        attempts: 1,
        maxAttempts: 3,
        completedAt: new Date(),
      },
    });

    // Create a note linked to the material in targetCourseId
    const noteRes = await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: targetCourseId,
        materialId: mat.id,
        title: 'Catatan Sementara',
        content: 'Isi catatan',
      });
    const noteId = noteRes.body.note.id;

    // 1. Deleting course while material is active fails with 409 COURSE_HAS_MATERIALS
    const blockedByMat = await request(app)
      .delete(`/api/courses/${targetCourseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(blockedByMat.status).toBe(409);
    expect(blockedByMat.body.error.code).toBe('COURSE_HAS_MATERIALS');

    // 2. Soft-delete material via DELETE /api/materials/:id
    const delMatRes = await request(app)
      .delete(`/api/materials/${mat.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(delMatRes.status).toBe(200);

    // Storage usage was decremented once (from 80 KB to 50 KB)
    const usageAfterMatDelete = await prisma.storageUsage.findUnique({ where: { userId: userAId } });
    expect(Number(usageAfterMatDelete?.usedBytes)).toBe(otherMatBytes);

    // Note was unlinked (materialId === null), but still blocks course deletion until note is deleted/moved
    const blockedByNote = await request(app)
      .delete(`/api/courses/${targetCourseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(blockedByNote.status).toBe(409);
    expect(blockedByNote.body.error.code).toBe('COURSE_HAS_NOTES');

    // Move or delete the note (here we move it to otherCourseId or delete it; let's update courseId or delete it)
    const delNoteRes = await request(app)
      .delete(`/api/notes/${noteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(delNoteRes.status).toBe(200);

    // 3. Semester deletion is still blocked while targetCourseId exists
    const blockedSem = await request(app)
      .delete(`/api/semesters/${targetSemId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(blockedSem.status).toBe(409);
    expect(blockedSem.body.error.code).toBe('SEMESTER_HAS_COURSES');

    // 4. Now DELETE /api/courses/:id succeeds (200 OK) even though soft-deleted material row existed
    const delCourseRes = await request(app)
      .delete(`/api/courses/${targetCourseId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(delCourseRes.status).toBe(200);

    // Verify soft-deleted material row is purged, ProcessingJob still exists with materialId = null,
    // and storage_usages was NOT decremented a second time!
    const matAfterCourseDel = await prisma.material.findUnique({ where: { id: mat.id } });
    expect(matAfterCourseDel).toBeNull();

    const jobAfterCourseDel = await prisma.processingJob.findUnique({ where: { id: job.id } });
    expect(jobAfterCourseDel).not.toBeNull();
    expect(jobAfterCourseDel?.materialId).toBeNull();
    expect(jobAfterCourseDel?.status).toBe('COMPLETED');

    const usageAfterCourseDel = await prisma.storageUsage.findUnique({ where: { userId: userAId } });
    expect(Number(usageAfterCourseDel?.usedBytes)).toBe(otherMatBytes);

    // 5. Now DELETE /api/semesters/:id on the parent semester succeeds (200 OK)
    const delSemRes = await request(app)
      .delete(`/api/semesters/${targetSemId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(delSemRes.status).toBe(200);

    const checkSem = await prisma.semester.findUnique({ where: { id: targetSemId } });
    expect(checkSem).toBeNull();
    expect(otherCourseId).toBeDefined();
  });
});

