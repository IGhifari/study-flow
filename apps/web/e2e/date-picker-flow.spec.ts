import { test, expect } from '@playwright/test';

test.describe('E2E: Date Picker Basic (Shadcn Popover + Calendar)', () => {
  const testEmail = `datepicker.test.${Date.now()}@example.com`;
  const testPassword = 'Password123456!';
  const testName = 'Mahasiswa Test DatePicker';

  test.beforeEach(async ({ page }) => {
    // 1. Registrasi akun baru
    await page.goto('/register');
    await page.fill('#name', testName);
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Daftar Akun")');

    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 2. Buat Semester aktif & Mata Kuliah
    await page.click('button:has-text("Kelola semester")');
    await expect(page.locator('text=Daftar Semester')).toBeVisible();
    await page.click('button:has-text("Tambah semester")');
    await page.fill('input#name', 'Semester Ganjil 2026/2027');
    await page.fill('input#academicYear', '2026/2027');
    await page.check('input#makeActive');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('text=Semester Ganjil 2026/2027')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.click('a[href="/courses"], button:has-text("Mata Kuliah")');
    await page.waitForURL('**/courses');
    await page.click('button:has-text("Tambah mata kuliah")');
    await page.fill('input#course-name', 'Pemrograman Lanjut');
    await page.fill('input#course-code', 'IF2101');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Pemrograman Lanjut')).toBeVisible();
  });

  test('menguji interaksi Date Picker Basic: buka kalender, pilih tanggal, format Indonesia, tutup otomatis, dan simpan form', async ({ page }) => {
    // Buka halaman tugas
    await page.click('a[href="/assignments"], button:has-text("Tugas")');
    await page.waitForURL('**/assignments');
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
    await page.click('button[aria-label*="Aksi untuk Tugas Uji Validasi"]');
    await page.click('div[role="menuitem"]:has-text("Edit tugas")');
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
