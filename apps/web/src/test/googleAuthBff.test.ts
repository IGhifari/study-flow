import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { COOKIE_NAMES } from '@studyflow/shared';
import { GET as startGoogleAuth } from '../app/api/auth/google/route.js';
import { GET as googleCallback } from '../app/api/auth/google/callback/route.js';
import { POST as initiateLink } from '../app/api/auth/google/link/route.js';

describe('Google OAuth BFF Route Handlers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('1. GET /api/auth/google (Initiate OAuth)', () => {
    it('mengatur cookie transaksi HttpOnly dan me-redirect ke Google auth URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=xyz',
          state: 'test-state-123',
          codeVerifier: 'test-verifier-abc',
          nonce: 'test-nonce-456',
        }),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/google?returnUrl=/assignments');
      const res = await startGoogleAuth(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=xyz'
      );

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain(COOKIE_NAMES.oauthTx);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie?.toLowerCase()).toContain('samesite=lax');
    });

    it('menormalisasi open redirect returnUrl menjadi /dashboard', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: 'https://accounts.google.com/o/oauth2/v2/auth',
          state: 'test-state',
          codeVerifier: 'test-verifier',
          nonce: 'test-nonce',
        }),
      } as any);

      const req = new NextRequest(
        'http://localhost:3000/api/auth/google?returnUrl=https://evil-attacker.com'
      );
      const res = await startGoogleAuth(req);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain(COOKIE_NAMES.oauthTx);
      // Decoded cookie check
      expect(setCookie).toContain('%22returnUrl%22%3A%22%2Fdashboard%22');
    });
  });

  describe('2. GET /api/auth/google/callback (OAuth Callback Handling)', () => {
    it('menolak callback jika cookie transaksi tidak ditemukan / kedaluwarsa', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/google/callback?code=abc&state=123');
      const res = await googleCallback(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login?error=');
    });

    it('menolak callback dan membersihkan cookie jika pengguna membatalkan (error=access_denied)', async () => {
      const txData = JSON.stringify({
        state: 'valid-state',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        returnUrl: '/dashboard',
        intent: 'login',
        createdAt: Date.now(),
      });

      const req = new NextRequest(
        'http://localhost:3000/api/auth/google/callback?error=access_denied',
        {
          headers: {
            cookie: `${COOKIE_NAMES.oauthTx}=${encodeURIComponent(txData)}`,
          },
        }
      );

      const res = await googleCallback(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?error=');
      expect(res.headers.get('location')).toContain('dibatalkan');
      expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    });

    it('menolak callback jika state yang diterima tidak cocok (anti-CSRF)', async () => {
      const txData = JSON.stringify({
        state: 'expected-state-777',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        returnUrl: '/dashboard',
        intent: 'login',
        createdAt: Date.now(),
      });

      const req = new NextRequest(
        'http://localhost:3000/api/auth/google/callback?code=good-code&state=forged-state-999',
        {
          headers: {
            cookie: `${COOKIE_NAMES.oauthTx}=${encodeURIComponent(txData)}`,
          },
        }
      );

      const res = await googleCallback(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?error=');
      expect(res.headers.get('location')).toContain('CSRF');
    });

    it('menukar code via Express API, meneruskan Set-Cookie auth, dan redirect ke returnUrl aman', async () => {
      const txData = JSON.stringify({
        state: 'valid-state',
        codeVerifier: 'verifier-123',
        nonce: 'nonce-456',
        returnUrl: '/materials',
        intent: 'login',
        createdAt: Date.now(),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          getSetCookie: () => ['studyflow_access=jwt.token; Path=/; HttpOnly'],
        },
        json: async () => ({
          message: 'Login dengan Google berhasil',
          user: { id: 'u1', email: 'test@example.com' },
        }),
      } as any);

      const req = new NextRequest(
        'http://localhost:3000/api/auth/google/callback?code=valid-auth-code&state=valid-state',
        {
          headers: {
            cookie: `${COOKIE_NAMES.oauthTx}=${encodeURIComponent(txData)}`,
          },
        }
      );

      const res = await googleCallback(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/materials');
      // Cookie transaksi dibersihkan
      const allCookies = res.headers.get('set-cookie') || '';
      expect(allCookies).toContain('Max-Age=0');
      // Cookie auth dari backend diteruskan
      expect(allCookies).toContain('studyflow_access');
    });

    it('mengarahkan hasil linking yang sukses ke /settings?google=linked', async () => {
      const txData = JSON.stringify({
        state: 'valid-link-state',
        codeVerifier: 'verifier-link',
        nonce: 'nonce-link',
        returnUrl: '/settings',
        intent: 'link',
        createdAt: Date.now(),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          getSetCookie: () => [],
        },
        json: async () => ({ message: 'Akun Google berhasil dihubungkan' }),
      } as any);

      const req = new NextRequest(
        'http://localhost:3000/api/auth/google/callback?code=valid-code&state=valid-link-state',
        {
          headers: {
            cookie: `${COOKIE_NAMES.oauthTx}=${encodeURIComponent(txData)}`,
          },
        }
      );

      const res = await googleCallback(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/settings?google=linked');
    });
  });

  describe('3. POST /api/auth/google/link (Initiate Google Linking)', () => {
    it('menolak permintaan jika password kosong atau invalid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Password saat ini wajib diisi' },
        }),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/google/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ currentPassword: '' }),
      });

      const res = await initiateLink(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Password saat ini wajib diisi');
    });

    it('berhasil inisiasi linking dan mengatur cookie transaksi bertipe "link"', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: 'https://accounts.google.com/o/oauth2/v2/auth?prompt=consent',
          state: 'state-link-999',
          codeVerifier: 'verifier-link-999',
          nonce: 'nonce-link-999',
        }),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/google/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          cookie: 'studyflow_access=valid.token',
        },
        body: JSON.stringify({ currentPassword: 'SecurePassword123!' }),
      });

      const res = await initiateLink(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toContain('https://accounts.google.com');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain(COOKIE_NAMES.oauthTx);
      expect(setCookie).toContain('%22intent%22%3A%22link%22');
    });
  });
});
