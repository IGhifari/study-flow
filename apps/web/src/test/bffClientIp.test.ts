import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resolveForwardedClientIp } from '../lib/clientIp.js';
import { POST } from '../app/api/auth/[...path]/route.js';

describe('BFF Client IP Resolution & Header Security', () => {
  const originalEnv = process.env.TRUSTED_CLIENT_IP_HEADER;

  beforeEach(() => {
    delete process.env.TRUSTED_CLIENT_IP_HEADER;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TRUSTED_CLIENT_IP_HEADER = originalEnv;
    } else {
      delete process.env.TRUSTED_CLIENT_IP_HEADER;
    }
    vi.restoreAllMocks();
  });

  describe('1. Mode Default (Tanpa Ingress Terpercaya)', () => {
    it('mengabaikan seluruh header IP dari klien (X-Forwarded-For, X-Real-IP, CF-Connecting-IP, Forwarded)', () => {
      // TRUSTED_CLIENT_IP_HEADER is unset / undefined
      const headers = new Headers();
      headers.set('x-forwarded-for', '203.0.113.195');
      headers.set('x-real-ip', '198.51.100.22');
      headers.set('cf-connecting-ip', '192.0.2.100');
      headers.set('forwarded', 'for=10.0.0.1');

      const resolvedIp = resolveForwardedClientIp(headers);
      // In default mode, user headers MUST NOT be trusted
      expect(resolvedIp).toBe('127.0.0.1');
    });

    it('mengabaikan header jika TRUSTED_CLIENT_IP_HEADER diisi "none" atau string kosong', () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = 'none';
      const headers1 = new Headers({ 'x-real-ip': '203.0.113.10' });
      expect(resolveForwardedClientIp(headers1)).toBe('127.0.0.1');

      process.env.TRUSTED_CLIENT_IP_HEADER = '   ';
      const headers2 = new Headers({ 'x-real-ip': '203.0.113.10' });
      expect(resolveForwardedClientIp(headers2)).toBe('127.0.0.1');
    });
  });

  describe('2. Mode Reverse Proxy Terpercaya (TRUSTED_CLIENT_IP_HEADER terkonfigurasi)', () => {
    it('hanya mempercayai header yang dikonfigurasi dan mengabaikan header alternatif', () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';

      // Attacker attempts to forge CF-Connecting-IP and X-Forwarded-For, but X-Real-IP is absent
      const headers = new Headers();
      headers.set('cf-connecting-ip', '198.51.100.99');
      headers.set('x-forwarded-for', '192.0.2.55');

      const resolved = resolveForwardedClientIp(headers);
      // Because x-real-ip was NOT provided by the ingress, fallback to 127.0.0.1
      expect(resolved).toBe('127.0.0.1');
    });

    it('memvalidasi format IPv4 valid dari header terkonfigurasi', () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';

      const headers = new Headers({ 'x-real-ip': '203.0.113.45' });
      expect(resolveForwardedClientIp(headers)).toBe('203.0.113.45');
    });

    it('memvalidasi format IPv6 valid dari header terkonfigurasi', () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = 'cf-connecting-ip';

      const headers = new Headers({ 'cf-connecting-ip': '2001:db8:85a3::8a2e:370:7334' });
      expect(resolveForwardedClientIp(headers)).toBe('2001:db8:85a3::8a2e:370:7334');
    });

    it('menolak nilai non-IP, string berbahaya, dan port suffix', () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';

      // Arbitrary malicious string
      expect(resolveForwardedClientIp(new Headers({ 'x-real-ip': 'malicious-string; drop table' }))).toBe('127.0.0.1');

      // Invalid octets
      expect(resolveForwardedClientIp(new Headers({ 'x-real-ip': '999.999.999.999' }))).toBe('127.0.0.1');

      // IP with port suffix (isIP returns 0)
      expect(resolveForwardedClientIp(new Headers({ 'x-real-ip': '203.0.113.10:8080' }))).toBe('127.0.0.1');

      // Blank string
      expect(resolveForwardedClientIp(new Headers({ 'x-real-ip': '   ' }))).toBe('127.0.0.1');
    });

    it('mengambil entri IP pertama jika header berisi daftar dipisahkan koma', () => {
      process.env.TRUSTED_CLIENT_IP_HEADER = 'x-forwarded-for';

      const headers = new Headers({ 'x-forwarded-for': '203.0.113.50, 198.51.100.1, 10.0.0.2' });
      expect(resolveForwardedClientIp(headers)).toBe('203.0.113.50');
    });
  });

  describe('3. BFF handleProxy Integration', () => {
    it('meneruskan Retry-After dan header rate-limit standar dari Express 429 ke respons peramban', async () => {
      const mockExpressRes = new Response(
        JSON.stringify({
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Terlalu banyak percobaan autentikasi. Silakan tunggu.',
          },
        }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': '900',
            'ratelimit-limit': '30',
            'ratelimit-remaining': '0',
            'ratelimit-reset': '900',
          },
        }
      );

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockExpressRes as any);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ path: ['login'] }),
      });

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('900');
      expect(response.headers.get('ratelimit-limit')).toBe('30');
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(response.headers.get('ratelimit-reset')).toBe('900');

      const body = await response.json();
      expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('pada mode default, header spoofing dari peramban tidak diteruskan ke Express', async () => {
      delete process.env.TRUSTED_CLIENT_IP_HEADER;

      let capturedForwardedFor: string | null = null;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        const headers = init?.headers as Headers;
        capturedForwardedFor = headers.get('x-forwarded-for');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });

      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          'x-real-ip': '6.6.6.6',
          'x-forwarded-for': '7.7.7.7',
          'cf-connecting-ip': '8.8.8.8',
        },
        body: JSON.stringify({ name: 'User', email: 'u@test.com', password: 'Password123!' }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ path: ['register'] }),
      });

      expect(response.status).toBe(200);
      // In default mode, the forwarded IP is strictly 127.0.0.1, IGNORING 6.6.6.6, 7.7.7.7, and 8.8.8.8!
      expect(capturedForwardedFor).toBe('127.0.0.1');
    });
  });
});
