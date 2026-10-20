import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { __setMockTurnstileVerifier, verifyTurnstileToken } from '../services/turnstile.service.js';
import { env, assertProductionSecrets } from '../config/env.js';
import { __getSentTestEmails, __clearSentTestEmails } from '../services/email.service.js';
import { hashPassword } from '../services/password.service.js';
import { __resetLoginProtectionMemory } from '../services/loginProtection.service.js';

describe('Cloudflare Turnstile Protection Tests', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  const cleanUsers = async () => {
    await prisma.passwordResetToken.deleteMany({
      where: {
        user: {
          email: { contains: 'turnstile.' },
        },
      },
    });
    await prisma.refreshSession.deleteMany({
      where: {
        user: {
          email: { contains: 'turnstile.' },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'turnstile.' },
      },
    });
  };

  beforeEach(async () => {
    process.env.TEST_ENFORCE_TURNSTILE = 'true';
    __setMockTurnstileVerifier(null);
    __clearSentTestEmails();
    await cleanUsers();
  });

  afterAll(async () => {
    delete process.env.TEST_ENFORCE_TURNSTILE;
    __setMockTurnstileVerifier(null);
    __clearSentTestEmails();
    await cleanUsers();
    await prisma.$disconnect();
  });

  describe('1. POST /api/auth/register with Turnstile', () => {
    it('menolak registrasi jika turnstileToken tidak dikirim (validation error)', async () => {
      const email = `turnstile.missing.${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'No Token User',
          email,
          password: 'SecurePassword123!',
          timezone: 'Asia/Jakarta',
          // turnstileToken omitted
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TURNSTILE_TOKEN_REQUIRED');

      // User tidak boleh dibuat di database
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeNull();
    });

    it('menolak registrasi jika turnstileToken kosong / whitespace', async () => {
      const email = `turnstile.empty.${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Empty Token User',
          email,
          password: 'SecurePassword123!',
          timezone: 'Asia/Jakarta',
          turnstileToken: '   ',
        });

      expect(res.status).toBe(400);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeNull();
    });

    it('menolak registrasi dan tidak membuat user jika verifikasi Turnstile gagal', async () => {
      const email = `turnstile.failed.${Date.now()}@example.com`;
      __setMockTurnstileVerifier(() => false);

      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Failed Turnstile User',
          email,
          password: 'SecurePassword123!',
          timezone: 'Asia/Jakarta',
          turnstileToken: 'mock-invalid-token',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TURNSTILE_VERIFICATION_FAILED');
      expect(res.body.error.message).toBe('Verifikasi keamanan gagal. Silakan coba lagi.');

      // Memastikan user tidak dibuat
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeNull();
    });

    it('berhasil membuat user jika verifikasi Turnstile valid', async () => {
      const email = `turnstile.success.${Date.now()}@example.com`;
      __setMockTurnstileVerifier(() => true);

      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Success Turnstile User',
          email,
          password: 'SecurePassword123!',
          timezone: 'Asia/Jakarta',
          turnstileToken: 'valid-turnstile-token-12345',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(email);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeDefined();
    });
  });

  describe('2. POST /api/auth/forgot-password with Turnstile', () => {
    it('menolak forgot password jika turnstileToken tidak dikirim', async () => {
      const email = `turnstile.forgot.missing.${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TURNSTILE_TOKEN_REQUIRED');

      expect(__getSentTestEmails()).toHaveLength(0);
    });

    it('menolak forgot password dan tidak mengirim email jika Turnstile gagal', async () => {
      const email = `turnstile.forgot.fail.${Date.now()}@example.com`;
      await prisma.user.create({
        data: {
          name: 'Target User',
          email,
          passwordHash: await hashPassword('LocalPass12345!'),
        },
      });

      __setMockTurnstileVerifier(() => false);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email,
          turnstileToken: 'invalid-turnstile-token',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TURNSTILE_VERIFICATION_FAILED');

      // Email tidak boleh terkirim
      expect(__getSentTestEmails()).toHaveLength(0);

      // Token reset tidak boleh dibuat
      const tokens = await prisma.passwordResetToken.findMany({
        where: { user: { email } },
      });
      expect(tokens).toHaveLength(0);
    });

    it('berhasil memproses forgot password jika Turnstile valid', async () => {
      const email = `turnstile.forgot.ok.${Date.now()}@example.com`;
      await prisma.user.create({
        data: {
          name: 'Target User',
          email,
          passwordHash: await hashPassword('LocalPass12345!'),
        },
      });

      __setMockTurnstileVerifier(() => true);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email,
          turnstileToken: 'valid-turnstile-token',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Jika akun memenuhi syarat');
      expect(__getSentTestEmails()).toHaveLength(1);
    });
  });

  describe('3. Error & Network Failure Resilience', () => {
    it('menangani error network/service saat verifikasi Cloudflare dengan 503 yang aman', async () => {
      const email = `turnstile.network.${Date.now()}@example.com`;
      __setMockTurnstileVerifier(() => {
        throw new Error('Cloudflare network unreachable');
      });

      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: 'Network Error User',
          email,
          password: 'SecurePassword123!',
          timezone: 'Asia/Jakarta',
          turnstileToken: 'valid-token',
        });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('TURNSTILE_NETWORK_ERROR');
      expect(res.body.error.message).toContain('masalah jaringan');
    });
  });

  describe('4. Adaptive CAPTCHA for Login', () => {
    const validPassword = 'SecurePassword123!';
    let ipCounter = 0;
    // Unique client IP per test (trusted via loopback BFF proxy) so counters stay isolated
    const nextIp = () => `203.0.113.${(ipCounter += 1)}`;

    const createLoginUser = async () => {
      const email = `turnstile.login.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
      await prisma.user.create({
        data: { name: 'Login Turnstile User', email, passwordHash: await hashPassword(validPassword) },
      });
      return email;
    };

    const login = (ip: string, body: Record<string, string>) =>
      request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .set('X-Forwarded-For', ip)
        .send(body);

    beforeEach(() => {
      __resetLoginProtectionMemory();
    });

    it('login normal tanpa CAPTCHA berhasil bila belum ada kegagalan', async () => {
      const email = await createLoginUser();
      const res = await login(nextIp(), { email, password: validPassword });
      expect(res.status).toBe(200);
    });

    it('ambang per akun: CAPTCHA wajib setelah 3 kali gagal, lalu sukses dengan token valid', async () => {
      const email = await createLoginUser();
      const ip = nextIp();

      for (let i = 1; i <= 3; i += 1) {
        const res = await login(ip, { email, password: 'WrongPassword123!' });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
        expect(res.body.error.details?.requireCaptcha).toBe(i >= 3);
      }

      // Password benar tanpa token ditolak sebelum password diperiksa, tanpa sesi
      const blocked = await login(ip, { email, password: validPassword });
      expect(blocked.status).toBe(400);
      expect(blocked.body.error.code).toBe('TURNSTILE_TOKEN_REQUIRED');
      expect(blocked.body.error.details?.requireCaptcha).toBe(true);
      expect(blocked.headers['set-cookie']).toBeUndefined();

      // Ambang akun berlaku juga dari IP lain
      const otherIp = await login(nextIp(), { email, password: validPassword });
      expect(otherIp.status).toBe(400);
      expect(otherIp.body.error.code).toBe('TURNSTILE_TOKEN_REQUIRED');

      // Token tidak valid ditolak
      __setMockTurnstileVerifier(() => false);
      const invalid = await login(ip, { email, password: validPassword, turnstileToken: 'mock-invalid-token' });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('TURNSTILE_VERIFICATION_FAILED');
      expect(invalid.headers['set-cookie']).toBeUndefined();

      // Token valid + password benar berhasil
      __setMockTurnstileVerifier(() => true);
      const ok = await login(ip, { email, password: validPassword, turnstileToken: 'valid-turnstile-token' });
      expect(ok.status).toBe(200);
      expect(ok.body.user.email).toBe(email);
    });

    it('login sukses mereset penghitung akun, tetapi tidak mereset penghitung IP', async () => {
      const victim = await createLoginUser();
      const attacker = await createLoginUser();
      const ip = nextIp();

      // 2 kegagalan untuk akun victim (di bawah ambang akun)
      for (let i = 0; i < 2; i += 1) {
        await login(ip, { email: victim, password: 'WrongPassword123!' });
      }

      // Login sukses akun victim mereset penghitung akun victim
      const ok = await login(ip, { email: victim, password: validPassword });
      expect(ok.status).toBe(200);
      const afterReset = await login(ip, { email: victim, password: 'WrongPassword123!' });
      expect(afterReset.body.error.details?.requireCaptcha).toBe(false);

      // 7 kegagalan lagi dengan email acak dari IP yang sama -> total 10 kegagalan IP
      for (let i = 0; i < 7; i += 1) {
        await login(ip, { email: `turnstile.spray.${i}.${Date.now()}@example.com`, password: 'WrongPassword123!' });
      }

      // Login sukses akun milik penyerang tidak boleh mereset penghitung IP
      __setMockTurnstileVerifier(() => true);
      const attackerOwn = await login(ip, { email: attacker, password: validPassword, turnstileToken: 'valid-token' });
      expect(attackerOwn.status).toBe(200);

      const stillBlocked = await login(ip, { email: victim, password: validPassword });
      expect(stillBlocked.status).toBe(400);
      expect(stillBlocked.body.error.code).toBe('TURNSTILE_TOKEN_REQUIRED');
    });

    it('ambang per IP: credential stuffing lintas banyak email memicu CAPTCHA setelah 10 kegagalan', async () => {
      const ip = nextIp();
      for (let i = 1; i <= 10; i += 1) {
        const res = await login(ip, {
          email: `turnstile.stuff.${i}.${Date.now()}@example.com`,
          password: 'WrongPassword123!',
        });
        expect(res.status).toBe(401);
        // Setiap email hanya gagal 1x, jadi hanya ambang IP yang memicu CAPTCHA
        expect(res.body.error.details?.requireCaptcha).toBe(i >= 10);
      }

      const fresh = await createLoginUser();
      const res = await login(ip, { email: fresh, password: validPassword });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TURNSTILE_TOKEN_REQUIRED');

      // IP lain tidak terpengaruh
      const otherIp = await login(nextIp(), { email: fresh, password: validPassword });
      expect(otherIp.status).toBe(200);
    });

    it('sinyal CAPTCHA identik untuk email terdaftar dan tidak terdaftar (tanpa enumerasi akun)', async () => {
      const registered = await createLoginUser();
      const unregistered = `turnstile.ghost.${Date.now()}@example.com`;
      const ipA = nextIp();
      const ipB = nextIp();

      for (let i = 1; i <= 3; i += 1) {
        const a = await login(ipA, { email: registered, password: 'WrongPassword123!' });
        const b = await login(ipB, { email: unregistered, password: 'WrongPassword123!' });
        expect(a.status).toBe(b.status);
        expect(a.body.error.code).toBe(b.body.error.code);
        expect(a.body.error.message).toBe(b.body.error.message);
        expect(a.body.error.details).toEqual(b.body.error.details);
      }

      const a = await login(ipA, { email: registered, password: 'Anything123!' });
      const b = await login(ipB, { email: unregistered, password: 'Anything123!' });
      expect(a.status).toBe(400);
      expect(b.status).toBe(400);
      expect(a.body.error.code).toBe(b.body.error.code);
      expect(a.body.error.message).toBe(b.body.error.message);
      expect(a.body.error.details).toEqual(b.body.error.details);
    });
  });

  describe('5. Production Fail-Closed & Configuration Hardening', () => {
    it('menolak verifikasi di runtime production jika secret tidak ada / tidak valid (500 CONFIGURATION_ERROR)', async () => {
      const origEnv = env.NODE_ENV;
      const origSecret = env.TURNSTILE_SECRET_KEY;
      try {
        (env as any).NODE_ENV = 'production';
        (env as any).TURNSTILE_SECRET_KEY = '';

        await expect(
          verifyTurnstileToken({
            token: 'mock-valid-token-12345',
            remoteIp: '1.2.3.4',
          })
        ).rejects.toMatchObject({
          statusCode: 500,
          code: 'CONFIGURATION_ERROR',
        });
      } finally {
        (env as any).NODE_ENV = origEnv;
        (env as any).TURNSTILE_SECRET_KEY = origSecret;
      }
    });

    it('menolak verifikasi di runtime production jika secret bernilai test dummy Cloudflare (500 CONFIGURATION_ERROR)', async () => {
      const origEnv = env.NODE_ENV;
      const origSecret = env.TURNSTILE_SECRET_KEY;
      try {
        (env as any).NODE_ENV = 'production';
        (env as any).TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

        await expect(
          verifyTurnstileToken({
            token: 'mock-valid-token-12345',
            remoteIp: '1.2.3.4',
          })
        ).rejects.toMatchObject({
          statusCode: 500,
          code: 'CONFIGURATION_ERROR',
        });
      } finally {
        (env as any).NODE_ENV = origEnv;
        (env as any).TURNSTILE_SECRET_KEY = origSecret;
      }
    });

    it('mengizinkan bypass yang disengaja di development ketika secret belum dikonfigurasi', async () => {
      const origEnv = env.NODE_ENV;
      const origSecret = env.TURNSTILE_SECRET_KEY;
      try {
        (env as any).NODE_ENV = 'development';
        (env as any).TURNSTILE_SECRET_KEY = '';

        // Tidak boleh melempar error saat di development tanpa secret
        await expect(
          verifyTurnstileToken({
            token: 'any-token',
            remoteIp: '127.0.0.1',
          })
        ).resolves.toBeUndefined();
      } finally {
        (env as any).NODE_ENV = origEnv;
        (env as any).TURNSTILE_SECRET_KEY = origSecret;
      }
    });

    it('startup validation menolak production jika TURNSTILE_SECRET_KEY hilang atau placeholder dummy', () => {
      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'super_secret_jwt_access_custom_value_999',
          JWT_REFRESH_SECRET: 'super_secret_jwt_refresh_custom_value_999',
          COOKIE_SECRET: 'super_secret_cookie_signing_custom_value_99',
          TURNSTILE_SECRET_KEY: '',
        });
      }).toThrow(/Missing required production environment variables: TURNSTILE_SECRET_KEY/);

      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'super_secret_jwt_access_custom_value_999',
          JWT_REFRESH_SECRET: 'super_secret_jwt_refresh_custom_value_999',
          COOKIE_SECRET: 'super_secret_cookie_signing_custom_value_99',
          TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        });
      }).toThrow(/Insecure default development secrets detected in production for: TURNSTILE_SECRET_KEY/);
    });

    it('startup validation berhasil di production saat TURNSTILE_SECRET_KEY kuat dan sah', () => {
      expect(() => {
        assertProductionSecrets({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'super_secret_jwt_access_custom_value_999',
          JWT_REFRESH_SECRET: 'super_secret_jwt_refresh_custom_value_999',
          COOKIE_SECRET: 'super_secret_cookie_signing_custom_value_99',
          TURNSTILE_SECRET_KEY: '0x4AAAAAAABBBBBBBBCCCCCCCCDDDDDDDDEE',
        });
      }).not.toThrow();
    });
  });
});
