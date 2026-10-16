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
import { __setTestGoogleAuthMock } from '../services/googleAuth.service.js';

describe('Email Verification Integration & Security Tests', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  const cleanUsers = async () => {
    await prisma.emailVerificationToken.deleteMany({
      where: {
        user: {
          email: { contains: 'verify.' },
        },
      },
    });
    await prisma.passwordResetToken.deleteMany({
      where: {
        user: {
          email: { contains: 'verify.' },
        },
      },
    });
    await prisma.refreshSession.deleteMany({
      where: {
        user: {
          email: { contains: 'verify.' },
        },
      },
    });
    await prisma.federatedIdentity.deleteMany({
      where: {
        user: {
          email: { contains: 'verify.' },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'verify.' },
      },
    });
  };

  beforeEach(async () => {
    __clearSentTestEmails();
    __setTestGoogleAuthMock(null);
    await cleanUsers();
  });

  afterAll(async () => {
    __clearSentTestEmails();
    __setTestGoogleAuthMock(null);
    await cleanUsers();
    await prisma.$disconnect();
  });

  // Helper to register and log in a user with session cookies
  const createLoggedInUser = async (customEmail?: string) => {
    const email = customEmail || `verify.user.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
    const password = 'SecurePassword123!';

    const regRes = await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Verify Test User',
        email,
        password,
        timezone: 'Asia/Jakarta',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.user.emailVerifiedAt).toBeNull();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const accessTokenCookie = cookies.find((c) => c.startsWith(`${COOKIE_NAMES.accessToken}=`));

    return {
      userId: regRes.body.user.id,
      email,
      cookies,
      accessTokenCookie,
    };
  };

  describe('1. POST /api/auth/verify-email/request', () => {
    it('menolak permintaan jika pengguna belum terautentikasi (401)', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN);

      expect(res.status).toBe(401);
      expect(__getSentTestEmails()).toHaveLength(0);
    });

    it('mengirim email verifikasi ke email akun dan menyimpan hash token di database', async () => {
      const { email, cookies } = await createLoggedInUser();

      const res = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Email verifikasi telah dikirim');

      const sentEmails = __getSentTestEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(email);
      expect(sentEmails[0].subject).toContain('Verifikasi Alamat Email');
      expect(sentEmails[0].text).toContain('/verify-email?token=');

      // Verify token in database is hashed
      const tokens = await prisma.emailVerificationToken.findMany({
        where: { email },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].usedAt).toBeNull();
      expect(tokens[0].tokenHash).toHaveLength(64); // SHA-256 hex length
    });

    it('alamat tujuan diambil dari akun bukan input client bebas (tidak ada parameter target email)', async () => {
      const { email, cookies } = await createLoggedInUser();

      // Attempt to spoof target email in body
      const res = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies)
        .send({ email: 'victim@otherdomain.com' });

      expect(res.status).toBe(200);

      // Email MUST still be sent ONLY to the authenticated account's email
      const sentEmails = __getSentTestEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(email);
      expect(sentEmails[0].to).not.toBe('victim@otherdomain.com');
    });

    it('melakukan escape HTML pada nama pengguna di template email untuk mencegah XSS/injection', async () => {
      const maliciousName = 'Budi <b>Peretas</b> <script>alert(1)</script>';
      const email = `verify.xss.${Date.now()}@example.com`;
      const password = 'SecurePassword123!';

      const regRes = await request(app)
        .post('/api/auth/register')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          name: maliciousName,
          email,
          password,
        });
      expect(regRes.status).toBe(201);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ email, password });
      expect(loginRes.status).toBe(200);

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];

      const reqRes = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);
      expect(reqRes.status).toBe(200);

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

    it('menerapkan cooldown 60 detik jika meminta ulang terlalu cepat (429)', async () => {
      const { cookies } = await createLoggedInUser();

      // First request succeeds
      const firstRes = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);
      expect(firstRes.status).toBe(200);

      // Immediate second request hits cooldown
      const secondRes = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      expect(secondRes.status).toBe(429);
      expect(secondRes.body.error.code).toBe('VERIFICATION_COOLDOWN_ACTIVE');
    });

    it('akun yang sudah terverifikasi tidak dikirimi email baru', async () => {
      const { email, cookies, userId } = await createLoggedInUser();

      // Mark account verified directly in db
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });

      const res = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('sudah terverifikasi');
      expect(__getSentTestEmails()).toHaveLength(0);
    });

    it('resend membatalkan token sebelumnya yang belum digunakan', async () => {
      const { email, cookies, userId } = await createLoggedInUser();

      // Manually create an older token that is beyond the 60s cooldown
      const oldToken = 'oldtoken'.repeat(8);
      const oldTokenHash = crypto.createHash('sha256').update(oldToken).digest('hex');
      await prisma.emailVerificationToken.create({
        data: {
          userId,
          email,
          tokenHash: oldTokenHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          createdAt: new Date(Date.now() - 70 * 1000), // 70 seconds ago
        },
      });

      // Request new verification email
      const res = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);

      // Verify old token is marked as usedAt (invalidated)
      const oldTokenRecord = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: oldTokenHash },
      });
      expect(oldTokenRecord?.usedAt).not.toBeNull();
    });

    it('menangani kegagalan transport email dengan 503 tanpa pesan sukses palsu', async () => {
      const { cookies } = await createLoggedInUser();

      __setMockEmailFailure(new Error('SMTP connection refused'));

      const res = await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('EMAIL_SEND_FAILED');
    });
  });

  describe('2. POST /api/auth/verify-email/confirm', () => {
    it('berhasil memverifikasi email dengan token yang valid dan memperbarui emailVerifiedAt', async () => {
      const { email, cookies, userId } = await createLoggedInUser();

      await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      const sentEmails = __getSentTestEmails();
      const match = sentEmails[0].text.match(/token=([a-f0-9]+)/);
      expect(match).not.toBeNull();
      const rawToken = match![1];

      // Confirm verification
      const confirmRes = await request(app)
        .post('/api/auth/verify-email/confirm')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ token: rawToken });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.message).toContain('berhasil diverifikasi');
      expect(confirmRes.body.user.emailVerifiedAt).not.toBeNull();

      // Database check
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.emailVerifiedAt).not.toBeNull();

      // Token marked used
      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { userId },
      });
      expect(tokenRecord?.usedAt).not.toBeNull();
    });

    it('menolak token yang tidak ada / invalid (400)', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email/confirm')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ token: 'invalidrandomtoken'.repeat(3) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });

    it('menolak token yang sudah kedaluwarsa (expired) (400)', async () => {
      const { email, userId } = await createLoggedInUser();

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.emailVerificationToken.create({
        data: {
          userId,
          email,
          tokenHash,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const res = await request(app)
        .post('/api/auth/verify-email/confirm')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ token: rawToken });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });

    it('menolak replay token yang sudah pernah digunakan (400)', async () => {
      const { cookies, userId } = await createLoggedInUser();

      await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      const rawToken = __getSentTestEmails()[0].text.match(/token=([a-f0-9]+)/)![1];

      // First use succeeds
      const firstRes = await request(app)
        .post('/api/auth/verify-email/confirm')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ token: rawToken });
      expect(firstRes.status).toBe(200);

      // Replay attempt fails
      const replayRes = await request(app)
        .post('/api/auth/verify-email/confirm')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ token: rawToken });

      expect(replayRes.status).toBe(400);
      expect(replayRes.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });

    it('menolak token reset password sebagai token verifikasi email (isolasi token)', async () => {
      const { email, userId } = await createLoggedInUser();

      // Create a password reset token for this user
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash: resetTokenHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      // Submit reset token to email verification confirm
      const res = await request(app)
        .post('/api/auth/verify-email/confirm')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ token: rawResetToken });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.emailVerifiedAt).toBeNull();
    });

    it('menolak token verifikasi email sebagai token reset password (isolasi dua arah)', async () => {
      const { email, userId } = await createLoggedInUser();

      const rawVerifyToken = crypto.randomBytes(32).toString('hex');
      const verifyTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');

      await prisma.emailVerificationToken.create({
        data: {
          userId,
          email,
          tokenHash: verifyTokenHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      // Submit email verification token to reset-password
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          token: rawVerifyToken,
          newPassword: 'BrandNewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });

    it('konsumsi token bersamaan (concurrent) hanya menghasilkan satu keberhasilan', async () => {
      const { cookies, userId } = await createLoggedInUser();

      await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      const rawToken = __getSentTestEmails()[0].text.match(/token=([a-f0-9]+)/)![1];

      // Run 2 parallel requests
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/auth/verify-email/confirm')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ token: rawToken }),
        request(app)
          .post('/api/auth/verify-email/confirm')
          .set('Origin', TRUSTED_ORIGIN)
          .send({ token: rawToken }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 400]);
    });

    it('verifikasi email tidak mengubah password, tidak mencabut sesi, dan tidak menerbitkan sesi baru', async () => {
      const { cookies, userId, email } = await createLoggedInUser();

      const userBefore = await prisma.user.findUnique({ where: { id: userId } });
      const passwordHashBefore = userBefore?.passwordHash;
      const tokenVersionBefore = userBefore?.tokenVersion;

      await request(app)
        .post('/api/auth/verify-email/request')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      const rawToken = __getSentTestEmails()[0].text.match(/token=([a-f0-9]+)/)![1];

      const confirmRes = await request(app)
        .post('/api/auth/verify-email/confirm')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ token: rawToken });

      expect(confirmRes.status).toBe(200);
      // No set-cookie header on confirm
      expect(confirmRes.headers['set-cookie']).toBeUndefined();

      const userAfter = await prisma.user.findUnique({ where: { id: userId } });
      expect(userAfter?.passwordHash).toBe(passwordHashBefore);
      expect(userAfter?.tokenVersion).toBe(tokenVersionBefore);

      // Existing session remains valid
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.emailVerifiedAt).not.toBeNull();
    });
  });

  describe('3. Google OAuth email verified claim handling', () => {
    it('Google verified diterima dan menandai emailVerifiedAt saat email_verified true dan email cocok', async () => {
      const googleSub = `google-sub-${Date.now()}`;
      const googleEmail = `verify.google.${Date.now()}@example.com`;

      __setTestGoogleAuthMock(async () => ({
        iss: 'https://accounts.google.com',
        sub: googleSub,
        aud: 'test-client-id',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: googleEmail,
        email_verified: true,
        name: 'Google Verified User',
        nonce: 'valid-test-nonce',
      }));

      const exchangeRes = await request(app)
        .post('/api/auth/google/exchange')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          code: 'mock-auth-code',
          codeVerifier: 'mock-code-verifier',
          nonce: 'valid-test-nonce',
          redirectUri: 'http://localhost:3000/api/auth/google/callback',
          intent: 'login',
        });

      expect(exchangeRes.status).toBe(200);
      expect(exchangeRes.body.user.emailVerifiedAt).not.toBeNull();

      const user = await prisma.user.findUnique({ where: { email: googleEmail } });
      expect(user?.emailVerifiedAt).not.toBeNull();
    });

    it('Google link menandai akun terverifikasi jika email Google cocok persis dan email_verified true', async () => {
      const { cookies, email, userId } = await createLoggedInUser();

      const googleSub = `google-sub-link-${Date.now()}`;
      __setTestGoogleAuthMock(async () => ({
        iss: 'https://accounts.google.com',
        sub: googleSub,
        aud: 'test-client-id',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        email, // Matches exactly
        email_verified: true,
        name: 'Linked User',
        nonce: 'valid-test-nonce',
      }));

      const linkRes = await request(app)
        .post('/api/auth/google/exchange')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookies)
        .send({
          code: 'mock-auth-code',
          codeVerifier: 'mock-code-verifier',
          nonce: 'valid-test-nonce',
          redirectUri: 'http://localhost:3000/api/auth/google/callback',
          intent: 'link',
        });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.user.emailVerifiedAt).not.toBeNull();

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.emailVerifiedAt).not.toBeNull();
    });
  });
});
