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
});
