import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createBffProxyHandler,
  sanitizeLogUrl,
  sanitizeLogText,
} from '../lib/bff-proxy.js';

describe('BFF Error Logging Hardening & Secret Protection Tests', () => {
  describe('1. sanitizeLogUrl Unit Tests', () => {
    it('strips query parameters from backend target URLs', () => {
      const url = 'http://localhost:4000/api/courses?token=super_secret_token&sort=desc';
      expect(sanitizeLogUrl(url)).toBe('http://localhost:4000/api/courses');
    });

    it('strips hash fragments and query strings together', () => {
      const url = 'http://localhost:4000/api/materials/doc.pdf?token=secretToken#page=2';
      expect(sanitizeLogUrl(url)).toBe('http://localhost:4000/api/materials/doc.pdf');
    });

    it('strips CRLF control characters to prevent log injection', () => {
      const maliciousUrl = 'http://localhost:4000/api/test\r\nInjected-Header: evil\r\n?token=secret';
      const clean = sanitizeLogUrl(maliciousUrl);
      expect(clean).not.toContain('\r');
      expect(clean).not.toContain('\n');
      expect(clean).not.toContain('token=secret');
    });

    it('handles relative paths gracefully', () => {
      expect(sanitizeLogUrl('/api/courses?token=secret123')).toBe('/api/courses');
    });

    it('handles empty, root, whitespace, and undefined gracefully', () => {
      expect(sanitizeLogUrl('')).toBe('');
      expect(sanitizeLogUrl('   ')).toBe('');
      expect(sanitizeLogUrl(undefined)).toBe('');
    });
  });

  describe('2. sanitizeLogText Unit Tests', () => {
    it('redacts JWT tokens from error text', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const text = `Failed upstream auth: ${jwt}`;
      const redacted = sanitizeLogText(text);
      expect(redacted).not.toContain(jwt);
      expect(redacted).toContain('[REDACTED_JWT]');
    });

    it('redacts query parameter secrets in error messages', () => {
      const text = 'Upstream call failed on https://api.internal/data?token=secretVal123&code=authCode999';
      const redacted = sanitizeLogText(text);
      expect(redacted).not.toContain('secretVal123');
      expect(redacted).not.toContain('authCode999');
      expect(redacted).toContain('token=[REDACTED]');
      expect(redacted).toContain('code=[REDACTED]');
    });

    it('redacts Bearer authorization credentials', () => {
      const text = 'Error with header: Bearer ya29.a0ARrdaM-secretBearerToken';
      const redacted = sanitizeLogText(text);
      expect(redacted).not.toContain('ya29.a0ARrdaM-secretBearerToken');
      expect(redacted).toContain('Bearer [REDACTED]');
    });
  });

  describe('3. Runtime Regression Test: Backend Failure Log Sanitization', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('logs sanitized URL without query tokens on backend connection failure while preserving real targetUrl for fetch', async () => {
      const sensitiveToken = 'sensitive_secret_token_777';
      const sensitiveApiKey = 'secret_api_key_888';
      const sensitiveCode = 'oauth_code_999';

      let fetchCalledUrl: string | undefined;
      globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
        fetchCalledUrl = typeof url === 'string' ? url : url.toString();
        return Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:4000'));
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = createBffProxyHandler('/api/courses');
      const req = new NextRequest(
        `http://localhost:3000/api/courses/list?token=${sensitiveToken}&apiKey=${sensitiveApiKey}&code=${sensitiveCode}`,
        {
          method: 'GET',
          headers: {
            Origin: 'http://localhost:3000',
          },
        }
      );

      const response = await handler(req, {
        params: Promise.resolve({ path: ['list'] }),
      });

      // 1. Verify response contract
      expect(response.status).toBe(503);
      const resBody = await response.json();
      expect(resBody.error?.code).toBe('BACKEND_UNAVAILABLE');

      // 2. Verify backend fetch received full targetUrl with query parameters (contract preserved)
      expect(fetchCalledUrl).toBeDefined();
      expect(fetchCalledUrl).toContain(`token=${sensitiveToken}`);
      expect(fetchCalledUrl).toContain(`apiKey=${sensitiveApiKey}`);
      expect(fetchCalledUrl).toContain(`code=${sensitiveCode}`);

      // 3. Verify console.error output: sanitized URL without secrets
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedError = errorSpy.mock.calls[0]?.join(' ') || '';

      // Must contain safe diagnostic information
      expect(loggedError).toContain('[BFF Proxy Error]');
      expect(loggedError).toContain('GET');
      expect(loggedError).toContain('http://localhost:4000/api/courses/list');
      expect(loggedError).toContain('connect ECONNREFUSED 127.0.0.1:4000');

      // CRITICAL ASSERTION: Must NOT contain any query tokens or parameters
      expect(loggedError).not.toContain(sensitiveToken);
      expect(loggedError).not.toContain(sensitiveApiKey);
      expect(loggedError).not.toContain(sensitiveCode);
      expect(loggedError).not.toContain('token=');
      expect(loggedError).not.toContain('apiKey=');
      expect(loggedError).not.toContain('code=');
    });

    it('redacts tokens reflected inside the underlying fetch error message', async () => {
      const sensitiveTokenInErrMsg = 'reflected_token_secret_value_12345';
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error(`fetch failed for https://internal.api/call?token=${sensitiveTokenInErrMsg}`)
      );

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = createBffProxyHandler('/api/auth');
      const req = new NextRequest(
        'http://localhost:3000/api/auth/verify?token=someToken',
        {
          method: 'GET',
          headers: {
            Origin: 'http://localhost:3000',
          },
        }
      );

      const response = await handler(req, {
        params: Promise.resolve({ path: ['verify'] }),
      });

      expect(response.status).toBe(503);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedError = errorSpy.mock.calls[0]?.join(' ') || '';

      // The reflected query parameter token in the error message is redacted
      expect(loggedError).not.toContain(sensitiveTokenInErrMsg);
      expect(loggedError).toContain('token=[REDACTED]');
    });
  });
});
