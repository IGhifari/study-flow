import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { COOKIE_NAMES } from '@studyflow/shared';
import { __setTestGoogleAuthMock } from '../services/googleAuth.service.js';

describe('Google OAuth Integration & Security Tests', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  beforeEach(async () => {
    // Reset test mock before each test
    __setTestGoogleAuthMock(null);

    // Clean up test data
    await prisma.federatedIdentity.deleteMany({
      where: {
        OR: [
          { email: { contains: 'google.test.' } },
          { email: { contains: 'existing.password.' } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'google.test.' } },
          { email: { contains: 'existing.password.' } },
        ],
      },
    });
  });

  afterAll(async () => {
    __setTestGoogleAuthMock(null);
    await prisma.federatedIdentity.deleteMany({
      where: {
        OR: [
          { email: { contains: 'google.test.' } },
          { email: { contains: 'existing.password.' } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'google.test.' } },
          { email: { contains: 'existing.password.' } },
        ],
      },
    });
    await prisma.$disconnect();
  });

  it('GET /api/auth/google/status should return configured status', async () => {
    const res = await request(app).get('/api/auth/google/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('configured');
    expect(typeof res.body.configured).toBe('boolean');
  });

  it('GET /api/auth/google/url should generate PKCE authorization params with S256 challenge', async () => {
    const res = await request(app).get('/api/auth/google/url');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(res.body.url).toContain('code_challenge_method=S256');
    expect(res.body.state).toBeDefined();
    expect(res.body.nonce).toBeDefined();
    expect(res.body.codeVerifier).toBeDefined();
  });

  it('Should register new user via Google, issue StudyFlow session, and support re-login with same identity', async () => {
    const mockGoogleSub = `sub_${Date.now()}`;
    const mockEmail = `google.test.${Date.now()}@example.com`;
    const mockNonce = 'test-nonce-123';

    __setTestGoogleAuthMock(async (code) => {
      if (code === 'valid-auth-code') {
        return {
          iss: 'https://accounts.google.com',
          sub: mockGoogleSub,
          aud: 'test-client-id',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          email: mockEmail,
          email_verified: true,
          name: 'Mahasiswa Google Baru',
          nonce: mockNonce,
        };
      }
      return null;
    });

    // 1. Initial Google sign-in (Registration)
    const res1 = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        code: 'valid-auth-code',
        codeVerifier: 'mock-verifier',
        nonce: mockNonce,
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'login',
      });

    expect(res1.status).toBe(200);
    expect(res1.body.user).toBeDefined();
    expect(res1.body.user.email).toBe(mockEmail);
    expect(res1.body.user.name).toBe('Mahasiswa Google Baru');
    expect(res1.body.user.hasPassword).toBe(false);
    expect(res1.body.user.providers).toContain('google');
    expect(res1.body.accessToken).toBeDefined();

    // Verify Set-Cookie headers for access token and refresh token
    const cookies1 = res1.headers['set-cookie'] as unknown as string[];
    expect(cookies1).toBeDefined();
    expect(cookies1.some((c) => c.includes(COOKIE_NAMES.accessToken))).toBe(true);
    expect(cookies1.some((c) => c.includes(COOKIE_NAMES.refreshToken))).toBe(true);

    const createdUserId = res1.body.user.id;

    // 2. Subsequent Google sign-in (Re-login) should resolve to the SAME user without duplication
    const res2 = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        code: 'valid-auth-code',
        codeVerifier: 'mock-verifier',
        nonce: mockNonce,
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'login',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.user.id).toBe(createdUserId);
    expect(res2.body.user.email).toBe(mockEmail);

    // Verify only ONE user and ONE federated identity exists
    const usersCount = await prisma.user.count({ where: { email: mockEmail } });
    expect(usersCount).toBe(1);

    const identitiesCount = await prisma.federatedIdentity.count({
      where: { provider: 'google', subject: mockGoogleSub },
    });
    expect(identitiesCount).toBe(1);
  });

  it('Should reject automatic merging when email already exists with password', async () => {
    const existingEmail = `existing.password.${Date.now()}@example.com`;
    const password = 'PasswordAman1234!';

    // Register existing user with password
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Existing Password User',
        email: existingEmail,
        password,
      });

    const mockNonce = 'test-nonce-conflict';
    __setTestGoogleAuthMock(async () => ({
      iss: 'https://accounts.google.com',
      sub: `unlinked_sub_${Date.now()}`,
      aud: 'test-client-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: existingEmail,
      email_verified: true,
      name: 'Google Impersonator',
      nonce: mockNonce,
    }));

    // Attempt to login with Google for an unlinked email
    const res = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        code: 'any-code',
        codeVerifier: 'any-verifier',
        nonce: mockNonce,
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'login',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_LINKED');
    expect(res.body.error.message).toContain('sudah terdaftar menggunakan password');

    // Verify identity was NOT linked automatically
    const identity = await prisma.federatedIdentity.findFirst({
      where: { email: existingEmail },
    });
    expect(identity).toBeNull();
  });

  it('Should link Google account after re-authentication and reject mismatched email or foreign identity', async () => {
    const userEmail = `existing.password.${Date.now()}@example.com`;
    const password = 'PasswordAman1234!';

    // Register and login user
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'User To Link',
        email: userEmail,
        password,
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: userEmail,
        password,
      });

    const userAccessToken = loginRes.body.accessToken;
    expect(userAccessToken).toBeDefined();

    // 1. Re-authentication test with wrong password should fail
    const badReauthRes = await request(app)
      .post('/api/auth/google/link/init')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({ currentPassword: 'WrongPassword999!' });

    expect(badReauthRes.status).toBe(400);
    expect(badReauthRes.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    // 2. Re-authentication test with correct password succeeds
    const goodReauthRes = await request(app)
      .post('/api/auth/google/link/init')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({ currentPassword: password });

    expect(goodReauthRes.status).toBe(200);
    expect(goodReauthRes.body.codeVerifier).toBeDefined();

    const googleSub = `link_sub_${Date.now()}`;
    const nonce = 'link-nonce-123';

    // 3. Reject linking if Google email does not match user account email
    __setTestGoogleAuthMock(async () => ({
      iss: 'https://accounts.google.com',
      sub: googleSub,
      aud: 'test-client-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'different.email@example.com',
      email_verified: true,
      name: 'Different Email Google',
      nonce,
    }));

    const mismatchRes = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        code: 'mismatch-code',
        codeVerifier: 'verifier',
        nonce,
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'link',
      });

    expect(mismatchRes.status).toBe(400);
    expect(mismatchRes.body.error.code).toBe('EMAIL_MISMATCH');

    // 4. Successful linking when Google email matches user account email
    __setTestGoogleAuthMock(async () => ({
      iss: 'https://accounts.google.com',
      sub: googleSub,
      aud: 'test-client-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: userEmail,
      email_verified: true,
      name: 'Matching Email Google',
      nonce,
    }));

    const linkSuccessRes = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        code: 'link-code',
        codeVerifier: 'verifier',
        nonce,
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'link',
      });

    expect(linkSuccessRes.status).toBe(200);
    expect(linkSuccessRes.body.user.providers).toContain('google');
    expect(linkSuccessRes.body.user.hasPassword).toBe(true);

    // 5. Subsequent attempt to link the SAME Google identity to a DIFFERENT user is rejected
    const otherEmail = `existing.password.${Date.now()}_other@example.com`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Other User',
        email: otherEmail,
        password,
      });

    const otherLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ email: otherEmail, password });

    const otherToken = otherLogin.body.accessToken;

    __setTestGoogleAuthMock(async () => ({
      iss: 'https://accounts.google.com',
      sub: googleSub, // same sub already linked to first user!
      aud: 'test-client-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: otherEmail,
      email_verified: true,
      name: 'Hijacker',
      nonce,
    }));

    const foreignLinkRes = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        code: 'hijack-code',
        codeVerifier: 'verifier',
        nonce,
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'link',
      });

    expect(foreignLinkRes.status).toBe(409);
    expect(foreignLinkRes.body.error.code).toBe('IDENTITY_ALREADY_LINKED');
  });

  it('Should reject invalid nonce, unverified email, or expired/rejected provider code', async () => {
    // 1. Nonce mismatch
    __setTestGoogleAuthMock(async () => ({
      iss: 'https://accounts.google.com',
      sub: 'sub-nonce-test',
      aud: 'test-client-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'test@example.com',
      email_verified: true,
      nonce: 'wrong-nonce',
    }));

    const res1 = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        code: 'code',
        codeVerifier: 'verifier',
        nonce: 'expected-nonce',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'login',
      });

    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe('OAUTH_NONCE_MISMATCH');

    // 2. Unverified email
    __setTestGoogleAuthMock(async () => ({
      iss: 'https://accounts.google.com',
      sub: 'sub-unverified-test',
      aud: 'test-client-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'unverified@example.com',
      email_verified: false,
      nonce: 'valid-nonce',
    }));

    const res2 = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        code: 'code',
        codeVerifier: 'verifier',
        nonce: 'valid-nonce',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'login',
      });

    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    // 3. Provider error (code invalid or expired)
    __setTestGoogleAuthMock(async () => null);

    const res3 = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        code: 'expired-or-bad-code',
        codeVerifier: 'verifier',
        nonce: 'valid-nonce',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'login',
      });

    expect(res3.status).toBe(400);
    expect(res3.body.error.code).toBe('OAUTH_PROVIDER_ERROR');
  });

  it('Google-only user should not crash when attempting password login or password change', async () => {
    const googleEmail = `google.test.${Date.now()}@example.com`;
    const googleSub = `sub_pwdless_${Date.now()}`;
    const nonce = 'pwdless-nonce';

    __setTestGoogleAuthMock(async () => ({
      iss: 'https://accounts.google.com',
      sub: googleSub,
      aud: 'test-client-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: googleEmail,
      email_verified: true,
      name: 'Passwordless User',
      nonce,
    }));

    // Register via Google
    const registerRes = await request(app)
      .post('/api/auth/google/exchange')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        code: 'code',
        codeVerifier: 'verifier',
        nonce,
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        intent: 'login',
      });

    expect(registerRes.status).toBe(200);
    const googleAccessToken = registerRes.body.accessToken;

    // 1. Password login attempt should return generic 401 without crashing
    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: googleEmail,
        password: 'RandomPassword123!',
      });

    expect(loginAttempt.status).toBe(401);
    expect(loginAttempt.body.error.code).toBe('INVALID_CREDENTIALS');

    // 2. Change password attempt should gracefully reject without crashing
    const changePwdAttempt = await request(app)
      .post('/api/auth/change-password')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${googleAccessToken}`)
      .send({
        currentPassword: 'RandomPassword123!',
        newPassword: 'NewStrongPassword123!',
      });

    expect(changePwdAttempt.status).toBe(400);
    expect(changePwdAttempt.body.error.code).toBe('PASSWORD_NOT_SET');
  });
});
