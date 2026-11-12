import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateCsrfOrigin, createBffProxyHandler } from '../lib/bff-proxy.js';
import { escapeCsvCell } from '../lib/admin-formatters.js';

describe('BFF CSRF Origin Validation', () => {
  it('allows requests with Origin http://localhost:3005', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3005',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(true);
  });

  it('allows requests with Origin http://localhost:3005/ (trailing slash)', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3005/',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(true);
  });

  it('allows requests with Referer http://localhost:3005/dashboard without Origin header', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Referer: 'http://localhost:3005/dashboard',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(true);
  });

  it('allows requests with Origin http://127.0.0.1:3005', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'http://127.0.0.1:3005',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(true);
  });

  it('rejects malicious attacker origins', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'https://evil-attacker.com',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Origin tidak diizinkan');
  });

  it('rejects null origin', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'null',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Origin null tidak diizinkan');
  });

  it('rejects request with missing Origin and Referer', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Header Origin atau Referer wajib ada');
  });

  it('rejects path traversal and slash segments in BFF catch-all proxy (SEC-01)', async () => {
    const handler = createBffProxyHandler('/api/courses');
    const req = new NextRequest('http://localhost:3000/api/courses', {
      method: 'GET',
    });

    for (const badPath of [['..', 'admin', 'users'], ['.'], ['a/b'], ['a\\b'], ['']]) {
      const res = await handler(req, { params: Promise.resolve({ path: badPath }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('INVALID_PATH');
    }
  });

  it('re-encodes special query/fragment characters in BFF catch-all proxy segments (SEC-01)', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    global.fetch = fetchMock;

    try {
      const handler = createBffProxyHandler('/api/materials');
      const req = new NextRequest('http://localhost:3000/api/materials', {
        method: 'GET',
      });

      await handler(req, { params: Promise.resolve({ path: ['id?injected=1#frag'] }) });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(calledUrl).toContain('/api/materials/id%3Finjected%3D1%23frag');
      expect(calledUrl).not.toContain('?injected=1');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('neutralizes spreadsheet formula prefixes in escapeCsvCell (SEC-06)', () => {
    expect(escapeCsvCell('=cmd|\' /C calc\'!A0')).toBe('"\'=cmd|\' /C calc\'!A0"');
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(escapeCsvCell('-1+2')).toBe('"\'-1+2"');
    expect(escapeCsvCell('@IMPORTXML()')).toBe('"\'@IMPORTXML()"');
    expect(escapeCsvCell('Mahasiswa Normal')).toBe('"Mahasiswa Normal"');
  });
});
