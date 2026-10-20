import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getInternalApiUrl, ApiConfigurationError } from '../lib/api-config.js';
import { createBffProxyHandler } from '../lib/bff-proxy.js';
import { middleware } from '../middleware.js';
import { getServerSessionUser } from '../lib/auth-server.js';
import { COOKIE_NAMES } from '@studyflow/shared';

// Mock next/headers for getServerSessionUser
const mockCookieMap = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (mockCookieMap.has(name) ? { value: mockCookieMap.get(name) } : undefined),
    toString: () =>
      Array.from(mockCookieMap.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
  }),
}));

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key];
  } else {
    (process.env as Record<string, string | undefined>)[key] = value;
  }
}

describe('API Base URL Configuration & Production Fallback Guard', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCookieMap.clear();
    // Reset env vars to baseline
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Resolusi URL pada Mode Development & Test', () => {
    it('menggunakan fallback http://localhost:4000 saat variabel tidak dikonfigurasi di development', () => {
      setEnv('NODE_ENV', 'development');
      setEnv('INTERNAL_API_URL', undefined);
      setEnv('NEXT_PUBLIC_API_URL', undefined);

      const url = getInternalApiUrl();
      expect(url).toBe('http://localhost:4000');
    });

    it('mengutamakan INTERNAL_API_URL dibanding NEXT_PUBLIC_API_URL saat keduanya tersedia', () => {
      setEnv('NODE_ENV', 'development');
      setEnv('INTERNAL_API_URL', 'http://localhost:4001');
      setEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4002');

      const url = getInternalApiUrl();
      expect(url).toBe('http://localhost:4001');
    });

    it('menggunakan NEXT_PUBLIC_API_URL saat INTERNAL_API_URL tidak ada di development', () => {
      setEnv('NODE_ENV', 'development');
      setEnv('INTERNAL_API_URL', undefined);
      setEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4005');

      const url = getInternalApiUrl();
      expect(url).toBe('http://localhost:4005');
    });

    it('menghapus trailing slash pada konfigurasi URL secara otomatis', () => {
      setEnv('NODE_ENV', 'development');
      setEnv('INTERNAL_API_URL', 'http://localhost:4000///');

      const url = getInternalApiUrl();
      expect(url).toBe('http://localhost:4000');
    });

    it('membersihkan whitespace di awal dan akhir URL', () => {
      setEnv('NODE_ENV', 'development');
      setEnv('INTERNAL_API_URL', '   http://localhost:4000   ');

      const url = getInternalApiUrl();
      expect(url).toBe('http://localhost:4000');
    });
  });

  describe('2. Pencegahan Silent Fallback & Validasi pada Mode Production', () => {
    it('gagal eksplisit dengan ApiConfigurationError saat kedua konfigurasi tidak disetel di production', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', undefined);
      setEnv('NEXT_PUBLIC_API_URL', undefined);

      expect(() => getInternalApiUrl()).toThrow(ApiConfigurationError);
      expect(() => getInternalApiUrl()).toThrow(
        'Konfigurasi URL API backend tidak ditemukan. Harap tentukan variabel environment INTERNAL_API_URL atau NEXT_PUBLIC_API_URL pada mode produksi.'
      );
    });

    it('tidak menggunakan localhost:4000 secara diam-diam jika konfigurasi hanya berisi string kosong atau whitespace di production', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', '   ');
      setEnv('NEXT_PUBLIC_API_URL', '');

      expect(() => getInternalApiUrl()).toThrow(ApiConfigurationError);
      expect(() => getInternalApiUrl()).toThrow(
        'Konfigurasi URL API backend tidak ditemukan. Harap tentukan variabel environment INTERNAL_API_URL atau NEXT_PUBLIC_API_URL pada mode produksi.'
      );
    });

    it('menolak nilai URL yang memiliki format sintaks tidak valid', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'bukan-sebuah-url-valid');

      expect(() => getInternalApiUrl()).toThrow(ApiConfigurationError);
      expect(() => getInternalApiUrl()).toThrow(
        'Format URL API backend tidak valid. Nilai harus merupakan URL valid dengan protokol http atau https.'
      );
    });

    it('menolak protokol selain http atau https (mis. ftp, ws, javascript)', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'ftp://api.studyflow.id/files');

      expect(() => getInternalApiUrl()).toThrow(ApiConfigurationError);
      expect(() => getInternalApiUrl()).toThrow(
        'Protokol URL API backend tidak valid. Hanya protokol http atau https yang didukung.'
      );
    });

    it('menolak URL yang memuat username tertanam (userinfo)', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://admin@api.studyflow.id');

      expect(() => getInternalApiUrl()).toThrow(ApiConfigurationError);
      expect(() => getInternalApiUrl()).toThrow(
        'URL API backend tidak boleh mengandung kredensial autentikasi (username atau password).'
      );
    });

    it('menolak URL yang memuat password tertanam', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://:supersecret123@api.studyflow.id');

      expect(() => getInternalApiUrl()).toThrow(ApiConfigurationError);
      expect(() => getInternalApiUrl()).toThrow(
        'URL API backend tidak boleh mengandung kredensial autentikasi (username atau password).'
      );
    });

    it('menolak URL yang memuat kombinasi username dan password tertanam', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://admin:supersecret123@api.studyflow.id');

      expect(() => getInternalApiUrl()).toThrow(ApiConfigurationError);
      expect(() => getInternalApiUrl()).toThrow(
        'URL API backend tidak boleh mengandung kredensial autentikasi (username atau password).'
      );
    });

    it('pesan error penolakan userinfo tidak membocorkan username atau password yang dimasukkan', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://superadmin:TopSecretPassword999@api.studyflow.id/internal');

      try {
        getInternalApiUrl();
        expect.unreachable('Harus melempar ApiConfigurationError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiConfigurationError);
        const error = err as ApiConfigurationError;
        expect(error.message).not.toContain('superadmin');
        expect(error.message).not.toContain('TopSecretPassword999');
        expect(error.message).toBe(
          'URL API backend tidak boleh mengandung kredensial autentikasi (username atau password).'
        );
      }
    });

    it('berhasil menggunakan INTERNAL_API_URL valid pada mode production', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://api.studyflow.id');
      setEnv('NEXT_PUBLIC_API_URL', undefined);

      const url = getInternalApiUrl();
      expect(url).toBe('https://api.studyflow.id');
    });

    it('berhasil menggunakan NEXT_PUBLIC_API_URL sebagai fallback valid pada mode production', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', undefined);
      setEnv('NEXT_PUBLIC_API_URL', 'https://public-api.studyflow.id');

      const url = getInternalApiUrl();
      expect(url).toBe('https://public-api.studyflow.id');
    });

    it('mendukung URL dengan path segmen / base path dan menormalkan trailing slash', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://api.studyflow.id/v1///');

      const url = getInternalApiUrl();
      expect(url).toBe('https://api.studyflow.id/v1');
    });

    it('mendukung URL jaringan internal container (mis. http://studyflow-api:4000)', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'http://studyflow-api:4000');

      const url = getInternalApiUrl();
      expect(url).toBe('http://studyflow-api:4000');
    });
  });

  describe('3. Konsistensi Ketiga Jalur Pemanggilan (BFF Proxy, Middleware, Auth Server)', () => {
    it('jalur 1: createBffProxyHandler mengembalikan status 500 API_CONFIGURATION_ERROR saat unconfigured di production', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', undefined);
      setEnv('NEXT_PUBLIC_API_URL', undefined);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = createBffProxyHandler('/api/test-endpoint');
      const req = new NextRequest('http://localhost:3000/api/test-endpoint', {
        method: 'GET',
      });

      const res = await handler(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error.code).toBe('API_CONFIGURATION_ERROR');
      // Memastikan fetch ke localhost:4000 TIDAK pernah dipanggil
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('jalur 1: createBffProxyHandler memanggil URL terkonfigurasi pada production', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://api.studyflow.id');

      let calledUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
        calledUrl = String(url);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });

      const handler = createBffProxyHandler('/api/courses');
      const req = new NextRequest('http://localhost:3000/api/courses', {
        method: 'GET',
      });

      const res = await handler(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      expect(calledUrl).toBe('https://api.studyflow.id/api/courses');
    });

    it('jalur 2: middleware me-redirect ke login, membersihkan cookie, dan mencegah redirect loop saat unconfigured di production', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', undefined);
      setEnv('NEXT_PUBLIC_API_URL', undefined);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Expired access token dengan refresh token yang masih ada di browser
      const expiredPayload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 300 })).toString(
        'base64url'
      );
      const expiredJwt = `header.${expiredPayload}.signature`;

      const req = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: `${COOKIE_NAMES.accessToken}=${expiredJwt}; ${COOKIE_NAMES.refreshToken}=sample_refresh_token`,
        },
      });

      // 1. Eksekusi request pertama ke /dashboard
      const res = await middleware(req);

      // Verifikasi redirect 307 ke /login
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?returnUrl=%2Fdashboard');
      // Fetch ke localhost:4000 TIDAK boleh terjadi
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      // 2. Verifikasi respon redirect membersihkan cookie autentikasi (mencegah loop)
      const accessTokenCookie = res.cookies.get(COOKIE_NAMES.accessToken);
      const refreshTokenCookie = res.cookies.get(COOKIE_NAMES.refreshToken);
      expect(accessTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();
      // Cookie terhapus memiliki maxAge 0 atau nilai kosong
      expect(accessTokenCookie?.value === '' || accessTokenCookie?.maxAge === 0).toBe(true);
      expect(refreshTokenCookie?.value === '' || refreshTokenCookie?.maxAge === 0).toBe(true);

      // 3. Verifikasi request follow-up peramban ke /login (tanpa cookie yang sudah dihapus)
      const followUpLoginReq = new NextRequest('http://localhost:3000/login?returnUrl=%2Fdashboard');
      const followUpLoginRes = await middleware(followUpLoginReq);

      // Pengguna TIDAK di-redirect balik ke /dashboard; halaman login dapat ditampilkan
      expect(followUpLoginRes.status).toBe(200);
      expect(followUpLoginRes.headers.get('location')).toBeNull();
    });

    it('jalur 2: refresh token normal yang berhasil tetap memperbarui cookie dan meneruskan request', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://api.studyflow.id');

      const expiredPayload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 300 })).toString(
        'base64url'
      );
      const expiredJwt = `header.${expiredPayload}.signature`;

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': `${COOKIE_NAMES.accessToken}=new_refreshed_jwt; Path=/; HttpOnly; SameSite=Lax`,
          },
        })
      );

      const req = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: `${COOKIE_NAMES.accessToken}=${expiredJwt}; ${COOKIE_NAMES.refreshToken}=sample_refresh_token`,
        },
      });

      const res = await middleware(req);
      // Sukses me-refresh: meneruskan request (NextResponse.next()) tanpa redirect ke /login
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
      // Refreshed cookie diteruskan ke browser
      expect(res.headers.get('set-cookie')).toContain('new_refreshed_jwt');
    });

    it('jalur 2: route publik (/) dan login tanpa sesi dapat diakses tanpa dipengaruhi konfigurasi API', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', undefined);
      setEnv('NEXT_PUBLIC_API_URL', undefined);

      // 1. Kunjungan ke route publik (/)
      const homeReq = new NextRequest('http://localhost:3000/');
      const homeRes = await middleware(homeReq);
      expect(homeRes.status).toBe(200);
      expect(homeRes.headers.get('location')).toBeNull();

      // 2. Kunjungan ke route login (/login) tanpa sesi
      const loginReq = new NextRequest('http://localhost:3000/login');
      const loginRes = await middleware(loginReq);
      expect(loginRes.status).toBe(200);
      expect(loginRes.headers.get('location')).toBeNull();
    });

    it('jalur 3: getServerSessionUser mengembalikan null dan tidak memicu fetch saat unconfigured di production', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', undefined);
      setEnv('NEXT_PUBLIC_API_URL', undefined);

      mockCookieMap.set(COOKIE_NAMES.accessToken, 'valid_token');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const user = await getServerSessionUser();
      expect(user).toBeNull();
      // Fetch ke localhost:4000 TIDAK boleh terjadi
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('ketiga jalur menghasilkan base URL yang identik ketika INTERNAL_API_URL dikonfigurasi', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('INTERNAL_API_URL', 'https://api-prod.studyflow.internal');

      const calls: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ user: { id: 'u1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });

      // Jalur 1: BFF
      const handler = createBffProxyHandler('/api/semesters');
      await handler(new NextRequest('http://localhost:3000/api/semesters', { method: 'GET' }), {
        params: Promise.resolve({}),
      });

      // Jalur 2: Middleware refresh
      const expiredPayload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 300 })).toString(
        'base64url'
      );
      const expiredJwt = `header.${expiredPayload}.signature`;
      await middleware(
        new NextRequest('http://localhost:3000/dashboard', {
          headers: {
            cookie: `${COOKIE_NAMES.accessToken}=${expiredJwt}; ${COOKIE_NAMES.refreshToken}=sample_refresh_token`,
          },
        })
      );

      // Jalur 3: Server Session
      mockCookieMap.set(COOKIE_NAMES.accessToken, 'sample_token');
      await getServerSessionUser();

      // Periksa bahwa ketiga pemanggilan memiliki origin basis yang konsisten
      expect(calls.length).toBe(3);
      for (const callUrl of calls) {
        expect(callUrl.startsWith('https://api-prod.studyflow.internal')).toBe(true);
      }
    });
  });
});
