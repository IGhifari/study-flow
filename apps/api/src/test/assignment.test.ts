import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Assignment Endpoints & Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];
  let semAId: string;
  let semBId: string;
  let courseAId: string;
  let courseBId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.asg.' } },
    });

    // Create User A with timezone Asia/Jakarta
    const emailA = `test.asg.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Assignment User A',
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

    // Set User A timezone
    await prisma.user.update({
      where: { id: userAId },
      data: { timezone: 'Asia/Jakarta' },
    });

    const semResA = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester A', academicYear: '2026/2027', isActive: true });
    semAId = semResA.body.semester.id;

    const courseResA = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Algoritma & Struktur Data',
        code: 'IF201',
      });
    courseAId = courseResA.body.course.id;

    // Create User B with timezone America/New_York
    const emailB = `test.asg.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Assignment User B',
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

    await prisma.user.update({
      where: { id: userBId },
      data: { timezone: 'America/New_York' },
    });

    const semResB = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ name: 'Semester B', academicYear: '2026/2027', isActive: true });
    semBId = semResB.body.semester.id;

    const courseResB = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({
        semesterId: semBId,
        name: 'Jaringan Komputer',
        code: 'IF301',
      });
    courseBId = courseResB.body.course.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.asg.' } },
    });
    await prisma.$disconnect();
  });

  it('creates assignment and defaults date-only input to 23:59:00 in user timezone', async () => {
    // User A timezone is Asia/Jakarta (+07:00).
    // Date "2099-10-15" at 23:59:00 WIB is 2099-10-15T16:59:00.000Z.
    const res = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas 1: Linked List',
        dueDate: '2099-10-15',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body.assignment.title).toBe('Tugas 1: Linked List');
    expect(res.body.assignment.priority).toBe('HIGH');
    expect(res.body.assignment.status).toBe('TODO');
    expect(res.body.assignment.dueDate).toBe('2099-10-15T16:59:00.000Z');
    expect(res.body.assignment.completedAt).toBeNull();
    expect(res.body.assignment.isOverdue).toBe(false);
  });

  it('rejects invalid or non-existent dates in DST transition', async () => {
    // America/New_York skipped 2026-03-08 02:30:00 (spring forward from 02:00 to 03:00)
    const res = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({
        courseId: courseBId,
        title: 'Tugas DST',
        dueDate: '2026-03-08T02:30:00',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DUE_DATE');
  });

  it('handles status transitions and completedAt correctly', async () => {
    const createRes = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas Status Transition',
        dueDate: '2099-11-01T17:00:00.000Z',
      });

    const assignmentId = createRes.body.assignment.id;
    expect(createRes.body.assignment.status).toBe('TODO');
    expect(createRes.body.assignment.completedAt).toBeNull();

    // 1. Update to DONE
    const doneRes = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ status: 'DONE' });

    expect(doneRes.status).toBe(200);
    expect(doneRes.body.assignment.status).toBe('DONE');
    expect(doneRes.body.assignment.completedAt).not.toBeNull();
    const firstCompletedAt = doneRes.body.assignment.completedAt;

    // 2. Repeat update to DONE -> should retain previous completedAt
    const repeatDoneRes = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ status: 'DONE', title: 'Tugas Status Transition (Updated)' });

    expect(repeatDoneRes.status).toBe(200);
    expect(repeatDoneRes.body.assignment.completedAt).toBe(firstCompletedAt);

    // 3. Update to IN_PROGRESS -> should clear completedAt
    const inProgressRes = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ status: 'IN_PROGRESS' });

    expect(inProgressRes.status).toBe(200);
    expect(inProgressRes.body.assignment.status).toBe('IN_PROGRESS');
    expect(inProgressRes.body.assignment.completedAt).toBeNull();
  });

  it('computes overdue correctly: past deadline is overdue if not DONE; DONE is never overdue', async () => {
    // Past deadline (year 2020)
    const res = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas Masa Lalu',
        dueDate: '2020-01-01T12:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.assignment.isOverdue).toBe(true);

    // Marking it DONE clears isOverdue
    const doneRes = await request(app)
      .patch(`/api/assignments/${res.body.assignment.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ status: 'DONE' });

    expect(doneRes.status).toBe(200);
    expect(doneRes.body.assignment.isOverdue).toBe(false);
  });

  it('rejects editing courseId', async () => {
    const createRes = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas Course Change',
        dueDate: '2099-11-01T17:00:00.000Z',
      });

    const editRes = await request(app)
      .patch(`/api/assignments/${createRes.body.assignment.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ courseId: courseBId });

    expect(editRes.status).toBe(400);
    expect(editRes.body.error.code).toBe('CANNOT_CHANGE_COURSE');
  });

  it('editing title preserves UTC deadline', async () => {
    const originalUtc = '2026-12-01T10:00:00.000Z';
    const createRes = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Original Title',
        dueDate: originalUtc,
      });

    const editRes = await request(app)
      .patch(`/api/assignments/${createRes.body.assignment.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'New Title Without Changing DueDate' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.assignment.title).toBe('New Title Without Changing DueDate');
    expect(editRes.body.assignment.dueDate).toBe(originalUtc);
  });

  it('enforces multi-tenant data isolation', async () => {
    // User A creates assignment
    const asgA = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Rahasia User A',
        dueDate: '2099-11-01T17:00:00.000Z',
      });

    // User B tries to read User A assignment -> 404
    const getRes = await request(app)
      .get(`/api/assignments/${asgA.body.assignment.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(getRes.status).toBe(404);

    // User B tries to update User A assignment -> 404
    const patchRes = await request(app)
      .patch(`/api/assignments/${asgA.body.assignment.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ title: 'Hacked' });
    expect(patchRes.status).toBe(404);

    // User B tries to delete User A assignment -> 404
    const deleteRes = await request(app)
      .delete(`/api/assignments/${asgA.body.assignment.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(deleteRes.status).toBe(404);

    // User B tries to create assignment under User A course -> 404 COURSE_NOT_FOUND
    const createBwithACourse = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({
        courseId: courseAId,
        title: 'Tugas Ilegal',
        dueDate: '2099-11-01T17:00:00.000Z',
      });
    expect(createBwithACourse.status).toBe(404);
    expect(createBwithACourse.body.error.code).toBe('COURSE_NOT_FOUND');
  });

  it('prevents course deletion if course has assignments and suggests archive', async () => {
    // courseA has assignments
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas Pencegah Hapus',
        dueDate: '2099-11-01T17:00:00.000Z',
      });

    const deleteCourseRes = await request(app)
      .delete(`/api/courses/${courseAId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(deleteCourseRes.status).toBe(409);
    expect(deleteCourseRes.body.error.code).toBe('COURSE_HAS_ASSIGNMENTS');
    expect(deleteCourseRes.body.error.message).toContain('arsip');
  });

  it('enforces read-only invariant on archived courses/semesters', async () => {
    // 1. Create assignment on active course
    const asgRes = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas Sebelum Arsip',
        dueDate: '2099-11-01T17:00:00.000Z',
      });
    const assignmentId = asgRes.body.assignment.id;

    // 2. Archive courseA
    await request(app)
      .post(`/api/courses/${courseAId}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    // 3. Attempt to create new assignment on archived course -> 400 COURSE_ARCHIVED
    const newAsgRes = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas Baru Di Arsip',
        dueDate: '2099-11-01T17:00:00.000Z',
      });
    expect(newAsgRes.status).toBe(400);
    expect(newAsgRes.body.error.code).toBe('COURSE_ARCHIVED');

    // 4. Attempt to update assignment on archived course -> 400 COURSE_ARCHIVED
    const editRes = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'Edit Di Arsip' });
    expect(editRes.status).toBe(400);
    expect(editRes.body.error.code).toBe('COURSE_ARCHIVED');

    // 5. Attempt to delete assignment on archived course -> 400 COURSE_ARCHIVED
    const deleteRes = await request(app)
      .delete(`/api/assignments/${assignmentId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.error.code).toBe('COURSE_ARCHIVED');

    // 6. Reading assignment on archived course remains allowed (read-only)
    const readRes = await request(app)
      .get(`/api/assignments/${assignmentId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(readRes.status).toBe(200);
    expect(readRes.body.assignment.title).toBe('Tugas Sebelum Arsip');

    // 7. Unarchive course -> mutations are permitted again
    await request(app)
      .post(`/api/courses/${courseAId}/unarchive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    const reEditRes = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'Edit Setelah Pulihkan' });
    expect(reEditRes.status).toBe(200);
    expect(reEditRes.body.assignment.title).toBe('Edit Setelah Pulihkan');
  });

  it('supports filtering by status, priority, semester, course, overdue and pagination', async () => {
    // Create multiple assignments
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas Matematika 1',
        dueDate: '2099-11-01',
        priority: 'LOW',
      });

    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Tugas Fisika Dasar',
        dueDate: '2020-01-01T00:00:00.000Z', // overdue
        priority: 'HIGH',
      });

    // Filter by overdue=true
    const overdueList = await request(app)
      .get('/api/assignments?isOverdue=true')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(overdueList.status).toBe(200);
    expect(overdueList.body.assignments.length).toBeGreaterThanOrEqual(1);
    expect(overdueList.body.assignments.every((it: any) => it.isOverdue)).toBe(true);

    // Search by title
    const searchRes = await request(app)
      .get('/api/assignments?search=Fisika')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.assignments.length).toBe(1);
    expect(searchRes.body.assignments[0].title).toBe('Tugas Fisika Dasar');
  });
});
