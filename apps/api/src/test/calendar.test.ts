import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Calendar Endpoints & Business Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];
  let semAId: string;
  let semBId: string;
  let courseA1Id: string;
  let courseA2Id: string;
  let courseBId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.cal.' } },
    });

    // 1. Buat User A & Semester A
    const emailA = `test.cal.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Calendar User A',
        email: emailA,
        password: 'PasswordKuat123!',
      });
    const loginA = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: emailA,
        password: 'PasswordKuat123!',
      });
    userAId = loginA.body.user.id;
    cookieA = loginA.headers['set-cookie'] as unknown as string[];

    const semResA = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Ganjil 2026', academicYear: '2026/2027', makeActive: true });
    semAId = semResA.body.semester.id;

    // Course A1 & A2
    const crsResA1 = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Kalkulus I',
        code: 'MATH101',
        lecturer: 'Prof. Bambang',
      });
    courseA1Id = crsResA1.body.course.id;

    const crsResA2 = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Fisika Dasar',
        code: 'PHYS101',
      });
    courseA2Id = crsResA2.body.course.id;

    // 2. Buat User B & Semester B (untuk uji isolasi tenant)
    const emailB = `test.cal.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Calendar User B',
        email: emailB,
        password: 'PasswordKuat123!',
      });
    const loginB = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: emailB,
        password: 'PasswordKuat123!',
      });
    userBId = loginB.body.user.id;
    cookieB = loginB.headers['set-cookie'] as unknown as string[];

    const semResB = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ name: 'Semester B', academicYear: '2026/2027', makeActive: true });
    semBId = semResB.body.semester.id;

    const crsResB = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({
        semesterId: semBId,
        name: 'Biologi Sel',
      });
    courseBId = crsResB.body.course.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.cal.' } },
    });
  });

  it('menolak rentang tanggal tidak valid (startDate >= endDate)', async () => {
    const res = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        startDate: '2026-10-15',
        endDate: '2026-10-10',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RANGE');
  });

  it('menolak rentang waktu kalender lebih dari 60 hari', async () => {
    const res = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        startDate: '2026-09-01',
        endDate: '2026-11-15', // > 70 hari
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RANGE_TOO_LARGE');
  });

  it('menolak akses ke semester atau mata kuliah milik user lain (isolasi tenant)', async () => {
    // User A mencoba query dengan semester milik User B
    const res1 = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        semesterId: semBId,
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      });

    expect(res1.status).toBe(404);

    // User A mencoba query dengan courseId milik User B
    const res2 = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        courseId: courseBId,
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      });

    expect(res2.status).toBe(404);
  });

  it('mengekspansi jadwal berulang mingguan ke tanggal kalender yang sesuai rentang [start, end)', async () => {
    // Buat jadwal kuliah pada hari Rabu (dayOfWeek = 3), 08:00 - 10:00 untuk Kalkulus I
    await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 3,
        startTime: '08:00',
        endTime: '10:00',
        room: 'Lab Komputer 1',
      });

    // Rentang: 2026-10-05 (Senin) hingga 2026-10-19 (Senin) -> 2 minggu
    // Hari Rabu jatuh pada: 2026-10-07 dan 2026-10-14
    const res = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        startDate: '2026-10-05',
        endDate: '2026-10-19',
        type: 'schedule',
      });

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);

    expect(res.body.events[0].date).toBe('2026-10-07');
    expect(res.body.events[0].type).toBe('SCHEDULE');
    expect(res.body.events[0].title).toBe('Kalkulus I');
    expect(res.body.events[0].startTime).toBe('08:00');
    expect(res.body.events[0].endTime).toBe('10:00');
    expect(res.body.events[0].room).toBe('Lab Komputer 1');
    expect(res.body.events[0].lecturer).toBe('Prof. Bambang');

    expect(res.body.events[1].date).toBe('2026-10-14');
    expect(res.body.events[1].type).toBe('SCHEDULE');
    expect(res.body.events[1].title).toBe('Kalkulus I');
  });

  it('menggabungkan jadwal kuliah dan tugas, mendukung filter mata kuliah dan tipe', async () => {
    // 1. Jadwal Kalkulus I di hari Senin (dayOfWeek = 1)
    await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '12:00',
      });

    // 2. Tugas Kalkulus I due pada 2026-10-08 23:59 (Kamis)
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        title: 'Tugas Limit dan Kontinuitas',
        dueDate: '2026-10-08T16:59:00.000Z', // 23:59 WIB
        priority: 'HIGH',
      });

    // 3. Tugas Fisika Dasar due pada 2026-10-12 14:00 (Senin)
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA2Id,
        title: 'Laporan Kinematika Gerak',
        dueDate: '2026-10-12T07:00:00.000Z', // 14:00 WIB
        priority: 'MEDIUM',
      });

    // Uji 1: Query all dalam 1 minggu (2026-10-05 sampai 2026-10-12)
    // 2026-10-05 ada jadwal Kalkulus I (Senin)
    // 2026-10-08 ada tugas Kalkulus I (Kamis)
    // 2026-10-12 ada di batas luar [start, end) sehingga tidak masuk
    const resAll = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        startDate: '2026-10-05',
        endDate: '2026-10-12',
        type: 'all',
      });

    expect(resAll.status).toBe(200);
    expect(resAll.body.events).toHaveLength(2);
    expect(resAll.body.events[0].type).toBe('SCHEDULE');
    expect(resAll.body.events[0].title).toBe('Kalkulus I');
    expect(resAll.body.events[1].type).toBe('ASSIGNMENT');
    expect(resAll.body.events[1].title).toBe('Tugas Limit dan Kontinuitas');

    // Uji 2: Filter tipe = 'assignment'
    const resAssignmentsOnly = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        startDate: '2026-10-05',
        endDate: '2026-10-15',
        type: 'assignment',
      });

    expect(resAssignmentsOnly.status).toBe(200);
    expect(resAssignmentsOnly.body.events).toHaveLength(2);
    expect(resAssignmentsOnly.body.events.every((e: any) => e.type === 'ASSIGNMENT')).toBe(true);

    // Uji 3: Filter courseId = courseA1Id
    const resCourseA1Only = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        startDate: '2026-10-05',
        endDate: '2026-10-15',
        courseId: courseA1Id,
        type: 'all',
      });

    expect(resCourseA1Only.status).toBe(200);
    // Tidak boleh mengandung tugas Fisika Dasar
    expect(
      resCourseA1Only.body.events.some((e: any) => e.title === 'Laporan Kinematika Gerak')
    ).toBe(false);
  });

  it('tidak menyertakan tugas atau jadwal dari mata kuliah yang diarsipkan', async () => {
    // Arsipkan courseA2
    await request(app)
      .post(`/api/courses/${courseA2Id}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    const res = await request(app)
      .get('/api/calendar')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({
        courseId: courseA2Id,
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COURSE_ARCHIVED');
  });
});
