import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  readRequestBodyWithLimit,
  MAX_BFF_BODY_BYTES,
} from '@/lib/bff-body';
import { POST } from '../app/api/[...path]/route.js';

describe('Admin BFF Request Body Size Limits & Stream Hardening', () => {
  describe('readRequestBodyWithLimit unit tests', () => {
    it('returns undefined body for GET requests', async () => {
      const req = new NextRequest('http://localhost:3002/api/admin/metrics', {
        method: 'GET',
      });
      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(true);
      expect(res.body).toBeUndefined();
    });

    it('accepts small valid admin payload', async () => {
      const payload = JSON.stringify({ role: 'ADMIN', action: 'PROMOTE' });
      const req = new NextRequest('http://localhost:3002/api/admin/users/promote', {
        method: 'POST',
        body: payload,
      });

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(true);
      expect(res.body).toBe(payload);
    });

    it('accepts body exactly at 1 MiB limit', async () => {
      const exactBody = 'x'.repeat(MAX_BFF_BODY_BYTES);
      const req = new NextRequest('http://localhost:3002/api/admin/users/bulk', {
        method: 'POST',
        body: exactBody,
      });

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(true);
      expect(res.body).toBe(exactBody);
    });

    it('rejects payload exceeding 1 MiB with 413 Payload Too Large', async () => {
      const oversizedBody = 'x'.repeat(MAX_BFF_BODY_BYTES + 10);
      const req = new NextRequest('http://localhost:3002/api/admin/users/bulk', {
        method: 'POST',
        body: oversizedBody,
      });

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(false);
      expect(res.errorResponse?.status).toBe(413);

      const json = await res.errorResponse?.json();
      expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('fast-rejects when Content-Length header is greater than 1 MiB', async () => {
      let cancelCalled = false;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
        },
        cancel() {
          cancelCalled = true;
        },
      });

      const req = new NextRequest('http://localhost:3002/api/admin/users/bulk', {
        method: 'POST',
        body: stream,
        headers: {
          'content-length': '2000000',
        },
        duplex: 'half',
      } as any);

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(false);
      expect(res.errorResponse?.status).toBe(413);
      expect(cancelCalled).toBe(true);
    });

    it('handles stream errors gracefully returning 400', async () => {
      const failingStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Simulated network disconnect'));
        },
      });

      const req = new NextRequest('http://localhost:3002/api/admin/users/bulk', {
        method: 'POST',
        body: failingStream,
        duplex: 'half',
      } as any);

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(false);
      expect(res.errorResponse?.status).toBe(400);

      const json = await res.errorResponse?.json();
      expect(json.error.code).toBe('REQUEST_STREAM_ERROR');
    });
  });

  describe('Admin BFF POST route integration test', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('rejects oversized admin POST mutation without invoking backend fetch', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const req = new NextRequest('http://localhost:3002/api/admin/system', {
        method: 'POST',
        body: 'a'.repeat(MAX_BFF_BODY_BYTES + 100),
        headers: {
          Origin: 'http://localhost:3002',
        },
      });

      const response = await POST(req, {
        params: Promise.resolve({ path: ['admin', 'system'] }),
      });

      expect(response.status).toBe(413);
      const json = await response.json();
      expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
