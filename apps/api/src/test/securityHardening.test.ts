import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { assertProductionSecrets } from '../config/env.js';
import { LocalStorageAdapter } from '../services/storage.service.js';
import { LocalWorkerStorageAdapter } from '../../../worker/src/services/storageAdapter.js';
import { requestIdMiddleware } from '../middleware/requestId.js';

describe('Security Hardening Defense-in-Depth Tests', () => {
  describe('1. Production Secrets Enforcement (assertProductionSecrets)', () => {
    const validTurnstileKey = 'valid_custom_prod_turnstile_secret_key_9999';

    it('throws error when NODE_ENV is production and default development JWT_ACCESS_SECRET is used', () => {
      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'studyflow_dev_jwt_access_secret_key_123456',
          JWT_REFRESH_SECRET: 'custom_strong_prod_refresh_secret_1234567890',
          COOKIE_SECRET: 'custom_strong_prod_cookie_secret_1234567890',
          TURNSTILE_SECRET_KEY: validTurnstileKey,
        });
      }).toThrow(/Insecure default development secrets detected in production for: JWT_ACCESS_SECRET/);
    });

    it('throws error when NODE_ENV is production and secret starts with studyflow_dev_', () => {
      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'custom_strong_prod_access_secret_1234567890',
          JWT_REFRESH_SECRET: 'studyflow_dev_custom_suffix_123456',
          COOKIE_SECRET: 'custom_strong_prod_cookie_secret_1234567890',
          TURNSTILE_SECRET_KEY: validTurnstileKey,
        });
      }).toThrow(/Insecure default development secrets detected in production for: JWT_REFRESH_SECRET/);

      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'custom_strong_prod_access_secret_1234567890',
          JWT_REFRESH_SECRET: 'custom_strong_prod_refresh_secret_1234567890',
          COOKIE_SECRET: 'studyflow_dev_cookie_signing_secret_123456',
          TURNSTILE_SECRET_KEY: validTurnstileKey,
        });
      }).toThrow(/Insecure default development secrets detected in production for: COOKIE_SECRET/);
    });

    it('throws error when NODE_ENV is production and TURNSTILE_SECRET_KEY is missing or empty', () => {
      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'custom_strong_prod_access_secret_1234567890',
          JWT_REFRESH_SECRET: 'custom_strong_prod_refresh_secret_1234567890',
          COOKIE_SECRET: 'custom_strong_prod_cookie_secret_1234567890',
          // TURNSTILE_SECRET_KEY omitted
        });
      }).toThrow(/Missing required production environment variables: TURNSTILE_SECRET_KEY/);

      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'custom_strong_prod_access_secret_1234567890',
          JWT_REFRESH_SECRET: 'custom_strong_prod_refresh_secret_1234567890',
          COOKIE_SECRET: 'custom_strong_prod_cookie_secret_1234567890',
          TURNSTILE_SECRET_KEY: '   ',
        });
      }).toThrow(/Missing required production environment variables: TURNSTILE_SECRET_KEY/);
    });

    it('throws error when NODE_ENV is production and dummy Cloudflare test key or dev prefix is used for TURNSTILE_SECRET_KEY', () => {
      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'custom_strong_prod_access_secret_1234567890',
          JWT_REFRESH_SECRET: 'custom_strong_prod_refresh_secret_1234567890',
          COOKIE_SECRET: 'custom_strong_prod_cookie_secret_1234567890',
          TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        });
      }).toThrow(/Insecure default development secrets detected in production for: TURNSTILE_SECRET_KEY/);

      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'custom_strong_prod_access_secret_1234567890',
          JWT_REFRESH_SECRET: 'custom_strong_prod_refresh_secret_1234567890',
          COOKIE_SECRET: 'custom_strong_prod_cookie_secret_1234567890',
          TURNSTILE_SECRET_KEY: 'studyflow_dev_turnstile_dummy',
        });
      }).toThrow(/Insecure default development secrets detected in production for: TURNSTILE_SECRET_KEY/);
    });

    it('allows default development secrets and missing/dummy TURNSTILE_SECRET_KEY when NODE_ENV is development or test', () => {
      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'development',
          JWT_ACCESS_SECRET: 'studyflow_dev_jwt_access_secret_key_123456',
          JWT_REFRESH_SECRET: 'studyflow_dev_jwt_refresh_secret_key_123456',
          COOKIE_SECRET: 'studyflow_dev_cookie_signing_secret_123456',
        });
      }).not.toThrow();

      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'test',
          JWT_ACCESS_SECRET: 'studyflow_dev_jwt_access_secret_key_123456',
          JWT_REFRESH_SECRET: 'studyflow_dev_jwt_refresh_secret_key_123456',
          COOKIE_SECRET: 'studyflow_dev_cookie_signing_secret_123456',
          TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        });
      }).not.toThrow();
    });

    it('succeeds in production when all secrets are strong custom values', () => {
      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'super_secret_custom_production_jwt_access_key_9999',
          JWT_REFRESH_SECRET: 'super_secret_custom_production_jwt_refresh_key_9999',
          COOKIE_SECRET: 'super_secret_custom_production_cookie_secret_9999',
          TURNSTILE_SECRET_KEY: 'super_secret_custom_production_turnstile_key_9999',
        });
      }).not.toThrow();
    });
  });

  describe('2. Path Traversal Prevention (LocalStorageAdapter & LocalWorkerStorageAdapter)', () => {
    const testDir = path.join(os.tmpdir(), `studyflow-storage-test-${Date.now()}`);

    beforeAll(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterAll(() => {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {}
    });

    it('LocalStorageAdapter (API) rejects path traversal keys on resolvePath, download, upload, info', async () => {
      const adapter = new LocalStorageAdapter(testDir);
      const maliciousKeys = [
        '../../package.json',
        '../secret.txt',
        '..\\..\\windows\\system32',
        '../../etc/passwd',
        '',
        'normal/path\0sneaky.pdf',
      ];

      for (const key of maliciousKeys) {
        // Direct resolvePath throw
        expect(() => (adapter as any).resolvePath(key)).toThrow(/Invalid storage key: path traversal detected/);

        // Safe return in download
        const dlRes = await adapter.download(key);
        expect(dlRes.data).toBeNull();
        expect(dlRes.error?.message).toContain('path traversal detected');

        // Safe return in upload
        const upRes = await adapter.upload(key, Buffer.from('test'));
        expect(upRes.data).toBeNull();
        expect(upRes.error?.message).toContain('path traversal detected');

        // Safe return in info
        const infoRes = await adapter.info(key);
        expect(infoRes.data).toBeNull();
        expect(infoRes.error?.message).toContain('path traversal detected');
      }
    });

    it('LocalStorageAdapter allows legitimate nested keys inside baseDir', async () => {
      const adapter = new LocalStorageAdapter(testDir);
      const validKey = 'user_123/materials/doc_456.pdf';

      const uploadRes = await adapter.upload(validKey, Buffer.from('hello pdf content'));
      expect(uploadRes.error).toBeNull();
      expect(uploadRes.data?.key).toBe(validKey);

      const dlRes = await adapter.download(validKey);
      expect(dlRes.error).toBeNull();
      expect(dlRes.data?.toString()).toBe('hello pdf content');

      const infoRes = await adapter.info(validKey);
      expect(infoRes.error).toBeNull();
      expect(infoRes.data?.size).toBe(Buffer.byteLength('hello pdf content'));
    });

    it('LocalWorkerStorageAdapter (Worker) rejects path traversal keys on resolvePath, download, info', async () => {
      const workerAdapter = new LocalWorkerStorageAdapter(testDir);
      const maliciousKeys = [
        '../../package.json',
        '../secret.txt',
        '..\\..\\windows\\system32',
        '../../etc/passwd',
        'material/..\0/injected',
        '',
      ];

      for (const key of maliciousKeys) {
        expect(() => (workerAdapter as any).resolvePath(key)).toThrow(/Invalid storage key: path traversal detected/);

        const dlRes = await workerAdapter.download(key);
        expect(dlRes.data).toBeNull();
        expect(dlRes.error?.message).toContain('path traversal detected');

        const infoRes = await workerAdapter.info(key);
        expect(infoRes.data).toBeNull();
        expect(infoRes.error?.message).toContain('path traversal detected');
      }
    });
  });

  describe('3. X-Request-Id Validation & Sanitization (requestIdMiddleware)', () => {
    it('preserves valid X-Request-Id matching /^[a-zA-Z0-9._-]{1,128}$/', () => {
      const validIds = [
        'req-abc_123.456',
        'req-0123456789',
        'cuid_clx1234567890abcdef',
        'request.id-test_99',
      ];

      for (const id of validIds) {
        const req: any = { headers: { 'x-request-id': id } };
        const headersSet: Record<string, string> = {};
        const res: any = {
          setHeader: (name: string, value: string) => {
            headersSet[name] = value;
          },
        };
        let nextCalled = false;

        requestIdMiddleware(req, res, () => {
          nextCalled = true;
        });

        expect(nextCalled).toBe(true);
        expect(req.id).toBe(id);
        expect(headersSet['X-Request-Id']).toBe(id);
      }
    });

    it('replaces dangerous or malformed X-Request-Id with a secure UUID', () => {
      const invalidIds = [
        'req\r\ninjection: bad',
        'req with spaces',
        '<script>alert(1)</script>',
        'a'.repeat(129), // > 128 characters
        '',
        '   ',
        'special$char!@#',
      ];

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      for (const id of invalidIds) {
        const req: any = { headers: { 'x-request-id': id } };
        const headersSet: Record<string, string> = {};
        const res: any = {
          setHeader: (name: string, value: string) => {
            headersSet[name] = value;
          },
        };

        requestIdMiddleware(req, res, () => {});

        expect(req.id).not.toBe(id);
        expect(req.id).toMatch(UUID_REGEX);
        expect(headersSet['X-Request-Id']).toBe(req.id);
      }
    });

    it('generates a new UUID when X-Request-Id header is omitted', () => {
      const req: any = { headers: {} };
      const headersSet: Record<string, string> = {};
      const res: any = {
        setHeader: (name: string, value: string) => {
          headersSet[name] = value;
        },
      };

      requestIdMiddleware(req, res, () => {});

      expect(req.id).toBeDefined();
      expect(typeof req.id).toBe('string');
      expect(headersSet['X-Request-Id']).toBe(req.id);
    });
  });
});
