import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@studyflow/database';
import {
  processAssignmentReminderJob,
  reconcileAssignmentReminders,
} from '../queues/assignmentReminderQueue.js';
import {
  __getSentTestEmails,
  __clearSentTestEmails,
  __setMockEmailFailure,
} from '../services/emailAdapter.js';

describe('Worker Assignment Deadline Reminder (H-1) Queue & Reconciliation', () => {
  let testUserId: string;
  let testCourseId: string;
  let testSemesterId: string;
  let testUserEmail: string;

  beforeEach(async () => {
    __clearSentTestEmails();

    // Clean up previous test users
    await prisma.user.deleteMany({
      where: { email: { contains: 'reminder.worker.test' } },
    });

    testUserEmail = `reminder.worker.test.${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        passwordHash: 'hashed_password_placeholder',
        name: 'Mahasiswa Berprestasi',
        timezone: 'Asia/Jakarta',
        emailVerifiedAt: new Date(), // Verified by default
        reminderEmailDeadline: true, // Opt-in enabled by default
      },
    });
    testUserId = user.id;

    const semester = await prisma.semester.create({
      data: {
        userId: testUserId,
        name: 'Semester Genap 2026/2027',
        academicYear: '2026/2027',
        isActive: true,
      },
    });
    testSemesterId = semester.id;

    const course = await prisma.course.create({
      data: {
        userId: testUserId,
        semesterId: testSemesterId,
        name: 'Struktur Data & Algoritma',
        code: 'CS201',
      },
    });
    testCourseId = course.id;
  });

  it('1. Berhasil mengirim tepat 1 email saat kondisi memenuhi syarat', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000); // 2026-10-21T10:00:00.000Z

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Implementasi Binary Search Tree',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    const result = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );

    expect(result.status).toBe('SENT');

    // Verify sent emails
    const emails = __getSentTestEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(testUserEmail);
    expect(emails[0].subject).toContain('Implementasi Binary Search Tree');
    expect(emails[0].subject).toContain('jatuh tempo besok');
    expect(emails[0].text).toContain('Struktur Data & Algoritma');
    expect(emails[0].text).toContain('/assignments?id=' + assignment.id);
    expect(emails[0].text).toContain('/settings');
    expect(emails[0].html).toContain('Implementasi Binary Search Tree');

    // Verify DB log
    const log = await prisma.assignmentReminderLog.findUnique({
      where: {
        assignment_reminder_unique: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline,
        },
      },
    });
    expect(log).not.toBeNull();
    expect(log?.status).toBe('SENT');
    expect(log?.sentAt).not.toBeNull();
    expect(log?.error).toBeNull();
  });

  it('2. Idempotency: eksekusi ulang tidak mengirim email ganda', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Graf & Djikstra',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    // First execution
    const res1 = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );
    expect(res1.status).toBe('SENT');
    expect(__getSentTestEmails()).toHaveLength(1);

    // Second execution (re-run)
    const res2 = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );
    expect(res2.status).toBe('ALREADY_SENT');
    // Email count must remain 1
    expect(__getSentTestEmails()).toHaveLength(1);
  });

  it('3. Tugas DONE dilewati', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas yang Sudah Selesai',
        dueDate: deadline,
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    const result = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );

    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toContain('Tugas sudah selesai');
    expect(__getSentTestEmails()).toHaveLength(0);

    const log = await prisma.assignmentReminderLog.findUnique({
      where: {
        assignment_reminder_unique: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline,
        },
      },
    });
    expect(log?.status).toBe('SKIPPED');
  });

  it('4. Tugas dihapus dilewati', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Dihapus',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    const id = assignment.id;
    await prisma.assignment.delete({ where: { id } });

    const result = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );

    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toContain('Tugas telah dihapus');
    expect(__getSentTestEmails()).toHaveLength(0);
  });

  it('5. Deadline bergeser membatalkan pengingat lama dan menjadwalkan ulang sesuai deadline baru', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const oldDeadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000); // Oct 21
    const newDeadline = new Date(baseTime.getTime() + 48 * 60 * 60 * 1000); // Oct 22

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Diperpanjang',
        dueDate: oldDeadline,
        status: 'TODO',
      },
    });

    // User updates due date
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { dueDate: newDeadline },
    });

    // 1. Process job for old deadline
    const oldResult = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: oldDeadline.toISOString(),
        },
      },
      { now: baseTime }
    );
    expect(oldResult.status).toBe('SKIPPED');
    expect(oldResult.reason).toContain('Tenggat waktu tugas telah diubah');
    expect(__getSentTestEmails()).toHaveLength(0);

    // 2. Process job for new deadline at its H-1 timestamp (Oct 21)
    const newTime = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);
    const newResult = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: newDeadline.toISOString(),
        },
      },
      { now: newTime }
    );
    expect(newResult.status).toBe('SENT');
    expect(__getSentTestEmails()).toHaveLength(1);
  });

  it('6. Mata kuliah atau semester diarsipkan dilewati', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

    // Archive the course
    await prisma.course.update({
      where: { id: testCourseId },
      data: { archivedAt: new Date() },
    });

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas di Mata Kuliah Arsip',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    const result = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );

    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toContain('Mata kuliah atau semester diarsipkan');
    expect(__getSentTestEmails()).toHaveLength(0);
  });

  it('7. Email belum terverifikasi tidak menerima pengingat', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

    // Set emailVerifiedAt = null
    await prisma.user.update({
      where: { id: testUserId },
      data: { emailVerifiedAt: null },
    });

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Email Belum Verif',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    const result = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );

    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toContain('Alamat email pengguna belum terverifikasi');
    expect(__getSentTestEmails()).toHaveLength(0);
  });

  it('8. Pengguna yang menonaktifkan pengingat dilewati', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

    // Disable reminder opt-in
    await prisma.user.update({
      where: { id: testUserId },
      data: { reminderEmailDeadline: false },
    });

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Pengguna Opt-Out',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    const result = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );

    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toContain('Preferensi pengingat email dinonaktifkan');
    expect(__getSentTestEmails()).toHaveLength(0);
  });

  it('9. Keterlambatan melebihi 1 jam saat worker pulih ditandai terlewat, bukan dikirim', async () => {
    const targetSendTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(targetSendTime.getTime() + 24 * 60 * 60 * 1000); // 2026-10-21T10:00:00.000Z

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Terlambat Lebih Dari 1 Jam',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    // Worker recovers at targetSendTime + 65 minutes (> 1 hour late)
    const recoveredTime = new Date(targetSendTime.getTime() + 65 * 60 * 1000);

    const result = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: recoveredTime }
    );

    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toContain('Keterlambatan melebihi batas toleransi 1 jam');
    expect(__getSentTestEmails()).toHaveLength(0);

    // Also verify: if now >= deadline, never send after deadline
    const pastDeadlineTime = new Date(deadline.getTime() + 1000);
    const pastResult = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: pastDeadlineTime }
    );
    expect(pastResult.status).toBe('SKIPPED');
    expect(__getSentTestEmails()).toHaveLength(0);
  });

  it('10. Recovery worker mengirim tugas tertunda yang masih dalam batas toleransi', async () => {
    const targetSendTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(targetSendTime.getTime() + 24 * 60 * 60 * 1000);

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Recovery Dalam Toleransi',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    // Worker recovers at targetSendTime + 45 minutes (<= 1 hour late tolerance)
    const recoveredTime = new Date(targetSendTime.getTime() + 45 * 60 * 1000);

    const result = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: recoveredTime }
    );

    expect(result.status).toBe('SENT');
    expect(__getSentTestEmails()).toHaveLength(1);
    expect(__getSentTestEmails()[0].subject).toContain('Tugas Recovery Dalam Toleransi');
  });

  it('11. Retry SMTP tidak menyebabkan duplikasi jika DB sudah mencatat terkirim', async () => {
    const baseTime = new Date('2026-10-20T10:00:00.000Z');
    const deadline = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Retry SMTP',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    // 1. Simulate initial SMTP failure
    __setMockEmailFailure(new Error('Koneksi SMTP terputus (ETIMEDOUT)'));

    await expect(
      processAssignmentReminderJob(
        {
          data: {
            assignmentId: assignment.id,
            reminderType: 'D_MINUS_1',
            deadline: deadline.toISOString(),
          },
        },
        { now: baseTime }
      )
    ).rejects.toThrow('Koneksi SMTP terputus');

    const failedLog = await prisma.assignmentReminderLog.findUnique({
      where: {
        assignment_reminder_unique: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline,
        },
      },
    });
    expect(failedLog?.status).toBe('FAILED');
    expect(__getSentTestEmails()).toHaveLength(0);

    // 2. Recovery: SMTP recovers, worker retries job
    __setMockEmailFailure(null);

    const successResult = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );
    expect(successResult.status).toBe('SENT');
    expect(__getSentTestEmails()).toHaveLength(1);

    // 3. Spurious redelivery/retry after SENT status
    const redeliveryResult = await processAssignmentReminderJob(
      {
        data: {
          assignmentId: assignment.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline.toISOString(),
        },
      },
      { now: baseTime }
    );
    expect(redeliveryResult.status).toBe('ALREADY_SENT');
    // Still exactly 1 email sent!
    expect(__getSentTestEmails()).toHaveLength(1);
  });

  it('12. Reconciliation runner scans and processes eligible assignments while skipping expired ones', async () => {
    const now = new Date('2026-10-20T12:00:00.000Z');

    // Assignment 1: Due in 23.5 hours (targetSendTime was 30 mins ago -> within 1h tolerance)
    const deadline1 = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const a1 = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Reconcile Eligible',
        dueDate: deadline1,
        status: 'TODO',
      },
    });

    // Assignment 2: Due in 20 hours (targetSendTime was 4 hours ago -> > 1h late tolerance)
    const deadline2 = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const a2 = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Reconcile Expired',
        dueDate: deadline2,
        status: 'TODO',
      },
    });

    const report = await reconcileAssignmentReminders({ now });

    expect(report.processed).toBe(1);
    expect(report.skipped).toBe(1);

    // Verify email was sent only for eligible assignment
    const emails = __getSentTestEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toContain('Tugas Reconcile Eligible');

    // Verify DB logs
    const log1 = await prisma.assignmentReminderLog.findUnique({
      where: {
        assignment_reminder_unique: {
          assignmentId: a1.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline1,
        },
      },
    });
    expect(log1?.status).toBe('SENT');

    const log2 = await prisma.assignmentReminderLog.findUnique({
      where: {
        assignment_reminder_unique: {
          assignmentId: a2.id,
          reminderType: 'D_MINUS_1',
          deadline: deadline2,
        },
      },
    });
    expect(log2?.status).toBe('SKIPPED');
    expect(log2?.error).toContain('Keterlambatan melebihi batas toleransi 1 jam');
  });

  it('13. Reconciliation runner enqueues future eligible assignments (targetSendTime > now within 72h window) to queue', async () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    // Due in 48 hours -> targetSendTime is in 24 hours (targetSendTime > now, within 72h window)
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const targetSendTime = deadline.getTime() - 24 * 60 * 60 * 1000;

    const assignment = await prisma.assignment.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title: 'Tugas Masa Depan Reconcile Queue',
        dueDate: deadline,
        status: 'TODO',
      },
    });

    const mockQueue = {
      add: vi.fn().mockResolvedValue({}),
    } as any;

    const report = await reconcileAssignmentReminders({
      now,
      queue: mockQueue,
    });

    expect(report.enqueued).toBe(1);
    expect(report.processed).toBe(0);
    expect(report.skipped).toBe(0);

    const expectedJobId = `reminder-${assignment.id}-D_MINUS_1-${deadline.getTime()}`;
    const expectedDelay = targetSendTime - now.getTime();

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-assignment-reminder',
      {
        assignmentId: assignment.id,
        reminderType: 'D_MINUS_1',
        deadline: deadline.toISOString(),
      },
      {
        jobId: expectedJobId,
        delay: expectedDelay,
      }
    );
  });
});
