import { test, expect } from '@playwright/test';

/**
 * Pengujian E2E Redesign Tahap 17:
 * - Registrasi form validation
 * - Login gagal (password salah) lalu berhasil
 * - Pengaturan Profil: Retensi input saat PATCH gagal (500) & Sinkronisasi header nama/avatar saat sukses
 * - Keamanan Akun: Ganti password salah menghasilkan error inline, ganti password sukses mengikuti alur logout/login ulang
 */

test.describe('Auth & Settings Redesign Flow', () => {
  const originalPassword = 'InitialPassword123!';
  const updatedPassword = 'NewStrongPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[BROWSER EXCEPTION]:', err));
  });

  async function registerAndLogin(page: any, name: string, email: string, password: string) {
    await page.goto('/register');
    await page.fill('#name', name);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }

  test('1. Validasi Register & Login gagal lalu berhasil dengan retensi email', async ({ page }) => {
    test.setTimeout(60000);
    const testEmail1 = `auth-test1-${Date.now()}@studyflow.test`;

    // 1. Validasi Form Registrasi
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Daftar Akun StudyFlow' })).toBeVisible({ timeout: 10000 });

    // Submit kosong untuk memicu validasi Zod client-side
    await page.click('button:has-text("Buat Akun")');
    await expect(page.locator('#name-error')).toBeVisible();
    await expect(page.locator('#email-error')).toBeVisible();
    await expect(page.locator('#password-error')).toBeVisible();

    // Isi formulir pendaftaran valid
    await page.fill('#name', 'Mahasiswa Penguji');
    await page.fill('#email', testEmail1);
    await page.fill('#password', originalPassword);

    // Uji toggle password di halaman register
    const toggleRegPwd = page.locator('button[aria-label="Tampilkan password"]');
    await expect(toggleRegPwd).toBeVisible();
    await toggleRegPwd.click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.locator('button[aria-label="Sembunyikan password"]').click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');

    // Submit registrasi
    await page.click('button:has-text("Buat Akun")');

    // Verifikasi pengalihan ke /login?registered=true
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });
    await expect(page.locator('text=Pendaftaran Berhasil')).toBeVisible();

    // 2. Login Gagal (Password Salah)
    await page.fill('#email', testEmail1);
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button:has-text("Masuk")');

    // Verifikasi alert error dari server muncul dan nilai email tetap utuh
    await expect(page.locator('[role="alert"]:has-text("Gagal Masuk")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#email')).toHaveValue(testEmail1);

    // 3. Login Berhasil
    await page.fill('#password', originalPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('2. Pengaturan Profil: Retensi input saat server gagal 500 & Sinkronisasi header saat berhasil', async ({ page }) => {
    test.setTimeout(60000);
    const testEmail2 = `auth-test2-${Date.now()}@studyflow.test`;

    // Daftarkan dan login user terisolasi
    await registerAndLogin(page, 'User Profil Awal', testEmail2, originalPassword);

    // Buka Halaman Pengaturan
    await page.goto('/settings');
    await expect(page.locator('h1:has-text("Pengaturan Akun")')).toBeVisible();

    // Verifikasi email bersifat read-only / disabled
    const emailInput = page.locator('#profile-email');
    await expect(emailInput).toBeDisabled();
    await expect(emailInput).toHaveValue(testEmail2);

    // Ubah nama profil
    const nameInput = page.locator('#profile-name');
    await nameInput.fill('Nama Gagal Simpan');

    // Mock kegagalan server HTTP 500 pada update profile
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Simulasi kegagalan server profil 500' } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.click('button:has-text("Simpan Profil")');

    // Verifikasi pesan error muncul dan input nama TETAP dipertahankan
    await expect(page.locator('[role="alert"]:has-text("Simulasi kegagalan server profil 500")')).toBeVisible({ timeout: 10000 });
    await expect(nameInput).toHaveValue('Nama Gagal Simpan');

    // Unroute mock failure
    await page.unroute('**/api/auth/me');

    // Simpan profil berhasil dengan nama baru
    const updatedName = 'Bima Mahasiswa Berprestasi';
    await nameInput.fill(updatedName);
    await page.click('button:has-text("Simpan Profil")');

    // Verifikasi alert sukses muncul
    await expect(page.locator('text=Profil dan zona waktu berhasil diperbarui.')).toBeVisible({ timeout: 10000 });

    // Verifikasi sinkronisasi nama dan avatar di header secara instan
    const headerAccountTrigger = page.locator(`button[aria-label="Menu akun untuk ${updatedName}"]`);
    await expect(headerAccountTrigger).toBeVisible({ timeout: 10000 });
    await expect(headerAccountTrigger.getByText(updatedName)).toBeVisible();
  });

  test('3. Keamanan Akun: Ganti password salah gagal inline, ganti password sukses mencabut sesi dan login ulang', async ({ page }) => {
    test.setTimeout(60000);
    const testEmail3 = `auth-test3-${Date.now()}@studyflow.test`;

    // Daftarkan dan login user terisolasi
    await registerAndLogin(page, 'User Password Test', testEmail3, originalPassword);

    // Buka Halaman Pengaturan
    await page.goto('/settings');
    await expect(page.locator('h1:has-text("Pengaturan Akun")')).toBeVisible();

    // 1. Uji ganti password dengan password saat ini yang salah
    await page.fill('#currentPassword', 'PasswordLamaSalah123!');
    await page.fill('#newPassword', updatedPassword);
    await page.fill('#confirmPassword', updatedPassword);
    await page.click('button:has-text("Ganti Password")');

    // Verifikasi pesan error muncul di form tanpa menutup halaman
    await expect(page.locator('[role="alert"]:has-text("Password saat ini tidak sesuai")')).toBeVisible({ timeout: 10000 });

    // 2. Uji ganti password dengan data yang benar
    await page.fill('#currentPassword', originalPassword);
    await page.fill('#newPassword', updatedPassword);
    await page.fill('#confirmPassword', updatedPassword);
    await page.click('button:has-text("Ganti Password")');

    // Verifikasi pesan sukses muncul dan diarahkan ke login
    await expect(page.locator('text=Password berhasil diubah')).toBeVisible({ timeout: 10000 });
    await page.waitForURL('**/login', { timeout: 15000 });

    // 3. Verifikasi login dengan password lama DITOLAK
    await page.fill('#email', testEmail3);
    await page.fill('#password', originalPassword);
    await page.click('button:has-text("Masuk")');
    await expect(page.locator('[role="alert"]:has-text("Gagal Masuk")')).toBeVisible({ timeout: 10000 });

    // 4. Verifikasi login dengan password baru BERHASIL
    await page.fill('#password', updatedPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
