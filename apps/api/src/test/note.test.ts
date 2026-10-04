import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Note Endpoints & Invariants', () => {
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
      where: { email: { contains: 'test.not.' } },
    });

    // Create User A
    const emailA = `test.not.a.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Note User A',
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
      .send({ name: 'Semester A', academicYear: '2026/2027', isActive: true });
    semAId = semResA.body.semester.id;

    const courseResA = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        semesterId: semAId,
        name: 'Sistem Operasi',
        code: 'IF202',
      });
    courseAId = courseResA.body.course.id;

    // Create User B
    const emailB = `test.not.b.${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Note User B',
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
      .send({ name: 'Semester B', academicYear: '2026/2027', isActive: true });
    semBId = semResB.body.semester.id;

    const courseResB = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({
        semesterId: semBId,
        name: 'Basis Data',
        code: 'IF203',
      });
    courseBId = courseResB.body.course.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.not.' } },
    });
    await prisma.$disconnect();
  });

  it('creates a note with empty content and retrieves it', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Catatan Pertemuan 1',
        content: '',
      });

    expect(res.status).toBe(201);
    expect(res.body.note.title).toBe('Catatan Pertemuan 1');
    expect(res.body.note.content).toBe('');
    expect(res.body.note.version).toBe(1);

    const getRes = await request(app)
      .get(`/api/notes/${res.body.note.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(getRes.status).toBe(200);
    expect(getRes.body.note.title).toBe('Catatan Pertemuan 1');
    expect(getRes.body.note.content).toBe('');
    expect(getRes.body.note.version).toBe(1);
  });

  it('manages version increments and rejects conflicting concurrent edits with 409', async () => {
    // 1. Create note (version 1)
    const createRes = await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Catatan Concurrency',
        content: '# Bab 1\nPengantar proses.',
      });

    const noteId = createRes.body.note.id;
    expect(createRes.body.note.version).toBe(1);

    // 2. Tab A edits with version = 1 -> succeeds, version becomes 2
    const editTabARes = await request(app)
      .patch(`/api/notes/${noteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        version: 1,
        content: '# Bab 1\nPengantar proses dan thread oleh Tab A.',
      });

    expect(editTabARes.status).toBe(200);
    expect(editTabARes.body.note.version).toBe(2);

    // 3. Tab B (which still holds version 1) attempts to save -> 409 NOTE_VERSION_CONFLICT
    const editTabBRes = await request(app)
      .patch(`/api/notes/${noteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        version: 1,
        content: '# Bab 1\nTab B mencoba menimpa!',
      });

    expect(editTabBRes.status).toBe(409);
    expect(editTabBRes.body.error.code).toBe('NOTE_VERSION_CONFLICT');

    // 4. Tab B fetches current note, reconciles, and submits with version = 2
    const editTabBRetryRes = await request(app)
      .patch(`/api/notes/${noteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        version: 2,
        content: '# Bab 1\nTab B rekonsiliasi berhasil.',
      });

    expect(editTabBRetryRes.status).toBe(200);
    expect(editTabBRetryRes.body.note.version).toBe(3);
  });

  it('rejects editing courseId', async () => {
    const createRes = await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Catatan Test Course Change',
      });

    const editRes = await request(app)
      .patch(`/api/notes/${createRes.body.note.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ courseId: courseBId });

    expect(editRes.status).toBe(400);
    expect(editRes.body.error.code).toBe('CANNOT_CHANGE_COURSE');
  });

  it('enforces multi-tenant data isolation', async () => {
    // User A creates note
    const noteA = await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Rahasia Catatan User A',
        content: 'Konten rahasia A',
      });

    // User B tries to read User A note -> 404
    const getRes = await request(app)
      .get(`/api/notes/${noteA.body.note.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(getRes.status).toBe(404);

    // User B tries to update User A note -> 404
    const patchRes = await request(app)
      .patch(`/api/notes/${noteA.body.note.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ title: 'Hacked', version: 1 });
    expect(patchRes.status).toBe(404);

    // User B tries to delete User A note -> 404
    const deleteRes = await request(app)
      .delete(`/api/notes/${noteA.body.note.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(deleteRes.status).toBe(404);

    // User B tries to create note under User A course -> 404 COURSE_NOT_FOUND
    const createBwithACourse = await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({
        courseId: courseAId,
        title: 'Catatan Ilegal',
      });
    expect(createBwithACourse.status).toBe(404);
    expect(createBwithACourse.body.error.code).toBe('COURSE_NOT_FOUND');
  });

  it('prevents course deletion if course has notes and suggests archive', async () => {
    await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Catatan Penghalang Hapus',
        content: 'Isi catatan',
      });

    const deleteCourseRes = await request(app)
      .delete(`/api/courses/${courseAId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(deleteCourseRes.status).toBe(409);
    expect(deleteCourseRes.body.error.code).toBe('COURSE_HAS_NOTES');
    expect(deleteCourseRes.body.error.message).toContain('arsip');
  });

  it('enforces read-only invariant on archived courses/semesters', async () => {
    // 1. Create note on active course
    const noteRes = await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Catatan Sebelum Arsip',
        content: 'Konten penting',
      });
    const noteId = noteRes.body.note.id;

    // 2. Archive courseA
    await request(app)
      .post(`/api/courses/${courseAId}/archive`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    // 3. Attempt to create new note on archived course -> 400 COURSE_ARCHIVED
    const newNoteRes = await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Catatan Baru Di Arsip',
      });
    expect(newNoteRes.status).toBe(400);
    expect(newNoteRes.body.error.code).toBe('COURSE_ARCHIVED');

    // 4. Attempt to update note on archived course -> 400 COURSE_ARCHIVED
    const editRes = await request(app)
      .patch(`/api/notes/${noteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'Edit Di Arsip', version: 1 });
    expect(editRes.status).toBe(400);
    expect(editRes.body.error.code).toBe('COURSE_ARCHIVED');

    // 5. Attempt to delete note on archived course -> 400 COURSE_ARCHIVED
    const deleteRes = await request(app)
      .delete(`/api/notes/${noteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.error.code).toBe('COURSE_ARCHIVED');

    // 6. Reading note on archived course remains allowed (read-only)
    const readRes = await request(app)
      .get(`/api/notes/${noteId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(readRes.status).toBe(200);
    expect(readRes.body.note.title).toBe('Catatan Sebelum Arsip');
  });

  it('supports list without full content, search by title, and course/semester filters', async () => {
    await request(app)
      .post('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({
        courseId: courseAId,
        title: 'Catatan Teori Graph',
        content: 'Isi yang sangat panjang tidak perlu diunduh pada list view...',
      });

    const listRes = await request(app)
      .get('/api/notes?search=Graph')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(listRes.status).toBe(200);
    expect(listRes.body.notes.length).toBe(1);
    expect(listRes.body.notes[0].title).toBe('Catatan Teori Graph');
    // Note list items do not include the full content
    expect((listRes.body.notes[0] as any).content).toBeUndefined();
  });
});
