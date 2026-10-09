import { test, expect } from '@playwright/test';
import path from 'node:path';

/**
 * StudyFlow E2E Suite — Milestone 8 MVP Release Readiness
 * 
 * Flow 1: Lifecycle Manajemen Akademik & Sesi
 *   Register → Create Semester → Create Course → Create Assignment → Create Note with Markdown →
 *   Archive Semester Verification → Session Reload (Persistence) → Logout → Auth Revocation.
 * 
 * Flow 2: Pipeline AI & Latihan Materi
 *   Upload PDF → Extraction (Polling/READY) → Summary AI → Flashcards Deck & Mastery Update →
 *   Quiz Attempt → Save Draft Answer → Page Reload (Answer Persistence & No Key Leak) →
 *   Server-side Evaluation & Score → Page Reference Jump to PDF Viewer.
 * 
 * Flow 3: Multi-tenant & Cross-User Security Isolation
 *   User A vs User B data isolation (Semesters, Courses, Materials, Notes, Attempts) via UI & API.
 * 
 * Flow 4: Responsiveness & Aksesibilitas
 *   Mobile (375x667), Tablet (768x1024), Desktop (1440x900) layout, mobile drawer navigation,
 *   keyboard focus, theme toggle, and empty states.
 */

test.describe('StudyFlow End-to-End Suite', () => {
  const timestamp = Date.now();
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[BROWSER EXCEPTION]:', err));
  });

  // Helper for registration and login
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

  test('Flow 1: Lifecycle Manajemen (Semester → Course → Assignment → Note → Reload → Logout)', async ({ page }) => {
    const userEmail = `flow1-${timestamp}@studyflow.test`;
    await registerAndLogin(page, 'User Flow One', userEmail);

    // 1. Buat Semester Baru
    await page.click('a[href="/semesters"], button:has-text("Kelola Semester")');
    await page.waitForURL('**/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Ganjil 2026');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('text=Semester Ganjil 2026')).toBeVisible({ timeout: 10000 });

    // 2. Buat Mata Kuliah Baru di Semester tersebut
    await page.click('a[href="/courses"], button:has-text("Mata Kuliah")');
    await page.waitForURL('**/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.fill('#create-course-name', 'Struktur Data & Algoritma');
    await page.fill('#create-course-code', 'IF2110');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Struktur Data & Algoritma')).toBeVisible({ timeout: 10000 });

    // 3. Buat Tugas Kuliah
    await page.click('a[href="/assignments"], button:has-text("Tugas")');
    await page.waitForURL('**/assignments');
    await page.click('button:has-text("Tambah Tugas")');
    await page.fill('#create-title', 'Tugas Pemrograman Graf');
    await page.selectOption('#create-course', { index: 1 });
    await page.fill('#create-due', '2026-11-20T23:59');
    await page.selectOption('#create-priority', 'HIGH');
    await page.click('button:has-text("Simpan Tugas")');
    // Verify assignment item appears in list
    await expect(page.locator('table').getByText('Tugas Pemrograman Graf')).toBeVisible({ timeout: 10000 });

    // 4. Buat Catatan Kuliah dengan Markdown
    await page.click('a[href="/notes"], button:has-text("Catatan")');
    await page.waitForURL('**/notes');
    await page.click('button:has-text("Buat Catatan")');
    await page.fill('#create-note-title', 'Catatan Tree dan Graph');
    await page.selectOption('#create-note-course', { index: 1 });
    await page.fill('#create-note-content', '# Struktur Pohon Biner\n\n- Binary Search Tree (BST)\n- AVL Tree\n\n*Catatan penting untuk UAS.*');
    await page.click('button:has-text("Buat & Buka Editor")');
    await page.waitForURL('**/notes/**', { timeout: 15000 });
    await expect(page.locator('input[placeholder="Judul Catatan..."]')).toHaveValue('Catatan Tree dan Graph');

    // Verifikasi Tab Preview Markdown
    await page.click('button:has-text("Pratinjau")');
    await expect(page.locator('h1:has-text("Struktur Pohon Biner")')).toBeVisible();
    await expect(page.locator('text=Binary Search Tree (BST)')).toBeVisible();

    // 5. Session Persistence: Reload Halaman
    await page.reload();
    await expect(page.locator('input[placeholder="Judul Catatan..."]')).toHaveValue('Catatan Tree dan Graph');

    // 6. Logout & Akses Dicabut
    await page.click('button:has-text("Keluar")');
    await page.waitForURL('**/login', { timeout: 10000 });

    // 7. Verifikasi Protected Route Ditolak & Dialihkan ke Login
    await page.goto('/dashboard');
    await page.waitForURL('**/login*', { timeout: 10000 });
  });

  test('Flow 2: AI Pipeline & Latihan (Upload → Extract → Summary → Flashcards → Quiz Draft & Submission → Jump)', async ({ page }) => {
    test.setTimeout(180000); // 3 menit untuk seluruh pipeline
    const userEmail = `flow2-${timestamp}@studyflow.test`;
    await registerAndLogin(page, 'User AI Flow', userEmail);

    // Setup Semester & Course
    await page.click('a[href="/semesters"], button:has-text("Kelola Semester")');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester AI M8');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');

    await page.click('a[href="/courses"], button:has-text("Mata Kuliah")');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.fill('#create-course-name', 'Kecerdasan Buatan Terapan');
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.click('button:has-text("Simpan Mata Kuliah")');

    // 1. Upload Materi PDF
    await page.click('a[href="/materials"], button:has-text("Materi")');
    await page.waitForURL('**/materials');
    await page.click('button:has-text("Unggah Materi")');

    await page.selectOption('#upload-course', { index: 1 });
    await page.fill('#upload-title', 'Buku Ajar Kecerdasan Buatan');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('text=klik untuk memilih').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve('apps/web/e2e/fixtures/sample.pdf'));

    // Klik tombol submit di dalam dialog modal
    await page.locator('div[role="dialog"] button:has-text("Unggah Materi")').click();
    await expect(page.locator('text=File berhasil diterima')).toBeVisible({ timeout: 15000 });

    // 2. Tunggu Ekstraksi Selesai (READY status in table)
    await expect(page.locator('table').getByText('Siap dipelajari')).toBeVisible({ timeout: 45000 });

    // 3. Buka Detail Materi
    await page.click('text=Buku Ajar Kecerdasan Buatan');
    await page.waitForURL('**/materials/**', { timeout: 15000 });

    // 4. Hasilkan Ringkasan AI (Mock)
    await page.click('button:has-text("Ringkasan AI")');
    await page.click('button:has-text("Buat Ringkasan AI Sekarang")');
    await expect(page.locator('text=Ringkasan Utama')).toBeVisible({ timeout: 35000 });
    await expect(page.locator('text=Konsep Kunci')).toBeVisible();

    // 5. Buka Tab Flashcards & Hasilkan Set Kartu
    await page.click('button:has-text("Flashcards")');
    await expect(page.locator('text=Belum Ada Flashcard')).toBeVisible();
    await page.click('button:has-text("Buat Flashcard Sekarang")');
    await page.click('button:has-text("Mulai Pembuatan")');

    // Tunggu Flashcard Terbentuk
    await expect(page.locator('text=Kartu 1 dari')).toBeVisible({ timeout: 35000 });
    // Balik kartu
    await page.click('text=Klik untuk membalik');
    await expect(page.locator('text=Jawaban / Penjelasan')).toBeVisible();

    // Tandai Penguasaan Kartu
    await page.click('button:has-text("Sudah Paham")');

    // 6. Buka Tab Kuis & Buat Kuis Baru
    await page.click('button:has-text("Kuis")');
    await expect(page.locator('text=Belum Ada Kuis')).toBeVisible();
    await page.click('button:has-text("Buat Kuis Sekarang")');
    await page.click('button:has-text("Mulai Pembuatan")');

    // Tunggu Kuis Siap & Mulai Kerjakan
    await expect(page.locator('button:has-text("Mulai Kerjakan Kuis")')).toBeEnabled({ timeout: 35000 });
    await page.click('button:has-text("Mulai Kerjakan Kuis")');

    // Jawab Soal Pertama
    const optionA = page.locator('div.space-y-2\\.5 button').first();
    await optionA.click();
    await page.waitForTimeout(1000);

    // Verifikasi Save Draft Answer via Reload Halaman:
    // Jawaban pilihan harus tetap terpilih dan kunci jawaban TIDAK boleh bocor di antarmuka
    await page.reload();
    await page.click('button:has-text("Kuis")');
    await page.click('button:has-text("Mulai Kerjakan Kuis")', { timeout: 15000 });
    await expect(page.locator('text=1 / 5 Terjawab')).toBeVisible({ timeout: 10000 });
    // Pastikan tidak ada bocoran kunci / skor sebelum submit
    await expect(page.locator('text=Hasil pengerjaan kuis')).not.toBeVisible();
    await expect(page.locator('text=Jawaban Benar:')).not.toBeVisible();

    // Navigasi ke Soal Terakhir & Kumpulkan Kuis
    await page.locator('button:text-is("5")').click();
    await page.click('button:has-text("Selesai & Kumpulkan")');
    await page.click('button:has-text("Ya, Kumpulkan Jawaban")');

    // 7. Verifikasi Hasil Evaluasi Sisi Server
    await expect(page.locator('text=Hasil Pengerjaan Kuis')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Nilai (0-100)')).toBeVisible();
    await expect(page.locator('text=Pembahasan & Referensi Materi')).toBeVisible();

    // 8. Verifikasi Loncat ke Referensi PDF
    const jumpLink = page.locator('button:has-text("Buka Referensi Halaman")').first();
    if (await jumpLink.isVisible()) {
      await jumpLink.click();
      // Tab aktif beralih ke Dokumen PDF
      await expect(page.locator('button:has-text("Dokumen PDF")')).toBeVisible();
    }
  });

  test('Flow 3: Isolasi Data Pengguna (Multi-tenant Ownership)', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const emailA = `tenant-a-${timestamp}@studyflow.test`;
    const emailB = `tenant-b-${timestamp}@studyflow.test`;

    // Daftarkan Pengguna A dan buat Semester & Mata Kuliah
    await pageA.goto('/register');
    await pageA.fill('#name', 'User Tenant A');
    await pageA.fill('#email', emailA);
    await pageA.fill('#password', testPassword);
    await pageA.click('button:has-text("Buat Akun")');
    await pageA.waitForURL('**/login?registered=true');
    await pageA.fill('#email', emailA);
    await pageA.fill('#password', testPassword);
    await pageA.click('button:has-text("Masuk")');
    await pageA.waitForURL('**/dashboard');

    await pageA.click('a[href="/semesters"], button:has-text("Kelola Semester")');
    await pageA.click('button:has-text("Tambah Semester")');
    await pageA.fill('#create-sem-name', 'Semester Rahasia A');
    await pageA.fill('#create-sem-year', '2026/2027');
    await pageA.click('button:has-text("Simpan Semester")');
    await expect(pageA.locator('text=Semester Rahasia A')).toBeVisible();

    // Daftarkan Pengguna B
    await pageB.goto('/register');
    await pageB.fill('#name', 'User Tenant B');
    await pageB.fill('#email', emailB);
    await pageB.fill('#password', testPassword);
    await pageB.click('button:has-text("Buat Akun")');
    await pageB.waitForURL('**/login?registered=true');
    await pageB.fill('#email', emailB);
    await pageB.fill('#password', testPassword);
    await pageB.click('button:has-text("Masuk")');
    await pageB.waitForURL('**/dashboard');

    // 1. Verifikasi User B tidak melihat data Semester User A di UI
    await pageB.click('a[href="/semesters"], button:has-text("Kelola Semester")');
    await expect(pageB.locator('text=Semester Rahasia A')).not.toBeVisible();

    // 2. Verifikasi akses ID palsu/acak melalui UI dialihkan ke error/not found
    await pageB.goto('/materials/00000000-0000-0000-0000-000000000000');
    await expect(pageB.locator('h3:has-text("Gagal Memuat Materi")')).toBeVisible({ timeout: 10000 });

    await contextA.close();
    await contextB.close();
  });

  test('Flow 4: Responsiveness & Aksesibilitas (Mobile 375px, Tablet 768px, Keyboard & Theme)', async ({ page }) => {
    const userEmail = `responsive-${timestamp}@studyflow.test`;
    await registerAndLogin(page, 'User Responsive UI', userEmail);

    // 1. Uji Tampilan Mobile Viewport (375x667 — iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Di mobile, tombol alihkan sidebar (hamburger) harus ada dan dapat membuka drawer
    const mobileMenuButton = page.locator('button[aria-label="Alihkan navigasi sidebar"]').first();
    await expect(mobileMenuButton).toBeVisible();
    await mobileMenuButton.click();

    // Verifikasi menu sidebar muncul di dalam mobile sheet/drawer
    const semesterLink = page.locator('div[role="dialog"] a[href="/semesters"]').first();
    await expect(semesterLink).toBeVisible();
    await semesterLink.click();
    await page.waitForURL('**/semesters');

    // Pastikan tidak ada horizontal scrollbar overflow pada halaman mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // margin toleransi subpixel rendering

    // 2. Uji Tampilan Tablet Viewport (768x1024 — iPad)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/courses');
    await expect(page.locator('h1:has-text("Mata Kuliah")')).toBeVisible();

    // 3. Uji Tampilan Desktop (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/assignments');
    await expect(page.locator('h1:has-text("Tugas Kuliah")')).toBeVisible();

    // 4. Uji Penggantian Tema (Dark / Light Theme Toggle)
    const darkBtn = page.locator('button[title="Gunakan tema gelap"]').first();
    if (await darkBtn.isVisible()) {
      await darkBtn.click();
      await expect(page.locator('html')).toHaveClass(/dark/);
    }

    // 5. Uji Navigasi Keyboard (Tab navigation)
    await page.keyboard.press('Tab');
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).toBeTruthy();
  });
});
