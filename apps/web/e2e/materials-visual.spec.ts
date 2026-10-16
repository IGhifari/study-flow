import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, '../../../docs/screenshots');

test.describe('Materials Visual Inspection & Upload Screenshots', () => {
  test('Capture materials list and upload dialog across viewports and themes', async ({ page }) => {
    test.setTimeout(180000);
    const timestamp = Date.now();
    const userEmail = `mat-visual-${timestamp}@studyflow.test`;
    const testPassword = 'SecretPass123!';

    // 1. Register dan Login
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

    // 2. Buat Semester
    await page.click('a[href="/semesters"]:has-text("Tambah Semester")');
    await page.waitForURL('**/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Gasal 2026/2027');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('text=Semester Gasal 2026/2027')).toBeVisible({ timeout: 10000 });

    // 3. Tambah Mata Kuliah
    await page.goto('/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.click('#create-course-sem');
    await page.locator('[role="option"]').first().click();
    await page.fill('#create-course-name', 'Jaringan Komputer dan Komunikasi Data Tingkat Lanjut');
    await page.fill('#create-course-code', 'IF3110');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Jaringan Komputer')).toBeVisible({ timeout: 10000 });

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

    // =========================================================================
    // 4. SCREENSHOT: EMPTY STATE DAFTAR MATERI
    // =========================================================================
    await page.goto('/materials');
    await expect(page.locator('h1:has-text("Materi")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Belum ada materi kuliah')).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme('light');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'materials-empty-desktop-light.png'),
      fullPage: true,
    });

    // =========================================================================
    // 5. SCREENSHOT: DIALOG UNGGAH MATERI (DESKTOP & MOBILE)
    // =========================================================================
    await page.click('button:has-text("Unggah materi")');
    await expect(page.locator('div[role="dialog"] h2:has-text("Unggah Materi PDF")')).toBeVisible();

    // Dialog Desktop Light
    await takeScreenshot({
      path: path.join(screenshotsDir, 'material-upload-dialog-desktop-light.png'),
    });

    // Dialog Desktop Dark
    await setTheme('dark');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'material-upload-dialog-desktop-dark.png'),
    });

    // Dialog Mobile 375px Dark
    await page.setViewportSize({ width: 375, height: 812 });
    await takeScreenshot({
      path: path.join(screenshotsDir, 'material-upload-dialog-mobile-dark.png'),
    });

    // Dialog Mobile 375px Light
    await setTheme('light');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'material-upload-dialog-mobile-light.png'),
    });

    // =========================================================================
    // 6. VERIFIKASI RETENSI INPUT SAAT UPLOAD GAGAL & RETRY SUKSES TERISOLASI
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('#upload-course');
    await page.locator('[role="option"]').first().click();
    const longTitle =
      'Modul Perkuliahan Komprehensif Protokol Jaringan Komputer, TCP/IP, dan Model OSI Layer';
    await page.fill('#upload-title', longTitle);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Pilih Berkas PDF")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve('apps/web/e2e/fixtures/sample.pdf'));

    // Verifikasi bahwa nama file dan mata kuliah muncul di dropzone
    await expect(page.locator('text=sample.pdf')).toBeVisible();

    // 6a. Uji kegagalan upload: gagalkan inisiasi upload sekali untuk memverifikasi retensi input
    let failUploadOnce = true;
    await page.route('**/api/materials/initiate-upload', async (route) => {
      if (failUploadOnce && route.request().method() === 'POST') {
        failUploadOnce = false;
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    // Submit saat simulasi error aktif
    await page.locator('div[role="dialog"] button:has-text("Unggah Materi")').click();

    // Verifikasi error alert muncul dan input form TETAP DIPERTAHANKAN (tidak terhapus)
    await expect(page.locator('div[role="dialog"] [role="alert"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#upload-title')).toHaveValue(longTitle);
    await expect(page.locator('#upload-course')).not.toHaveText('Pilih mata kuliah...');
    await expect(page.locator('text=sample.pdf')).toBeVisible();

    // Unroute untuk retry normal
    await page.unroute('**/api/materials/initiate-upload');

    // 6b. Retry submit tanpa mengisi ulang formulir
    await page.locator('div[role="dialog"] button:has-text("Unggah Materi")').click();
    await expect(page.locator('text=File berhasil diterima')).toBeVisible({ timeout: 20000 });

    // Tunggu dialog menutup otomatis dan tabel materi muncul
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('table').getByText('Siap dipelajari')).toBeVisible({ timeout: 45000 });

    // Tambah materi kedua untuk variasi daftar
    await page.click('button:has-text("Unggah materi")');
    await expect(page.locator('div[role="dialog"] h2:has-text("Unggah Materi PDF")')).toBeVisible();
    await page.click('#upload-course');
    await page.locator('[role="option"]').first().click();
    await page.fill('#upload-title', 'Slide Presentasi Arsitektur DNS dan Routing BGP');
    const fileChooser2Promise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Pilih Berkas PDF")');
    const fileChooser2 = await fileChooser2Promise;
    await fileChooser2.setFiles(path.resolve('apps/web/e2e/fixtures/sample.pdf'));
    await page.locator('div[role="dialog"] button:has-text("Unggah Materi")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('table').getByText('Slide Presentasi Arsitektur DNS')).toBeVisible({ timeout: 45000 });

    // =========================================================================
    // 7. SCREENSHOT: DAFTAR MATERI TERISI (DESKTOP & MOBILE, LIGHT & DARK)
    // =========================================================================

    // Desktop Light (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme('light');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'materials-desktop-light.png'),
      fullPage: true,
    });

    // Desktop Dark (1440x900)
    await setTheme('dark');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'materials-desktop-dark.png'),
      fullPage: true,
    });

    // Mobile Light (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await setTheme('light');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'materials-mobile-light.png'),
      fullPage: true,
    });

    // Mobile Dark (375x812)
    await setTheme('dark');
    await takeScreenshot({
      path: path.join(screenshotsDir, 'materials-mobile-dark.png'),
      fullPage: true,
    });
  });
});
