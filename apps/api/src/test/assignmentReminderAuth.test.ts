import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@studyflow/database';
import { COOKIE_NAMES } from '@studyflow/shared';

describe('Assignment Reminder User Preference API Tests', () => {
  const app = createApp();
  const TRUSTED_ORIGIN = 'http://localhost:3000';

  const cleanUsers = async () => {
    await prisma.assignmentReminderLog.deleteMany({
      where: {
        user: {
          email: { contains: 'pref.reminder.test' },
        },
      },
    });
    await prisma.assignment.deleteMany({
      where: {
        user: {
          email: { contains: 'pref.reminder.test' },
        },
      },
    });
    await prisma.refreshSession.deleteMany({
      where: {
        user: {
          email: { contains: 'pref.reminder.test' },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'pref.reminder.test' },
      },
    });
  };

  beforeEach(async () => {
    await cleanUsers();
  });

  afterAll(async () => {
    await cleanUsers();
    await prisma.$disconnect();
  });

  const createLoggedInUser = async (isVerified = false) => {
    const email = `pref.reminder.test.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
    const password = 'SecurePassword123!';

    const regRes = await request(app)
      .post('/api/auth/register')
      .set('Origin', TRUSTED_ORIGIN)
      .send({
        name: 'Preference Test User',
        email,
        password,
        timezone: 'Asia/Jakarta',
      });

    expect(regRes.status).toBe(201);
    const userId = regRes.body.user.id;

    if (isVerified) {
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

    return {
      userId,
      email,
      cookieHeader,
    };
  };

  it('1. Default preferensi pengingat email adalah false untuk akun baru', async () => {
    const { cookieHeader } = await createLoggedInUser(false);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.reminderEmailDeadline).toBe(false);
  });

  it('2. Menolak pengaktifan pengingat deadline jika email belum diverifikasi (HTTP 400)', async () => {
    const { cookieHeader } = await createLoggedInUser(false); // Unverified

    const updateRes = await request(app)
      .patch('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader)
      .send({
        reminderEmailDeadline: true,
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(updateRes.body.error.message).toContain('Alamat email harus diverifikasi');

    // Confirm state in DB has not changed
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader);

    expect(meRes.body.user.reminderEmailDeadline).toBe(false);
  });

  it('3. Berhasil mengaktifkan pengingat deadline jika email sudah terverifikasi (HTTP 200)', async () => {
    const { cookieHeader } = await createLoggedInUser(true); // Verified

    const updateRes = await request(app)
      .patch('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader)
      .send({
        reminderEmailDeadline: true,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.reminderEmailDeadline).toBe(true);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader);

    expect(meRes.body.user.reminderEmailDeadline).toBe(true);
  });

  it('4. Pengguna dapat menonaktifkan pengingat kapan saja', async () => {
    const { userId, cookieHeader } = await createLoggedInUser(true);

    // Set enabled first
    await prisma.user.update({
      where: { id: userId },
      data: { reminderEmailDeadline: true },
    });

    const updateRes = await request(app)
      .patch('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader)
      .send({
        reminderEmailDeadline: false,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.reminderEmailDeadline).toBe(false);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader);

    expect(meRes.body.user.reminderEmailDeadline).toBe(false);
  });

  it('5. Rotasi refresh token (POST /api/auth/refresh) tetap mempertahankan user.reminderEmailDeadline === true', async () => {
    const { cookieHeader } = await createLoggedInUser(true);

    // Enable reminderEmailDeadline via PATCH /api/auth/me
    const updateRes = await request(app)
      .patch('/api/auth/me')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader)
      .send({
        reminderEmailDeadline: true,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.reminderEmailDeadline).toBe(true);

    // Call POST /api/auth/refresh with current session cookies
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', cookieHeader)
      .send({});

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.user).toBeDefined();
    expect(refreshRes.body.user.reminderEmailDeadline).toBe(true);
  });
});
