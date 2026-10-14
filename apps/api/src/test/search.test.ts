import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Global Search Endpoints & Business Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];
  let semA1Id: string;
  let semA2Id: string;
  let semBId: string;
  let courseA1Id: string;
  let courseA2Id: string;
  let courseBId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.srch.' } },
    });

    // 1. Buat User A & Semester 1 (Aktif)
    const emailA = `test.srch.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Search User A',
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

    const semResA1 = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Gasal 2026', academicYear: '2026/2027', makeActive: true });
    semA1Id = semResA1.body.semester.id;

    // Semester 2 (Non-aktif) untuk User A
    const semResA2 = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Genap 2027', academicYear: '2026/2027', makeActive: false });
    semA2Id = semResA2.body.semester.id;

    // Course A1 di Semester 1: "Kalkulus I", code: "CS101"
    const crsResA1 = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semA1Id,
        name: 'Kalkulus I',
        code: 'CS101',
      });
    courseA1Id = crsResA1.body.course.id;

    // Course A2 di Semester 2: "Kalkulus Lanjut", code: "CS201"
    const crsResA2 = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semA2Id,
        name: 'Kalkulus Lanjut',
        code: 'CS201',
      });
    courseA2Id = crsResA2.body.course.id;

    // 2. Buat User B & Semester B (untuk uji isolasi tenant)
    const emailB = `test.srch.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Search User B',
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
        name: 'Kalkulus Khusus B',
      });
    courseBId = crsResB.body.course.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.srch.' } },
    });
  });

  it('menolak query pencarian yang kurang dari 2 karakter atau lebih dari 100 karakter', async () => {
    // Kurang dari 2 karakter
    const resShort = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'a' });

    expect(resShort.status).toBe(400);
    expect(resShort.body.error.code).toBe('VALIDATION_ERROR');

    // Kosong / whitespace
    const resBlank = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: '   ' });

    expect(resBlank.status).toBe(400);
    expect(resBlank.body.error.code).toBe('VALIDATION_ERROR');

    // Lebih dari 100 karakter
    const longQuery = 'a'.repeat(101);
    const resLong = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: longQuery });

    expect(resLong.status).toBe(400);
    expect(resLong.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('menjaga isolasi tenant: tidak menemukan data milik pengguna lain', async () => {
    // User B punya "Kalkulus Khusus B"
    const res = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'Khusus B', semesterId: 'all' });

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(0);
    expect(res.body.results.courses).toHaveLength(0);
  });

  it('menolak query dengan semesterId milik user lain atau semester diarsipkan', async () => {
    // User A query dengan semester User B
    const resTenant = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'Kalkulus', semesterId: semBId });

    expect(resTenant.status).toBe(404);
    expect(resTenant.body.error.code).toBe('SEMESTER_NOT_FOUND');

    // User A mengarsipkan semA2
    await request(app)
      .post(`/api/semesters/${semA2Id}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    const resArchived = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'Kalkulus', semesterId: semA2Id });

    expect(resArchived.status).toBe(400);
    expect(resArchived.body.error.code).toBe('SEMESTER_ARCHIVED');
  });

  it('mencari pada semester aktif secara default dan mendukung opsi "Semua Semester"', async () => {
    // Default (semester aktif = semA1): hanya menemukan "Kalkulus I", tidak menemukan "Kalkulus Lanjut" (semA2)
    const resDefault = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'kalkulus' }); // Case-insensitive test

    expect(resDefault.status).toBe(200);
    expect(resDefault.body.semesterScope.id).toBe(semA1Id);
    expect(resDefault.body.results.courses).toHaveLength(1);
    expect(resDefault.body.results.courses[0].title).toBe('Kalkulus I');

    // Opsi semesterId='all': menemukan kedua mata kuliah di kedua semester
    const resAll = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'kalkulus', semesterId: 'all' });

    expect(resAll.status).toBe(200);
    expect(resAll.body.semesterScope.id).toBe('all');
    expect(resAll.body.results.courses).toHaveLength(2);
    const titles = resAll.body.results.courses.map((c: any) => c.title);
    expect(titles).toContain('Kalkulus I');
    expect(titles).toContain('Kalkulus Lanjut');
  });

  it('mencocokkan kode mata kuliah secara case-insensitive', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'cs101' });

    expect(res.status).toBe(200);
    expect(res.body.results.courses).toHaveLength(1);
    expect(res.body.results.courses[0].title).toBe('Kalkulus I');
    expect(res.body.results.courses[0].metadata.code).toBe('CS101');
  });

  it('mengelompokkan hasil ke dalam kategori (Mata Kuliah, Materi, Tugas, Catatan) dan tidak menyertakan konten catatan/PDF', async () => {
    // Buat Materi, Tugas, dan Catatan di courseA1
    await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Materi Limit dan Fungsi Kalkulus',
        originalFilename: 'limit.pdf',
        storageKey: `test/limit-${Date.now()}.pdf`,
        bytes: 1024,
      },
    });

    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        title: 'Tugas Kalkulus Minggu 1',
        dueDate: '2026-10-20T16:59:00.000Z',
        priority: 'HIGH',
      });

    await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        title: 'Catatan Kuliah Kalkulus Dasar',
        content: 'Rahasia internal rumus limit trigonometri yang panjang',
      });

    const res = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'kalkulus' });

    expect(res.status).toBe(200);
    expect(res.body.results.courses).toHaveLength(1);
    expect(res.body.results.materials).toHaveLength(1);
    expect(res.body.results.assignments).toHaveLength(1);
    expect(res.body.results.notes).toHaveLength(1);

    expect(res.body.results.materials[0].title).toBe('Materi Limit dan Fungsi Kalkulus');
    expect(res.body.results.materials[0].url).toMatch(/^\/materials\//);

    expect(res.body.results.assignments[0].title).toBe('Tugas Kalkulus Minggu 1');
    expect(res.body.results.assignments[0].url).toContain(`/assignments?courseId=${courseA1Id}`);

    expect(res.body.results.notes[0].title).toBe('Catatan Kuliah Kalkulus Dasar');
    expect(res.body.results.notes[0].url).toMatch(/^\/notes\//);

    // Verifikasi: Konten catatan tidak dibocorkan dalam respons
    expect((res.body.results.notes[0] as any).content).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Rahasia internal rumus');
  });

  it('mengurutkan hasil secara deterministik: exact match -> prefix -> substring', async () => {
    // Tambahkan 3 tugas dengan variasi nama
    // 1. "Kalkulus" (exact)
    // 2. "Kalkulus Diferensial" (prefix)
    // 3. "Belajar Soal Kalkulus" (substring)
    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        title: 'Belajar Soal Kalkulus',
        dueDate: '2026-10-25T16:59:00.000Z',
      });

    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        title: 'Kalkulus',
        dueDate: '2026-10-25T16:59:00.000Z',
      });

    await request(app)
      .post('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        title: 'Kalkulus Diferensial',
        dueDate: '2026-10-25T16:59:00.000Z',
      });

    const res = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'kalkulus' });

    expect(res.status).toBe(200);
    const assignmentTitles = res.body.results.assignments.map((a: any) => a.title);

    // Exact match "Kalkulus" harus di urutan pertama
    expect(assignmentTitles[0]).toBe('Kalkulus');
    // Prefix "Kalkulus Diferensial" harus di urutan kedua
    expect(assignmentTitles[1]).toBe('Kalkulus Diferensial');
    // Substring "Belajar Soal Kalkulus" harus di urutan ketiga
    expect(assignmentTitles[2]).toBe('Belajar Soal Kalkulus');
  });

  it('tidak menampilkan materi yang telah dihapus (soft-deleted)', async () => {
    const mat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Materi Dihapus Kalkulus',
        originalFilename: 'deleted.pdf',
        storageKey: `test/deleted-${Date.now()}.pdf`,
        bytes: 512,
        deletedAt: new Date(),
      },
    });

    const res = await request(app)
      .get('/api/search')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .query({ q: 'Dihapus Kalkulus' });

    expect(res.status).toBe(200);
    expect(res.body.results.materials).toHaveLength(0);
  });
});
