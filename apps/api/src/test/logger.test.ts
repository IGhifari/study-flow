import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { createApp } from '../app.js';
import {
  sanitizeRequestPath,
  sanitizeHeaderValue,
  requestLogger,
} from '../middleware/logger.js';
import {
  redactSensitiveErrorText,
  errorHandler,
  type AppError,
} from '../middleware/errorHandler.js';
import {
  setStorageAdapterForTesting,
  generateLocalStorageToken,
  type StorageAdapter,
} from '../services/storage.service.js';

describe('Request Logging Hardening & Secret Protection Tests', () => {
  describe('1. sanitizeRequestPath Unit Tests', () => {
    it('strips query parameters from standard API URLs', () => {
      expect(sanitizeRequestPath('/api/courses?sort=desc&limit=10')).toBe('/api/courses');
    });

    it('strips local storage tokens and signed query parameters', () => {
      const sensitiveUrl = '/api/storage/local/download/document.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123xyz';
      expect(sanitizeRequestPath(sensitiveUrl)).toBe('/api/storage/local/download/document.pdf');
    });

    it('strips multiple query parameters with sensitive keys', () => {
      const url = '/api/resource?key=secretKey&secret=mySecret&token=superToken&password=pass123';
      expect(sanitizeRequestPath(url)).toBe('/api/resource');
    });

    it('strips hash fragments and query strings together', () => {
      expect(sanitizeRequestPath('/api/notes?token=secretToken#section-2')).toBe('/api/notes');
      expect(sanitizeRequestPath('/api/notes#section-2')).toBe('/api/notes');
    });

    it('strips CRLF control characters to prevent log injection', () => {
      const maliciousUrl = '/api/test\r\nInjected-Header: evil\r\n\r\n?token=secret';
      const clean = sanitizeRequestPath(maliciousUrl);
      expect(clean).not.toContain('\r');
      expect(clean).not.toContain('\n');
      expect(clean).not.toContain('token=secret');
    });

    it('handles absolute URLs cleanly and extracts only the pathname', () => {
      const absUrl = 'http://localhost:4000/api/storage/local/upload/file.pdf?token=signedUploadToken';
      expect(sanitizeRequestPath(absUrl)).toBe('/api/storage/local/upload/file.pdf');
    });

    it('handles protocol-relative URLs without leaking host or query', () => {
      const protoRel = '//malicious.com/api/test?token=signedToken';
      const clean = sanitizeRequestPath(protoRel);
      expect(clean).not.toContain('token=');
      expect(clean.startsWith('/')).toBe(true);
    });

    it('handles empty, root, whitespace, and undefined gracefully', () => {
      expect(sanitizeRequestPath('')).toBe('/');
      expect(sanitizeRequestPath('   ')).toBe('/');
      expect(sanitizeRequestPath(undefined)).toBe('/');
      expect(sanitizeRequestPath('/')).toBe('/');
    });

    it('normalizes paths without leading slashes', () => {
      expect(sanitizeRequestPath('api/v1/resource?token=123')).toBe('/api/v1/resource');
    });
  });

  describe('2. sanitizeHeaderValue Unit Tests', () => {
    it('strips CRLF injection characters from headers', () => {
      const maliciousAgent = 'Mozilla/5.0\r\nEvil-Header: injected\r\n';
      const clean = sanitizeHeaderValue(maliciousAgent);
      expect(clean).not.toContain('\r');
      expect(clean).not.toContain('\n');
    });

    it('truncates excessively long headers to max length', () => {
      const longAgent = 'A'.repeat(1000);
      expect(sanitizeHeaderValue(longAgent, 200).length).toBe(200);
    });

    it('handles empty and undefined headers gracefully', () => {
      expect(sanitizeHeaderValue(undefined)).toBe('unknown');
      expect(sanitizeHeaderValue('')).toBe('unknown');
      expect(sanitizeHeaderValue('   ')).toBe('unknown');
    });
  });

  describe('3. requestLogger Integration & Output Security', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      vi.restoreAllMocks();
    });

    it('logs structured JSON containing method, clean URL, statusCode, and duration, without query tokens', async () => {
      process.env.NODE_ENV = 'development';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const app = express();
      app.use((req, _res, next) => {
        req.id = 'req-test-uuid-1234';
        next();
      });
      app.use(requestLogger);
      app.get('/api/storage/local/download/:file', (_req, res) => {
        res.status(200).json({ ok: true });
      });

      const sensitiveToken = 'super_secret_local_storage_token_999';
      await request(app).get(`/api/storage/local/download/file.pdf?token=${sensitiveToken}&apiKey=leakedKey`);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const loggedJson = logSpy.mock.calls[0]?.[0] as string;
      expect(loggedJson).toBeDefined();

      const parsed = JSON.parse(loggedJson);
      expect(parsed.level).toBe('info');
      expect(parsed.method).toBe('GET');
      expect(parsed.url).toBe('/api/storage/local/download/file.pdf');
      expect(parsed.statusCode).toBe(200);
      expect(typeof parsed.durationMs).toBe('number');
      expect(parsed.durationMs).toBeGreaterThanOrEqual(0);
      expect(parsed.requestId).toBe('req-test-uuid-1234');
      expect(typeof parsed.timestamp).toBe('string');

      // CRITICAL ASSERTION: No secrets or query tokens in the logged output
      expect(loggedJson).not.toContain(sensitiveToken);
      expect(loggedJson).not.toContain('apiKey');
      expect(loggedJson).not.toContain('token=');
      expect(loggedJson).not.toContain('leakedKey');
    });

    it('categorizes 4xx status as warn and 5xx status as error in access logs', async () => {
      process.env.NODE_ENV = 'development';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const app = express();
      app.use(requestLogger);
      app.get('/warn', (_req, res) => res.status(403).send('Forbidden'));
      app.get('/error', (_req, res) => res.status(500).send('Internal Error'));

      await request(app).get('/warn?token=forbiddenToken');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const warnLog = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
      expect(warnLog.level).toBe('warn');
      expect(warnLog.statusCode).toBe(403);
      expect(warnLog.url).toBe('/warn');

      logSpy.mockClear();

      await request(app).get('/error?secret=dbSecret');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const errorLog = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
      expect(errorLog.level).toBe('error');
      expect(errorLog.statusCode).toBe(500);
      expect(errorLog.url).toBe('/error');
    });
  });

  describe('4. redactSensitiveErrorText & errorHandler Defense-in-Depth', () => {
    it('redacts JWT tokens from error messages', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const errorMsg = `Invalid credentials for token: ${jwt}`;
      const redacted = redactSensitiveErrorText(errorMsg);
      expect(redacted).not.toContain(jwt);
      expect(redacted).toContain('[REDACTED_JWT]');
    });

    it('redacts query parameter tokens and secrets from error text', () => {
      const errorMsg = 'Failed upstream request: https://storage.local/download?token=superSecret123&code=authCode999';
      const redacted = redactSensitiveErrorText(errorMsg);
      expect(redacted).not.toContain('superSecret123');
      expect(redacted).not.toContain('authCode999');
      expect(redacted).toContain('token=[REDACTED]');
      expect(redacted).toContain('code=[REDACTED]');
    });

    it('redacts Bearer and Basic authorization credentials', () => {
      const errorMsg = 'Failed authorization header: Bearer ya29.a0ARrdaM-sensitiveOAuthToken';
      const redacted = redactSensitiveErrorText(errorMsg);
      expect(redacted).not.toContain('ya29.a0ARrdaM-sensitiveOAuthToken');
      expect(redacted).toContain('Bearer [REDACTED]');
    });

    it('redacts database passwords in connection URLs', () => {
      const errorMsg = 'DB connection error: postgresql://admin:MySecretPassword123@localhost:5432/studyflow';
      const redacted = redactSensitiveErrorText(errorMsg);
      expect(redacted).not.toContain('MySecretPassword123');
      expect(redacted).toBe('DB connection error: postgresql://admin:[REDACTED]@localhost:5432/studyflow');
    });

    it('errorHandler suppresses and redacts secrets in console.error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = { id: 'req-err-456' } as Request;
      const res = {
        statusCode: 400,
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      const secretToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature123';
      const appErr: AppError = new Error(`Verification failed for token=${secretToken}`);
      appErr.statusCode = 400;

      errorHandler(appErr, req, res, next);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedErr = errorSpy.mock.calls[0]?.[0] as string;
      expect(loggedErr).not.toContain(secretToken);
      expect(loggedErr).toContain('[REDACTED_JWT]');

      // Client response is also sanitized
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.not.stringContaining(secretToken),
          }),
        })
      );
    });
  });

  describe('5. 404 Route Path Sanitization (Defense-in-Depth)', () => {
    const app = createApp();

    it('does not reflect query parameters or secrets in 404 response body', async () => {
      const sensitiveLeak = 'super_secret_query_leak_123';
      const res = await request(app).get(`/api/nonexistent-route-path?token=${sensitiveLeak}&key=confidential`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Route GET /api/nonexistent-route-path tidak ditemukan');

      // CRITICAL ASSERTION: The response body does not reflect query secrets
      expect(JSON.stringify(res.body)).not.toContain(sensitiveLeak);
      expect(JSON.stringify(res.body)).not.toContain('confidential');
      expect(JSON.stringify(res.body)).not.toContain('token=');
    });
  });

  describe('6. Local Storage Endpoint Contracts & Security Verification', () => {
    const app = createApp();
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      setStorageAdapterForTesting(null);
      vi.restoreAllMocks();
    });

    it('rejects PUT /api/storage/local/upload/:key without valid token with 403 INVALID_STORAGE_TOKEN', async () => {
      const res = await request(app)
        .put('/api/storage/local/upload/test%2Ffile.pdf?token=invalid_token_123')
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('PDF sample'));

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('INVALID_STORAGE_TOKEN');
    });

    it('rejects GET /api/storage/local/download/:key without valid token with 403 INVALID_STORAGE_TOKEN', async () => {
      const res = await request(app)
        .get('/api/storage/local/download/test%2Ffile.pdf?token=invalid_token_123');

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('INVALID_STORAGE_TOKEN');
    });

    it('allows PUT upload with valid signed token while logger never leaks token', async () => {
      process.env.NODE_ENV = 'development';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      let uploadedPayload: Buffer | null = null;
      const mockAdapter: StorageAdapter = {
        async createSignedUploadUrl() { return { data: null, error: null }; },
        async createSignedUrl() { return { data: null, error: null }; },
        async download() { return { data: null, error: null }; },
        async remove() { return { data: null, error: null }; },
        async info() { return { data: { size: 10 }, error: null }; },
        async upload(_key, data) {
          uploadedPayload = data as Buffer;
          return { data: { path: _key }, error: null };
        },
      };
      setStorageAdapterForTesting(mockAdapter);

      const storageKey = 'user_1/materials/lecture1.pdf';
      const validToken = generateLocalStorageToken(storageKey);

      const payload = Buffer.from('%PDF-1.4 test binary file content');
      const res = await request(app)
        .put(`/api/storage/local/upload/${encodeURIComponent(storageKey)}?token=${validToken}`)
        .set('Content-Type', 'application/pdf')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.key).toBe(storageKey);
      expect(uploadedPayload).toEqual(payload);

      // Verify logger called
      expect(logSpy).toHaveBeenCalled();
      const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1]?.[0] as string;
      const parsedLog = JSON.parse(lastCall);
      expect(parsedLog.method).toBe('PUT');
      expect(parsedLog.statusCode).toBe(200);
      expect(parsedLog.url).toBe(`/api/storage/local/upload/${encodeURIComponent(storageKey)}`);

      // NO token or query parameters in the log
      expect(lastCall).not.toContain(validToken);
      expect(lastCall).not.toContain('token=');
    });

    it('allows GET download with valid signed token while logger never leaks token', async () => {
      process.env.NODE_ENV = 'development';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const fileBuffer = Buffer.from('%PDF-1.4 streaming test document');
      const mockAdapter: StorageAdapter = {
        async createSignedUploadUrl() { return { data: null, error: null }; },
        async createSignedUrl() { return { data: null, error: null }; },
        async download() {
          return { data: fileBuffer, error: null };
        },
        async remove() { return { data: null, error: null }; },
        async info() { return { data: { size: fileBuffer.length }, error: null }; },
        async upload() { return { data: null, error: null }; },
      };
      setStorageAdapterForTesting(mockAdapter);

      const storageKey = 'user_1/materials/lecture1.pdf';
      const validToken = generateLocalStorageToken(storageKey);

      const res = await request(app)
        .get(`/api/storage/local/download/${encodeURIComponent(storageKey)}?token=${validToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.body).toEqual(fileBuffer);

      // Verify logger called
      expect(logSpy).toHaveBeenCalled();
      const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1]?.[0] as string;
      const parsedLog = JSON.parse(lastCall);
      expect(parsedLog.method).toBe('GET');
      expect(parsedLog.statusCode).toBe(200);
      expect(parsedLog.url).toBe(`/api/storage/local/download/${encodeURIComponent(storageKey)}`);

      // NO token or query parameters in the log
      expect(lastCall).not.toContain(validToken);
      expect(lastCall).not.toContain('token=');
    });
  });
});
