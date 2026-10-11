import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, '../../../docs/screenshots');

test.describe('Material Detail, PDF Reader & Summary Tab Visual Inspection', () => {
  test('Verify PDF viewer, AI summary, page jump references and capture screenshots across viewports & themes', async ({
    page,
  }) => {
    test.setTimeout(240000);
    const timestamp = Date.now();
    const userEmail = `mat-detail-${timestamp}@studyflow.test`;
    const testPassword = 'SecretPass123!';

    // Helper ganti tema
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
      await page.waitForTimeout(300);
    };

    // 1. Registrasi & Login
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
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.fill('#create-course-name', 'Sistem Terdistribusi dan Komputasi Awan Tingkat Lanjut');
    await page.fill('#create-course-code', 'CS401');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Sistem Terdistribusi')).toBeVisible({ timeout: 10000 });

    // 4. Unggah Materi PDF
    await page.goto('/materials');
    await expect(page.locator('h1:has-text("Materi")')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Unggah materi")');
    await expect(page.locator('div[role="dialog"] h2:has-text("Unggah Materi PDF")')).toBeVisible();

    await page.selectOption('#upload-course', { index: 1 });
    const materialTitle =
      'Modul Perkuliahan: Konsensus Raft, Paxos, dan Replikasi State Machine Terdistribusi';
    await page.fill('#upload-title', materialTitle);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Pilih Berkas PDF")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve('apps/web/e2e/fixtures/sample.pdf'));

    await page.locator('div[role="dialog"] button:has-text("Unggah Materi")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 20000 });

    // Tunggu materi selesai diproses dan siap dipelajari
    await expect(page.locator('table').getByText('Siap dipelajari')).toBeVisible({ timeout: 45000 });

    // 5. Buka Halaman Detail Materi
    await page.click(`text=${materialTitle}`);
    await page.waitForURL('**/materials/**', { timeout: 15000 });
    await expect(page.locator('h1').getByText('Konsensus Raft')).toBeVisible({ timeout: 15000 });

    // Verifikasi elemen-elemen Header Detail
    await expect(page.locator('a:has-text("Kembali ke Materi")')).toBeVisible();
    await expect(page.locator('text=Siap dipelajari')).toBeVisible();
    await expect(page.locator('button:has-text("Unduh Berkas")')).toBeVisible();
    await expect(page.locator('button[aria-label="Pilihan aksi materi lainnya"]')).toBeVisible();

    // Verifikasi Tab Navigasi Dokumen PDF aktif secara default
    await expect(page.locator('button[role="tab"]:has-text("Dokumen PDF")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Ringkasan AI")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Flashcards")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Kuis")')).toBeVisible();

    // Tunggu iframe viewer siap
    await expect(page.locator('iframe[title^="Pratinjau PDF"]')).toBeVisible({ timeout: 15000 });

    // =========================================================================
    // 6. SCREENSHOTS: TAB DOKUMEN PDF (DESKTOP & MOBILE, LIGHT & DARK)
    // =========================================================================

    // Desktop Light (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme('light');
    await page.screenshot({
      path: path.join(screenshotsDir, 'material-detail-pdf-desktop-light.png'),
      fullPage: true,
    });

    // Desktop Dark (1440x900)
    await setTheme('dark');
    await page.screenshot({
      path: path.join(screenshotsDir, 'material-detail-pdf-desktop-dark.png'),
      fullPage: true,
    });

    // Mobile Light (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await setTheme('light');
    await page.screenshot({
      path: path.join(screenshotsDir, 'material-detail-pdf-mobile-light.png'),
      fullPage: true,
    });

    // Mobile Dark (375x812)
    await setTheme('dark');
    await page.screenshot({
      path: path.join(screenshotsDir, 'material-detail-pdf-mobile-dark.png'),
      fullPage: true,
    });

    // =========================================================================
    // 7. HASILKAN RINGKASAN AI (MOCK WORKER)
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('button[role="tab"]:has-text("Ringkasan AI")');

    // Verifikasi state awal ringkasan (onboarding & sisa kuota)
    await expect(page.locator('h3:has-text("Ringkas Materi Ini dengan AI")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Sisa kuota harian')).toBeVisible();

    // Klik buat ringkasan
    await page.click('button:has-text("Buat Ringkasan AI Sekarang")');

    // Tunggu proses AI selesai
    await expect(page.locator('text=Ringkasan Utama')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('text=Konsep Kunci')).toBeVisible();
    await expect(page.locator('text=Struktur & Bagian Materi')).toBeVisible();
    await expect(page.locator('text=Istilah Penting')).toBeVisible();

    // Verifikasi aksi di header ringkasan (Salin & Buat Ulang)
    await expect(page.locator('button:has-text("Salin Teks")')).toBeVisible();
    await expect(page.locator('button:has-text("Regenerasi")')).toBeVisible();

    // =========================================================================
    // 8. SCREENSHOTS: TAB RINGKASAN AI (DESKTOP & MOBILE, LIGHT & DARK)
    // =========================================================================

    // Desktop Light (1440x900)
    await setTheme('light');
    await page.screenshot({
      path: path.join(screenshotsDir, 'material-detail-summary-desktop-light.png'),
      fullPage: true,
    });

    // Desktop Dark (1440x900)
    await setTheme('dark');
    await page.screenshot({
      path: path.join(screenshotsDir, 'material-detail-summary-desktop-dark.png'),
      fullPage: true,
    });

    // Mobile Light (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await setTheme('light');
    await page.screenshot({
      path: path.join(screenshotsDir, 'material-detail-summary-mobile-light.png'),
      fullPage: true,
    });

    // Mobile Dark (375x812)
    await setTheme('dark');
    await page.screenshot({
      path: path.join(screenshotsDir, 'material-detail-summary-mobile-dark.png'),
      fullPage: true,
    });

    // =========================================================================
    // 9. VERIFIKASI INTERAKSI JUMP REFERENCE KE PDF
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 900 });
    // Temukan tombol rujukan halaman ("Hal. X")
    const pageJumpBtn = page.locator('button:has-text("Hal.")').first();
    await expect(pageJumpBtn).toBeVisible({ timeout: 10000 });
    await pageJumpBtn.click();

    // Verifikasi tab otomatis berpindah kembali ke "Dokumen PDF" dan banner rujukan muncul
    await expect(page.locator('iframe[title^="Pratinjau PDF"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Dokumen PDF', selected: true })).toBeVisible();
    await expect(page.locator('text=Menampilkan sumber rujukan:')).toBeVisible();
  });
});
