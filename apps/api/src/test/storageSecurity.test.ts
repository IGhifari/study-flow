import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../app.js';
import {
  LocalStorageAdapter,
  generateLocalStorageToken,
  setStorageAdapterForTesting,
} from '../services/storage.service.js';
import { FILE_UPLOAD_LIMITS } from '@studyflow/shared';

describe('Storage Security Hardening & Path Traversal Regression Tests (API)', () => {
  let tempDir: string;
  let adapter: LocalStorageAdapter;
  const app = createApp();

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studyflow-api-storage-test-'));
    adapter = new LocalStorageAdapter(tempDir);
  });

  afterEach(async () => {
    setStorageAdapterForTesting(null);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('LocalStorageAdapter resolvePath security & path traversal defenses', () => {
    it('rejects path traversal with parent directory (..)', async () => {
      const traversalKeys = [
        '../secret.txt',
        '../../etc/passwd',
        'subdir/../../etc/shadow',
        'a/b/../../../etc/hosts',
      ];

      for (const key of traversalKeys) {
        const res = await adapter.download(key);
        expect(res.error).toBeDefined();
        expect(res.error?.message).toContain('path traversal detected');
      }
    });

    it('rejects backslash path traversal (\\..\\)', async () => {
      const backslashKeys = [
        '..\\secret.txt',
        'subdir\\..\\..\\windows\\system32',
        'nested\\..\\..\\secret.env',
      ];

      for (const key of backslashKeys) {
        const res = await adapter.download(key);
        expect(res.error).toBeDefined();
        expect(res.error?.message).toContain('path traversal detected');
      }
    });

    it('rejects NUL byte injection in storageKey', async () => {
      const nulKeys = [
        'document.pdf\0.png',
        'materials/\0/secret.txt',
        '\0test.pdf',
      ];

      for (const key of nulKeys) {
        const res = await adapter.download(key);
        expect(res.error).toBeDefined();
        expect(res.error?.message).toContain('path traversal detected');
      }
    });

    it('rejects empty, slash-only, or whitespace keys', async () => {
      const emptyKeys = ['', '/', '///', '   ', null as any, undefined as any];

      for (const key of emptyKeys) {
        const res = await adapter.download(key);
        expect(res.error).toBeDefined();
        expect(res.error?.message).toContain('path traversal detected');
      }
    });
  });

  describe('LocalStorageAdapter download() file size verification & race condition mitigation', () => {
    it('successfully downloads valid files within 20 MiB limit', async () => {
      const storageKey = 'user123/valid.pdf';
      const fileData = Buffer.from('%PDF-1.4 sample document content for studyflow');
      await adapter.upload(storageKey, fileData);

      const res = await adapter.download(storageKey);
      expect(res.error).toBeNull();
      expect(res.data).toBeDefined();
      expect(res.data?.toString()).toBe(fileData.toString());
    });

    it('rejects file exceeding 20 MiB via pre-read stat check without buffering whole file', async () => {
      const storageKey = 'user123/huge.pdf';
      const filePath = path.join(tempDir, 'user123', 'huge.pdf');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      // Create a sparse file or mocked stat size of 21 MiB
      // Using writeSync with truncate to 21 MiB so it takes virtually zero disk space
      const fd = fs.openSync(filePath, 'w');
      fs.ftruncateSync(fd, 21 * 1024 * 1024); // 21 MiB
      fs.closeSync(fd);

      const statBefore = fs.statSync(filePath);
      expect(statBefore.size).toBeGreaterThan(FILE_UPLOAD_LIMITS.maxSizeBytes);

      const res = await adapter.download(storageKey);
      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('melebihi batas maksimal 20 MiB');
    });

    it('mitigates race condition if file grows to exceed 20 MiB after stat check', async () => {
      const storageKey = 'user123/race.pdf';
      const filePath = path.join(tempDir, 'user123', 'race.pdf');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      // Write valid small file initially
      fs.writeFileSync(filePath, Buffer.from('%PDF-1.4 test'));

      // Mock readFile to return an oversized buffer simulating file growth during read
      const originalReadFile = fs.promises.readFile;
      const oversizedBuffer = Buffer.alloc(FILE_UPLOAD_LIMITS.maxSizeBytes + 1024);
      (fs.promises as any).readFile = async () => oversizedBuffer;

      try {
        const res = await adapter.download(storageKey);
        expect(res.data).toBeNull();
        expect(res.error).toBeDefined();
        expect(res.error?.message).toContain('melebihi batas maksimal 20 MiB');
      } finally {
        fs.promises.readFile = originalReadFile;
      }
    });
  });

  describe('GET /api/storage/local/download/:key route error response for oversized files', () => {
    it('returns 413 FILE_TOO_LARGE when downloaded file exceeds 20 MiB limit', async () => {
      const mockAdapter: any = {
        async download() {
          return {
            data: null,
            error: new Error('Ukuran file melebihi batas maksimal 20 MiB (20971520 bytes)'),
          };
        },
      };
      setStorageAdapterForTesting(mockAdapter);

      const key = 'test/oversized.pdf';
      const token = generateLocalStorageToken(key);

      const res = await request(app)
        .get(`/api/storage/local/download/${encodeURIComponent(key)}?token=${token}`);

      expect(res.status).toBe(413);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });
});
