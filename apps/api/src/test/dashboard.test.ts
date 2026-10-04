import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { getUserTodayRange } from '@studyflow/shared';

describe('Dashboard Aggregation & Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userId: string;
  let cookie: string[];
  let semesterId: string;
  let courseId: string;
  let archivedCourseId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.dash.' } },
    });

    const email = `test.dash.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Dashboard User',
        email,
        password: 'PasswordSangatKuat123!',
      });
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email,
        password: 'PasswordSangatKuat123!',
      });
    userId = login.body.user.id;
    cookie = login.headers['set-cookie'] as unknown as string[];

    await prisma.user.update({
      where: { id: userId },
      data: { timezone: 'Asia/Jakarta' },
    });

    const semRes = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({ name: 'Semester Ganjil 2026/2027', academicYear: '2026/2027', isActive: true });
    semesterId = semRes.body.semester.id;

    const courseRes = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        semesterId,
        name: 'Pemrograman Web',
        code: 'IF302',
      });
    courseId = courseRes.body.course.id;

    const archCourseRes = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        semesterId,
        name: 'Mata Kuliah Diarsipkan',
        code: 'IF999',
      });
    archivedCourseId = archCourseRes.body.course.id;
    await request(app)
      .post(`/api/courses/${archivedCourseId}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.dash.' } },
    });
    await prisma.$disconnect();
  });

  it('returns clean summary when no assignments exist', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.activeSemester).not.toBeNull();
    expect(res.body.activeSemester.id).toBe(semesterId);
    expect(res.body.totalCourses).toBe(1); // archived course is excluded
    expect(res.body.activeCourses.length).toBe(1);
    expect(res.body.assignmentsToday).toHaveLength(0);
    expect(res.body.assignmentsUpcoming).toHaveLength(0);
    expect(res.body.overdueCount).toBe(0);
    expect(res.body.completedCount).toBe(0);
    expect(res.body.totalAssignments).toBe(0);
    expect(res.body.completionPercentage).toBe(0);
  });

  it('aggregates today, upcoming, overdue, and completion percentage correctly and excludes archived courses', async () => {
    const now = new Date();
    const { startOfToday, endOfToday } = getUserTodayRange(now, 'Asia/Jakarta');

    // 1. Assignment due today (endOfToday, future relative to now)
    const dueToday = endOfToday;
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        courseId,
        title: 'Tugas Hari Ini',
        dueDate: dueToday.toISOString(),
        priority: 'HIGH',
      });

    // 2. Assignment due in 3 days (upcoming)
    const dueUpcoming = new Date(endOfToday.getTime() + 3 * 24 * 3600 * 1000);
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        courseId,
        title: 'Tugas Tiga Hari Lagi',
        dueDate: dueUpcoming.toISOString(),
        priority: 'MEDIUM',
      });

    // 3. Assignment overdue (year 2020)
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        courseId,
        title: 'Tugas Terlambat',
        dueDate: '2020-05-01T00:00:00.000Z',
        priority: 'LOW',
      });

    // 4. Completed assignment
    const compRes = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        courseId,
        title: 'Tugas Sudah Selesai',
        dueDate: dueToday.toISOString(),
      });
    await request(app)
      .patch(`/api/assignments/${compRes.body.assignment.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({ status: 'DONE' });

    // Fetch dashboard summary
    const res = await request(app)
      .get('/api/dashboard')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.totalAssignments).toBe(4);
    expect(res.body.completedCount).toBe(1);
    expect(res.body.completionPercentage).toBe(25); // 1/4 = 25%
    expect(res.body.overdueCount).toBe(1);

    // assignmentsToday contains only uncompleted tasks due today
    expect(res.body.assignmentsToday).toHaveLength(1);
    expect(res.body.assignmentsToday[0].title).toBe('Tugas Hari Ini');

    // assignmentsUpcoming contains only uncompleted tasks in the next 7 days
    expect(res.body.assignmentsUpcoming).toHaveLength(1);
    expect(res.body.assignmentsUpcoming[0].title).toBe('Tugas Tiga Hari Lagi');
  });
});
