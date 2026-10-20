import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { COOKIE_NAMES } from '@studyflow/shared';

describe('Express Authentication Endpoints', () => {
  const app = createApp();
  const testEmail = `test.user.${Date.now()}@example.com`;
  const testPassword = 'PasswordSangatKuat123!';
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  beforeEach(async () => {
    // Clean up test users created during test runs
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'test.user.' },
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'test.user.' },
      },
    });
    await prisma.$disconnect();
  });

  it('POST /api/auth/register should create a user and not leak password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Mahasiswa Test',
        email: testEmail,
        password: testPassword,
        timezone: 'Asia/Jakarta',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.user.name).toBe('Mahasiswa Test');
    expect(res.body.user.timezone).toBe('Asia/Jakarta');

    // Never leak passwordHash
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('POST /api/auth/register should reject duplicate emails case-insensitively', async () => {
    // First register
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'User 1',
        email: testEmail.toLowerCase(),
        password: testPassword,
      });

    // Try registering with uppercase variation
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'User 2',
        email: testEmail.toUpperCase(),
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('POST /api/auth/register should reject password shorter than 12 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Short Password User',
        email: `short.${Date.now()}@example.com`,
        password: 'short123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/auth/login should authenticate valid user and set cookies', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Login User',
        email: testEmail,
        password: testPassword,
      });

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.accessToken).toBeDefined();

    // Check Set-Cookie headers
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const cookieHeaderStr = cookies.join('; ');
    expect(cookieHeaderStr).toContain(COOKIE_NAMES.accessToken);
    expect(cookieHeaderStr).toContain(COOKIE_NAMES.refreshToken);
    expect(cookieHeaderStr).toContain('HttpOnly');
  });

  it('POST /api/auth/login should return generic error on invalid password or email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Email atau password tidak sesuai');
  });

  it('GET /api/auth/me should return 401 without token and 200 with valid token', async () => {
    // Without token
    const resNoToken = await request(app).get('/api/auth/me');
    expect(resNoToken.status).toBe(401);

    // Register & Login
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Me User',
        email: testEmail,
        password: testPassword,
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: testPassword,
      });

    const accessToken = loginRes.body.accessToken;

    const resAuth = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(resAuth.status).toBe(200);
    expect(resAuth.body.user.email).toBe(testEmail.toLowerCase());
    expect(resAuth.body.user.name).toBe('Me User');
  });

  it('PATCH /api/auth/me should update profile for authenticated user', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Old Name',
        email: testEmail,
        password: testPassword,
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: testPassword,
      });

    const updateRes = await request(app)
      .patch('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({
        name: 'New Name',
        timezone: 'Asia/Makassar',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.name).toBe('New Name');
    expect(updateRes.body.user.timezone).toBe('Asia/Makassar');
  });

  it('POST /api/auth/refresh should rotate refresh token and support concurrent grace period', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Rotate User',
        email: testEmail,
        password: testPassword,
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: testPassword,
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c: string) => c.startsWith(`${COOKIE_NAMES.refreshToken}=`));
    const rawRefreshToken = refreshCookie?.split(';')[0]?.split('=')[1];

    expect(rawRefreshToken).toBeDefined();

    // 1. First rotation (Request 1 / Tab 1)
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    // 2. Concurrent request / second tab sending the same old token within grace period (15s)
    const concurrentRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);

    // Grace period allows second tab to obtain an access token without revoking the session family!
    expect(concurrentRes.status).toBe(200);
    expect(concurrentRes.body.accessToken).toBeDefined();

    // 3. Replay attack: Simulate token reuse outside grace period (>15s)
    // Manually push revokedAt back to 20 seconds ago in DB
    const tokenHash = (await import('../services/token.service.js')).hashToken(rawRefreshToken!);
    await prisma.refreshSession.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date(Date.now() - 20_000) },
    });

    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('SESSION_REPLAY_DETECTED');
  });

  it('POST /api/auth/logout should revoke session and clear cookies', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Logout User',
        email: testEmail,
        password: testPassword,
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: testPassword,
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c: string) => c.startsWith(`${COOKIE_NAMES.refreshToken}=`));
    const rawRefreshToken = refreshCookie?.split(';')[0]?.split('=')[1];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);

    expect(logoutRes.status).toBe(200);

    // After logout, refreshing with that token must fail
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);

    expect(refreshRes.status).toBe(401);
  });

  it('POST /api/auth/change-password should revoke all existing sessions and access tokens', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Password User',
        email: testEmail,
        password: testPassword,
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: testPassword,
      });

    const oldAccessToken = loginRes.body.accessToken;

    // Change password
    const newPassword = 'PasswordBaruYangKuat456!';
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${oldAccessToken}`)
      .send({
        currentPassword: testPassword,
        newPassword,
      });

    expect(changeRes.status).toBe(200);

    // Old access token must now be rejected immediately due to tokenVersion increment
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);

    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe('SESSION_REVOKED');

    // Login with new password should succeed
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: newPassword,
      });

    expect(newLoginRes.status).toBe(200);
  });

  it('POST /api/auth/change-password should reject incorrect current password', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Wrong Password User',
        email: testEmail,
        password: testPassword,
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: testPassword,
      });

    const accessToken = loginRes.body.accessToken;

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'WrongPassword123!',
        newPassword: 'BrandNewSecurePassword123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('State-changing requests with forbidden Origin should be rejected with 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://malicious-website.com')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ORIGIN_INVALID');
  });

  it('State-changing requests with null Origin should be rejected with 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'null')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ORIGIN_INVALID');
  });

  it('State-changing requests with missing Origin and Referer should be rejected with 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ORIGIN_INVALID');
  });

  it('State-changing requests with allowed Origin http://localhost:3005 should be accepted', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3005')
      .send({
        name: 'Origin 3005 User',
        email: testEmail,
        password: testPassword,
      });

    expect(regRes.status).toBe(201);

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3005')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  it('State-changing requests with allowed Origin http://localhost:3005/ (trailing slash) should be accepted', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3005/')
      .send({
        name: 'Origin 3005 Slash User',
        email: testEmail,
        password: testPassword,
      });

    expect(regRes.status).toBe(201);

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3005/')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  it('State-changing requests with allowed Referer http://localhost:3005/ without Origin should be accepted', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .set('Referer', 'http://localhost:3005/register')
      .send({
        name: 'Referer 3005 User',
        email: testEmail,
        password: testPassword,
      });

    expect(regRes.status).toBe(201);

    const res = await request(app)
      .post('/api/auth/login')
      .set('Referer', 'http://localhost:3005/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });
});
