import { test, expect } from '@playwright/test';

test.use({ screenshot: 'off' });

test.describe('Courses & Semesters Management Flow', () => {
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[BROWSER EXCEPTION]:', err));
  });

  async function registerAndLogin(page: any) {
    const userEmail = `course-sem-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    await page.goto('/register');
    await page.fill('#name', 'Course Sem Tester');
    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }

  test('1. Retensi input saat pembuatan semester & mata kuliah gagal HTTP 500', async ({ page }) => {
    test.setTimeout(60000);
    await registerAndLogin(page);

    // --- Uji Semester Input Retention ---
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    const semName = 'Semester Ganjil 2026/2027';
    const semYear = '2026/2027';
    await page.fill('#create-sem-name', semName);
    await page.fill('#create-sem-year', semYear);

    // Mock failure pada endpoint semester creation
    await page.route('**/api/semesters', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Database failure saat menyimpan semester' } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.locator('div[role="dialog"] button:has-text("Simpan Semester")').click();

    // Verifikasi dialog tetap terbuka, alert error muncul, dan input tetap utuh
    await expect(page.locator('div[role="dialog"] [role="alert"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#create-sem-name')).toHaveValue(semName);
    await expect(page.locator('#create-sem-year')).toHaveValue(semYear);

    // Unroute mock dan coba simpan kembali
    await page.unroute('**/api/semesters');
    await page.locator('div[role="dialog"] button:has-text("Simpan Semester")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText(semName)).toBeVisible({ timeout: 10000 });

    // --- Uji Course Input Retention ---
    await page.goto('/courses');
    await page.click('button:has-text("Tambah mata kuliah")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    const courseName = 'Algoritma Pemrograman Lanjut';
    const courseCode = 'IF220';
    const courseLecturer = 'Dr. Handoko';
    await page.fill('#create-course-name', courseName);
    await page.fill('#create-course-code', courseCode);
    await page.fill('#create-course-lecturer', courseLecturer);

    // Mock failure pada endpoint course creation
    await page.route('**/api/courses', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Server database error saat simpan mata kuliah' } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.locator('div[role="dialog"] button:has-text("Simpan Mata Kuliah")').click();

    // Verifikasi dialog tetap terbuka, alert error muncul, dan nilai input dipertahankan
    await expect(page.locator('div[role="dialog"] [role="alert"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#create-course-name')).toHaveValue(courseName);
    await expect(page.locator('#create-course-code')).toHaveValue(courseCode);
    await expect(page.locator('#create-course-lecturer')).toHaveValue(courseLecturer);

    // Unroute mock dan coba simpan kembali
    await page.unroute('**/api/courses');
    await page.locator('div[role="dialog"] button:has-text("Simpan Mata Kuliah")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText(courseName)).toBeVisible({ timeout: 10000 });
  });

  test('2. Aktivasi semester: penolakan kegagalan & sinkronisasi sidebar saat berhasil', async ({ page }) => {
    test.setTimeout(60000);
    await registerAndLogin(page);

    // 1. Buat Semester 1 (Aktif)
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Gasal 2026');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('table').getByText('Semester Gasal 2026')).toBeVisible({ timeout: 10000 });

    // 2. Buat Semester 2 (Non-aktif)
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Genap 2027');
    await page.fill('#create-sem-year', '2026/2027');
    // Jangan centang makeActive
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('table').getByText('Semester Genap 2027')).toBeVisible({ timeout: 10000 });

    // Verifikasi Semester 2 memiliki status Non-aktif dan ada tombol "Jadikan Aktif"
    const sem2Row = page.locator('tr:has-text("Semester Genap 2027")');
    await expect(sem2Row.getByText('Non-aktif').filter({ visible: true })).toBeVisible();
    const activateBtn = sem2Row.locator('button:has-text("Jadikan Aktif")').filter({ visible: true });
    await expect(activateBtn).toBeVisible();

    // 3. Simulasikan kegagalan aktivasi semester (HTTP 500)
    await page.route('**/api/semesters/*/activate', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Gagal mengaktifkan semester di backend.' } }),
      });
    });

    await activateBtn.click();

    // Verifikasi error alert muncul dan status Semester 2 TETAP Non-aktif
    await expect(page.locator('[role="alert"]:has-text("Gagal mengaktifkan semester")')).toBeVisible({ timeout: 10000 });
    await expect(sem2Row.getByText('Non-aktif', { exact: true }).filter({ visible: true })).toBeVisible();

    // Unroute mock failure
    await page.unroute('**/api/semesters/*/activate');

    // 4. Aktivasi berhasil
    await activateBtn.click();

    // Verifikasi Semester 2 kini berstatus Aktif
    await expect(sem2Row.getByText('Aktif', { exact: true }).filter({ visible: true })).toBeVisible({ timeout: 10000 });

    // 5. Verifikasi sinkronisasi selector semester di sidebar
    const sidebarSelector = page.locator('button[aria-label="Pilih semester aktif"]');
    await expect(sidebarSelector.getByText('Semester Genap 2027')).toBeVisible({ timeout: 10000 });
  });

  test('3. Konfirmasi aksi destruktif: dialog hapus mata kuliah dan semester menyebutkan nama spesifik', async ({ page }) => {
    test.setTimeout(60000);
    await registerAndLogin(page);

    // 1. Buat Semester
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    const semName = 'Semester Basis Data';
    await page.fill('#create-sem-name', semName);
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('table').getByText(semName)).toBeVisible({ timeout: 10000 });

    // 2. Buat Mata Kuliah
    await page.goto('/courses');
    await page.click('button:has-text("Tambah mata kuliah")');
    const courseName = 'Sistem Manajemen Basis Data';
    await page.fill('#create-course-name', courseName);
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('table').getByText(courseName)).toBeVisible({ timeout: 10000 });

    // 3. Uji Konfirmasi Dialog Hapus Mata Kuliah
    const courseRow = page.locator(`tr:has-text("${courseName}")`);
    await courseRow.locator('button[aria-label^="Menu aksi untuk mata kuliah"]').click();
    await page.click('[role="menuitem"]:has-text("Hapus mata kuliah")');

    const courseDeleteDialog = page.locator('div[role="dialog"]:has-text("Hapus Mata Kuliah")');
    await expect(courseDeleteDialog).toBeVisible();
    // Verifikasi nama mata kuliah disebut secara spesifik
    await expect(courseDeleteDialog.getByText(courseName)).toBeVisible();

    // Batalkan dialog hapus
    await courseDeleteDialog.locator('button:has-text("Batal")').click();
    await expect(courseDeleteDialog).not.toBeVisible();

    // 4. Uji Konfirmasi Dialog Hapus Semester
    await page.goto('/semesters');
    const semRow = page.locator(`tr:has-text("${semName}")`);
    await semRow.locator('button[aria-label^="Menu aksi untuk semester"]').click();
    await page.click('[role="menuitem"]:has-text("Hapus semester")');

    const semDeleteDialog = page.locator('div[role="dialog"]:has-text("Hapus Semester")');
    await expect(semDeleteDialog).toBeVisible();
    // Verifikasi nama semester disebut secara spesifik
    await expect(semDeleteDialog.getByText(semName)).toBeVisible();

    // Batalkan dialog hapus
    await semDeleteDialog.locator('button:has-text("Batal")').click();
    await expect(semDeleteDialog).not.toBeVisible();
  });
});
