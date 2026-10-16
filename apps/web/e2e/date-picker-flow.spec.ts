import { test, expect } from '@playwright/test';

test.describe('E2E: Date Picker Basic (Shadcn Popover + Calendar)', () => {
  const testPassword = 'Password123456!';
  const testName = 'Mahasiswa Test DatePicker';

  test.beforeEach(async ({ page }) => {
    const testEmail = `datepicker.test.${Date.now()}.${Math.floor(Math.random() * 1000000)}@studyflow.test`;

    // 1. Registrasi & Login akun baru
    await page.goto('/register');
    await page.fill('#name', testName);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });

    // 2. Buat Semester aktif & Mata Kuliah
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Ganjil 2026/2027');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('main').getByText('Semester Ganjil 2026/2027')).toBeVisible({ timeout: 10000 });

    await page.goto('/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.click('#create-course-sem');
    await page.locator('[role="option"]').first().click();
    await page.fill('#create-course-name', 'Pemrograman Lanjut');
    await page.fill('#create-course-code', 'IF2101');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('main').getByText('Pemrograman Lanjut')).toBeVisible({ timeout: 10000 });
  });

  test('menguji interaksi Date Picker Basic: buka kalender, pilih tanggal, format Indonesia, tutup otomatis, dan simpan form', async ({ page }) => {
    // Buka halaman tugas
    await page.goto('/assignments');
    await expect(page.locator('text=Belum ada tugas kuliah')).toBeVisible();

    // Buka Dialog Tambah Tugas Baru
    await page.click('button:has-text("Tambah tugas")');
    await expect(page.locator('text=Tambah Tugas Baru')).toBeVisible();

    // Periksa trigger Date Picker awal
    const datePickerTrigger = page.locator('#create-due');
    await expect(datePickerTrigger).toBeVisible();
    await expect(datePickerTrigger).toContainText('Pilih tanggal');

    // Input jam terpisah memiliki nilai default 23:59 atau kosong
    const timeInput = page.locator('#create-due-time');
    await expect(timeInput).toBeVisible();

    // 1. Uji Validasi Required: Submit tanpa tanggal gagal dengan error semantik
    await page.fill('#create-title', 'Tugas Uji Validasi');
    await page.click('button:has-text("Simpan Tugas")');
    await expect(page.locator('text=Tenggat waktu wajib diisi')).toBeVisible();

    // 2. Buka Date Picker Popover di dalam Dialog
    await datePickerTrigger.click();
    const calendarSlot = page.locator('[data-slot="calendar"]');
    await expect(calendarSlot).toBeVisible();

    // Pilih tanggal 20
    const day20Button = calendarSlot.locator('button:not([disabled])').getByText('20', { exact: true }).first();
    await day20Button.click();

    // Popover kalender harus otomatis menutup setelah tanggal dipilih
    await expect(calendarSlot).not.toBeVisible();

    // Trigger harus menampilkan tanggal dalam format Bahasa Indonesia (misal: "20 [Bulan] [Tahun]")
    await expect(datePickerTrigger).toContainText('20');
    await expect(datePickerTrigger).not.toContainText('Pilih tanggal');

    // 3. Ubah jam pada input waktu terpisah
    await timeInput.fill('15:30');
    await expect(timeInput).toHaveValue('15:30');

    // 4. Simpan tugas
    await page.click('button:has-text("Simpan Tugas")');
    await expect(page.locator('table').getByText('Tugas Uji Validasi')).toBeVisible({ timeout: 10000 });

    // 5. Uji Edit Nilai Existing: Buka modal edit
    await page.click('table button[aria-label*="Menu aksi"]');
    await page.click('text=Edit tugas');
    await expect(page.locator('text=Edit Tugas')).toBeVisible();

    // Trigger edit harus menampilkan tanggal tersimpan
    const editDueTrigger = page.locator('#edit-due');
    await expect(editDueTrigger).toBeVisible();
    await expect(editDueTrigger).toContainText('20');

    // Input jam terpisah pada edit harus menampilkan jam tersimpan (15:30)
    const editTimeInput = page.locator('#edit-due-time');
    await expect(editTimeInput).toHaveValue('15:30');

    // Buka kalender pada mode edit -> harus memuat bulan dari tanggal tersimpan
    await editDueTrigger.click();
    await expect(page.locator('[data-slot="calendar"]')).toBeVisible();

    // Ganti ke tanggal 22
    const day22Button = page.locator('[data-slot="calendar"] button:not([disabled])').getByText('22', { exact: true }).first();
    await day22Button.click();
    await expect(page.locator('[data-slot="calendar"]')).not.toBeVisible();
    await expect(editDueTrigger).toContainText('22');

    // Simpan perubahan
    await page.click('button:has-text("Simpan Perubahan")');
    await expect(page.locator('text=Edit Tugas')).not.toBeVisible();
    await expect(page.locator('table').getByText('Tugas Uji Validasi')).toBeVisible();
  });
});
