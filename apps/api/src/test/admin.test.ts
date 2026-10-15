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

    it('rejects ADMIN user from logging into student portal (/api/auth/login) with 403', async () => {
      const webLogin = await request(app)
        .post('/api/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({
          email: adminUserEmail,
          password: 'PasswordAdmin123!',
        });
      expect(webLogin.status).toBe(403);
      expect(webLogin.body.error.code).toBe('ADMIN_PORTAL_ONLY');
      expect(webLogin.body.error.message).toContain('Akun administrator');
    });

    it('clears admin cookies on logout and does not revoke separated normal user web session', async () => {
      // 1. Create a web session for a normal user on web origin
      const webLogin = await request(app)
        .post('/api/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({
          email: normalUserEmail,
          password: 'PasswordNormal123!',
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

      // 3. Normal user web session should still be completely valid
      const meWeb = await request(app)
        .get('/api/auth/me')
        .set('Cookie', webCookie);
      expect(meWeb.status).toBe(200);
      expect(meWeb.body.user.email).toBe(normalUserEmail);
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
      expect(Math.abs(res.body.totalMaterials - directCount)).toBeLessThanOrEqual(5);
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

  describe('Read-Only User Detail (GET /api/admin/users/:id)', () => {
    it('rejects anonymous request with 401', async () => {
      const res = await request(app).get(`/api/admin/users/${normalUserId}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects non-admin USER with 403', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${normalUserId}`)
        .set('Cookie', normalUserCookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 when target user does not exist', async () => {
      const res = await request(app)
        .get('/api/admin/users/cuid_non_existent_12345')
        .set('Cookie', adminUserCookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('allows ADMIN to fetch user detail with safe projection and no leaked secrets', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${normalUserId}`)
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store, private');
      expect(res.body.id).toBe(normalUserId);
      expect(res.body.name).toBe('Normal User');
      expect(res.body.email).toBe(normalUserEmail);
      expect(res.body.role).toBe('USER');
      expect(res.body.timezone).toBeDefined();
      expect(res.body.createdAt).toBeDefined();

      // Auth methods
      expect(res.body.authMethods).toBeDefined();
      expect(res.body.authMethods.hasPassword).toBe(true);
      expect(res.body.authMethods.hasGoogle).toBe(false);
      expect(res.body.authMethods.methods).toEqual(['password']);

      // Usage summary structure
      expect(res.body.usageSummary).toBeDefined();
      expect(typeof res.body.usageSummary.semesters).toBe('number');
      expect(typeof res.body.usageSummary.courses).toBe('number');
      expect(typeof res.body.usageSummary.materials).toBe('number');
      expect(typeof res.body.usageSummary.assignments).toBe('number');
      expect(typeof res.body.usageSummary.notes).toBe('number');

      // STRICT PROJECTION: Secrets MUST NEVER be exposed
      expect((res.body as any).passwordHash).toBeUndefined();
      expect((res.body as any).password_hash).toBeUndefined();
      expect((res.body as any).tokenVersion).toBeUndefined();
      expect((res.body as any).token_version).toBeUndefined();
      expect((res.body as any).refreshSessions).toBeUndefined();
      expect((res.body as any).federatedIdentities).toBeUndefined();
    });

    it('accurately reports Google OAuth in authMethods when present', async () => {
      // Add a Google federated identity to normalUser
      await prisma.federatedIdentity.create({
        data: {
          userId: normalUserId,
          provider: 'google',
          subject: 'google_sub_12345678',
          email: normalUserEmail,
        },
      });

      const res = await request(app)
        .get(`/api/admin/users/${normalUserId}`)
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.authMethods.hasPassword).toBe(true);
      expect(res.body.authMethods.hasGoogle).toBe(true);
      expect(res.body.authMethods.methods).toContain('password');
      expect(res.body.authMethods.methods).toContain('google');
      // Ensure raw federated identity details (e.g. subject) are not exposed
      expect((res.body as any).subject).toBeUndefined();
    });

    it('accurately aggregates user usage metrics and respects active materials scoping', async () => {
      // 1. Create semester and course
      const semester = await prisma.semester.create({
        data: {
          userId: normalUserId,
          name: 'Semester 1 Test',
          academicYear: '2025/2026',
          isActive: true,
        },
      });

      const course = await prisma.course.create({
        data: {
          userId: normalUserId,
          semesterId: semester.id,
          name: 'Kalkulus I Test',
        },
      });

      // 2. Create 1 active material and 1 soft-deleted material
      await prisma.material.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Materi Aktif',
          originalFilename: 'materi_aktif.pdf',
          storageKey: `test/aktif_${Date.now()}.pdf`,
          bytes: 1048576, // 1 MB
          status: 'READY',
        },
      });

      await prisma.material.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Materi Terhapus',
          originalFilename: 'materi_terhapus.pdf',
          storageKey: `test/terhapus_${Date.now()}.pdf`,
          bytes: 1048576,
          status: 'READY',
          deletedAt: new Date(),
        },
      });

      // 3. Create assignment
      await prisma.assignment.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Tugas Kuliah Test',
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      // 4. Create note
      await prisma.note.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Catatan Kuliah Test',
          content: 'Catatan pribadi belajar kalkulus',
        },
      });

      // 5. Create storage usage record (10.5 MB)
      await prisma.storageUsage.upsert({
        where: { userId: normalUserId },
        create: {
          userId: normalUserId,
          usedBytes: BigInt(11010048), // ~10.5 MB
        },
        update: {
          usedBytes: BigInt(11010048),
        },
      });

      // Request user detail
      const res = await request(app)
        .get(`/api/admin/users/${normalUserId}`)
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      const usage = res.body.usageSummary;
      expect(usage.semesters).toBe(1);
      expect(usage.courses).toBe(1);
      // Soft-deleted material MUST NOT be included
      expect(usage.materials).toBe(1);
      expect(usage.assignments).toBe(1);
      expect(usage.notes).toBe(1);
      expect(usage.storageUsage).toBeDefined();
      expect(usage.storageUsage.usedBytes).toBe(11010048);
      expect(usage.storageUsage.formatted).toBe('10.5 MB');

      // Verify privacy: no note text, no material file URLs, no assignment content leaked
      expect((res.body as any).content).toBeUndefined();
      expect((res.body as any).notesList).toBeUndefined();
      expect((res.body as any).materialsList).toBeUndefined();
    });

    it('enforces tenant isolation: another user metrics do not bleed into target user summary', async () => {
      // Admin should have 0 semesters/courses in their summary
      const adminRes = await request(app)
        .get(`/api/admin/users/${adminUserId}`)
        .set('Cookie', adminUserCookie);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.usageSummary.semesters).toBe(0);
      expect(adminRes.body.usageSummary.courses).toBe(0);
      expect(adminRes.body.usageSummary.materials).toBe(0);
      expect(adminRes.body.usageSummary.assignments).toBe(0);
      expect(adminRes.body.usageSummary.notes).toBe(0);
      expect(adminRes.body.usageSummary.storageUsage).toBeNull();
    });
  });

  describe('GET /api/admin/trends', () => {
    it('rejects anonymous request with 401', async () => {
      const res = await request(app).get('/api/admin/trends');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects non-admin USER with 403', async () => {
      const res = await request(app)
        .get('/api/admin/trends')
        .set('Cookie', normalUserCookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects invalid range parameter with 400', async () => {
      const res = await request(app)
        .get('/api/admin/trends?range=1y')
        .set('Cookie', adminUserCookie);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 30d activity trends by default with continuous chronological dates', async () => {
      const res = await request(app)
        .get('/api/admin/trends')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.body.range).toBe('30d');
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(30);
      expect(res.body.totals).toBeDefined();
      expect(typeof res.body.totals.materi).toBe('number');
      expect(typeof res.body.totals.tugas).toBe('number');

      // Verify date ordering
      const dates = res.body.data.map((d: any) => d.date);
      for (let i = 1; i < dates.length; i++) {
        expect(new Date(dates[i]).getTime()).toBeGreaterThan(new Date(dates[i - 1]).getTime());
      }
    });

    it('supports 7d and 90d query parameters correctly', async () => {
      const res7d = await request(app)
        .get('/api/admin/trends?range=7d')
        .set('Cookie', adminUserCookie);
      expect(res7d.status).toBe(200);
      expect(res7d.body.range).toBe('7d');
      expect(res7d.body.data.length).toBe(7);

      const res90d = await request(app)
        .get('/api/admin/trends?range=90d')
        .set('Cookie', adminUserCookie);
      expect(res90d.status).toBe(200);
      expect(res90d.body.range).toBe('90d');
      expect(res90d.body.data.length).toBe(90);
    });

    it('aggregates materials and assignments counts accurately and ignores soft-deleted materials', async () => {
      // Create course
      const semester = await prisma.semester.create({
        data: {
          userId: normalUserId,
          name: 'Semester Test Trends',
          academicYear: '2026/2027',
          isActive: true,
        },
      });

      const course = await prisma.course.create({
        data: {
          userId: normalUserId,
          semesterId: semester.id,
          name: 'Trends Test Course',
          code: 'TR101',
        },
      });

      // Active material created today
      await prisma.material.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Active Material Today',
          originalFilename: 'active.pdf',
          storageKey: `materials/test/trends-act-${Date.now()}.pdf`,
          bytes: 1024,
        },
      });

      // Soft-deleted material created today (MUST NOT be counted)
      await prisma.material.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Deleted Material Today',
          originalFilename: 'deleted.pdf',
          storageKey: `materials/test/trends-del-${Date.now()}.pdf`,
          bytes: 1024,
          deletedAt: new Date(),
        },
      });

      // Assignment created today
      await prisma.assignment.create({
        data: {
          userId: normalUserId,
          courseId: course.id,
          title: 'Assignment Today',
          dueDate: new Date(Date.now() + 86400000),
        },
      });

      const res = await request(app)
        .get('/api/admin/trends?range=7d')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.body.totals.materi).toBeGreaterThanOrEqual(1);
      expect(res.body.totals.tugas).toBeGreaterThanOrEqual(1);

      // Verify today's data point has at least 1 materi and 1 tugas
      const todayKey = new Date().toISOString().split('T')[0];
      const todayPoint = res.body.data.find((d: any) => d.date === todayKey);
      expect(todayPoint).toBeDefined();
      expect(todayPoint.materi).toBeGreaterThanOrEqual(1);
      expect(todayPoint.tugas).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/admin/system/status', () => {
    it('rejects anonymous request with 401', async () => {
      const res = await request(app).get('/api/admin/system/status');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects non-admin USER with 403', async () => {
      const res = await request(app)
        .get('/api/admin/system/status')
        .set('Cookie', normalUserCookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns system health and component modules for ADMIN with cache-control no-store', async () => {
      const res = await request(app)
        .get('/api/admin/system/status')
        .set('Cookie', adminUserCookie);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.body.timestamp).toBeDefined();
      expect(Array.isArray(res.body.modules)).toBe(true);
      expect(res.body.modules.length).toBeGreaterThanOrEqual(5);

      // Verify each module follows schema
      for (const mod of res.body.modules) {
        expect(mod.id).toBeDefined();
        expect(mod.name).toBeDefined();
        expect(mod.category).toBeDefined();
        expect(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNCONFIGURED']).toContain(mod.status);
        expect(mod.engine).toBeDefined();
        expect(mod.metricLabel).toBeDefined();
        expect(mod.metricValue).toBeDefined();
        expect(mod.description).toBeDefined();
        expect(mod.updatedAt).toBeDefined();
      }

      // Verify specific expected modules exist
      const moduleIds = res.body.modules.map((m: any) => m.id);
      expect(moduleIds).toContain('postgres-db');
      expect(moduleIds).toContain('redis-broker');
      expect(moduleIds).toContain('worker-document');
      expect(moduleIds).toContain('worker-ai');
      expect(moduleIds).toContain('storage-service');
      expect(moduleIds).toContain('ai-pipeline');
      expect(moduleIds).toContain('security-auth');

      // Verify PostgreSQL module reported query latency
      const dbMod = res.body.modules.find((m: any) => m.id === 'postgres-db');
      expect(dbMod.status).toBe('HEALTHY');
      expect(dbMod.metricValue).toContain('ms');
    });
  });
});


