import { test, expect } from '@playwright/test';

test.describe('Note Editor Unsaved Changes & Navigation Guard', () => {
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[BROWSER EXCEPTION]:', err));
  });

  // Helper register and login with unique user per test
  async function registerAndLogin(page: any) {
    const userEmail = `note-nav-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    await page.goto('/register');
    await page.fill('#name', 'Note Guard Tester');
    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }

  // Setup semester, course, and initial note
  async function setupNote(page: any) {
    // 1. Semester
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Nav Guard');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('text=Semester Nav Guard')).toBeVisible({ timeout: 10000 });

    // 2. Course
    await page.goto('/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.fill('#create-course-name', 'Logika Komputasi');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Logika Komputasi')).toBeVisible({ timeout: 10000 });

    // 3. Note
    await page.goto('/notes');
    await page.click('button:has-text("Buat Catatan")');
    await page.fill('#create-note-title', 'Catatan Proposisi');
    await page.selectOption('#create-note-course', { index: 1 });
    await page.fill('#create-note-content', 'Konten awal catatan');
    await page.click('button:has-text("Buat & Buka Editor")');
    await page.waitForURL('**/notes/**', { timeout: 15000 });
    await expect(page.locator('input[placeholder="Judul Catatan..."]')).toHaveValue('Catatan Proposisi');
  }

  test('1. Browser Back/Forward navigation guard: anti-loop, retain state on stay, and clean unmount', async ({ page }) => {
    await registerAndLogin(page);
    await setupNote(page);

    // Bangun urutan navigasi eksplisit: Dashboard -> Daftar Catatan -> Editor
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/dashboard');

    await page.click('a[href="/notes"]');
    await page.waitForURL('**/notes', { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/notes');

    await page.click('text=Catatan Proposisi');
    await page.waitForURL('**/notes/**', { timeout: 10000 });
    const noteUrl = page.url();
    expect(new URL(noteUrl).pathname).toMatch(/^\/notes\/[a-zA-Z0-9_-]+$/);

    // Pastikan status awal tersimpan
    await expect(page.locator('text=Tersimpan')).toBeVisible({ timeout: 5000 });

    // 1. Ketik perubahan (dirty)
    const textarea = page.locator('textarea');
    await textarea.fill('Konten dirty browser back test');
    await expect(page.locator('text=Belum disimpan')).toBeVisible({ timeout: 5000 });

    // 2. Tekan Browser Back
    await page.goBack();

    // Dialog konfirmasi harus muncul
    const dialog = page.locator('[data-testid="unsaved-changes-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 3. Opsi "Tetap mengedit"
    await page.click('[data-testid="confirm-stay-and-edit"]');
    await expect(dialog).not.toBeVisible();

    // Verifikasi URL, isi editor, dan posisi navigasi dipertahankan
    expect(page.url()).toBe(noteUrl);
    await expect(textarea).toHaveValue('Konten dirty browser back test');
    await expect(page.locator('text=Belum disimpan')).toBeVisible();

    // 4. Ulangi Browser Back (verifikasi tidak loop atau menumpuk sentinel)
    await page.goBack();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 5. Opsi "Buang perubahan dan lanjutkan" -> harus menuju halaman tujuan yang tepat (/notes)
    await page.click('[data-testid="confirm-discard-and-leave"]');
    await page.waitForURL('**/notes', { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/notes');

    // 6. Buktikan posisi history: Back dari /notes harus menuju /dashboard
    await page.goBack();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/dashboard');

    // 7. Verifikasi listener dan sentinel bersih saat editor ditinggalkan
    // Berada di /dashboard, navigasi ke /courses tidak memunculkan dialog guard catatan
    await page.click('a[href="/courses"]');
    await page.waitForURL('**/courses', { timeout: 10000 });
    await expect(dialog).not.toBeVisible();
  });

  test('2. "Simpan dan lanjutkan" tidak berpindah dan tulisan tetap utuh saat API update gagal HTTP 500', async ({ page }) => {
    await registerAndLogin(page);
    await setupNote(page);

    const noteUrl = page.url();

    // Ketik perubahan
    const textarea = page.locator('textarea');
    await textarea.fill('Perubahan penting yang akan menemui server error 500');
    await expect(page.locator('text=Belum disimpan')).toBeVisible();

    // Intercept API PATCH untuk menyimulasikan server failure 500
    await page.route('**/api/notes/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Gagal menghubungi database server cluster',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Coba navigasi ke Dashboard melalui link
    await page.click('a[href="/dashboard"]');

    // Dialog muncul
    const dialog = page.locator('[data-testid="unsaved-changes-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Klik "Simpan dan lanjutkan"
    await page.click('[data-testid="confirm-save-and-leave"]');

    // Dialog tertutup, TIDAK BERPINDAH, dan error ditampilkan
    await expect(dialog).not.toBeVisible();
    expect(page.url()).toBe(noteUrl);
    await expect(page.locator('text=Gagal menghubungi database server cluster')).toBeVisible({ timeout: 5000 });

    // Tulisan lokal di textarea TETAP UTUH!
    await expect(textarea).toHaveValue('Perubahan penting yang akan menemui server error 500');
  });

  test('3. Tunda respons save lalu ketik perubahan in-flight: perubahan tidak hilang dan tidak berpindah jika masih dirty', async ({ page }) => {
    await registerAndLogin(page);
    await setupNote(page);

    const noteUrl = page.url();

    const textarea = page.locator('textarea');
    await textarea.fill('Teks Dasar Awal');
    await expect(page.locator('text=Belum disimpan')).toBeVisible();

    // Delay response save 1200ms
    await page.route('**/api/notes/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      } else {
        await route.continue();
      }
    });

    // Klik tombol kembali di UI
    await page.click('a[aria-label="Kembali ke daftar catatan"], a[href="/notes"]');

    const dialog = page.locator('[data-testid="unsaved-changes-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Klik "Simpan dan lanjutkan"
    await page.click('[data-testid="confirm-save-and-leave"]');

    // Saat proses menyimpan sedang in-flight, ketik teks tambahan baru di textarea
    await expect(page.locator('text=Menyimpan dan melanjutkan…')).toBeVisible({ timeout: 2000 });
    await textarea.pressSequentially(' + Tambahan Karakter Saat Simpan Berlangsung!');

    // Tunggu request selesai
    // Karena masih ada perubahan yang belum tersimpan saat request selesai, sistem TIDAK BOLEH berpindah!
    await expect(dialog).not.toBeVisible();
    expect(page.url()).toBe(noteUrl);

    // Status harus tetap dirty
    await expect(page.locator('text=Belum disimpan')).toBeVisible({ timeout: 5000 });

    // Seluruh teks (termasuk karakter in-flight) tidak hilang dan tetap utuh di textarea
    await expect(textarea).toHaveValue('Teks Dasar Awal + Tambahan Karakter Saat Simpan Berlangsung!');
  });

  test('4. Konflik versi mempertahankan tulisan lokal dan menampilkan banner konflik', async ({ page, request }) => {
    await registerAndLogin(page);
    await setupNote(page);

    const noteUrl = page.url();
    const noteId = noteUrl.split('/notes/')[1].split('?')[0];

    // Ketik tulisan lokal baru di browser
    const textarea = page.locator('textarea');
    await textarea.fill('Tulisan lokal penting di Tab A');
    await expect(page.locator('text=Belum disimpan')).toBeVisible();

    // Lakukan update dari sesi eksternal (mensimulasikan Tab B yang berhasil menyimpan versi 2)
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const patchRes = await request.patch(`http://localhost:4100/api/notes/${noteId}`, {
      headers: {
        Cookie: cookieHeader,
        Origin: 'http://localhost:3100',
      },
      data: {
        version: 1,
        content: 'Konten yang disimpan oleh Tab B di server',
      },
    });
    expect(patchRes.status()).toBe(200);

    // Sekarang klik "Simpan" di editor browser (yang masih mengira version = 1)
    await page.click('button:has-text("Simpan")');

    // Harus muncul banner konflik versi
    await expect(page.locator('text=Konflik Versi Catatan')).toBeVisible({ timeout: 10000 });

    // Tulisan lokal pengguna di textarea HARUS TETAP UTUH!
    await expect(textarea).toHaveValue('Tulisan lokal penting di Tab A');
  });
});
