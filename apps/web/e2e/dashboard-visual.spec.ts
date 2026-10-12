import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, '../../../docs/screenshots');

test.describe('Dashboard Visual Inspection & Polish Screenshots', () => {
  test('Capture dashboard with empty state and populated state across viewports', async ({ page }) => {
    test.setTimeout(120000);
    const timestamp = Date.now();
    const userEmail = `visual-polish-${timestamp}@studyflow.test`;
    const testPassword = 'SecretPass123!';

    // 1. Register and Login
    await page.goto('/register');
    await page.fill('#name', 'Rifqi Mahasiswa');
    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });

    // 2. Buat Semester Aktif
    await page.click('a[href="/semesters"]:has-text("Tambah Semester")');
    await page.waitForURL('**/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Gasal 2026/2027');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('text=Semester Gasal 2026/2027')).toBeVisible({ timeout: 10000 });

    // 3. Tambah Mata Kuliah 1 & 2
    await page.goto('/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.fill('#create-course-name', 'Jaringan Komputer dan Komunikasi Data Tingkat Lanjut');
    await page.fill('#create-course-code', 'IF3110');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Jaringan Komputer')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.fill('#create-course-name', 'Sistem Operasi');
    await page.fill('#create-course-code', 'IF2220');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Sistem Operasi')).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // 4. VERIFIKASI & SCREENSHOT: EMPTY STATE TERPADU (Belum Memiliki Tugas)
    // =========================================================================
    await page.goto('/dashboard');
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

    // Verifikasi teks "Belum ada tugas" di strip statistik
    await expect(page.getByText('Belum ada tugas').first()).toBeVisible();
    // Verifikasi empty state tugas terpadu
    await expect(page.getByText('Belum ada tugas tercatat')).toBeVisible();

    const setTheme = async (mode: 'light' | 'dark') => {
      await page.evaluate((t) => {
        if (t === 'dark') {
          document.documentElement.classList.add('dark');
          localStorage.setItem('studyflow-theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('studyflow-theme', 'light');
        }
      }, mode);
      await page.waitForTimeout(250);
    };

    const takeScreenshot = async (options: { path: string; fullPage?: boolean }) => {
      if (process.env.PW_NO_CAPTURE === '1') {
        return;
      }
      await page.screenshot(options);
    };

    // Screenshot Empty State Desktop (1440x900) Light
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme('light');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'dashboard-empty-desktop-light.png'),
      fullPage: true,
    });

    // =========================================================================
    // 5. ISI DATA: Tugas Hari Ini, Tugas Mendatang, & Nama Panjang
    // =========================================================================
    // Tugas 1: Hari ini (Tinggi)
    await page.click('button:has-text("Tambah tugas")');
    await expect(page.locator('h2:has-text("Tambah Tugas Baru")')).toBeVisible();
    await page.fill('#task-title', 'Laporan Praktikum Socket TCP dan Protokol Komunikasi Jaringan Komputer');
    await page.click('#task-duedate');
    const todayDate = new Date().getDate().toString();
    await page.locator('[data-slot="calendar"] button:not([disabled])').getByText(todayDate, { exact: true }).first().click();
    await page.click('#task-priority');
    await page.locator('[role="option"]:has-text("Tinggi")').click();
    await page.click('#task-course');
    await page.locator('[role="option"]').first().click();
    await page.click('button:has-text("Simpan Tugas")');
    await expect(page.locator('h2:has-text("Tambah Tugas Baru")')).not.toBeVisible();
    await expect(page.getByText('Laporan Praktikum Socket TCP')).toBeVisible({ timeout: 10000 });

    // Tugas 2: Mendatang (Sedang)
    await page.click('button:has-text("Tambah tugas")');
    await expect(page.locator('h2:has-text("Tambah Tugas Baru")')).toBeVisible();
    await page.fill('#task-title', 'Analisis Threading POSIX & Sinkronisasi Mutex');
    await page.click('#task-duedate');
    const futureDay = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).getDate().toString();
    await page.locator('[data-slot="calendar"] button:not([disabled])').getByText(futureDay, { exact: true }).last().click();
    await page.click('#task-priority');
    await page.locator('[role="option"]:has-text("Sedang")').click();
    await page.click('#task-course');
    await page.locator('[role="option"]').nth(1).click();
    await page.click('button:has-text("Simpan Tugas")');
    await expect(page.locator('h2:has-text("Tambah Tugas Baru")')).not.toBeVisible();
    await expect(page.getByText('Analisis Threading POSIX')).toBeVisible({ timeout: 10000 });

    // Tunggu animasi stabil
    await page.waitForTimeout(500);

    // =========================================================================
    // 6. SCREENSHOTS POPULATED DASHBOARD
    // =========================================================================

    // Desktop Light (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme('light');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'dashboard-desktop-light.png'),
      fullPage: true,
    });

    // Desktop Dark (1440x900)
    await setTheme('dark');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'dashboard-desktop-dark.png'),
      fullPage: true,
    });

    // Tablet Light (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await setTheme('light');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'dashboard-tablet-light.png'),
      fullPage: true,
    });

    // Mobile Light (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await setTheme('light');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'dashboard-mobile-light.png'),
      fullPage: true,
    });

    // Mobile Dark (375x812)
    await setTheme('dark');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'dashboard-mobile-dark.png'),
      fullPage: true,
    });
  });
});
