import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  prisma,
  startDocumentJobAtomically,
  finishDocumentJobAtomically,
  failDocumentJobAtomically,
} from '@studyflow/database';
import { deleteMaterial, retryMaterialProcessing } from '../services/material.service.js';
import { checkAndReserveUploadQuota } from '../services/quota.service.js';

describe('Document Processing Idempotency & Storage Quota Invariants', () => {
  let testUserId: string;
  let testCourseId: string;
  let testSemesterId: string;

  beforeEach(async () => {
    const uniqueEmail = `doc.idempotency.${Date.now()}.${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: 'dummy_hash',
        name: 'Doc Idempotency Tester',
      },
    });
    testUserId = user.id;

    const semester = await prisma.semester.create({
      data: {
        userId: testUserId,
        name: 'Semester Doc Lifecycle',
        academicYear: '2026/2027',
      },
    });
    testSemesterId = semester.id;

    const course = await prisma.course.create({
      data: {
        userId: testUserId,
        semesterId: testSemesterId,
        name: 'Sistem Operasi',
        code: 'CS202',
      },
    });
    testCourseId = course.id;
  });

  async function createMaterialWithReservation(
    title: string,
    declaredBytes: number,
    initialStatus: 'QUEUED' | 'PROCESSING' | 'READY' = 'QUEUED'
  ) {
    // 1. Ensure storageUsage exists and reserve declaredBytes
    await prisma.storageUsage.upsert({
      where: { userId: testUserId },
      create: {
        userId: testUserId,
        usedBytes: initialStatus === 'READY' ? BigInt(declaredBytes) : BigInt(0),
        reservedBytes: initialStatus === 'READY' ? BigInt(0) : BigInt(declaredBytes),
      },
      update: {
        ...(initialStatus === 'READY'
          ? { usedBytes: { increment: BigInt(declaredBytes) } }
          : { reservedBytes: { increment: BigInt(declaredBytes) } }),
      },
    });

    // 2. Create Material
    const material = await prisma.material.create({
      data: {
        userId: testUserId,
        courseId: testCourseId,
        title,
        originalFilename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        storageKey: `materials/${testUserId}/${crypto.randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        bytes: declaredBytes,
        pageCount: 2,
        status: initialStatus,
      },
    });

    // 3. Create ProcessingJob
    const job = await prisma.processingJob.create({
      data: {
        userId: testUserId,
        materialId: material.id,
        type: 'DOCUMENT_EXTRACTION',
        status: initialStatus === 'READY' ? 'COMPLETED' : 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        payload: {
          materialId: material.id,
          userId: testUserId,
          storageKey: material.storageKey,
          declaredBytes,
        },
      },
    });

    return { material, job };
  }

  it('1. Job sukses dieksekusi ulang: usedBytes bertambah satu kali, reservedBytes dilepas satu kali', async () => {
    const declaredBytes = 51200; // 50 KB
    const actualBytes = 51200;
    const { material, job } = await createMaterialWithReservation('Doc Re-execute Test', declaredBytes);

    // Initial state check
    const initialUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(initialUsage?.reservedBytes)).toBe(declaredBytes);
    expect(Number(initialUsage?.usedBytes)).toBe(0);

    // Eksekusi pertama
    const start1 = await startDocumentJobAtomically({
      jobId: job.id,
      materialId: material.id,
      userId: testUserId,
      attempts: 1,
    });
    expect(start1.canProcess).toBe(true);

    const finish1 = await finishDocumentJobAtomically({
      jobId: job.id,
      materialId: material.id,
      userId: testUserId,
      declaredBytes,
      actualBytes,
      pageCount: 2,
      pages: [
        { pageNumber: 1, extractedText: 'Page 1 text', characterCount: 11 },
        { pageNumber: 2, extractedText: 'Page 2 text', characterCount: 11 },
      ],
    });
    expect(finish1.wasCommitted).toBe(true);
    expect(finish1.status).toBe('READY');

    // Storage usage after first execution
    const usageAfterFirst = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(usageAfterFirst?.reservedBytes)).toBe(0);
    expect(Number(usageAfterFirst?.usedBytes)).toBe(actualBytes);

    // Eksekusi ulang job yang sama (simulasi BullMQ duplicate delivery)
    const start2 = await startDocumentJobAtomically({
      jobId: job.id,
      materialId: material.id,
      userId: testUserId,
      attempts: 1,
    });
    expect(start2.canProcess).toBe(false);
    expect(start2.status).toBe('COMPLETED');

    const finish2 = await finishDocumentJobAtomically({
      jobId: job.id,
      materialId: material.id,
      userId: testUserId,
      declaredBytes,
      actualBytes,
      pageCount: 2,
      pages: [
        { pageNumber: 1, extractedText: 'Page 1 duplicate', characterCount: 16 },
      ],
    });
    expect(finish2.wasCommitted).toBe(false);
    expect(finish2.status).toBe('ALREADY_TERMINAL');

    // Quota HARUS tetap persis sama: usedBytes tidak boleh menjadi 102400
    const usageAfterDuplicate = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(usageAfterDuplicate?.reservedBytes)).toBe(0);
    expect(Number(usageAfterDuplicate?.usedBytes)).toBe(actualBytes);

    // Halaman di database tidak berubah/terduplikasi
    const pages = await prisma.materialPage.findMany({ where: { materialId: material.id } });
    expect(pages.length).toBe(2);
  });

  it('2. Dua eksekusi job yang sama berjalan bersamaan: hasil dan kuota tetap konsisten', async () => {
    const bytes = 40960; // 40 KB
    const { material, job } = await createMaterialWithReservation('Doc Race Test', bytes);

    await startDocumentJobAtomically({
      jobId: job.id,
      materialId: material.id,
      userId: testUserId,
      attempts: 1,
    });

    // Jalankan finishDocumentJobAtomically bersamaan via Promise.all
    const [res1, res2] = await Promise.all([
      finishDocumentJobAtomically({
        jobId: job.id,
        materialId: material.id,
        userId: testUserId,
        declaredBytes: bytes,
        actualBytes: bytes,
        pageCount: 1,
        pages: [{ pageNumber: 1, extractedText: 'Race page', characterCount: 9 }],
      }),
      finishDocumentJobAtomically({
        jobId: job.id,
        materialId: material.id,
        userId: testUserId,
        declaredBytes: bytes,
        actualBytes: bytes,
        pageCount: 1,
        pages: [{ pageNumber: 1, extractedText: 'Race page', characterCount: 9 }],
      }),
    ]);

    // Tepat satu yang berhasil commit, satu lagi terdeteksi ALREADY_TERMINAL
    const committedCount = [res1, res2].filter((r) => r.wasCommitted).length;
    const terminalCount = [res1, res2].filter((r) => r.status === 'ALREADY_TERMINAL').length;
    expect(committedCount).toBe(1);
    expect(terminalCount).toBe(1);

    // usedBytes bertambah tepat satu kali
    const finalUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(finalUsage?.reservedBytes)).toBe(0);
    expect(Number(finalUsage?.usedBytes)).toBe(bytes);
  });

  it('3. Simulasikan database sudah commit tetapi job dikirim ulang: tidak ada efek tambahan', async () => {
    const bytes = 61440; // 60 KB
    const { material, job } = await createMaterialWithReservation('Already Committed Test', bytes, 'READY');

    await prisma.materialPage.createMany({
      data: [
        { materialId: material.id, pageNumber: 1, extractedText: 'Ready 1', characterCount: 7 },
        { materialId: material.id, pageNumber: 2, extractedText: 'Ready 2', characterCount: 7 },
      ],
    });

    // Panggil finishDocumentJobAtomically pada job yang statusnya sudah COMPLETED
    const lateFinish = await finishDocumentJobAtomically({
      jobId: job.id,
      materialId: material.id,
      userId: testUserId,
      declaredBytes: bytes,
      actualBytes: bytes,
      pageCount: 2,
      pages: [{ pageNumber: 1, extractedText: 'Corrupted text', characterCount: 14 }],
    });

    expect(lateFinish.wasCommitted).toBe(false);
    expect(lateFinish.status).toBe('ALREADY_TERMINAL');

    const usage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(usage?.usedBytes)).toBe(bytes);
    expect(Number(usage?.reservedBytes)).toBe(0);

    const pages = await prisma.materialPage.findMany({ where: { materialId: material.id } });
    expect(pages.length).toBe(2);
    expect(pages[0]?.extractedText).toBe('Ready 1');
  });

  it('4. Penghapusan bersamaan dengan penyelesaian ekstraksi: materi tetap terhapus, tidak ada halaman tersisa, dan kuota benar', async () => {
    const bytes = 71680; // 70 KB
    const { material, job } = await createMaterialWithReservation('Concurrent Delete Test', bytes);

    await startDocumentJobAtomically({
      jobId: job.id,
      materialId: material.id,
      userId: testUserId,
      attempts: 1,
    });

    // Jalankan deleteMaterial dan finishDocumentJobAtomically bersamaan via Promise.allSettled
    const [deleteRes, finishRes] = await Promise.allSettled([
      deleteMaterial(testUserId, material.id),
      finishDocumentJobAtomically({
        jobId: job.id,
        materialId: material.id,
        userId: testUserId,
        declaredBytes: bytes,
        actualBytes: bytes,
        pageCount: 1,
        pages: [{ pageNumber: 1, extractedText: 'Late text', characterCount: 9 }],
      }),
    ]);

    expect(deleteRes.status).toBe('fulfilled');
    expect(finishRes.status).toBe('fulfilled');

    // Materi HARUS tetap berstatus terhapus (deletedAt != null)
    const deletedMat = await prisma.material.findUnique({ where: { id: material.id } });
    expect(deletedMat?.deletedAt).not.toBeNull();

    // Tidak boleh ada halaman tersisa untuk materi yang sudah dihapus
    const remainingPages = await prisma.materialPage.findMany({ where: { materialId: material.id } });
    expect(remainingPages.length).toBe(0);

    // Kuota penyimpanan HARUS bersih: 0 usedBytes dan 0 reservedBytes (tidak ada kebocoran)
    const finalUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(finalUsage?.usedBytes)).toBe(0);
    expect(Number(finalUsage?.reservedBytes)).toBe(0);
  });

  it('5. Materi lain milik pengguna yang sama memiliki reservasi: reservasi tersebut tidak ikut berkurang', async () => {
    const bytes1 = 51200; // 50 KB
    const bytes2 = 71680; // 70 KB

    // Material 1 (50 KB)
    const { material: mat1, job: job1 } = await createMaterialWithReservation('Mat 1 Intact Quota', bytes1);
    // Material 2 (70 KB)
    const { material: mat2 } = await createMaterialWithReservation('Mat 2 Intact Quota', bytes2);

    const initialUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(initialUsage?.reservedBytes)).toBe(bytes1 + bytes2);
    expect(Number(initialUsage?.usedBytes)).toBe(0);

    // Selesaikan ekstraksi Material 1
    await startDocumentJobAtomically({
      jobId: job1.id,
      materialId: mat1.id,
      userId: testUserId,
      attempts: 1,
    });

    await finishDocumentJobAtomically({
      jobId: job1.id,
      materialId: mat1.id,
      userId: testUserId,
      declaredBytes: bytes1,
      actualBytes: bytes1,
      pageCount: 1,
      pages: [{ pageNumber: 1, extractedText: 'Mat 1 text', characterCount: 10 }],
    });

    // Material 1 commit: reservedBytes harus berkurang TEPAT 50 KB, menyisakan TEPAT 70 KB untuk Material 2!
    const midUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(midUsage?.reservedBytes)).toBe(bytes2);
    expect(Number(midUsage?.usedBytes)).toBe(bytes1);

    // Simulasi duplicate execution Material 1
    await finishDocumentJobAtomically({
      jobId: job1.id,
      materialId: mat1.id,
      userId: testUserId,
      declaredBytes: bytes1,
      actualBytes: bytes1,
      pageCount: 1,
      pages: [{ pageNumber: 1, extractedText: 'Duplicate Mat 1', characterCount: 15 }],
    });

    // Reservasi Material 2 TIDAK BOLEH dicuri oleh eksekusi duplikat Material 1!
    const usageAfterDup = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(usageAfterDup?.reservedBytes)).toBe(bytes2);
    expect(Number(usageAfterDup?.usedBytes)).toBe(bytes1);

    // Hapus Material 2 saat masih QUEUED -> reservedBytes turun menjadi 0, usedBytes tetap 50 KB
    await deleteMaterial(testUserId, mat2.id);
    const finalUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(finalUsage?.reservedBytes)).toBe(0);
    expect(Number(finalUsage?.usedBytes)).toBe(bytes1);
  });

  it('6. Kegagalan dan retry yang sah: hasil akhirnya benar tanpa penghitungan ganda', async () => {
    const bytes = 40960; // 40 KB
    const { material, job: job1 } = await createMaterialWithReservation('Retry Quota Test', bytes);

    await startDocumentJobAtomically({
      jobId: job1.id,
      materialId: material.id,
      userId: testUserId,
      attempts: 1,
    });

    // Kegagalan permanen pada Job 1
    const failRes = await failDocumentJobAtomically({
      jobId: job1.id,
      materialId: material.id,
      userId: testUserId,
      declaredBytes: bytes,
      errorCode: 'FILE_CORRUPTED_TEMPORARY',
      errorMessage: 'Simulated parser failure',
    });
    expect(failRes.wasCommitted).toBe(true);

    // Reservasi harus dilepas saat gagal
    const failUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(failUsage?.reservedBytes)).toBe(0);
    expect(Number(failUsage?.usedBytes)).toBe(0);

    // Pengguna memicu retry yang sah via retryMaterialProcessing
    const retryRes = await retryMaterialProcessing(testUserId, material.id);
    expect(retryRes.jobId).toBeDefined();

    // Kuota penyimpanan di-re-reserve dengan benar
    const retryUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(retryUsage?.reservedBytes)).toBe(bytes);
    expect(Number(retryUsage?.usedBytes)).toBe(0);

    // Job baru (Job 2) dijalankan oleh worker dan berhasil
    await startDocumentJobAtomically({
      jobId: retryRes.jobId,
      materialId: material.id,
      userId: testUserId,
      attempts: 1,
    });

    const finishRetry = await finishDocumentJobAtomically({
      jobId: retryRes.jobId,
      materialId: material.id,
      userId: testUserId,
      declaredBytes: bytes,
      actualBytes: bytes,
      pageCount: 2,
      pages: [
        { pageNumber: 1, extractedText: 'Retried page 1', characterCount: 14 },
        { pageNumber: 2, extractedText: 'Retried page 2', characterCount: 14 },
      ],
    });
    expect(finishRetry.wasCommitted).toBe(true);

    // Hasil akhir kuota: reservedBytes = 0, usedBytes = 40 KB tepat
    const finalUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(finalUsage?.reservedBytes)).toBe(0);
    expect(Number(finalUsage?.usedBytes)).toBe(bytes);

    const matAfterRetry = await prisma.material.findUnique({ where: { id: material.id } });
    expect(matAfterRetry?.status).toBe('READY');
  });

  it('7. Penghapusan berulang: kuota tidak dilepas dua kali', async () => {
    const bytes1 = 51200; // 50 KB
    const { material: mat1 } = await createMaterialWithReservation('Double Delete Quota 1', bytes1);

    // Hapus material pertama kali
    await deleteMaterial(testUserId, mat1.id);

    const usageAfterDelete1 = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(usageAfterDelete1?.reservedBytes)).toBe(0);
    expect(Number(usageAfterDelete1?.usedBytes)).toBe(0);

    // Pengguna mengunggah material kedua (30 KB)
    const bytes2 = 30720;
    await createMaterialWithReservation('Active Mat 2', bytes2);

    const usageWithMat2 = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(usageWithMat2?.reservedBytes)).toBe(bytes2);

    // Upaya delete kedua pada material 1 yang sudah terhapus
    await expect(deleteMaterial(testUserId, mat1.id)).rejects.toThrow();

    // Kuota Material 2 TIDAK BOLEH berkurang karena penghapusan ulang Material 1
    const finalUsage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(finalUsage?.reservedBytes)).toBe(bytes2);
    expect(Number(finalUsage?.usedBytes)).toBe(0);
  });

  it('8. Konkurensi paralel checkAndReserveUploadQuota: row-level locking mencegah over-reservation kuota', async () => {
    // 5 panggilan paralel masing-masing 60 MB untuk testUserId (batas 200 MB)
    // Tepat 3 panggilan harus berhasil (3 * 60 = 180 MB <= 200 MB), dan 2 panggilan harus ditolak (180 + 60 = 240 MB > 200 MB)
    const sixtyMb = 60 * 1024 * 1024;
    const calls = Array.from({ length: 5 }, () => checkAndReserveUploadQuota(testUserId, sixtyMb));

    const settled = await Promise.allSettled(calls);
    const successes = settled.filter((s) => s.status === 'fulfilled');
    const failures = settled.filter((s) => s.status === 'rejected');

    expect(successes).toHaveLength(3);
    expect(failures).toHaveLength(2);

    for (const f of failures) {
      if (f.status === 'rejected') {
        expect(f.reason?.code).toBe('STORAGE_LIMIT_EXCEEDED');
      }
    }

    // Invarian basis data: reservedBytes harus tepat 180 MB (3 * 60 MB), tidak melampaui 200 MB
    const usage = await prisma.storageUsage.findUnique({ where: { userId: testUserId } });
    expect(Number(usage?.reservedBytes)).toBe(3 * sixtyMb);
    expect(Number(usage?.usedBytes)).toBe(0);
  });
});
