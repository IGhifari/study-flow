import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createBffProxyHandler,
  readRequestBodyWithLimit,
  MAX_BFF_BODY_BYTES,
} from '../lib/bff-proxy.js';

describe('BFF Proxy Request Body Size Limits & Stream Hardening', () => {
  describe('readRequestBodyWithLimit unit tests', () => {
    it('returns undefined body for GET and HEAD requests without reading stream', async () => {
      const getReq = new NextRequest('http://localhost:3000/api/courses', {
        method: 'GET',
      });
      const getRes = await readRequestBodyWithLimit(getReq);
      expect(getRes.ok).toBe(true);
      expect(getRes.body).toBeUndefined();

      const headReq = new NextRequest('http://localhost:3000/api/courses', {
        method: 'HEAD',
      });
      const headRes = await readRequestBodyWithLimit(headReq);
      expect(headRes.ok).toBe(true);
      expect(headRes.body).toBeUndefined();
    });

    it('returns undefined body for POST requests without body', async () => {
      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
      });
      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(true);
      expect(res.body).toBeUndefined();
    });

    it('accepts small body well under 1 MiB', async () => {
      const payload = JSON.stringify({ message: 'Belajar StudyFlow', value: 42 });
      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: payload,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(true);
      expect(res.body).toBe(payload);
    });

    it('accepts body exactly at the 1 MiB limit', async () => {
      const exactBody = 'a'.repeat(MAX_BFF_BODY_BYTES);
      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: exactBody,
      });

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(true);
      expect(res.body).toBe(exactBody);
      expect(res.body?.length).toBe(MAX_BFF_BODY_BYTES);
    });

    it('rejects body exceeding 1 MiB by 1 byte with 413 Payload Too Large', async () => {
      const oversizedBody = 'a'.repeat(MAX_BFF_BODY_BYTES + 1);
      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: oversizedBody,
      });

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(false);
      expect(res.errorResponse).toBeDefined();
      expect(res.errorResponse?.status).toBe(413);

      const json = await res.errorResponse?.json();
      expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(json.error.message).toContain('1 MiB');
    });

    it('fast-rejects immediately when Content-Length header > 1 MiB and cancels stream', async () => {
      let cancelCalled = false;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
        },
        cancel() {
          cancelCalled = true;
        },
      });

      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: stream,
        headers: {
          'content-length': '2097152', // 2 MiB
        },
        duplex: 'half',
      } as any);

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(false);
      expect(res.errorResponse?.status).toBe(413);
      expect(cancelCalled).toBe(true);
    });

    it('handles invalid Content-Length (non-numeric or negative) by strictly verifying actual stream bytes', async () => {
      // 1. Invalid non-numeric Content-Length with small body -> accepted
      const smallReq = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: 'valid-small-payload',
        headers: {
          'content-length': 'not-a-number',
        },
      });
      const smallRes = await readRequestBodyWithLimit(smallReq);
      expect(smallRes.ok).toBe(true);
      expect(smallRes.body).toBe('valid-small-payload');

      // 2. Invalid non-numeric Content-Length with oversized body -> rejected by stream reader
      const largeReq = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: 'b'.repeat(MAX_BFF_BODY_BYTES + 10),
        headers: {
          'content-length': 'invalid-content-length',
        },
      });
      const largeRes = await readRequestBodyWithLimit(largeReq);
      expect(largeRes.ok).toBe(false);
      expect(largeRes.errorResponse?.status).toBe(413);
    });

    it('handles absent Content-Length (chunked transfer) by enforcing stream limits', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('x'.repeat(500)));
          controller.enqueue(new TextEncoder().encode('y'.repeat(500)));
          controller.close();
        },
      });

      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: stream,
        duplex: 'half',
      } as any);

      const res = await readRequestBodyWithLimit(req);
      expect(res.ok).toBe(true);
      expect(res.body?.length).toBe(1000);
    });

    it('handles stream read errors gracefully and returns 400 REQUEST_STREAM_ERROR', async () => {
      const failingStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Simulated stream connection abort'));
        },
      });

      const req = new NextRequest('http://localhost:3000/api/courses', {
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

  describe('createBffProxyHandler integration tests', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('rejects oversized POST request with 413 without calling upstream backend', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const handler = createBffProxyHandler('/api/courses');
      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: 'z'.repeat(MAX_BFF_BODY_BYTES + 50),
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      const response = await handler(req, {
        params: Promise.resolve({ path: [] }),
      });

      expect(response.status).toBe(413);
      const json = await response.json();
      expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('forwards valid payload and preserves auth and cookie headers', async () => {
      let forwardedHeaders: Headers | undefined;
      let forwardedBody: string | undefined;

      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        forwardedHeaders = new Headers(init?.headers);
        forwardedBody = init?.body;
        return Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const validPayload = JSON.stringify({ name: 'Matematika Diskrit' });
      const handler = createBffProxyHandler('/api/courses');
      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'POST',
        body: validPayload,
        headers: {
          Origin: 'http://localhost:3000',
          Cookie: 'studyflow_access_token=token123',
          Authorization: 'Bearer token123',
          'x-request-id': 'req-test-999',
        },
      });

      const response = await handler(req, {
        params: Promise.resolve({ path: [] }),
      });

      expect(response.status).toBe(200);
      expect(forwardedBody).toBe(validPayload);
      expect(forwardedHeaders?.get('cookie')).toBe('studyflow_access_token=token123');
      expect(forwardedHeaders?.get('authorization')).toBe('Bearer token123');
      expect(forwardedHeaders?.get('x-request-id')).toBe('req-test-999');
    });
  });
});
