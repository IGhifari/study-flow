import { test, expect } from '@playwright/test';

test.use({ screenshot: 'off' });

test.describe('Notes List & Dialog Management Flow', () => {
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[BROWSER EXCEPTION]:', err));
  });

  async function registerAndLogin(page: any) {
    const userEmail = `notes-list-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    await page.goto('/register');
    await page.fill('#name', 'Notes List Tester');
    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }

  async function setupSemesterAndCourse(page: any) {
    // 1. Semester
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Ganjil OS');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('main').getByText('Semester Ganjil OS')).toBeVisible({ timeout: 10000 });

    // 2. Course
    await page.goto('/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.fill('#create-course-name', 'Sistem Operasi');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('main').getByText('Sistem Operasi')).toBeVisible({ timeout: 10000 });
  }

  test('Daftar catatan: Onboarding, input retention form, search, batalkan hapus, dan hapus catatan', async ({ page }) => {
    test.setTimeout(60000);
    await registerAndLogin(page);
    await setupSemesterAndCourse(page);

    // 1. Kunjungi Halaman Catatan
    await page.goto('/notes');
    await expect(page).toHaveURL(/\/notes/);

    // Verifikasi Header & Konteks Semester
    await expect(page.locator('h1')).toHaveText('Catatan');
    await expect(page.locator('main').getByText('Semester Ganjil OS (2026/2027)')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('main').getByText('0 catatan terdaftar')).toBeVisible();

    // Verifikasi Empty Onboarding
    await expect(page.locator('text=Belum ada catatan belajar')).toBeVisible();

    // 2. Tambah Catatan 1 & Verifikasi Input Retention
    await page.click('button:has-text("Buat catatan")');
    await expect(page.locator('text=Buat Catatan Baru')).toBeVisible();

    // Coba submit tanpa judul untuk menguji retensi input & pesan error
    await page.fill('#create-note-content', 'Catatan penting mengenai starvation dan deadlock.');
    await page.click('button:has-text("Buat & Buka Editor")');
    await expect(page.locator('text=Judul catatan wajib diisi')).toBeVisible();
    await expect(page.locator('#create-note-content')).toHaveValue('Catatan penting mengenai starvation dan deadlock.');

    // Lengkapi judul dan buat catatan
    await page.fill('#create-note-title', 'Catatan Deadlock dan Concurrency');
    await page.click('button:has-text("Buat & Buka Editor")');
    await page.waitForURL('**/notes/**', { timeout: 15000 });

    // 3. Tambah Catatan 2
    await page.goto('/notes');
    await page.click('button:has-text("Buat catatan")');
    await page.fill('#create-note-title', 'Catatan Manajemen Memori Virtual');
    await page.click('button:has-text("Buat & Buka Editor")');
    await page.waitForURL('**/notes/**', { timeout: 15000 });

    // 4. Verifikasi Tampilan di Daftar Catatan
    await page.goto('/notes');
    await expect(page.locator('table').getByText('Catatan Deadlock dan Concurrency')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Catatan Manajemen Memori Virtual')).toBeVisible();

    // 5. Pencarian & Reset Filter
    await page.fill('input[placeholder="Cari judul catatan..."]', 'Deadlock');
    await expect(page.locator('table').getByText('Catatan Deadlock dan Concurrency')).toBeVisible();
    await expect(page.locator('table').getByText('Catatan Manajemen Memori Virtual')).not.toBeVisible();

    await page.click('button:has-text("Hapus filter")');
    await expect(page.locator('table').getByText('Catatan Deadlock dan Concurrency')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Catatan Manajemen Memori Virtual')).toBeVisible();

    // 6. Dialog Hapus Catatan (Batal & Eksekusi Hapus)
    const secondRow = page.locator('tr').filter({ hasText: 'Catatan Manajemen Memori Virtual' });
    await secondRow.locator('button[aria-label*="Menu aksi"]').click();
    await page.click('text=Hapus catatan');

    // Dialog hapus terbuka dan menyebutkan judul catatan
    await expect(page.getByRole('heading', { name: 'Hapus Catatan' })).toBeVisible();
    await expect(page.locator('text=Apakah Anda yakin ingin menghapus catatan')).toBeVisible();
    await expect(page.locator('div[role="dialog"]').getByText('Catatan Manajemen Memori Virtual')).toBeVisible();

    // Batalkan hapus
    await page.click('button:has-text("Batal")');
    await expect(page.getByRole('heading', { name: 'Hapus Catatan' })).not.toBeVisible();
    await expect(page.locator('table').getByText('Catatan Manajemen Memori Virtual')).toBeVisible();

    // Buka kembali dialog dan konfirmasi Hapus
    await secondRow.locator('button[aria-label*="Menu aksi"]').click();
    await page.click('text=Hapus catatan');
    await page.getByRole('button', { name: 'Hapus Catatan' }).click();

    // Verifikasi catatan terhapus
    await expect(page.getByRole('heading', { name: 'Hapus Catatan' })).not.toBeVisible();
    await expect(page.locator('table').getByText('Catatan Manajemen Memori Virtual')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Catatan Deadlock dan Concurrency')).toBeVisible();
  });
});
