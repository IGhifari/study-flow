import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { COOKIE_NAMES } from '@studyflow/shared';

describe('Semester Endpoints & Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];

  beforeEach(async () => {
    // Clean test data via User cascade
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.sem.' } },
    });

    const emailA = `test.sem.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'User A',
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

    const emailB = `test.sem.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'User B',
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.sem.' } },
    });
    await prisma.$disconnect();
  });

  it('first semester created should automatically become active', async () => {
    const res = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        name: 'Semester Ganjil 2026/2027',
        academicYear: '2026/2027',
        makeActive: false, // Explicitly false, but first semester must become active
      });

    expect(res.status).toBe(201);
    expect(res.body.semester.isActive).toBe(true);
    expect(res.body.semester.name).toBe('Semester Ganjil 2026/2027');
    expect(res.body.semester.academicYear).toBe('2026/2027');
  });

  it('creating second semester with makeActive=true should deactivate the first semester', async () => {
    // 1st semester
    const res1 = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        name: 'Semester 1',
        academicYear: '2026/2027',
        makeActive: true,
      });
    expect(res1.status).toBe(201);
    expect(res1.body.semester.isActive).toBe(true);
    const sem1Id = res1.body.semester.id;

    // 2nd semester
    const res2 = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        name: 'Semester 2',
        academicYear: '2026/2027',
        makeActive: true,
      });
    expect(res2.status).toBe(201);
    expect(res2.body.semester.isActive).toBe(true);

    // Verify sem1 is now inactive
    const checkSem1 = await request(app)
      .get(`/api/semesters/${sem1Id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(checkSem1.status).toBe(200);
    expect(checkSem1.body.semester.isActive).toBe(false);
  });

  it('POST /api/semesters/:id/activate should switch active semester atomically', async () => {
    const res1 = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester 1', academicYear: '2026/2027' });
    const sem1Id = res1.body.semester.id;

    const res2 = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester 2', academicYear: '2026/2027', makeActive: true });
    const sem2Id = res2.body.semester.id;

    // Reactivate Semester 1
    const actRes = await request(app)
      .post(`/api/semesters/${sem1Id}/activate`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(actRes.status).toBe(200);
    expect(actRes.body.semester.isActive).toBe(true);

    // Semester 2 must be inactive
    const check2 = await request(app)
      .get(`/api/semesters/${sem2Id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(check2.body.semester.isActive).toBe(false);
  });

  it('archiving an active semester clears active flag, and cannot activate archived semester', async () => {
    const res = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Aktif', academicYear: '2026/2027' });
    const semId = res.body.semester.id;
    expect(res.body.semester.isActive).toBe(true);

    // Archive
    const archRes = await request(app)
      .post(`/api/semesters/${semId}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(archRes.status).toBe(200);
    expect(archRes.body.semester.archivedAt).not.toBeNull();
    expect(archRes.body.semester.isActive).toBe(false);

    // Try to activate archived semester -> MUST FAIL
    const actArchRes = await request(app)
      .post(`/api/semesters/${semId}/activate`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(actArchRes.status).toBe(400);
    expect(actArchRes.body.error.code).toBe('SEMESTER_ARCHIVED');

    // Unarchive
    const unarchRes = await request(app)
      .post(`/api/semesters/${semId}/unarchive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(unarchRes.status).toBe(200);
    expect(unarchRes.body.semester.archivedAt).toBeNull();
  });

  it('cannot delete semester that still has courses', async () => {
    const semRes = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Berisi', academicYear: '2026/2027' });
    const semId = semRes.body.semester.id;

    // Create course in this semester
    await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semId,
        name: 'Pemrograman Web',
        code: 'IF101',
      });

    // Attempt delete
    const delRes = await request(app)
      .delete(`/api/semesters/${semId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(delRes.status).toBe(409);
    expect(delRes.body.error.code).toBe('SEMESTER_HAS_COURSES');

    // Verify still exists
    const check = await request(app)
      .get(`/api/semesters/${semId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(check.status).toBe(200);
  });

  it('cross-user isolation: User B cannot view, modify, or delete User A semester', async () => {
    const semRes = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Rahasia User A', academicYear: '2026/2027' });
    const semId = semRes.body.semester.id;

    // User B attempts to read
    const getRes = await request(app)
      .get(`/api/semesters/${semId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(getRes.status).toBe(404);

    // User B attempts to edit
    const patchRes = await request(app)
      .patch(`/api/semesters/${semId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ name: 'Hacked Name' });
    expect(patchRes.status).toBe(404);

    // User B attempts to activate
    const actRes = await request(app)
      .post(`/api/semesters/${semId}/activate`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(actRes.status).toBe(404);

    // User B attempts to delete
    const delRes = await request(app)
      .delete(`/api/semesters/${semId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(delRes.status).toBe(404);
  });
});
