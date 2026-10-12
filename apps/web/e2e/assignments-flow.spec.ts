import { test, expect } from '@playwright/test';

test.use({ screenshot: 'off' });

test.describe('Assignments Redesign & Interactions Flow', () => {
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[BROWSER EXCEPTION]:', err));
  });

  async function registerAndLogin(page: any) {
    const userEmail = `asg-flow-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    await page.goto('/register');
    await page.fill('#name', 'Assignment Tester');
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
    await page.fill('#create-sem-name', 'Semester Ganjil Asg');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('main').getByText('Semester Ganjil Asg')).toBeVisible({ timeout: 10000 });

    // 2. Course
    await page.goto('/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.fill('#create-course-name', 'Algoritma & Struktur Data');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('main').getByText('Algoritma & Struktur Data')).toBeVisible({ timeout: 10000 });
  }

  test('Alur lengkap: Tambah tugas, input retention, edit, status toggle, rollback error, search/filter, dan hapus tugas', async ({ page }) => {
    test.setTimeout(60000);
    await registerAndLogin(page);
    await setupSemesterAndCourse(page);

    // 1. Masuk ke halaman Tugas
    await page.goto('/assignments');
    await expect(page).toHaveURL(/\/assignments/);

    // Verifikasi Header & Konteks Semester
    await expect(page.locator('h1')).toHaveText('Tugas');
    await expect(page.locator('main').getByText('Semester Ganjil Asg (2026/2027)')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('main').getByText('0 tugas terdaftar')).toBeVisible();

    // Verifikasi Empty Onboarding
    await expect(page.locator('text=Belum ada tugas kuliah')).toBeVisible();

    // 2. Tambah Tugas & Validasi Input Retention
    await page.click('button:has-text("Tambah tugas")');
    await expect(page.locator('text=Tambah Tugas Baru')).toBeVisible();

    // Coba submit dengan judul terlalu pendek (1 karakter) untuk menguji retensi input & error message
    await page.fill('#create-title', 'A');
    await page.click('#create-due');
    await page.locator('[data-slot="calendar"] button:not([disabled])').getByText('20', { exact: true }).first().click();
    await page.fill('#create-due-time', '23:59');
    await page.fill('#create-desc', 'Catatan penting mengenai kompleksitas algoritma.');
    await page.click('button:has-text("Simpan Tugas")');

    // Pesan error muncul dan form tidak di-reset
    await expect(page.locator('text=Judul tugas minimal 2 karakter')).toBeVisible();
    await expect(page.locator('#create-due')).toContainText('20');
    await expect(page.locator('#create-due-time')).toHaveValue('23:59');
    await expect(page.locator('#create-desc')).toHaveValue('Catatan penting mengenai kompleksitas algoritma.');

    // Perbaiki judul tugas dan simpan
    await page.fill('#create-title', 'Tugas 1: Analisis Kompleksitas Waktu');
    await page.click('#create-priority');
    await page.click('[role="option"]:has-text("Tinggi")');
    await page.click('button:has-text("Simpan Tugas")');

    // Dialog tertutup dan item tugas muncul di tabel
    await expect(page.locator('text=Tambah Tugas Baru')).not.toBeVisible();
    await expect(page.locator('table').getByText('Tugas 1: Analisis Kompleksitas Waktu')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Tinggi')).toBeVisible();

    // 3. Edit Tugas
    // Buka menu aksi dropdown MoreVertical
    await page.click('table button[aria-label*="Menu aksi"]');
    await page.click('text=Edit tugas');

    // Dialog edit tugas terbuka
    await expect(page.locator('text=Edit Tugas')).toBeVisible();
    await expect(page.locator('#edit-title')).toHaveValue('Tugas 1: Analisis Kompleksitas Waktu');

    // Ubah judul dan prioritas
    await page.fill('#edit-title', 'Tugas 1: Analisis Kompleksitas & Memori');
    await page.click('#edit-priority');
    await page.click('[role="option"]:has-text("Sedang")');
    await page.click('button:has-text("Simpan Perubahan")');

    // Verifikasi pembaruan di tabel
    await expect(page.locator('text=Edit Tugas')).not.toBeVisible();
    await expect(page.locator('table').getByText('Tugas 1: Analisis Kompleksitas & Memori')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Sedang')).toBeVisible();

    // 4. Toggle Status Tugas & Rollback pada Error Mutasi
    // Centang checkbox untuk menandai selesai
    const taskCheckbox = page.locator('table button[role="checkbox"]').first();
    await taskCheckbox.click();
    await expect(page.locator('table').getByText('Selesai', { exact: true })).toBeVisible({ timeout: 10000 });

    // Uncheck kembali ke TODO
    await taskCheckbox.click();
    await expect(page.locator('table').getByText('Mendatang')).toBeVisible({ timeout: 10000 });

    // Uji kegagalan mutasi server: route mock 500 error
    await page.route('**/api/assignments/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Koneksi jaringan server terputus saat update.' } }),
        });
      } else {
        await route.continue();
      }
    });

    // Klik checkbox saat server error
    await taskCheckbox.click();
    // Verifikasi alert error tampil dan rollback status ke TODO ("Mendatang")
    await expect(page.locator('text=Aksi tugas belum berhasil')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Mendatang')).toBeVisible();

    // Hapus mock route untuk interaksi selanjutnya
    await page.unroute('**/api/assignments/**');
    // Tutup error alert
    await page.click('button:has-text("Tutup")');

    // 5. Pencarian & Filter
    // Tambah tugas kedua
    await page.click('button:has-text("Tambah tugas")');
    await page.fill('#create-title', 'Tugas 2: Struktur Data Heap');
    await page.click('#create-due');
    await page.locator('[data-slot="calendar"] button:not([disabled])').getByText('25', { exact: true }).first().click();
    await page.selectOption('#create-priority', 'LOW');
    await page.click('button:has-text("Simpan Tugas")');
    await expect(page.locator('table').getByText('Tugas 2: Struktur Data Heap')).toBeVisible({ timeout: 10000 });

    // Cari tugas 2
    await page.fill('input[placeholder="Cari judul tugas..."]', 'Heap');
    await expect(page.locator('table').getByText('Tugas 2: Struktur Data Heap')).toBeVisible();
    await expect(page.locator('table').getByText('Tugas 1: Analisis Kompleksitas & Memori')).not.toBeVisible();

    // Klik tombol Hapus filter
    await page.click('button:has-text("Hapus filter")');
    await expect(page.locator('table').getByText('Tugas 1: Analisis Kompleksitas & Memori')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Tugas 2: Struktur Data Heap')).toBeVisible();

    // Cari dengan kata kunci yang tidak ada -> Empty filter view
    await page.fill('input[placeholder="Cari judul tugas..."]', 'KataKunciTidakDitemukan123');
    await expect(page.locator('text=Tidak ada tugas yang cocok')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Hapus filter")');
    await expect(page.locator('table').getByText('Tugas 1: Analisis Kompleksitas & Memori')).toBeVisible({ timeout: 10000 });

    // 6. Dialog Hapus Tugas (Batal & Konfirmasi Destruktif)
    // Cari baris tugas kedua untuk dihapus
    const secondTaskRow = page.locator('tr').filter({ hasText: 'Tugas 2: Struktur Data Heap' });
    await secondTaskRow.locator('button[aria-label*="Menu aksi"]').click();
    await page.click('text=Hapus tugas');

    // Dialog hapus terbuka dan menyebutkan judul tugas
    await expect(page.getByRole('heading', { name: 'Hapus Tugas' })).toBeVisible();
    await expect(page.locator('text=Apakah Anda yakin ingin menghapus tugas')).toBeVisible();
    await expect(page.locator('div[role="dialog"]').getByText('Tugas 2: Struktur Data Heap')).toBeVisible();

    // Klik Batal terlebih dahulu
    await page.click('button:has-text("Batal")');
    await expect(page.getByRole('heading', { name: 'Hapus Tugas' })).not.toBeVisible();
    await expect(page.locator('table').getByText('Tugas 2: Struktur Data Heap')).toBeVisible();

    // Buka lagi dialog dan konfirmasi Hapus
    await secondTaskRow.locator('button[aria-label*="Menu aksi"]').click();
    await page.click('text=Hapus tugas');
    await page.getByRole('button', { name: 'Hapus Tugas' }).click();

    // Verifikasi dialog tertutup dan tugas kedua terhapus dari daftar
    await expect(page.getByRole('heading', { name: 'Hapus Tugas' })).not.toBeVisible();
    await expect(page.locator('table').getByText('Tugas 2: Struktur Data Heap')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Tugas 1: Analisis Kompleksitas & Memori')).toBeVisible();
  });
});
