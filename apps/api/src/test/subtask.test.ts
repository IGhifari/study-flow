import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';

describe('Assignment Subtasks Endpoints & Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  let userAId: string;
  let userBId: string;
  let cookieA: string[];
  let cookieB: string[];

  let semAId: string;
  let courseAId: string;
  let assignmentAId: string;

  beforeEach(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.subtask.' } },
    });

    // 1. Create User A
    const emailA = `test.subtask.a.${Date.now()}.${Math.random()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Subtask User A',
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

    cookieA = loginA.headers['set-cookie'];
    userAId = loginA.body.user.id;

    // 2. Create User B
    const emailB = `test.subtask.b.${Date.now()}.${Math.random()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Subtask User B',
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

    cookieB = loginB.headers['set-cookie'];
    userBId = loginB.body.user.id;

    // 3. Create Semester & Course for User A
    const sem = await prisma.semester.create({
      data: {
        userId: userAId,
        name: 'Semester 1',
        academicYear: '2026/2027',
        isActive: true,
      },
    });
    semAId = sem.id;

    const course = await prisma.course.create({
      data: {
        userId: userAId,
        semesterId: semAId,
        name: 'Struktur Data',
        code: 'CS101',
      },
    });
    courseAId = course.id;

    // 4. Create Assignment for User A
    const asg = await prisma.assignment.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Tugas Linked List',
        dueDate: new Date(Date.now() + 86400000 * 3),
        status: 'TODO',
      },
    });
    assignmentAId = asg.id;
  });

  it('1. CRUD subtugas: tambah, ambil, perbarui judul, ubah status selesai, dan hapus', async () => {
    // Create subtask
    const resCreate = await request(app)
      .post(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'Rancang Node struct' });

    expect(resCreate.status).toBe(201);
    expect(resCreate.body.subtask).toBeDefined();
    expect(resCreate.body.subtask.title).toBe('Rancang Node struct');
    expect(resCreate.body.subtask.completed).toBe(false);
    expect(resCreate.body.subtask.order).toBe(0);
    const subtaskId = resCreate.body.subtask.id;

    // Get subtasks
    const resGet = await request(app)
      .get(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(resGet.status).toBe(200);
    expect(resGet.body.subtasks.length).toBe(1);
    expect(resGet.body.subtasks[0].id).toBe(subtaskId);

    // Update title
    const resEdit = await request(app)
      .patch(`/api/assignments/${assignmentAId}/subtasks/${subtaskId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'Rancang Node struct & pointer' });

    expect(resEdit.status).toBe(200);
    expect(resEdit.body.subtask.title).toBe('Rancang Node struct & pointer');

    // Update status to completed
    const resCheck = await request(app)
      .patch(`/api/assignments/${assignmentAId}/subtasks/${subtaskId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ completed: true });

    expect(resCheck.status).toBe(200);
    expect(resCheck.body.subtask.completed).toBe(true);

    // Delete subtask
    const resDel = await request(app)
      .delete(`/api/assignments/${assignmentAId}/subtasks/${subtaskId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(resDel.status).toBe(200);

    // Confirm deleted
    const resAfterDel = await request(app)
      .get(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);

    expect(resAfterDel.body.subtasks.length).toBe(0);
  });

  it('2. Validasi judul (min 1, max 200, trimmed) dan batas maksimal 50 subtugas per tugas', async () => {
    // Empty title rejected
    const resEmpty = await request(app)
      .post(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: '   ' });

    expect(resEmpty.status).toBe(400);

    // Too long title rejected
    const resLong = await request(app)
      .post(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'a'.repeat(201) });

    expect(resLong.status).toBe(400);

    // Insert 50 subtasks
    const subtaskData = Array.from({ length: 50 }, (_, i) => ({
      assignmentId: assignmentAId,
      title: `Subtugas ${i + 1}`,
      order: i,
    }));
    await prisma.assignmentSubtask.createMany({ data: subtaskData });

    // 51st subtask must be rejected
    const resOver = await request(app)
      .post(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'Subtugas ke-51' });

    expect(resOver.status).toBe(400);
    expect(resOver.body.error.message).toContain('50');

    // Concurrent parallel attempt to add when at limit
    const parallelRequests = await Promise.all([
      request(app)
        .post(`/api/assignments/${assignmentAId}/subtasks`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ title: 'Parallel 1' }),
      request(app)
        .post(`/api/assignments/${assignmentAId}/subtasks`)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieA)
        .send({ title: 'Parallel 2' }),
    ]);

    expect(parallelRequests[0].status).toBe(400);
    expect(parallelRequests[1].status).toBe(400);

    const count = await prisma.assignmentSubtask.count({ where: { assignmentId: assignmentAId } });
    expect(count).toBe(50);
  });

  it('3. Isolasi antar pengguna dan kecocokan subtask dengan tugas induk (404)', async () => {
    // Create subtask under user A
    const sub = await prisma.assignmentSubtask.create({
      data: {
        assignmentId: assignmentAId,
        title: 'Rahasia User A',
        order: 0,
      },
    });

    // User B tries to view User A's subtasks -> 404
    const resViewB = await request(app)
      .get(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(resViewB.status).toBe(404);

    // User B tries to update User A's subtask -> 404
    const resUpdateB = await request(app)
      .patch(`/api/assignments/${assignmentAId}/subtasks/${sub.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB)
      .send({ completed: true });
    expect(resUpdateB.status).toBe(404);

    // User B tries to delete User A's subtask -> 404
    const resDeleteB = await request(app)
      .delete(`/api/assignments/${assignmentAId}/subtasks/${sub.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieB);
    expect(resDeleteB.status).toBe(404);

    // User A provides mismatched assignmentId -> 404
    const otherAsg = await prisma.assignment.create({
      data: {
        userId: userAId,
        courseId: courseAId,
        title: 'Tugas Lain',
        dueDate: new Date(),
      },
    });

    const resMismatch = await request(app)
      .patch(`/api/assignments/${otherAsg.id}/subtasks/${sub.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ completed: true });
    expect(resMismatch.status).toBe(404);
  });

  it('4. Request status berulang tetap idempotent', async () => {
    const sub = await prisma.assignmentSubtask.create({
      data: {
        assignmentId: assignmentAId,
        title: 'Uji Idempoten',
        isCompleted: false,
        order: 0,
      },
    });

    // Set to true
    const res1 = await request(app)
      .patch(`/api/assignments/${assignmentAId}/subtasks/${sub.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ completed: true });
    expect(res1.body.subtask.completed).toBe(true);

    // Set to true again (must not flip to false!)
    const res2 = await request(app)
      .patch(`/api/assignments/${assignmentAId}/subtasks/${sub.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ completed: true });
    expect(res2.body.subtask.completed).toBe(true);
  });

  it('5. Mutasi ditolak saat tugas induk telah selesai (DONE) atau terarsip', async () => {
    const sub = await prisma.assignmentSubtask.create({
      data: {
        assignmentId: assignmentAId,
        title: 'Langkah Awal',
        order: 0,
      },
    });

    // Mark parent assignment as DONE
    await prisma.assignment.update({
      where: { id: assignmentAId },
      data: { status: 'DONE', completedAt: new Date() },
    });

    // Attempt to add subtask -> rejected 400
    const resAdd = await request(app)
      .post(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'Subtugas baru saat selesai' });
    expect(resAdd.status).toBe(400);
    expect(resAdd.body.error.message).toContain('selesai');

    // Attempt to edit subtask -> rejected 400
    const resEdit = await request(app)
      .patch(`/api/assignments/${assignmentAId}/subtasks/${sub.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ completed: true });
    expect(resEdit.status).toBe(400);

    // Attempt to delete subtask -> rejected 400
    const resDelete = await request(app)
      .delete(`/api/assignments/${assignmentAId}/subtasks/${sub.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(resDelete.status).toBe(400);

    // Reopen assignment
    await prisma.assignment.update({
      where: { id: assignmentAId },
      data: { status: 'TODO', completedAt: null },
    });

    // Archive course
    await prisma.course.update({
      where: { id: courseAId },
      data: { archivedAt: new Date() },
    });

    // Attempt to add subtask on archived course -> rejected 400
    const resArchived = await request(app)
      .post(`/api/assignments/${assignmentAId}/subtasks`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ title: 'Subtugas pada mata kuliah arsip' });
    expect(resArchived.status).toBe(400);
  });

  it('6. Semua subtugas selesai TIDAK otomatis menyelesaikan induk; status subtugas tidak mengubah firstCompletedAt', async () => {
    const sub1 = await prisma.assignmentSubtask.create({
      data: { assignmentId: assignmentAId, title: 'Step 1', isCompleted: false, order: 0 },
    });
    const sub2 = await prisma.assignmentSubtask.create({
      data: { assignmentId: assignmentAId, title: 'Step 2', isCompleted: false, order: 1 },
    });

    // Complete all subtasks
    await request(app)
      .patch(`/api/assignments/${assignmentAId}/subtasks/${sub1.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ completed: true });

    await request(app)
      .patch(`/api/assignments/${assignmentAId}/subtasks/${sub2.id}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA)
      .send({ completed: true });

    // Verify parent assignment is STILL TODO and firstCompletedAt is NULL
    const asg = await prisma.assignment.findUnique({
      where: { id: assignmentAId },
    });
    expect(asg?.status).toBe('TODO');
    expect(asg?.completedAt).toBeNull();
    expect(asg?.firstCompletedAt).toBeNull();

    // Verify subtaskCount in listAssignments
    const resList = await request(app)
      .get('/api/assignments')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    const listed = resList.body.assignments.find((a: any) => a.id === assignmentAId);
    expect(listed.subtaskCount).toEqual({ total: 2, completed: 2 });
  });

  it('7. Penghapusan tugas induk membersihkan semua subtugas (cascade delete)', async () => {
    await prisma.assignmentSubtask.createMany({
      data: [
        { assignmentId: assignmentAId, title: 'Subtask 1', order: 0 },
        { assignmentId: assignmentAId, title: 'Subtask 2', order: 1 },
      ],
    });

    expect(await prisma.assignmentSubtask.count({ where: { assignmentId: assignmentAId } })).toBe(2);

    // Delete parent assignment
    const resDel = await request(app)
      .delete(`/api/assignments/${assignmentAId}`)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieA);
    expect(resDel.status).toBe(200);

    // Verify subtasks are deleted
    const countAfter = await prisma.assignmentSubtask.count({
      where: { assignmentId: assignmentAId },
    });
    expect(countAfter).toBe(0);
  });
});
