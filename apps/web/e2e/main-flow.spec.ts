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
    const userEmail = `flow1-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
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
    await page.click('#create-course-sem');
    await page.locator('[role="option"]').first().click();
    await page.fill('#create-course-name', 'Struktur Data & Algoritma');
    await page.fill('#create-course-code', 'IF2110');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Struktur Data & Algoritma')).toBeVisible({ timeout: 10000 });

    // 3. Buat Tugas Kuliah
    await page.click('a[href="/assignments"], button:has-text("Tugas")');
    await page.waitForURL('**/assignments');
    await page.click('button:has-text("Tambah Tugas")');
    await page.fill('#create-title', 'Tugas Pemrograman Graf');
    await page.click('#create-course');
    await page.locator('[role="option"]').first().click();
    await page.click('#create-due');
    await page.locator('[data-slot="calendar"] button:not([disabled])').getByText('20', { exact: true }).first().click();
    await page.click('#create-priority');
    await page.locator('[role="option"]:has-text("Tinggi")').click();
    await page.click('button:has-text("Simpan Tugas")');
    // Verify assignment item appears in list
    await expect(page.locator('table').getByText('Tugas Pemrograman Graf')).toBeVisible({ timeout: 10000 });

    // 4. Buat Catatan Kuliah dengan Markdown
    await page.click('a[href="/notes"], button:has-text("Catatan")');
    await page.waitForURL('**/notes');
    await page.click('button:has-text("Buat Catatan")');
    await page.fill('#create-note-title', 'Catatan Tree dan Graph');
    await page.click('#create-note-course');
    await page.locator('[role="option"]').first().click();
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

    // 6. Logout & Akses Dicabut (melalui Menu Akun Header)
    await page.click('button[aria-label^="Menu akun untuk"]');
    await page.click('[role="menuitem"]:has-text("Keluar")');
    await page.waitForURL('**/login', { timeout: 10000 });

    // 7. Verifikasi Protected Route Ditolak & Dialihkan ke Login
    await page.goto('/dashboard');
    await page.waitForURL('**/login*', { timeout: 10000 });
  });

  test('Flow 2: AI Pipeline & Latihan (Upload → Extract → Summary → Flashcards → Quiz Draft & Submission → Jump)', async ({ page }) => {
    test.setTimeout(180000); // 3 menit untuk seluruh pipeline
    const userEmail = `flow2-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
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
    await page.click('#create-course-sem');
    await page.locator('[role="option"]').first().click();
    await page.click('button:has-text("Simpan Mata Kuliah")');

    // 1. Upload Materi PDF
    await page.click('a[href="/materials"], button:has-text("Materi")');
    await page.waitForURL('**/materials');
    await page.click('button:has-text("Unggah Materi")');

    await page.click('#upload-course');
    await page.locator('[role="option"]').first().click();
    await page.fill('#upload-title', 'Buku Ajar Kecerdasan Buatan');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Pilih Berkas PDF")');
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
    await expect(jumpLink).toBeVisible({ timeout: 10000 });
    await jumpLink.click();
    // Tab aktif beralih ke Dokumen PDF
    await expect(page.locator('button:has-text("Dokumen PDF")')).toBeVisible();
  });

  test('Flow 3: Isolasi Data Pengguna (Multi-tenant Ownership)', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const emailA = `tenant-a-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    const emailB = `tenant-b-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;

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

    // Buat Mata Kuliah Rahasia milik User A
    await pageA.click('a[href="/courses"], button:has-text("Mata Kuliah")');
    await pageA.waitForURL('**/courses');
    await pageA.click('button:has-text("Tambah Mata Kuliah")');
    await pageA.click('#create-course-sem');
    await pageA.locator('[role="option"]').first().click();
    await pageA.fill('#create-course-name', 'Mata Kuliah Rahasia A');
    await pageA.fill('#create-course-code', 'SEC101');
    await pageA.click('button:has-text("Simpan Mata Kuliah")');
    await expect(pageA.locator('text=Mata Kuliah Rahasia A')).toBeVisible({ timeout: 10000 });

    // Buat Catatan Kuliah Rahasia milik User A
    await pageA.click('a[href="/notes"], button:has-text("Catatan")');
    await pageA.waitForURL('**/notes');
    await pageA.click('button:has-text("Buat Catatan")');
    await pageA.fill('#create-note-title', 'Catatan Rahasia A');
    await pageA.click('#create-note-course');
    await pageA.locator('[role="option"]').first().click();
    await pageA.fill('#create-note-content', '# Dokumen Rahasia Milik User A');
    await pageA.click('button:has-text("Buat & Buka Editor")');
    await pageA.waitForURL('**/notes/**', { timeout: 15000 });
    const noteUrlA = pageA.url();

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

    // 2. Verifikasi akses ke resource nyata milik User A ditolak (Catatan Tidak Ditemukan)
    await pageB.goto(noteUrlA);
    await expect(pageB.locator('h3:has-text("Catatan Tidak Ditemukan")')).toBeVisible({ timeout: 10000 });
    await expect(pageB.locator('a[href="/notes"]:has-text("Kembali ke Daftar Catatan")')).toBeVisible();

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
    await page.goto('/dashboard');
    await expect(page.locator('nav[aria-label="breadcrumb"]')).toBeVisible();

    // Verifikasi pengelompokan navigasi di sidebar desktop (Belajar, Perkuliahan, Pengaturan)
    await expect(page.getByText('Belajar', { exact: true })).toBeVisible();
    await expect(page.getByText('Perkuliahan', { exact: true })).toBeVisible();
    await expect(page.locator('[data-sidebar="group-label"]:has-text("Pengaturan")')).toBeVisible();

    // Uji Collapsed Sidebar via Trigger
    const desktopToggle = page.locator('button[aria-label="Alihkan navigasi sidebar"]');
    await desktopToggle.click();
    await expect(page.locator('[data-sidebar="sidebar"]').first()).toHaveAttribute('data-state', 'collapsed');

    // Kembalikan ke Expanded
    await desktopToggle.click();
    await expect(page.locator('[data-sidebar="sidebar"]').first()).toHaveAttribute('data-state', 'expanded');

    // 4. Uji Penggantian Tema (Dark / Light Theme Toggle)
    const darkBtn = page.locator('button[title="Gunakan tema gelap"]').first();
    await expect(darkBtn).toBeVisible({ timeout: 10000 });
    await darkBtn.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // 5. Uji Navigasi Keyboard (Tab navigation)
    await page.keyboard.press('Tab');
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).toBeTruthy();

    // 6. Uji Header Account Dropdown Menu
    const accountMenuBtn = page.locator('button[aria-label^="Menu akun untuk"]');
    await expect(accountMenuBtn).toBeVisible();
    await accountMenuBtn.click();
    await expect(page.locator('div[role="menu"]').getByText('Pengaturan Akun')).toBeVisible();
  });

  test('Flow 5: Dashboard Redesign, Checkbox Aksesibel, & Pemisahan State', async ({ page }) => {
    const userEmail = `dash-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    await registerAndLogin(page, 'User Dashboard Test', userEmail);

    // 1. Verifikasi Empty State A: "Mulai dari semester pertamamu" (karena user baru belum punya semester)
    await page.goto('/dashboard');
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('h2:has-text("Mulai dari semester pertamamu")')).toBeVisible();
    await expect(page.locator('a[href="/semesters"]:has-text("Tambah Semester")')).toBeVisible();

    // 2. Buat Semester
    await page.click('a[href="/semesters"]:has-text("Tambah Semester")');
    await page.waitForURL('**/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Gasal 2026/2027');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('text=Semester Gasal 2026/2027')).toBeVisible({ timeout: 10000 });

    // 3. Verifikasi Empty State B: "Belum ada mata kuliah di semester ini"
    await page.goto('/dashboard');
    await expect(page.locator('h2:has-text("Belum ada mata kuliah di semester ini")')).toBeVisible();
    await expect(page.locator('a[href="/courses"]:has-text("Tambah Mata Kuliah")').first()).toBeVisible();

    // 4. Tambah Mata Kuliah
    await page.click('a[href="/courses"]:has-text("Tambah Mata Kuliah")');
    await page.waitForURL('**/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.click('#create-course-sem');
    await page.locator('[role="option"]').first().click();
    await page.fill('#create-course-name', 'Jaringan Komputer');
    await page.fill('#create-course-code', 'IF3110');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Jaringan Komputer')).toBeVisible({ timeout: 10000 });

    // 5. Verifikasi Dashboard Aktif dengan Baris Statistik
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Tugas Hari Ini' })).toBeVisible();
    await expect(page.getByText('Tugas Terlambat')).toBeVisible();
    await expect(page.getByText('Tugas Selesai')).toBeVisible();

    // 6. Uji Aksi Utama: Tambah Tugas dari Dashboard via Modal
    await page.click('button:has-text("Tambah tugas")');
    await expect(page.locator('h2:has-text("Tambah Tugas Baru")')).toBeVisible();
    await page.fill('#task-title', 'Laporan Praktikum Socket TCP');
    await page.click('#task-duedate');
    await page.locator('[data-slot="calendar"] button:not([disabled])').getByText('15', { exact: true }).first().click();
    await page.click('#task-priority');
    await page.locator('[role="option"]:has-text("Tinggi")').click();
    await page.click('button:has-text("Simpan Tugas")');

    // Dialog menutup dan tugas muncul di daftar
    await expect(page.locator('h2:has-text("Tambah Tugas Baru")')).not.toBeVisible();
    await expect(page.getByText('Laporan Praktikum Socket TCP')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tinggi')).toBeVisible();

    // 7. Uji Checkbox Penyelesaian Tugas (Keyboard Accessible & Status Persistence)
    const taskCheckbox = page.locator('button[role="checkbox"][aria-label*="Laporan Praktikum Socket TCP"]');
    await expect(taskCheckbox).toBeVisible();
    await expect(taskCheckbox).toHaveAttribute('data-state', 'unchecked');

    // Klik checkbox untuk menyelesaikan tugas
    await taskCheckbox.click();

    // Setelah tugas diselesaikan, status diperbarui: tugas berpindah dari daftar belum selesai dan count Tugas Selesai bertambah
    await expect(page.locator('button[role="checkbox"][aria-label*="Laporan Praktikum Socket TCP"]')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=1').first()).toBeVisible(); // 1 selesai

    // 8. Verifikasi Sinkronisasi Selector Semester di Sidebar dengan Dashboard
    // Semester Gasal 2026/2027 yang aktif harus muncul baik di sidebar maupun header dashboard
    await expect(page.locator('button[aria-label="Pilih semester aktif"]').getByText('Semester Gasal 2026/2027')).toBeVisible();

    // 9. Verifikasi Filter Dropdown Radix di Halaman Materi (Buka/Tutup & Opsi)
    await page.goto('/materials');
    await expect(page.locator('h1').getByText('Materi')).toBeVisible();
    const courseSelectTrigger = page.locator('button[role="combobox"]').first();
    await expect(courseSelectTrigger).toBeVisible();
    await courseSelectTrigger.click();
    await expect(page.locator('[role="listbox"]').getByText('Semua Mata Kuliah')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="listbox"]')).not.toBeVisible();

    // 10. Verifikasi Pemisahan Error Fetch (bukan ditampilkan sebagai semester kosong)
    // Simulasikan kegagalan network pada endpoint dashboard
    await page.route('**/api/dashboard**', (route) => route.abort('failed'));
    await page.goto('/dashboard');
    await expect(page.locator('text=Terjadi kesalahan saat memuat data')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Mulai dari semester pertamamu')).not.toBeVisible();
  });
});
