import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { COOKIE_NAMES } from '@studyflow/shared';
import {
  __getSentTestEmails,
  __clearSentTestEmails,
  __setMockEmailFailure,
} from '../services/email.service.js';
import { hashPassword } from '../services/password.service.js';

describe('Password Reset Integration & Security Tests', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  const cleanUsers = async () => {
    await prisma.passwordResetToken.deleteMany({
      where: {
        user: {
          email: { contains: 'pwreset.' },
        },
      },
    });
    await prisma.refreshSession.deleteMany({
      where: {
        user: {
          email: { contains: 'pwreset.' },
        },
      },
    });
    await prisma.federatedIdentity.deleteMany({
      where: {
        user: {
          email: { contains: 'pwreset.' },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'pwreset.' },
      },
    });
  };

  beforeEach(async () => {
    __clearSentTestEmails();
    await cleanUsers();
  });

  afterAll(async () => {
    __clearSentTestEmails();
    await cleanUsers();
    await prisma.$disconnect();
  });

  describe('1. POST /api/auth/forgot-password', () => {
    it('mengirim email reset untuk akun dengan password lokal dan menyimpan hash token', async () => {
      const email = `pwreset.local.${Date.now()}@example.com`;
      const user = await prisma.user.create({
        data: {
          name: 'Local User',
          email,
          passwordHash: await hashPassword('CurrentValidPassword123!'),
        },
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        'Jika akun memenuhi syarat, tautan reset password akan dikirim ke email tersebut.'
      );

      // Verify email was sent via mock
      const sentEmails = __getSentTestEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(email);
      expect(sentEmails[0].subject).toContain('Atur Ulang Kata Sandi');
      expect(sentEmails[0].text).toContain('/reset-password?token=');

      // Verify token in database is hashed (never plain token)
      const urlMatch = sentEmails[0].text.match(/token=([a-f0-9]{64})/);
      expect(urlMatch).not.toBeNull();
      const rawToken = urlMatch![1];
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const dbToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      expect(dbToken).toBeDefined();
      expect(dbToken?.userId).toBe(user.id);
      expect(dbToken?.usedAt).toBeNull();
      expect(new Date(dbToken!.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('melakukan escape HTML pada nama pengguna di template email reset kata sandi', async () => {
      const maliciousName = 'Budi <b>Peretas</b> <script>alert(1)</script>';
      const email = `pwreset.xss.${Date.now()}@example.com`;
      await prisma.user.create({
        data: {
          name: maliciousName,
          email,
          passwordHash: await hashPassword('ValidPassword123!'),
        },
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });

      expect(res.status).toBe(200);

      const sentEmails = __getSentTestEmails();
      expect(sentEmails.length).toBeGreaterThanOrEqual(1);
      const emailObj = sentEmails[sentEmails.length - 1];

      // HTML body must be escaped
      expect(emailObj.html).toBeDefined();
      expect(emailObj.html).toContain('&lt;b&gt;Peretas&lt;/b&gt; &lt;script&gt;alert(1)&lt;/script&gt;');
      expect(emailObj.html).not.toContain('<script>alert(1)</script>');
      expect(emailObj.html).not.toContain('<b>Peretas</b>');

      // Plain text must remain as unescaped raw string
      expect(emailObj.text).toContain(maliciousName);
    });

    it('mengembalikan respons identik untuk email yang tidak terdaftar tanpa mengirim email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email: 'pwreset.nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        'Jika akun memenuhi syarat, tautan reset password akan dikirim ke email tersebut.'
      );

      expect(__getSentTestEmails()).toHaveLength(0);
    });

    it('mengembalikan respons identik untuk akun Google-only tanpa mengirim email reset', async () => {
      const email = `pwreset.googleonly.${Date.now()}@example.com`;
      const googleUser = await prisma.user.create({
        data: {
          name: 'Google Only User',
          email,
          passwordHash: null,
          federatedIdentities: {
            create: {
              provider: 'google',
              subject: `g-sub-${Date.now()}`,
              email,
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        'Jika akun memenuhi syarat, tautan reset password akan dikirim ke email tersebut.'
      );

      expect(__getSentTestEmails()).toHaveLength(0);
      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: googleUser.id },
      });
      expect(tokens).toHaveLength(0);
    });

    it('mengizinkan reset untuk akun password yang juga terhubung ke Google', async () => {
      const email = `pwreset.hybrid.${Date.now()}@example.com`;
      await prisma.user.create({
        data: {
          name: 'Hybrid User',
          email,
          passwordHash: await hashPassword('LocalPass12345!'),
          federatedIdentities: {
            create: {
              provider: 'google',
              subject: `g-hybrid-${Date.now()}`,
              email,
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });

      expect(res.status).toBe(200);
      expect(__getSentTestEmails()).toHaveLength(1);
      expect(__getSentTestEmails()[0].to).toBe(email);
    });

    it('menerapkan cooldown: pengiriman dalam rentang 60 detik tidak menduplikasi email atau token aktif', async () => {
      const email = `pwreset.cooldown.${Date.now()}@example.com`;
      const user = await prisma.user.create({
        data: {
          name: 'Cooldown User',
          email,
          passwordHash: await hashPassword('LocalPass12345!'),
        },
      });

      // Request 1
      const res1 = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });
      expect(res1.status).toBe(200);
      expect(__getSentTestEmails()).toHaveLength(1);

      // Request 2 immediately
      const res2 = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });
      expect(res2.status).toBe(200);
      // Masih 1 email terkirim (cooldown mencegah spam)
      expect(__getSentTestEmails()).toHaveLength(1);

      const activeTokens = await prisma.passwordResetToken.findMany({
        where: { userId: user.id, usedAt: null },
      });
      expect(activeTokens).toHaveLength(1);
    });

    it('resend membatalkan token sebelumnya jika dibuat di luar cooldown', async () => {
      const email = `pwreset.resend.${Date.now()}@example.com`;
      const user = await prisma.user.create({
        data: {
          name: 'Resend User',
          email,
          passwordHash: await hashPassword('LocalPass12345!'),
        },
      });

      // Create previous token created 2 minutes ago
      const oldRawToken = crypto.randomBytes(32).toString('hex');
      const oldTokenHash = crypto.createHash('sha256').update(oldRawToken).digest('hex');
      const oldToken = await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: oldTokenHash,
          expiresAt: new Date(Date.now() + 28 * 60_000),
          createdAt: new Date(Date.now() - 120_000), // 2 minutes ago
        },
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });

      expect(res.status).toBe(200);
      expect(__getSentTestEmails()).toHaveLength(1);

      // Old token must be invalidated (usedAt not null)
      const refreshedOldToken = await prisma.passwordResetToken.findUnique({
        where: { id: oldToken.id },
      });
      expect(refreshedOldToken?.usedAt).not.toBeNull();

      // Only the new token is active
      const activeTokens = await prisma.passwordResetToken.findMany({
        where: { userId: user.id, usedAt: null },
      });
      expect(activeTokens).toHaveLength(1);
      expect(activeTokens[0].id).not.toBe(oldToken.id);
    });

    it('kegagalan pengiriman email dicatat aman dan tetap mengembalikan pesan generik yang sama', async () => {
      const email = `pwreset.smtpfail.${Date.now()}@example.com`;
      await prisma.user.create({
        data: {
          name: 'SMTP Fail User',
          email,
          passwordHash: await hashPassword('LocalPass12345!'),
        },
      });

      __setMockEmailFailure(new Error('Koneksi SMTP terputus (Mock Error)'));

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });

      // Tetap 200 dengan pesan generik
      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        'Jika akun memenuhi syarat, tautan reset password akan dikirim ke email tersebut.'
      );
    });
  });

  describe('2. POST /api/auth/reset-password', () => {
    it('berhasil mereset password, membatalkan token, dan mencabut seluruh sesi aktif', async () => {
      const email = `pwreset.consume.${Date.now()}@example.com`;
      const initialPassword = 'OldSecurePassword123!';
      const newPassword = 'NewBrandSecurePassword456!';

      const user = await prisma.user.create({
        data: {
          name: 'Reset Consumer',
          email,
          passwordHash: await hashPassword(initialPassword),
          tokenVersion: 1,
        },
      });

      // Login to obtain active session
      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email, password: initialPassword });
      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();

      // Request reset token
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email });
      expect(forgotRes.status).toBe(200);

      const sentEmails = __getSentTestEmails();
      const rawToken = sentEmails[0].text.match(/token=([a-f0-9]{64})/)![1];

      // Submit password reset
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          token: rawToken,
          newPassword,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.message).toContain('berhasil diatur ulang');

      // 1. Password lama sekarang harus ditolak
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email, password: initialPassword });
      expect(oldLogin.status).toBe(401);

      // 2. Password baru berhasil login
      const newLogin = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email, password: newPassword });
      expect(newLogin.status).toBe(200);

      // 3. Token sekali pakai: percobaan kedua dengan token sama harus ditolak
      const replayRes = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          token: rawToken,
          newPassword: 'AnotherNewPassword789!',
        });
      expect(replayRes.status).toBe(400);
      expect(replayRes.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');

      // 4. Sesi lama dicabut: refresh token lama ditolak
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies)
        .send();
      expect(refreshRes.status).toBe(401);

      // 5. Token version dinaikkan
      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updatedUser?.tokenVersion).toBeGreaterThan(1);
    });

    it('menolak token yang kedaluwarsa (>30 menit)', async () => {
      const email = `pwreset.expired.${Date.now()}@example.com`;
      const user = await prisma.user.create({
        data: {
          name: 'Expired Token User',
          email,
          passwordHash: await hashPassword('LocalPass12345!'),
        },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          token: rawToken,
          newPassword: 'BrandNewValidPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });

    it('menolak token yang tidak ada / invalid', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          token: 'invalid-nonexistent-token-with-minimum-length-32-chars-12345678',
          newPassword: 'BrandNewValidPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });

    it('dua konsumsi token bersamaan (parallel race condition) menghasilkan tepat 1 keberhasilan', async () => {
      const email = `pwreset.race.${Date.now()}@example.com`;
      const user = await prisma.user.create({
        data: {
          name: 'Race User',
          email,
          passwordHash: await hashPassword('InitPass123456!'),
        },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });

      // Send 2 concurrent requests with the identical token
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/auth/reset-password')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ token: rawToken, newPassword: 'WinnerPassword123!' }),
        request(app)
          .post('/api/auth/reset-password')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ token: rawToken, newPassword: 'SecondWinnerPassword123!' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one request must succeed (200), and the other must be rejected (400)
      expect(statuses).toEqual([200, 400]);

      // Exactly one consumed token
      const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
      expect(token?.usedAt).not.toBeNull();
    });

    it('pengubahan password melalui Settings (change-password) membatalkan token reset yang masih aktif', async () => {
      const email = `pwreset.settings.${Date.now()}@example.com`;
      const initialPass = 'SettingsInitialPassword123!';
      const newSettingsPass = 'SettingsNewPassword456!';

      const user = await prisma.user.create({
        data: {
          name: 'Settings Invalidate User',
          email,
          passwordHash: await hashPassword(initialPass),
        },
      });

      // Login to get access token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email, password: initialPass });
      const accessToken = loginRes.body.accessToken;

      // Create an active reset token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });

      // Change password through Settings endpoint
      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: initialPass,
          newPassword: newSettingsPass,
        });
      expect(changeRes.status).toBe(200);

      // Verify the active reset token was automatically invalidated
      const resetTokenDb = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      expect(resetTokenDb?.usedAt).not.toBeNull();

      // Attempting to consume this token now must be rejected
      const resetAttempt = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          token: rawToken,
          newPassword: 'AttemptAfterSettingsPasswordChange123!',
        });
      expect(resetAttempt.status).toBe(400);
      expect(resetAttempt.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });
  });
});
