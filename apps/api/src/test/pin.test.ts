import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Pinned Items Endpoints & Business Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];

  let semA1Id: string;
  let semA2Id: string;
  let courseA1Id: string;
  let courseA2Id: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.pin.' } },
    });

    // 1. Create User A
    const emailA = `test.pin.a.${Date.now()}.${Math.random()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Pin User A',
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

    // 2. Create User B
    const emailB = `test.pin.b.${Date.now()}.${Math.random()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Pin User B',
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

    // 3. User A Semesters & Courses
    const semA1Res = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Gasal', academicYear: '2026/2027', makeActive: true });
    semA1Id = semA1Res.body.semester.id;

    const semA2Res = await request(app)
      .post('/api/semesters')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ name: 'Semester Genap', academicYear: '2026/2027', makeActive: false });
    semA2Id = semA2Res.body.semester.id;

    const crsA1Res = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ semesterId: semA1Id, name: 'Struktur Data', code: 'CS201' });
    courseA1Id = crsA1Res.body.course.id;

    const crsA2Res = await request(app)
      .post('/api/courses')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ semesterId: semA2Id, name: 'Basis Data', code: 'CS202' });
    courseA2Id = crsA2Res.body.course.id;
  });

  it('1. Pin and unpin material and note successfully, without updating item updatedAt', async () => {
    // Create Material for User A
    const material = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Slide Struktur Data 01',
        originalFilename: 'slide-01.pdf',
        storageKey: `materials/${userAId}/slide-01.pdf`,
        bytes: 1024,
        status: 'READY',
      },
    });

    // Create Note for User A
    const note = await prisma.note.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Ringkasan Tree & Graph',
        content: 'Konten penting',
      },
    });

    const initialMaterialUpdatedAt = material.updatedAt.getTime();
    const initialNoteUpdatedAt = note.updatedAt.getTime();

    // Pin Material
    const pinMatRes = await request(app)
      .patch(`/api/materials/${material.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });

    expect(pinMatRes.status).toBe(200);
    expect(pinMatRes.body.success).toBe(true);
    expect(pinMatRes.body.pinned).toBe(true);
    expect(pinMatRes.body.pinnedAt).toBeDefined();

    // Pin Note
    const pinNoteRes = await request(app)
      .patch(`/api/notes/${note.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });

    expect(pinNoteRes.status).toBe(200);
    expect(pinNoteRes.body.success).toBe(true);
    expect(pinNoteRes.body.pinned).toBe(true);

    // Verify updatedAt did not change on Material or Note
    const freshMaterial = await prisma.material.findUniqueOrThrow({ where: { id: material.id } });
    const freshNote = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(freshMaterial.updatedAt.getTime()).toBe(initialMaterialUpdatedAt);
    expect(freshNote.updatedAt.getTime()).toBe(initialNoteUpdatedAt);

    // Verify list endpoint includes isPinned
    const matListRes = await request(app)
      .get('/api/materials')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(matListRes.status).toBe(200);
    const targetMat = matListRes.body.materials.find((m: any) => m.id === material.id);
    expect(targetMat.isPinned).toBe(true);

    const noteListRes = await request(app)
      .get('/api/notes')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(noteListRes.status).toBe(200);
    const targetNote = noteListRes.body.notes.find((n: any) => n.id === note.id);
    expect(targetNote.isPinned).toBe(true);

    // Unpin Material
    const unpinMatRes = await request(app)
      .patch(`/api/materials/${material.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: false });
    expect(unpinMatRes.status).toBe(200);
    expect(unpinMatRes.body.pinned).toBe(false);

    // Unpin Note
    const unpinNoteRes = await request(app)
      .patch(`/api/notes/${note.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: false });
    expect(unpinNoteRes.status).toBe(200);
    expect(unpinNoteRes.body.pinned).toBe(false);
  });

  it('2. Tenant isolation: cannot pin other user items (404)', async () => {
    // User A material & note
    const material = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Private Slide A',
        originalFilename: 'priv.pdf',
        storageKey: `materials/${userAId}/priv.pdf`,
        bytes: 1024,
        status: 'READY',
      },
    });

    const note = await prisma.note.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Private Note A',
        content: 'Secret',
      },
    });

    // User B tries to pin User A's material
    const resMat = await request(app)
      .patch(`/api/materials/${material.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ pinned: true });
    expect(resMat.status).toBe(404);

    // User B tries to pin User A's note
    const resNote = await request(app)
      .patch(`/api/notes/${note.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ pinned: true });
    expect(resNote.status).toBe(404);
  });

  it('3. Idempotency: repeated requests with same state return success without duplicate entries', async () => {
    const note = await prisma.note.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Idempotency Note',
      },
    });

    // Pin first time
    const res1 = await request(app)
      .patch(`/api/notes/${note.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });
    expect(res1.status).toBe(200);
    expect(res1.body.pinned).toBe(true);

    // Pin second time (same true)
    const res2 = await request(app)
      .patch(`/api/notes/${note.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });
    expect(res2.status).toBe(200);
    expect(res2.body.pinned).toBe(true);

    // Verify count in DB is exactly 1
    const count = await prisma.pinnedItem.count({
      where: { userId: userAId, noteId: note.id },
    });
    expect(count).toBe(1);

    // Unpin first time
    const res3 = await request(app)
      .patch(`/api/notes/${note.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: false });
    expect(res3.status).toBe(200);
    expect(res3.body.pinned).toBe(false);

    // Unpin second time
    const res4 = await request(app)
      .patch(`/api/notes/${note.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: false });
    expect(res4.status).toBe(200);
    expect(res4.body.pinned).toBe(false);
  });

  it('4. Maximum 20 combined items per user enforced, even under concurrent requests', async () => {
    // Create 21 notes for User A
    const notes = await Promise.all(
      Array.from({ length: 22 }, (_, i) =>
        prisma.note.create({
          data: {
            userId: userAId,
            courseId: courseA1Id,
            title: `Note Item ${i + 1}`,
          },
        })
      )
    );

    // Pin 19 items sequentially
    for (let i = 0; i < 19; i++) {
      const res = await request(app)
        .patch(`/api/notes/${notes[i].id}/pin`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ pinned: true });
      expect(res.status).toBe(200);
    }

    // Attempt to pin 3 items simultaneously (parallel requests for slots 20, 21, 22)
    const parallelResponses = await Promise.all([
      request(app)
        .patch(`/api/notes/${notes[19].id}/pin`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ pinned: true }),
      request(app)
        .patch(`/api/notes/${notes[20].id}/pin`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ pinned: true }),
      request(app)
        .patch(`/api/notes/${notes[21].id}/pin`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ pinned: true }),
    ]);

    const successes = parallelResponses.filter((r) => r.status === 200);
    const failures = parallelResponses.filter((r) => r.status === 400);

    // Exactly 1 can take the 20th slot; the other 2 must fail with PIN_LIMIT_EXCEEDED
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);
    expect(failures[0].body.error.code).toBe('PIN_LIMIT_EXCEEDED');

    // Total pinned items in DB must be exactly 20
    const totalCount = await prisma.pinnedItem.count({ where: { userId: userAId } });
    expect(totalCount).toBe(20);
  });

  it('5. Dashboard pinned endpoint filters by semester and preserves general notes', async () => {
    // Material in Semester 1
    const matSem1 = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Materi Sem 1',
        originalFilename: 'sem1.pdf',
        storageKey: `materials/${userAId}/sem1.pdf`,
        bytes: 1024,
        status: 'READY',
      },
    });

    // Material in Semester 2
    const matSem2 = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseA2Id,
        title: 'Materi Sem 2',
        originalFilename: 'sem2.pdf',
        storageKey: `materials/${userAId}/sem2.pdf`,
        bytes: 1024,
        status: 'READY',
      },
    });

    // Note in Semester 1
    const noteSem1 = await prisma.note.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Catatan Sem 1',
      },
    });

    // Pin all three
    await request(app)
      .patch(`/api/materials/${matSem1.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });

    await request(app)
      .patch(`/api/materials/${matSem2.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });

    await request(app)
      .patch(`/api/notes/${noteSem1.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });

    // Request dashboard pinned with semesterId = semA1Id
    const resSem1 = await request(app)
      .get(`/api/dashboard/pinned?semesterId=${semA1Id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(resSem1.status).toBe(200);
    expect(resSem1.body.items).toBeDefined();
    const titles = resSem1.body.items.map((i: any) => i.title);
    expect(titles).toContain('Materi Sem 1');
    expect(titles).toContain('Catatan Sem 1');
    expect(titles).not.toContain('Materi Sem 2');

    // Request dashboard pinned without semesterId: returns all non-archived pinned items
    const resAll = await request(app)
      .get('/api/dashboard/pinned')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(resAll.status).toBe(200);
    expect(resAll.body.items.length).toBe(3);
  });

  it('6. Deletion and archiving rules: deleted materials and archived courses are excluded', async () => {
    const mat = await prisma.material.create({
      data: {
        userId: userAId,
        courseId: courseA1Id,
        title: 'Materi Akan Dihapus',
        originalFilename: 'del.pdf',
        storageKey: `materials/${userAId}/del.pdf`,
        bytes: 1024,
        status: 'READY',
      },
    });

    // Pin it
    await request(app)
      .patch(`/api/materials/${mat.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });

    // Soft delete material
    await prisma.material.update({
      where: { id: mat.id },
      data: { deletedAt: new Date() },
    });

    // Query dashboard pinned: should NOT contain soft-deleted material
    const resDashboard = await request(app)
      .get('/api/dashboard/pinned')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(resDashboard.status).toBe(200);
    const found = resDashboard.body.items.find((i: any) => i.targetId === mat.id);
    expect(found).toBeUndefined();

    // Trying to pin a soft-deleted material returns 404
    const resRePin = await request(app)
      .patch(`/api/materials/${mat.id}/pin`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ pinned: true });
    expect(resRePin.status).toBe(404);
  });
});
