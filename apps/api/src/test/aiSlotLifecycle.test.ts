import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  prisma,
  cancelMaterialJobsAtomically,
  finishAiJobAtomically,
  reconcileAiJobSlots,
} from '@studyflow/database';
import { deleteMaterial } from '../services/material.service.js';

describe('AI Job Slot Lifecycle & Material Deletion Invariants', () => {
  let testUserId: string;
  let testCourseId: string;
  let testSemesterId: string;

  beforeEach(async () => {
    // Unique user per test to ensure isolation
    const uniqueEmail = `ai.slot.test.${Date.now()}.${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: 'dummy_hash',
        name: 'AI Slot Tester',
      },
    });
    testUserId = user.id;

    const semester = await prisma.semester.create({
      data: {
        userId: testUserId,
        name: 'Semester Slot Lifecycle',
        academicYear: '2026/2027',
      },
    });
    testSemesterId = semester.id;

    const course = await prisma.course.create({
      data: {
        userId: testUserId,
        semesterId: testSemesterId,
        name: 'Arsitektur Komputer',
        code: 'CS201',
      },
    });
    testCourseId = course.id;
  });

  async function createTestMaterial(title: string, status: 'READY' | 'UPLOADING' | 'PROCESSING' = 'READY') {
    return await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title,
        originalFilename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        storageKey: `materials/${testUserId}/${crypto.randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        bytes: 1024 * 50,
        pageCount: 3,
        status,
      },
    });
  }

  it('1. Hapus materi dengan job AI PENDING -> slot dilepas tepat satu kali', async () => {
    const material = await createTestMaterial('Materi AI Pending');

    // User memiliki activeJobsCount = 1 dan 1 job AI berstatus PENDING
    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        activeJobsCount: 1,
        dailyGenerationCount: 1,
      },
    });

    const job = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
      },
    });

    await prisma.materialSummary.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        status: 'QUEUED',
        activeJobId: job.id,
      },
    });

    // Jalankan penghapusan materi
    await deleteMaterial(testUserId, material.id);

    // 1. Verifikasi materi di-soft delete
    const deletedMat = await prisma.material.findUnique({
      where: { id: material.id },
    });
    expect(deletedMat?.deletedAt).not.toBeNull();

    // 2. Verifikasi status job menjadi FAILED dengan error code MATERIAL_DELETED
    const updatedJob = await prisma.processingJob.findUnique({
      where: { id: job.id },
    });
    expect(updatedJob?.status).toBe('FAILED');
    expect(updatedJob?.errorCode).toBe('MATERIAL_DELETED');

    // 3. Verifikasi slot AI dilepas tepat satu kali (1 -> 0)
    const usage = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(usage?.activeJobsCount).toBe(0);
    expect(usage?.dailyGenerationCount).toBe(1); // Kuota harian tidak terpengaruh
  });

  it('2. Hapus materi saat job PROCESSING -> hasil terlambat tidak disimpan dan slot dilepas tepat sekali', async () => {
    const material = await createTestMaterial('Materi AI Processing');

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        activeJobsCount: 1,
      },
    });

    const job = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_FLASHCARD_GENERATION',
        status: 'PROCESSING',
        attempts: 1,
        maxAttempts: 3,
      },
    });

    const set = await prisma.flashcardSet.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        title: 'Flashcard In Progress',
        status: 'PROCESSING',
        activeJobId: job.id,
      },
    });

    // 1. Hapus materi saat job sedang PROCESSING
    await deleteMaterial(testUserId, material.id);

    const jobAfterDelete = await prisma.processingJob.findUnique({
      where: { id: job.id },
    });
    expect(jobAfterDelete?.status).toBe('FAILED');
    expect(jobAfterDelete?.errorCode).toBe('MATERIAL_DELETED');

    const usageAfterDelete = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(usageAfterDelete?.activeJobsCount).toBe(0);

    // 2. Simulasikan worker selesai terlambat dan mencoba menyimpan hasil
    let wasOnSuccessCalled = false;
    const finishResult = await finishAiJobAtomically({
      jobId: job.id,
      userId: testUserId,
      materialId: material.id,
      status: 'COMPLETED',
      payload: { cardCount: 5 },
      onSuccessTx: async (tx) => {
        wasOnSuccessCalled = true;
        await tx.flashcard.create({
          data: {
            setId: set.id,
            front: 'Front late',
            back: 'Back late',
            pageReferences: [1],
          },
        });
      },
    });

    // Slot tidak boleh dilepas lagi (wasSlotReleased = false) karena job sudah terminal FAILED
    expect(finishResult.wasSlotReleased).toBe(false);
    expect(wasOnSuccessCalled).toBe(false);

    // activeJobsCount tetap 0 dan tidak menjadi negatif
    const finalUsage = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(finalUsage?.activeJobsCount).toBe(0);

    // Tidak ada kartu yang dibuat untuk materi yang telah dihapus
    const cards = await prisma.flashcard.findMany({
      where: { setId: set.id },
    });
    expect(cards.length).toBe(0);
  });

  it('3. Penghapusan berulang atau job duplikat -> tidak ada pengurangan tambahan atau slot negatif', async () => {
    const material = await createTestMaterial('Materi Double Delete');

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        activeJobsCount: 1,
      },
    });

    await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_QUIZ_GENERATION',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
      },
    });

    // Penghapusan pertama
    await deleteMaterial(testUserId, material.id);

    const usageAfterFirst = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(usageAfterFirst?.activeJobsCount).toBe(0);

    // Upaya pembatalan kedua pada materi yang sama (idempotent cancellation)
    const secondCancel = await cancelMaterialJobsAtomically({
      materialId: material.id,
      userId: testUserId,
    });

    expect(secondCancel.cancelledAiJobCount).toBe(0);

    const usageAfterSecond = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(usageAfterSecond?.activeJobsCount).toBe(0);
  });

  it('4. Penghapusan bersamaan dengan penyelesaian worker -> counter dan status akhir konsisten', async () => {
    const material = await createTestMaterial('Materi Concurrency Race');

    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        activeJobsCount: 1,
      },
    });

    const job = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PROCESSING',
        attempts: 1,
        maxAttempts: 3,
      },
    });

    // Jalankan deleteMaterial dan finishAiJobAtomically secara bersamaan via Promise.all
    const [deleteRes, finishRes] = await Promise.allSettled([
      deleteMaterial(testUserId, material.id),
      finishAiJobAtomically({
        jobId: job.id,
        userId: testUserId,
        materialId: material.id,
        status: 'COMPLETED',
        payload: { durationMs: 1500 },
      }),
    ]);

    expect(deleteRes.status).toBe('fulfilled');
    expect(finishRes.status).toBe('fulfilled');

    // Apapun yang menang, counter akhir HARUS tepat 0 (tidak pernah double-decrement menjadi -1)
    const finalUsage = await prisma.aiUsage.findUnique({
      where: { userId: testUserId },
    });
    expect(finalUsage?.activeJobsCount).toBe(0);

    const finalJob = await prisma.processingJob.findUnique({
      where: { id: job.id },
    });
    expect(['COMPLETED', 'FAILED']).toContain(finalJob?.status);
  });

  it('5. Pengguna memiliki job lain -> slot job lain tetap terjaga saat satu materi dihapus', async () => {
    const mat1 = await createTestMaterial('Materi 1 Keep Other Slot');
    const mat2 = await createTestMaterial('Materi 2 Keep Other Slot');

    // Pengguna memiliki 2 job aktif (maksimal batas konkurensi)
    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        activeJobsCount: 2,
      },
    });

    const job1 = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: mat1.id,
        type: 'AI_SUMMARY_GENERATION',
        status: 'PROCESSING',
      },
    });

    const job2 = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: mat2.id,
        type: 'AI_FLASHCARD_GENERATION',
        status: 'PROCESSING',
      },
    });

    // Hapus mat1
    await deleteMaterial(testUserId, mat1.id);

    // Job 1 FAILED
    const checkJob1 = await prisma.processingJob.findUnique({ where: { id: job1.id } });
    expect(checkJob1?.status).toBe('FAILED');

    // Job 2 TETAP PROCESSING
    const checkJob2 = await prisma.processingJob.findUnique({ where: { id: job2.id } });
    expect(checkJob2?.status).toBe('PROCESSING');

    // activeJobsCount turun dari 2 menjadi TEPAT 1 (slot job 2 tetap terjaga)
    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(1);
  });

  it('6. Hapus materi dengan job ekstraksi saja -> counter AI tidak berubah', async () => {
    const mat = await createTestMaterial('Materi Ekstraksi Saja', 'PROCESSING');

    // Pengguna memiliki activeJobsCount = 1 karena sedang menjalankan AI di tempat lain
    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        activeJobsCount: 1,
      },
    });

    const extractionJob = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: mat.id,
        type: 'DOCUMENT_EXTRACTION',
        status: 'PROCESSING',
      },
    });

    // Hapus materi yang hanya memiliki job ekstraksi dokumen
    await deleteMaterial(testUserId, mat.id);

    // Job ekstraksi menjadi FAILED
    const updatedJob = await prisma.processingJob.findUnique({ where: { id: extractionJob.id } });
    expect(updatedJob?.status).toBe('FAILED');
    expect(updatedJob?.errorCode).toBe('MATERIAL_DELETED');

    // Counter AI usage TETAP 1 (tidak boleh terpotong oleh job ekstraksi)
    const usage = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usage?.activeJobsCount).toBe(1);
  });

  it('7. Rekonsiliasi mendeteksi dan memperbaiki counter salah tanpa mengganggu job aktif', async () => {
    const activeMat = await createTestMaterial('Materi Job Aktif');

    // User memiliki 1 job AI yang BENAR-BENAR sedang aktif
    await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: activeMat.id,
        type: 'AI_QUIZ_GENERATION',
        status: 'PROCESSING',
      },
    });

    // Tapi counter di aiUsage tercatat salah (misalnya 2 karena bug sebelumnya)
    await prisma.aiUsage.create({
      data: {
        userId: testUserId,
        activeJobsCount: 2, // Salah: seharusnya 1
      },
    });

    // 1. Jalankan Mode Dry-Run (default)
    const dryRunReport = await reconcileAiJobSlots({
      userId: testUserId,
      dryRun: true,
    });

    expect(dryRunReport.dryRun).toBe(true);
    expect(dryRunReport.discrepanciesFound).toBe(1);
    expect(dryRunReport.details[0]?.recordedActiveJobs).toBe(2);
    expect(dryRunReport.details[0]?.actualActiveJobs).toBe(1);
    expect(dryRunReport.details[0]?.action).toBe('WOULD_REPAIR');

    // Database tidak boleh berubah dalam dry-run
    const usageAfterDry = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usageAfterDry?.activeJobsCount).toBe(2);

    // 2. Jalankan Mode Perbaikan Eksplisit (dryRun: false)
    const fixReport = await reconcileAiJobSlots({
      userId: testUserId,
      dryRun: false,
    });

    expect(fixReport.dryRun).toBe(false);
    expect(fixReport.discrepanciesFound).toBe(1);
    expect(fixReport.details[0]?.action).toBe('REPAIRED');

    // Database diperbaiki ke nilai aktual (1), BUKAN direset ke 0
    const usageAfterFix = await prisma.aiUsage.findUnique({ where: { userId: testUserId } });
    expect(usageAfterFix?.activeJobsCount).toBe(1);

    // 3. Rekonsiliasi ulang: harus bersih tanpa selisih
    const cleanReport = await reconcileAiJobSlots({
      userId: testUserId,
      dryRun: true,
    });
    expect(cleanReport.discrepanciesFound).toBe(0);
    expect(cleanReport.details[0]?.action).toBe('NO_CHANGE');
  });
});
