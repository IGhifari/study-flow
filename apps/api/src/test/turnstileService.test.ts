import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { env } from '../config/env.js';
import {
  __setMockTurnstileVerifier,
  verifyTurnstileToken,
} from '../services/turnstile.service.js';

describe('verifyTurnstileToken (Unit Tests — Siteverify HTTP & Error Classification)', () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalSecretKey = env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    __setMockTurnstileVerifier(null);
    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    (env as { TURNSTILE_SECRET_KEY: string }).TURNSTILE_SECRET_KEY =
      '0x4AAAAAA_REAL_PRODUCTION_SECRET_KEY';
  });

  afterEach(() => {
    (env as { NODE_ENV: string }).NODE_ENV = originalNodeEnv;
    (env as { TURNSTILE_SECRET_KEY: string }).TURNSTILE_SECRET_KEY = originalSecretKey;
    __setMockTurnstileVerifier(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mengirim secret yang sudah di-trim via POST application/x-www-form-urlencoded dan lolos pada success: true', async () => {
    (env as { TURNSTILE_SECRET_KEY: string }).TURNSTILE_SECRET_KEY =
      '  0x4AAAAAA_TRIMMED_SECRET_VALUE\n ';

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          'error-codes': [],
          hostname: 'studyflow-app.biz.id',
          action: 'register',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      verifyTurnstileToken({
        token: '  valid-client-token-123  ',
        remoteIp: '::ffff:203.0.113.5',
        expectedAction: 'register',
        allowedHostnames: ['studyflow-app.biz.id'],
      })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    const params = new URLSearchParams(String(init.body));
    expect(params.get('secret')).toBe('0x4AAAAAA_TRIMMED_SECRET_VALUE');
    expect(params.get('response')).toBe('valid-client-token-123');
    expect(params.get('remoteip')).toBe('203.0.113.5');
  });

  it('mengklasifikasikan HTTP 400 dengan bad-request / invalid-input-response / timeout-or-duplicate sebagai 400 client error (BUKAN 503)', async () => {
    const cases: Array<{ codes: string[] }> = [
      { codes: ['invalid-input-response'] },
      { codes: ['timeout-or-duplicate'] },
      { codes: ['bad-request'] },
    ];

    for (const testCase of cases) {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            'error-codes': testCase.codes,
            hostname: 'studyflow-app.biz.id',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        verifyTurnstileToken({
          token: 'expired-or-bad-token',
          remoteIp: '203.0.113.5',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'TURNSTILE_VERIFICATION_FAILED',
      });
    }
  });

  it('mengklasifikasikan HTTP 400 non-JSON sebagai 400 client error (BUKAN 503)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response('Bad Request', { status: 400 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      verifyTurnstileToken({
        token: 'some-token',
        remoteIp: '203.0.113.5',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'TURNSTILE_VERIFICATION_FAILED',
    });
  });

  it('mengklasifikasikan HTTP 400 atau 200 dengan invalid-input-secret / missing-input-secret sebagai 500 CONFIGURATION_ERROR tanpa membocorkan secret atau token', async () => {
    const rawSecret = '0x4AAAAAA_SUPER_SECRET_DO_NOT_LOG';
    const rawToken = 'sensitive-raw-turnstile-token-xyz';
    (env as { TURNSTILE_SECRET_KEY: string }).TURNSTILE_SECRET_KEY = rawSecret;

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const status of [400, 200]) {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            'error-codes': ['invalid-input-secret'],
          }),
          { status, headers: { 'Content-Type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      let caughtError: unknown;
      try {
        await verifyTurnstileToken({
          token: rawToken,
          remoteIp: '203.0.113.5',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toMatchObject({
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
      });
      const errMessage = (caughtError as Error).message;
      expect(errMessage).not.toContain(rawSecret);
      expect(errMessage).not.toContain(rawToken);
    }

    const serializedLogs = JSON.stringify([
      ...consoleErrorSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
    ]);
    expect(serializedLogs).not.toContain(rawSecret);
    expect(serializedLogs).not.toContain(rawToken);
    expect(serializedLogs).toContain('invalid-input-secret');
  });

  it('menolak ketidakcocokan action atau hostname yang diharapkan dengan 400 TURNSTILE_VERIFICATION_FAILED', async () => {
    const actionMismatchFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          'error-codes': [],
          hostname: 'studyflow-app.biz.id',
          action: 'login',
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', actionMismatchFetch);

    await expect(
      verifyTurnstileToken({
        token: 'valid-login-token',
        expectedAction: 'register',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'TURNSTILE_VERIFICATION_FAILED',
    });

    const hostnameMismatchFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          'error-codes': [],
          hostname: 'attacker.example.com',
          action: 'register',
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', hostnameMismatchFetch);

    await expect(
      verifyTurnstileToken({
        token: 'valid-foreign-token',
        expectedAction: 'register',
        allowedHostnames: ['studyflow-app.biz.id'],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'TURNSTILE_VERIFICATION_FAILED',
    });
  });

  it('mengklasifikasikan HTTP 5xx, 429, internal-error, dan kegagalan jaringan sebagai 503', async () => {
    for (const status of [429, 500, 502, 503]) {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response('Upstream unavailable', { status })
      );
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        verifyTurnstileToken({ token: 'token-123' })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'TURNSTILE_SERVICE_UNAVAILABLE',
      });
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, 'error-codes': ['internal-error'] }),
          { status: 200 }
        )
      )
    );
    await expect(
      verifyTurnstileToken({ token: 'token-123' })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'TURNSTILE_SERVICE_UNAVAILABLE',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new TypeError('fetch failed'))
    );
    await expect(
      verifyTurnstileToken({ token: 'token-123' })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'TURNSTILE_NETWORK_ERROR',
    });
  });

  it('mengklasifikasikan missing-input-response sebagai 400 TURNSTILE_TOKEN_REQUIRED dan menolak token terlalu panjang sebelum memanggil fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            'error-codes': ['missing-input-response'],
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    await expect(
      verifyTurnstileToken({ token: 'token-123' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'TURNSTILE_TOKEN_REQUIRED',
    });

    const spyFetch = vi.fn();
    vi.stubGlobal('fetch', spyFetch);

    await expect(
      verifyTurnstileToken({ token: 'x'.repeat(5000) })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'TURNSTILE_VERIFICATION_FAILED',
    });
    expect(spyFetch).not.toHaveBeenCalled();
  });

  it('menangani secret key berisi spasi saja di development sebagai tidak terkonfigurasi dan menolaknya di production', async () => {
    const spyFetch = vi.fn();
    vi.stubGlobal('fetch', spyFetch);

    (env as { NODE_ENV: string }).NODE_ENV = 'development';
    (env as { TURNSTILE_SECRET_KEY: string }).TURNSTILE_SECRET_KEY = '   \n  ';
    await expect(
      verifyTurnstileToken({ token: 'dev-token' })
    ).resolves.toBeUndefined();
    expect(spyFetch).not.toHaveBeenCalled();

    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    await expect(
      verifyTurnstileToken({ token: 'prod-token' })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'CONFIGURATION_ERROR',
    });
    expect(spyFetch).not.toHaveBeenCalled();
  });
});
