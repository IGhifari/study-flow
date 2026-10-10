import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { COOKIE_NAMES } from '@studyflow/shared';
import { hashToken } from '../services/token.service.js';

describe('Refresh Token Rotation Concurrency & Security', () => {
  const app = createApp();
  const testEmail = `auth.concurrency.${Date.now()}@example.com`;
  const testPassword = 'PasswordKuatConcurrency123!';
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'auth.concurrency.' },
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'auth.concurrency.' },
      },
    });
    await prisma.$disconnect();
  });

  async function registerAndLogin(email = testEmail) {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Concurrent User',
        email,
        password: testPassword,
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email,
        password: testPassword,
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies?.find((c: string) => c.startsWith(`${COOKIE_NAMES.refreshToken}=`));
    const rawRefreshToken = refreshCookie?.split(';')[0]?.split('=')[1];

    return {
      user: loginRes.body.user,
      accessToken: loginRes.body.accessToken,
      rawRefreshToken: rawRefreshToken!,
    };
  }

  it('1. Two concurrent refresh requests with the same token should create exactly one child session without branching', async () => {
    const { rawRefreshToken } = await registerAndLogin();
    const tokenHash = hashToken(rawRefreshToken);

    // Get the initial session
    const initialSession = await prisma.refreshSession.findUnique({
      where: { tokenHash },
    });
    expect(initialSession).toBeDefined();
    const familyId = initialSession!.familyId;

    // Send two concurrent refresh requests simultaneously
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
      request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
    ]);

    // Both requests must succeed (one via normal rotation, one via grace period)
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.accessToken).toBeDefined();
    expect(res2.body.accessToken).toBeDefined();

    // Verify session count in family:
    // Exactly 1 parent (now revoked) + exactly 1 child (active).
    // MUST NOT create 2 child sessions!
    const allSessions = await prisma.refreshSession.findMany({
      where: { familyId },
    });
    expect(allSessions.length).toBe(2);

    const activeSessions = allSessions.filter((s) => s.revokedAt === null);
    expect(activeSessions.length).toBe(1);

    const revokedSessions = allSessions.filter((s) => s.revokedAt !== null);
    expect(revokedSessions.length).toBe(1);
    expect(revokedSessions[0].id).toBe(initialSession!.id);
  });

  it('2. Winner request issues new refreshToken cookie; loser request within grace period omits refreshToken cookie without clearing it', async () => {
    const { rawRefreshToken } = await registerAndLogin();

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
      request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
    ]);

    // Inspect Set-Cookie headers on both responses
    const getRefreshCookie = (res: request.Response) => {
      const setCookies = (res.headers['set-cookie'] as unknown as string[]) || [];
      return setCookies.find((c) => c.startsWith(`${COOKIE_NAMES.refreshToken}=`));
    };

    const cookie1 = getRefreshCookie(res1);
    const cookie2 = getRefreshCookie(res2);

    // Exactly one of the requests should set the new refresh token cookie
    // The other request (runner-up during grace period) omits it
    const setsRefreshTokenCount = [cookie1, cookie2].filter((c) => c && !c.includes('Max-Age=0')).length;
    expect(setsRefreshTokenCount).toBe(1);

    // Neither request should have cleared the refresh cookie with Max-Age=0
    expect(cookie1?.includes('Max-Age=0')).toBeFalsy();
    expect(cookie2?.includes('Max-Age=0')).toBeFalsy();
  });

  it('3. Subsequent refresh using the newly generated child token succeeds', async () => {
    const { rawRefreshToken } = await registerAndLogin();

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);

    expect(refreshRes.status).toBe(200);

    const cookies = refreshRes.headers['set-cookie'] as unknown as string[];
    const newRefreshCookie = cookies.find((c: string) => c.startsWith(`${COOKIE_NAMES.refreshToken}=`));
    const newRawRefreshToken = newRefreshCookie?.split(';')[0]?.split('=')[1];
    expect(newRawRefreshToken).toBeDefined();

    // Use the newly rotated token for another refresh
    const secondRefreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${newRawRefreshToken}`]);

    expect(secondRefreshRes.status).toBe(200);
    expect(secondRefreshRes.body.accessToken).toBeDefined();
  });

  it('4. Replay attack outside grace window revokes the whole family and returns 401 SESSION_REPLAY_DETECTED', async () => {
    const { rawRefreshToken } = await registerAndLogin();
    const tokenHash = hashToken(rawRefreshToken);

    // Rotate token once
    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);
    expect(firstRefresh.status).toBe(200);

    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
    });
    const familyId = session!.familyId;

    // Simulate passage of time: set revokedAt to 30 seconds ago (> 15s grace window)
    await prisma.refreshSession.update({
      where: { tokenHash },
      data: {
        revokedAt: new Date(Date.now() - 30000),
      },
    });

    // Attempt to reuse the old revoked token
    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('SESSION_REPLAY_DETECTED');

    // Verify all sessions in the family are now revoked
    const familySessions = await prisma.refreshSession.findMany({
      where: { familyId },
    });
    expect(familySessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('5. Refresh racing with logout leaves zero active sessions in the family', async () => {
    const { rawRefreshToken } = await registerAndLogin();
    const tokenHash = hashToken(rawRefreshToken);

    const initialSession = await prisma.refreshSession.findUnique({
      where: { tokenHash },
    });
    const familyId = initialSession!.familyId;

    // Concurrently trigger refresh and logout with the same token
    const [refreshRes, logoutRes] = await Promise.all([
      request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
      request(app)
        .post('/api/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
    ]);

    expect(logoutRes.status).toBe(200);

    // After both complete, regardless of execution order:
    // ALL sessions in the family must be revoked! Zero active sessions!
    const familySessions = await prisma.refreshSession.findMany({
      where: { familyId },
    });
    const activeCount = familySessions.filter((s) => s.revokedAt === null).length;
    expect(activeCount).toBe(0);
  });

  it('6. Password change invalidates all existing sessions and increments tokenVersion', async () => {
    const { user, accessToken, rawRefreshToken } = await registerAndLogin();

    // Change password
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: testPassword,
        newPassword: 'PasswordBaruSangatKuat456!',
      });

    expect(changeRes.status).toBe(200);

    // 1. Old access token must be rejected (tokenVersion mismatch)
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe('SESSION_REVOKED');

    // 2. Old refresh token must be rejected (session was revoked)
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);
    expect(refreshRes.status).toBe(401);

    // 3. User can login with the new password
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: testEmail,
        password: 'PasswordBaruSangatKuat456!',
      });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.accessToken).toBeDefined();
  });

  it('7. Expired refresh token is rejected with SESSION_EXPIRED and marked revoked', async () => {
    const { rawRefreshToken } = await registerAndLogin();
    const tokenHash = hashToken(rawRefreshToken);

    // Manually expire the session in the database
    await prisma.refreshSession.update({
      where: { tokenHash },
      data: {
        expiresAt: new Date(Date.now() - 10000), // expired 10 seconds ago
      },
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');

    // Verify session in DB is marked as revoked
    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
    });
    expect(session!.revokedAt).not.toBeNull();
  });

  it('8. Concurrency: Refresh racing with password change (Refresh starts first)', async () => {
    const userEmail = `race.refresh.first.${Date.now()}@example.com`;
    const { accessToken: oldAccessToken, rawRefreshToken: oldRefreshToken } = await registerAndLogin(userEmail);

    const newPassword = 'PasswordBaruRacing123!';

    // Launch refresh and change-password with refresh starting immediately
    const refreshPromise = request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${oldRefreshToken}`]);

    // Very slight delay or immediate change-password to create tight race on PostgreSQL
    const changePasswordPromise = request(app)
      .post('/api/auth/change-password')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${oldAccessToken}`)
      .send({
        currentPassword: testPassword,
        newPassword,
      });

    const [refreshRes, changePassRes] = await Promise.all([refreshPromise, changePasswordPromise]);

    // Password change must succeed
    expect(changePassRes.status).toBe(200);

    // If refresh returned a child token (because it completed before or during change-password):
    const newChildRefreshToken = refreshRes.headers['set-cookie']
      ? ((refreshRes.headers['set-cookie'] as unknown as string[])
          .find((c) => c.startsWith(`${COOKIE_NAMES.refreshToken}=`))
          ?.split(';')[0]?.split('=')[1])
      : undefined;

    const issuedAccessToken = refreshRes.body.accessToken;

    // A. The old refresh token must be rejected
    const oldRefreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${oldRefreshToken}`]);
    expect(oldRefreshRes.status).toBe(401);

    // B. If a child refresh token was issued during the race, it must also be rejected
    if (newChildRefreshToken) {
      const childRefreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${newChildRefreshToken}`]);
      expect(childRefreshRes.status).toBe(401);
    }

    // C. The old access token must be rejected
    const testOldAccessRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);
    expect(testOldAccessRes.status).toBe(401);
    expect(testOldAccessRes.body.error.code).toBe('SESSION_REVOKED');

    // D. The access token issued by the racing refresh must also be rejected (tokenVersion mismatch)
    if (issuedAccessToken) {
      const testIssuedAccessRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${issuedAccessToken}`);
      expect(testIssuedAccessRes.status).toBe(401);
      expect(testIssuedAccessRes.body.error.code).toBe('SESSION_REVOKED');
    }

    // E. Logging in with the new password must succeed
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: userEmail,
        password: newPassword,
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();

    // F. Verify DB: All refresh sessions created before/during password change must be revoked
    const dbUser = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
      include: { refreshSessions: true },
    });
    expect(dbUser).toBeDefined();
    // Only the session from the new login (step E) can be active
    const activeSessions = dbUser!.refreshSessions.filter((s) => s.revokedAt === null);
    expect(activeSessions.length).toBe(1);
  });

  it('9. Concurrency: Password change racing with refresh (Password change starts first)', async () => {
    const userEmail = `race.pass.first.${Date.now()}@example.com`;
    const { accessToken: oldAccessToken, rawRefreshToken: oldRefreshToken } = await registerAndLogin(userEmail);

    const newPassword = 'PasswordBaruRacingPassFirst123!';

    // Launch change-password and refresh concurrently with change-password scheduled first
    const changePasswordPromise = request(app)
      .post('/api/auth/change-password')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Authorization', `Bearer ${oldAccessToken}`)
      .send({
        currentPassword: testPassword,
        newPassword,
      });

    const refreshPromise = (async () => {
      // Small pause to let change-password start its execution first
      await new Promise((r) => setTimeout(r, 5));
      return request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${oldRefreshToken}`]);
    })();

    const [changePassRes, refreshRes] = await Promise.all([changePasswordPromise, refreshPromise]);

    // Password change must succeed
    expect(changePassRes.status).toBe(200);

    // If refresh returned a token before change-password locked the user,
    // that token was issued with the old tokenVersion and must now be dead.
    // If change-password committed first, refresh was rejected with 401.
    const newChildRefreshToken = refreshRes.headers['set-cookie']
      ? ((refreshRes.headers['set-cookie'] as unknown as string[])
          .find((c) => c.startsWith(`${COOKIE_NAMES.refreshToken}=`))
          ?.split(';')[0]?.split('=')[1])
      : undefined;

    const issuedAccessToken = refreshRes.body.accessToken;

    // A. Old access token must be rejected
    const testOldAccessRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);
    expect(testOldAccessRes.status).toBe(401);
    expect(testOldAccessRes.body.error.code).toBe('SESSION_REVOKED');

    // B. Old refresh token must be rejected
    const oldRefreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${oldRefreshToken}`]);
    expect(oldRefreshRes.status).toBe(401);

    // C. Any access token issued during the race must be rejected (tokenVersion mismatch)
    if (issuedAccessToken) {
      const testIssuedAccessRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${issuedAccessToken}`);
      expect(testIssuedAccessRes.status).toBe(401);
      expect(testIssuedAccessRes.body.error.code).toBe('SESSION_REVOKED');
    }

    // D. Any child refresh token issued during the race must be rejected
    if (newChildRefreshToken) {
      const childRefreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${newChildRefreshToken}`]);
      expect(childRefreshRes.status).toBe(401);
    }

    // E. Login with new password must succeed
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: userEmail,
        password: newPassword,
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();

    // F. Verify DB: All refresh sessions created before/during password change must be revoked
    const dbUser = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
      include: { refreshSessions: true },
    });
    expect(dbUser).toBeDefined();
    // Only the session from the new login (step E) can be active
    const activeSessions = dbUser!.refreshSessions.filter((s) => s.revokedAt === null);
    expect(activeSessions.length).toBe(1);
  });

  it('10. Strict Lock Ordering: rotateRefreshToken and changeUserPassword execute concurrently without deadlock', async () => {
    const userEmail = `deadlock.check.${Date.now()}@example.com`;
    const { accessToken, rawRefreshToken } = await registerAndLogin(userEmail);
    const newPassword = 'PasswordBaruDeadlock123!';

    // Launch multiple interleaved operations simultaneously on the same user
    const results = await Promise.allSettled([
      request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
      request(app)
        .post('/api/auth/change-password')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testPassword,
          newPassword,
        }),
      request(app)
        .post('/api/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
      request(app)
        .post('/api/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [`${COOKIE_NAMES.refreshToken}=${rawRefreshToken}`]),
    ]);

    // None of the promises should be rejected due to database lock deadlock (SQL state 40P01)
    results.forEach((r) => {
      expect(r.status).toBe('fulfilled');
      if (r.status === 'fulfilled') {
        expect(r.value.status).not.toBe(500);
      }
    });

    // After all interleaved operations settle, login with new password must work cleanly
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: userEmail,
        password: newPassword,
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
  });
});
