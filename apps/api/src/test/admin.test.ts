import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { ADMIN_COOKIE_NAMES, COOKIE_NAMES } from '@studyflow/shared';

describe('Admin Endpoints & Authorization Invariants', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3002';
  const WEB_ORIGIN = 'http://localhost:3000';

  let normalUserId: string;
  let normalUserEmail: string;
  let normalUserCookie: string[];

  let adminUserId: string;
  let adminUserEmail: string;
  let adminUserCookie: string[];

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.admin.' } },
    });

    // 1. Create Normal USER
    normalUserEmail = `test.admin.user.${Date.now()}.${Math.random()}@example.com`;
    const regNormal = await request(app)
      .post('/api/auth/register')
      .set('Origin', WEB_ORIGIN)
      .send({
        name: 'Normal User',
        email: normalUserEmail,
        password: 'PasswordNormal123!',
      });
    expect(regNormal.status).toBe(201);

    const loginNormal = await request(app)
      .post('/api/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({
        email: normalUserEmail,
        password: 'PasswordNormal123!',
      });
    expect(loginNormal.status).toBe(200);
    normalUserId = loginNormal.body.user.id;
    normalUserCookie = loginNormal.headers['set-cookie'] as unknown as string[];

    // 2. Create ADMIN user (registered as normal, then promoted in DB)
    adminUserEmail = `test.admin.boss.${Date.now()}.${Math.random()}@example.com`;
    const regAdmin = await request(app)
      .post('/api/auth/register')
      .set('Origin', WEB_ORIGIN)
      .send({
        name: 'Boss Admin',
        email: adminUserEmail,
        password: 'PasswordAdmin123!',
      });
    expect(regAdmin.status).toBe(201);
    adminUserId = regAdmin.body.user.id;

    // Promote to ADMIN directly in database (authoritative source)
    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: 'ADMIN' },
    });

    const loginAdminRes = await request(app)
      .post('/api/admin/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        email: adminUserEmail,
        password: 'PasswordAdmin123!',
      });
    expect(loginAdminRes.status).toBe(200);
    expect(loginAdminRes.body.user.role).toBe('ADMIN');
    adminUserCookie = loginAdminRes.headers['set-cookie'] as unknown as string[];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.admin.' } },
    });
  });

  describe('Access Control & Boundaries', () => {
    it('rejects anonymous request to /api/admin/summary with 401', async () => {
      const res = await request(app).get('/api/admin/summary');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects anonymous request to /api/admin/users with 401', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects authenticated non-admin USER with 403 on /api/admin/summary', async () => {
      const res = await request(app)
        .get('/api/admin/summary')
        .set('Cookie', normalUserCookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects authenticated non-admin USER with 403 on /api/admin/users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Cookie', normalUserCookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows ADMIN to access summary and users', async () => {
      const summaryRes = await request(app)
        .get('/api/admin/summary')
        .set('Cookie', adminUserCookie);
      expect(summaryRes.status).toBe(200);
      expect(typeof summaryRes.body.totalUsers).toBe('number');
      expect(typeof summaryRes.body.totalMaterials).toBe('number');
      expect(typeof summaryRes.body.totalAssignments).toBe('number');
      expect(typeof summaryRes.body.failedJobs24h).toBe('number');

      const usersRes = await request(app)
        .get('/api/admin/users')
        .set('Cookie', adminUserCookie);
      expect(usersRes.status).toBe(200);
      expect(Array.isArray(usersRes.body.items)).toBe(true);
      expect(usersRes.body.pagination).toBeDefined();
    });

    it('immediately denies access with 403 on next request if role is revoked in DB', async () => {
      // 1. Initial request works
      const res1 = await request(app)
        .get('/api/admin/summary')
        .set('Cookie', adminUserCookie);
      expect(res1.status).toBe(200);

      // 2. Revoke role in database
      await prisma.user.update({
        where: { id: adminUserId },
        data: { role: 'USER' },
      });

      // 3. Next request with same cookie must be rejected immediately with 403
      const res2 = await request(app)
        .get('/api/admin/summary')
        .set('Cookie', adminUserCookie);
      expect(res2.status).toBe(403);
      expect(res2.body.error.code).toBe('FORBIDDEN');
    });

    it('does NOT allow public registration to inject ADMIN role', async () => {
      const attackerEmail = `test.admin.hacker.${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', WEB_ORIGIN)
        .send({
          name: 'Hacker',
          email: attackerEmail,
          password: 'PasswordHacker123!',
          role: 'ADMIN', // malicious input injection
        } as any);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('USER');

      // Verify in DB
      const userInDb = await prisma.user.findUnique({
        where: { email: attackerEmail },
        select: { role: true },
      });
      expect(userInDb?.role).toBe('USER');
    });
  });

  describe('Admin Auth & Session Isolation', () => {
    it('rejects admin login for non-admin user with 403 and sets no admin cookies', async () => {
      const res = await request(app)
        .post('/api/admin/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: normalUserEmail,
          password: 'PasswordNormal123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');

      // Ensure no cookies were set
      const cookies = res.headers['set-cookie'] || [];
      const hasAdminCookie = cookies.some((c: string) =>
        c.includes(ADMIN_COOKIE_NAMES.accessToken)
      );
      expect(hasAdminCookie).toBe(false);
    });

    it('sets dedicated admin cookies upon successful admin login', async () => {
      const res = await request(app)
        .post('/api/admin/auth/login')
        .set('Origin', TRUSTED_ORIGIN)
        .send({
          email: adminUserEmail,
          password: 'PasswordAdmin123!',
        });

      expect(res.status).toBe(200);
      const cookies = (res.headers['set-cookie'] || []) as string[];
      expect(cookies.some((c) => c.includes(ADMIN_COOKIE_NAMES.accessToken))).toBe(true);
      expect(cookies.some((c) => c.includes(ADMIN_COOKIE_NAMES.refreshToken))).toBe(true);
      // Ensure web cookies are NOT set
      expect(cookies.some((c) => c.includes(`${COOKIE_NAMES.accessToken}=`))).toBe(false);
    });

    it('returns admin profile on /api/admin/auth/me', async () => {
      const res = await request(app)
        .get('/api/admin/auth/me')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(adminUserEmail);
      expect(res.body.user.role).toBe('ADMIN');
    });

    it('refreshes admin token successfully and rotates session', async () => {
      const refreshCookie = adminUserCookie.find((c) =>
        c.includes(ADMIN_COOKIE_NAMES.refreshToken)
      );
      expect(refreshCookie).toBeDefined();

      const res = await request(app)
        .post('/api/admin/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [refreshCookie!]);

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('ADMIN');
      const newCookies = (res.headers['set-cookie'] || []) as string[];
      expect(newCookies.some((c) => c.includes(ADMIN_COOKIE_NAMES.accessToken))).toBe(true);
    });

    it('clears admin cookies on logout and does not revoke separated web session', async () => {
      // 1. Create a web session for the admin user on web origin
      const webLogin = await request(app)
        .post('/api/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({
          email: adminUserEmail,
          password: 'PasswordAdmin123!',
        });
      expect(webLogin.status).toBe(200);
      const webCookie = webLogin.headers['set-cookie'] as unknown as string[];

      // 2. Perform admin logout
      const refreshCookie = adminUserCookie.find((c) =>
        c.includes(ADMIN_COOKIE_NAMES.refreshToken)
      );
      const logoutRes = await request(app)
        .post('/api/admin/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', [refreshCookie!]);

      expect(logoutRes.status).toBe(200);

      // 3. Web session should still be completely valid
      const meWeb = await request(app)
        .get('/api/auth/me')
        .set('Cookie', webCookie);
      expect(meWeb.status).toBe(200);
      expect(meWeb.body.user.email).toBe(adminUserEmail);
    });
  });

  describe('Summary Aggregation Metrics', () => {
    it('calculates total users, materials, assignments, and failed jobs correctly', async () => {
      // Create a material for normal user
      const sem = await prisma.semester.create({
        data: {
          userId: normalUserId,
          name: 'Semester Test',
          academicYear: '2026/2027',
        },
      });

      const course = await prisma.course.create({
        data: {
          userId: normalUserId,
          semesterId: sem.id,
          name: 'Matematika Diskrit',
          code: 'CS101',
        },
      });

      const activeMat = await prisma.material.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Slide 1',
          originalFilename: 'test1.pdf',
          storageKey: 'test-admin-key-1',
          bytes: 1024,
          mimeType: 'application/pdf',
          status: 'READY',
        },
      });

      const deletedMat = await prisma.material.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Slide Hapus',
          originalFilename: 'test2.pdf',
          storageKey: 'test-admin-key-2',
          bytes: 1024,
          mimeType: 'application/pdf',
          status: 'READY',
          deletedAt: new Date(),
        },
      });

      const assignment = await prisma.assignment.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Tugas 1',
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      const res = await request(app)
        .get('/api/admin/summary')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBeGreaterThanOrEqual(2);
      expect(res.body.totalMaterials).toBeGreaterThanOrEqual(1);
      expect(res.body.totalAssignments).toBeGreaterThanOrEqual(1);

      // Verify deleted material was NOT counted
      const directCount = await prisma.material.count({ where: { deletedAt: null } });
      expect(res.body.totalMaterials).toBe(directCount);
    });
  });

  describe('Read-Only Users List & Safe Projection', () => {
    it('safely projects user list without passwordHash or secret fields', async () => {
      const res = await request(app)
        .get('/api/admin/users?limit=10')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);

      const firstItem = res.body.items[0];
      expect(firstItem.id).toBeDefined();
      expect(firstItem.name).toBeDefined();
      expect(firstItem.email).toBeDefined();
      expect(firstItem.role).toBeDefined();
      expect(firstItem.createdAt).toBeDefined();

      // SECURITY INVARIANTS: Secrets MUST NEVER be exposed
      expect((firstItem as any).passwordHash).toBeUndefined();
      expect((firstItem as any).password_hash).toBeUndefined();
      expect((firstItem as any).tokenVersion).toBeUndefined();
      expect((firstItem as any).token_version).toBeUndefined();
      expect((firstItem as any).refreshSessions).toBeUndefined();
      expect((firstItem as any).federatedIdentities).toBeUndefined();
    });

    it('supports search by name and email case-insensitively', async () => {
      const res = await request(app)
        .get(`/api/admin/users?search=${encodeURIComponent('boss')}`)
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.items.some((u: any) => u.email === adminUserEmail)).toBe(true);
    });

    it('supports stable pagination with limit and page', async () => {
      const res = await request(app)
        .get('/api/admin/users?limit=1&page=1')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.pagination.limit).toBe(1);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination.hasNext).toBe(true);
    });

    it('rejects invalid query parameters with 400', async () => {
      const res = await request(app)
        .get('/api/admin/users?limit=-5')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
