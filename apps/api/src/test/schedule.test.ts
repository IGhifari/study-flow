import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Course Schedule Endpoints & Invariants', () => {
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
  let courseAInSem2Id: string;
  let courseBId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.sch.' } },
    });

    // 1. Buat User A & Semester 1
    const emailA = `test.sch.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Schedule User A',
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

    // Semester 1 (Aktif) untuk User A
    const semResA1 = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Ganjil 2026', academicYear: '2026/2027', makeActive: true });
    semA1Id = semResA1.body.semester.id;

    // Semester 2 (Berbeda) untuk User A
    const semResA2 = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Genap 2027', academicYear: '2026/2027' });
    semA2Id = semResA2.body.semester.id;

    // Mata Kuliah 1 di Semester 1
    const crsResA1 = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semA1Id,
        name: 'Algoritma & Pemrograman',
        code: 'CS101',
        lecturer: 'Dr. Indah Permata',
      });
    courseA1Id = crsResA1.body.course.id;

    // Mata Kuliah 2 di Semester 1
    const crsResA2 = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semA1Id,
        name: 'Struktur Data',
        code: 'CS102',
        lecturer: 'Budi Santoso, M.Kom',
      });
    courseA2Id = crsResA2.body.course.id;

    // Mata Kuliah di Semester 2
    const crsResAInSem2 = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semA2Id,
        name: 'Basis Data Lanjut',
        code: 'CS201',
      });
    courseAInSem2Id = crsResAInSem2.body.course.id;

    // 2. Buat User B & Semester & Mata Kuliah
    const emailB = `test.sch.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Schedule User B',
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
      .send({ name: 'Semester User B', academicYear: '2026/2027' });
    semBId = semResB.body.semester.id;

    const crsResB = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({
        semesterId: semBId,
        name: 'Jaringan Komputer User B',
        code: 'CS301',
      });
    courseBId = crsResB.body.course.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.sch.' } },
    });
  });

  it('1. CRUD sesi jadwal berhasil dan hasil daftar terurut (hari Senin-Minggu lalu waktu mulai)', async () => {
    // Tambah 3 sesi dengan urutan acak
    // Sesi 1: Rabu (hari 3), 10:00 - 11:40
    const resWed = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 3,
        startTime: '10:00',
        endTime: '11:40',
        room: 'Lab Komputer 2',
      });
    expect(resWed.status).toBe(201);
    expect(resWed.body.schedule.dayOfWeek).toBe(3);
    expect(resWed.body.schedule.room).toBe('Lab Komputer 2');
    expect(resWed.body.hasConflict).toBe(false);
    const wedScheduleId = resWed.body.schedule.id;

    // Sesi 2: Senin (hari 1), 13:00 - 14:40
    const resMonLate = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '13:00',
        endTime: '14:40',
        room: 'Gedung A R.301',
      });
    expect(resMonLate.status).toBe(201);

    // Sesi 3: Senin (hari 1), 08:00 - 09:40
    const resMonEarly = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA2Id,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:40',
        room: 'Auditorium Utama',
      });
    expect(resMonEarly.status).toBe(201);

    // GET /api/schedules harus terurut:
    // Index 0: Senin 08:00 (hari 1)
    // Index 1: Senin 13:00 (hari 1)
    // Index 2: Rabu 10:00 (hari 3)
    const listRes = await request(app)
      .get('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(listRes.status).toBe(200);
    expect(listRes.body.schedules).toHaveLength(3);
    expect(listRes.body.schedules[0].dayOfWeek).toBe(1);
    expect(listRes.body.schedules[0].startTime).toBe('08:00');
    expect(listRes.body.schedules[1].dayOfWeek).toBe(1);
    expect(listRes.body.schedules[1].startTime).toBe('13:00');
    expect(listRes.body.schedules[2].dayOfWeek).toBe(3);
    expect(listRes.body.schedules[2].startTime).toBe('10:00');

    // Detail GET /api/schedules/:id
    const getSingle = await request(app)
      .get(`/api/schedules/${wedScheduleId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(getSingle.status).toBe(200);
    expect(getSingle.body.schedule.room).toBe('Lab Komputer 2');
    expect(getSingle.body.schedule.course.name).toBe('Algoritma & Pemrograman');

    // PATCH /api/schedules/:id (Update ruangan dan waktu)
    const patchRes = await request(app)
      .patch(`/api/schedules/${wedScheduleId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        room: 'Lab Riset AI',
        startTime: '10:30',
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.schedule.room).toBe('Lab Riset AI');
    expect(patchRes.body.schedule.startTime).toBe('10:30');

    // DELETE /api/schedules/:id
    const deleteRes = await request(app)
      .delete(`/api/schedules/${wedScheduleId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verifikasi sisa jadwal menjadi 2
    const listAfterDelete = await request(app)
      .get('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(listAfterDelete.body.schedules).toHaveLength(2);
  });

  it('2. Satu mata kuliah dapat memiliki beberapa sesi dan filter courseId/semesterId berfungsi', async () => {
    // Mata Kuliah A1 memiliki Sesi Teori (Senin 08:00-09:40) dan Sesi Praktikum (Kamis 13:00-15:00)
    await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:40',
        room: 'R.101',
      });

    await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 4,
        startTime: '13:00',
        endTime: '15:00',
        room: 'Lab Software',
      });

    // Mata Kuliah A2 memiliki 1 sesi (Jumat 09:00-11:00)
    await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA2Id,
        dayOfWeek: 5,
        startTime: '09:00',
        endTime: '11:00',
        room: 'R.202',
      });

    // Filter by courseId
    const filterCourseRes = await request(app)
      .get(`/api/schedules?courseId=${courseA1Id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(filterCourseRes.status).toBe(200);
    expect(filterCourseRes.body.schedules).toHaveLength(2);
    expect(filterCourseRes.body.schedules.every((s: any) => s.courseId === courseA1Id)).toBe(true);

    // Filter by semesterId
    const filterSemRes = await request(app)
      .get(`/api/schedules?semesterId=${semA1Id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(filterSemRes.status).toBe(200);
    expect(filterSemRes.body.schedules).toHaveLength(3);
  });

  it('3. Validasi hari, jam, waktu selesai > mulai, penolakan lintas tengah malam, dan penolakan sesi identik', async () => {
    // 3.1 Hari di luar 1..7 ditolak
    const resInvalidDay = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 8,
        startTime: '08:00',
        endTime: '09:40',
      });
    expect(resInvalidDay.status).toBe(400);

    // 3.2 Format waktu invalid ditolak
    const resInvalidTime = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '8:00', // harus 08:00
        endTime: '09:40',
      });
    expect(resInvalidTime.status).toBe(400);

    // 3.3 Waktu selesai sama dengan waktu mulai ditolak
    const resEqualTime = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '08:00',
      });
    expect(resEqualTime.status).toBe(400);
    expect(resEqualTime.body.error.message).toContain('Waktu selesai harus lebih besar daripada waktu mulai');

    // 3.4 Sesi lintas tengah malam (startTime > endTime) ditolak dengan pesan yang jelas
    const resMidnightCross = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '23:00',
        endTime: '01:00',
      });
    expect(resMidnightCross.status).toBe(400);
    expect(resMidnightCross.body.error.message).toContain('Sesi jadwal lintas tengah malam belum didukung');

    // 3.5 Penolakan sesi identik untuk mata kuliah yang sama
    const firstSession = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '12:00',
      });
    expect(firstSession.status).toBe(201);

    const duplicateSession = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '12:00',
      });
    expect(duplicateSession.status).toBe(409);
    expect(duplicateSession.body.error.code).toBe('SCHEDULE_DUPLICATE');
  });

  it('4. Multi-tenant isolation: User B tidak dapat mengakses atau memodifikasi jadwal User A', async () => {
    // User A membuat jadwal
    const resA = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:40',
        room: 'Ruang A',
      });
    expect(resA.status).toBe(201);
    const scheduleAId = resA.body.schedule.id;

    // User B mencoba membuat jadwal untuk mata kuliah User A -> ditolak 404 (tidak ditemukan kepemilikan)
    const crossCreate = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:40',
      });
    expect(crossCreate.status).toBe(404);

    // User B mencoba membaca jadwal User A -> ditolak 404
    const crossGet = await request(app)
      .get(`/api/schedules/${scheduleAId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(crossGet.status).toBe(404);

    // User B mencoba mengedit jadwal User A -> ditolak 404
    const crossPatch = await request(app)
      .patch(`/api/schedules/${scheduleAId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ room: 'Ruang Diretas' });
    expect(crossPatch.status).toBe(404);

    // User B mencoba menghapus jadwal User A -> ditolak 404
    const crossDelete = await request(app)
      .delete(`/api/schedules/${scheduleAId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(crossDelete.status).toBe(404);

    // Daftar jadwal User B tetap kosong
    const listB = await request(app)
      .get('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(listB.body.schedules).toHaveLength(0);
  });

  it('5. Deteksi konflik waktu: overlap terdeteksi, waktu berdampingan bukan konflik, edit sesi sendiri tidak konflik, dan beda semester bukan konflik', async () => {
    // 5.1 Jadwal awal Course A1: Senin (hari 1), 08:00 - 10:00 (di Semester 1)
    const resSession1 = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '10:00',
        room: 'R.101',
      });
    expect(resSession1.status).toBe(201);
    expect(resSession1.body.hasConflict).toBe(false);
    const session1Id = resSession1.body.schedule.id;

    // 5.2 Waktu berdampingan: Course A2 pada Senin 10:00 - 12:00 -> BUKAN konflik!
    const resAdjacent = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA2Id,
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '12:00',
        room: 'R.102',
      });
    expect(resAdjacent.status).toBe(201);
    expect(resAdjacent.body.hasConflict).toBe(false);
    expect(resAdjacent.body.conflicts).toHaveLength(0);

    // 5.3 Jadwal tumpang tindih (Overlap): Senin 09:00 - 11:00 (bertabrakan dengan 08:00-10:00 dan 10:00-12:00)
    // Jadwal tetap boleh disimpan (status 201), tetapi metadata konflik terisi
    const resOverlapping = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA2Id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '11:00',
        room: 'R.Overlap',
      });
    expect(resOverlapping.status).toBe(201);
    expect(resOverlapping.body.hasConflict).toBe(true);
    expect(resOverlapping.body.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(resOverlapping.body.conflicts.some((c: any) => c.id === session1Id)).toBe(true);

    // 5.4 Edit sesi sendiri: Mengubah ruangan sesi 1 tidak boleh menjadikannya konflik dengan dirinya sendiri
    const resPatchSelf = await request(app)
      .patch(`/api/schedules/${session1Id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        room: 'R.101 Baru',
      });
    expect(resPatchSelf.status).toBe(200);
    // Konflik sesi 1 hanya dengan sesi overlap (bukan dengan session1Id)
    expect(resPatchSelf.body.conflicts.every((c: any) => c.id !== session1Id)).toBe(true);

    // 5.5 Jadwal di SEMESTER BERBEDA tidak dianggap konflik
    // Tambah jadwal di Semester 2 pada hari Senin 08:00 - 10:00 (jam yang sama dengan Semester 1)
    const resSem2 = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAInSem2Id, // di Semester 2
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '10:00',
      });
    expect(resSem2.status).toBe(201);
    // Tidak bentrok dengan sesi Semester 1 karena beda semester!
    expect(resSem2.body.hasConflict).toBe(false);
  });

  it('6. Perilaku semester / mata kuliah diarsipkan: menolak penambahan, pengeditan, dan penghapusan jadwal', async () => {
    // Buat jadwal pada mata kuliah aktif terlebih dahulu
    const initRes = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 4,
        startTime: '08:00',
        endTime: '10:00',
      });
    expect(initRes.status).toBe(201);
    const scheduleId = initRes.body.schedule.id;

    // Arsipkan mata kuliah A1
    const archRes = await request(app)
      .post(`/api/courses/${courseA1Id}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(archRes.status).toBe(200);

    // Menambah jadwal baru pada mata kuliah arsip ditolak 400
    const addOnArchived = await request(app)
      .post('/api/schedules')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseA1Id,
        dayOfWeek: 5,
        startTime: '08:00',
        endTime: '10:00',
      });
    expect(addOnArchived.status).toBe(400);
    expect(addOnArchived.body.error.code).toBe('COURSE_ARCHIVED');

    // Mengedit jadwal pada mata kuliah arsip ditolak 400
    const editOnArchived = await request(app)
      .patch(`/api/schedules/${scheduleId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        room: 'Ruang Tidak Boleh Edit',
      });
    expect(editOnArchived.status).toBe(400);
    expect(editOnArchived.body.error.code).toBe('COURSE_ARCHIVED');

    // Menghapus jadwal pada mata kuliah arsip ditolak 400
    const deleteOnArchived = await request(app)
      .delete(`/api/schedules/${scheduleId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(deleteOnArchived.status).toBe(400);
    expect(deleteOnArchived.body.error.code).toBe('COURSE_ARCHIVED');
  });

  it('7. Data mata kuliah lama tetap dapat dibaca secara normal dan kompatibel', async () => {
    // Verifikasi endpoint /api/courses dan /api/courses/:id tetap mengembalikan mata kuliah dengan utuh
    const getCourseRes = await request(app)
      .get(`/api/courses/${courseA1Id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(getCourseRes.status).toBe(200);
    expect(getCourseRes.body.course.name).toBe('Algoritma & Pemrograman');
    expect(getCourseRes.body.course.code).toBe('CS101');
    expect(getCourseRes.body.course.lecturer).toBe('Dr. Indah Permata');
  });
});
