import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { dispatchOutboxEvents } from '../services/outbox.service.js';
import {
  setStorageAdapterForTesting,
  generateLocalStorageToken,
  type StorageAdapter,
} from '../services/storage.service.js';

describe('Outbox Failure Transition & Local Storage Security Tests', () => {
  const app = createApp();
  let testUserId: string;

  beforeEach(async () => {
    const uniqueEmail = `outbox.test.${Date.now()}.${Math.floor(Math.random() * 100000)}@studyflow.test`;
    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: 'dummy_hash',
        name: 'Outbox Tester',
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    setStorageAdapterForTesting(null);
  });

  describe('OutboxEvent Max Attempts & Terminal FAILED Transition', () => {
    it('transitions OutboxEvent from PENDING to FAILED once attempts reach 5', async () => {
      const failingAdapter: StorageAdapter = {
        async createSignedUploadUrl() {
          return { data: null, error: new Error('Simulated storage error') };
        },
        async createSignedUrl() {
          return { data: null, error: new Error('Simulated storage error') };
        },
        async download() {
          return { data: null, error: new Error('Simulated storage error') };
        },
        async remove() {
          return { data: null, error: new Error('Disk unwriteable or path locked') };
        },
        async info() {
          return { data: null, error: new Error('Simulated storage error') };
        },
        async upload() {
          return { data: null, error: new Error('Simulated storage error') };
        },
      };
      setStorageAdapterForTesting(failingAdapter);

      const event = await prisma.outboxEvent.create({
        data: {
          aggregateId: `mat_${Date.now()}`,
          eventType: 'DOCUMENT_CLEANUP_REQUESTED',
          payload: { storageKey: 'test/nonexistent.pdf', userId: testUserId },
          attempts: 3,
          status: 'PENDING',
        },
      });

      // Dispatch 1st time: attempts 3 -> 4, status remains PENDING
      const res1 = await dispatchOutboxEvents();
      expect(res1.failed).toBeGreaterThanOrEqual(1);

      const after1 = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(after1?.attempts).toBe(4);
      expect(after1?.status).toBe('PENDING');
      expect(after1?.lastError).toContain('Disk unwriteable or path locked');

      // Dispatch 2nd time: attempts 4 -> 5, status transitions to FAILED
      const res2 = await dispatchOutboxEvents();
      expect(res2.failed).toBeGreaterThanOrEqual(1);

      const after2 = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(after2?.attempts).toBe(5);
      expect(after2?.status).toBe('FAILED');
      expect(after2?.lastError).toContain('Disk unwriteable or path locked');

      // Verify that findMany for pending outbox does not pick up this event anymore
      const checkEvents = await prisma.outboxEvent.findMany({
        where: { id: event.id, status: 'PENDING', attempts: { lt: 5 } },
      });
      expect(checkEvents).toHaveLength(0);
    });
  });

  describe('Local Storage Endpoint Error Sanitization & Header Protection', () => {
    it('PUT /api/storage/local/upload/:key returns sanitized error message on storage failure without leaking path', async () => {
      const failingAdapter: StorageAdapter = {
        async createSignedUploadUrl() {
          return { data: null, error: null };
        },
        async createSignedUrl() {
          return { data: null, error: null };
        },
        async download() {
          return { data: null, error: null };
        },
        async remove() {
          return { data: null, error: null };
        },
        async info() {
          return { data: null, error: null };
        },
        async upload() {
          return {
            data: null,
            error: new Error('EACCES: permission denied, open /var/studyflow/internal/private.pdf'),
          };
        },
      };
      setStorageAdapterForTesting(failingAdapter);

      const validKey = 'user_123/materials/doc.pdf';
      const token = generateLocalStorageToken(validKey);

      const res = await request(app)
        .put(`/api/storage/local/upload/${encodeURIComponent(validKey)}?token=${token}`)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4 test content'));

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('STORAGE_WRITE_ERROR');
      expect(res.body.error.message).toBe('Gagal menyimpan berkas ke penyimpanan lokal.');
      expect(JSON.stringify(res.body)).not.toContain('/var/studyflow/internal');
    });

    it('GET /api/storage/local/download/:key sanitizes filename in Content-Disposition against quotes and newlines', async () => {
      const mockAdapter: StorageAdapter = {
        async createSignedUploadUrl() {
          return { data: null, error: null };
        },
        async createSignedUrl() {
          return { data: null, error: null };
        },
        async download() {
          return {
            data: Buffer.from('%PDF-1.4 fake pdf data'),
            error: null,
          };
        },
        async remove() {
          return { data: null, error: null };
        },
        async info() {
          return { data: { size: 21 }, error: null };
        },
        async upload() {
          return { data: null, error: null };
        },
      };
      setStorageAdapterForTesting(mockAdapter);

      const dangerousKey = 'materials/test"evil\r\nheader:injected.pdf';
      const token = generateLocalStorageToken(dangerousKey);

      const res = await request(app)
        .get(`/api/storage/local/download/${encodeURIComponent(dangerousKey)}?token=${token}`);

      expect(res.status).toBe(200);
      const disposition = res.headers['content-disposition'];
      expect(disposition).toBeDefined();
      expect(disposition).toContain('inline; filename="');
      expect(disposition).not.toContain('test"evil');
      expect(disposition).not.toContain('\r');
      expect(disposition).not.toContain('\n');
      expect(disposition).toBe('inline; filename="test_evil__header:injected.pdf"');
    });
  });
});
