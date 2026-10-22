import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LocalWorkerStorageAdapter } from '../services/storageAdapter.js';
import { FILE_UPLOAD_LIMITS } from '@studyflow/shared';

describe('LocalWorkerStorageAdapter Security Hardening & Path Traversal (Worker)', () => {
  let tempDir: string;
  let adapter: LocalWorkerStorageAdapter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studyflow-worker-storage-test-'));
    adapter = new LocalWorkerStorageAdapter(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('resolvePath traversal defenses', () => {
    it('rejects path traversal with parent directories', async () => {
      const keys = ['../secret.txt', '../../etc/passwd', 'folder/../../../root.txt'];
      for (const k of keys) {
        const res = await adapter.download(k);
        expect(res.error).toBeDefined();
        expect(res.error?.message).toContain('path traversal detected');
      }
    });

    it('rejects backslash directory traversal', async () => {
      const keys = ['..\\secret.txt', 'dir\\..\\..\\windows'];
      for (const k of keys) {
        const res = await adapter.download(k);
        expect(res.error).toBeDefined();
        expect(res.error?.message).toContain('path traversal detected');
      }
    });

    it('rejects NUL byte injection in storage keys', async () => {
      const keys = ['doc.pdf\0.evil', '\0/private.pdf'];
      for (const k of keys) {
        const res = await adapter.download(k);
        expect(res.error).toBeDefined();
        expect(res.error?.message).toContain('path traversal detected');
      }
    });
  });

  describe('download() file size verification & race condition mitigation', () => {
    it('downloads normal file successfully within 20 MiB limit', async () => {
      const storageKey = 'user_1/file.pdf';
      const fullPath = path.join(tempDir, 'user_1', 'file.pdf');
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, Buffer.from('%PDF-1.4 test document content'));

      const res = await adapter.download(storageKey);
      expect(res.error).toBeNull();
      expect(res.data).toBeDefined();
      expect(res.data?.toString()).toContain('test document content');
    });

    it('rejects file exceeding 20 MiB via pre-read stat check', async () => {
      const storageKey = 'user_1/huge.pdf';
      const fullPath = path.join(tempDir, 'user_1', 'huge.pdf');
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      // Create sparse 21 MiB file
      const fd = fs.openSync(fullPath, 'w');
      fs.ftruncateSync(fd, 21 * 1024 * 1024);
      fs.closeSync(fd);

      const res = await adapter.download(storageKey);
      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('melebihi batas maksimal 20 MiB');
    });

    it('mitigates race condition if file grows during read', async () => {
      const storageKey = 'user_1/race.pdf';
      const fullPath = path.join(tempDir, 'user_1', 'race.pdf');
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, Buffer.from('%PDF-1.4 initial'));

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
});
