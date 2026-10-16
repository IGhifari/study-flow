import { test, expect } from '@playwright/test';

/**
 * Pengujian E2E Redesign Tahap 18:
 * 1. Landing page public state (Guest): Navbar CTA, Hero <h1>, navigasi section, kontrol tema, ketiadaan artefak milestone/infrastruktur.
 * 2. DOM Horizontal Overflow check (Desktop 1280px & Mobile 375px).
 * 3. Landing page authenticated state: Tombol berganti ke Dashboard.
 * 4. Pengaturan Akun: Verifikasi label "Email" dan ketiadaan klaim "terverifikasi".
 */

test.describe('Landing Page & Settings Verification Flow', () => {
  const testPassword = 'InitialPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[BROWSER EXCEPTION]:', err));
  });

  async function registerAndLogin(page: any, name: string, email: string) {
    await page.goto('/register');
    await page.fill('#name', name);
    await page.fill('#email', email);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', email);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }

  test('1. Landing page publik untuk tamu: Navbar, Hero H1, Fitur, Cara Kerja, dan bebas artefak pengembangan', async ({ page }) => {
    test.setTimeout(45000);

    await page.goto('/');

    // 1. Verifikasi Heading Utama tunggal (H1)
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Materi, tugas, dan catatan kuliah lebih teratur.');

    // 2. Verifikasi CTA Tamu di Navbar dan Hero
    await expect(page.locator('header a[href="/login"] button:has-text("Masuk")')).toBeVisible();
    await expect(page.locator('header a[href="/register"] button:has-text("Daftar")')).toBeVisible();

    const heroPrimaryCta = page.locator('main a[href="/register"] button:has-text("Mulai Belajar Sekarang")');
    await expect(heroPrimaryCta).toBeVisible();

    // 3. Verifikasi Navigasi Section
    await expect(page.locator('#fitur')).toBeVisible();
    await expect(page.locator('#cara-kerja')).toBeVisible();

    // 4. Verifikasi Kontrol Tema dapat berinteraksi
    const themeRadio = page.locator('header input[type="radio"], header button[role="radio"]').first();
    if (await themeRadio.isVisible()) {
      await expect(themeRadio).toBeEnabled();
    }

    // 5. Verifikasi bebas dari artefak pengembangan lama
    await expect(page.locator('text=Milestone 2')).toHaveCount(0);
    await expect(page.locator('text=Next.js BFF Adapter')).toHaveCount(0);
    await expect(page.locator('text=Port 3000')).toHaveCount(0);
    await expect(page.locator('text=Port 4000')).toHaveCount(0);
    await expect(page.locator('text=Milestone 3')).toHaveCount(0);
  });

  test('2. DOM overflow check pada viewport Desktop (1280px) dan Mobile (375px)', async ({ page }) => {
    test.setTimeout(45000);

    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const hasDesktopOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasDesktopOverflow).toBe(false);

    // Mobile Viewport (375px)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const hasMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasMobileOverflow).toBe(false);
  });

  test('3. Landing page untuk pengguna yang sudah login: Navigasi mengarah ke Dashboard', async ({ page }) => {
    test.setTimeout(60000);
    const testEmail3 = `landing-test3-${Date.now()}@studyflow.test`;

    // Registrasi & login user
    await registerAndLogin(page, 'Mahasiswa Penguji Landing', testEmail3);

    // Buka kembali halaman beranda publik
    await page.goto('/');

    // Verifikasi tombol di Navbar kini berupa Dashboard
    await expect(page.locator('header a[href="/dashboard"] button:has-text("Dashboard")')).toBeVisible();

    // Verifikasi tombol di Hero kini mengarahkan ke Dashboard
    await expect(page.locator('main a[href="/dashboard"] button:has-text("Buka Dashboard Belajar")')).toBeVisible();
  });

  test('4. Pengaturan Akun: Label Email bersih dan klaim "terverifikasi" tidak muncul', async ({ page }) => {
    test.setTimeout(60000);
    const testEmail4 = `landing-test4-${Date.now()}@studyflow.test`;

    // Registrasi & login user
    await registerAndLogin(page, 'Mahasiswa Penguji Settings', testEmail4);

    // Buka pengaturan akun dengan user yang sudah login
    await page.goto('/settings');
    await expect(page.locator('h1:has-text("Pengaturan Akun")')).toBeVisible();

    // Verifikasi label email mengandung 'Email'
    const emailLabel = page.locator('label[for="profile-email"]');
    await expect(emailLabel).toContainText('Email');

    // Verifikasi input email disabled/read-only
    const emailInput = page.locator('#profile-email');
    await expect(emailInput).toBeDisabled();

    // Verifikasi user baru berstatus Belum Terverifikasi dan klaim 'Akun Terverifikasi' TIDAK muncul
    await expect(page.locator('text=Belum Terverifikasi')).toBeVisible();
    await expect(page.locator('text=Alamat email ini telah terverifikasi.')).toHaveCount(0);
    await expect(page.locator('text=Akun Terverifikasi')).toHaveCount(0);
  });
});
