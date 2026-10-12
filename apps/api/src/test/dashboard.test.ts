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

  it('aggregates activity and workload charts correctly with real data', async () => {
    // 1. Create a 2nd active course
    const course2Res = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        semesterId,
        name: 'Algoritma dan Struktur Data',
        code: 'IF201',
      });
    const course2Id = course2Res.body.course.id;

    // 2. Create tasks:
    // Course 1: 1 uncompleted task, 1 task to be completed
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        courseId,
        title: 'Tugas Web Pending',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });

    const taskToCompleteRes = await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        courseId,
        title: 'Tugas Web Selesai',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });
    const taskToCompleteId = taskToCompleteRes.body.assignment.id;

    // Course 2: 2 uncompleted tasks
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        courseId: course2Id,
        title: 'Tugas Algoritma 1',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        courseId: course2Id,
        title: 'Tugas Algoritma 2',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });

    // Mark task as DONE for the first time
    await request(app)
      .patch(`/api/assignments/${taskToCompleteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({ status: 'DONE' });

    // 3. Create Material, Quiz, and QuizAttempts
    const material = await prisma.material.create({
      data: {
        userId,
        courseId,
        title: 'Slide Kuliah Web',
        originalFilename: 'slide.pdf',
        storageKey: `test-storage-key-${Date.now()}`,
        bytes: 1024,
        status: 'READY',
      },
    });

    const quiz = await prisma.quiz.create({
      data: {
        userId,
        materialId: material.id,
        title: 'Kuis Protokol HTTP',
        status: 'READY',
      },
    });

    // Draft attempt (submittedAt is null -> MUST NOT be counted)
    await prisma.quizAttempt.create({
      data: {
        userId,
        quizId: quiz.id,
        score: 0,
        submittedAt: null,
      },
    });

    // Final submitted attempt 1 (MUST be counted)
    await prisma.quizAttempt.create({
      data: {
        userId,
        quizId: quiz.id,
        score: 100,
        submittedAt: new Date(),
      },
    });

    // Final submitted attempt 2 (retake -> MUST be counted as new activity)
    await prisma.quizAttempt.create({
      data: {
        userId,
        quizId: quiz.id,
        score: 80,
        submittedAt: new Date(),
      },
    });

    // 4. Test GET /api/dashboard/charts (default 30d)
    const chartRes = await request(app)
      .get('/api/dashboard/charts')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie);

    expect(chartRes.status).toBe(200);
    expect(chartRes.body.semesterId).toBe(semesterId);
    expect(chartRes.body.activityChart.period).toBe('30d');
    expect(chartRes.body.activityChart.grouping).toBe('daily');
    expect(chartRes.body.activityChart.items).toHaveLength(30);

    // Total counts verification
    expect(chartRes.body.activityChart.totalTasksCompleted).toBe(1);
    expect(chartRes.body.activityChart.totalQuizzesCompleted).toBe(2);

    // Workload Chart verification
    expect(chartRes.body.workloadChart.totalPendingTasks).toBe(3); // 1 in Course 1, 2 in Course 2
    expect(chartRes.body.workloadChart.items).toHaveLength(2);
    // Ordered descending by pendingTasks: Course 2 (2 tasks) then Course 1 (1 task)
    expect(chartRes.body.workloadChart.items[0].courseId).toBe(course2Id);
    expect(chartRes.body.workloadChart.items[0].pendingTasks).toBe(2);
    expect(chartRes.body.workloadChart.items[1].courseId).toBe(courseId);
    expect(chartRes.body.workloadChart.items[1].pendingTasks).toBe(1);

    // 5. Test Rule: Reopen task and re-complete does NOT duplicate activity count
    // Reopen task to TODO
    await request(app)
      .patch(`/api/assignments/${taskToCompleteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({ status: 'TODO' });

    // Chart should STILL show 1 task completed in activity history (first completion preserved)
    const afterReopenRes = await request(app)
      .get('/api/dashboard/charts')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie);
    expect(afterReopenRes.body.activityChart.totalTasksCompleted).toBe(1);
    // But pending tasks in workload should have increased by 1 (now 2 pending in Course 1)
    expect(afterReopenRes.body.workloadChart.totalPendingTasks).toBe(4);

    // Re-complete task to DONE
    await request(app)
      .patch(`/api/assignments/${taskToCompleteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie)
      .send({ status: 'DONE' });

    // Chart MUST STILL show exactly 1 task completed (NOT 2)
    const afterReDoneRes = await request(app)
      .get('/api/dashboard/charts')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie);
    expect(afterReDoneRes.body.activityChart.totalTasksCompleted).toBe(1);
    expect(afterReDoneRes.body.workloadChart.totalPendingTasks).toBe(3);

    // 6. Test periods: 7d and 3m
    const res7d = await request(app)
      .get('/api/dashboard/charts?period=7d')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie);
    expect(res7d.status).toBe(200);
    expect(res7d.body.activityChart.period).toBe('7d');
    expect(res7d.body.activityChart.grouping).toBe('daily');
    expect(res7d.body.activityChart.items).toHaveLength(7);
    expect(res7d.body.activityChart.totalTasksCompleted).toBe(1);
    expect(res7d.body.activityChart.totalQuizzesCompleted).toBe(2);

    const res3m = await request(app)
      .get('/api/dashboard/charts?period=3m')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookie);
    expect(res3m.status).toBe(200);
    expect(res3m.body.activityChart.period).toBe('3m');
    expect(res3m.body.activityChart.grouping).toBe('weekly');
    expect(res3m.body.activityChart.items.length).toBeGreaterThanOrEqual(8);
    expect(res3m.body.activityChart.totalTasksCompleted).toBe(1);
    expect(res3m.body.activityChart.totalQuizzesCompleted).toBe(2);
  });
});

