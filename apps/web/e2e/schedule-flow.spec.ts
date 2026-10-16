import { test, expect } from '@playwright/test';

test.use({ screenshot: 'off' });

test.describe('Schedule Management Flow (/schedule & Course Detail Integration)', () => {
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[BROWSER EXCEPTION]:', err));
  });

  async function registerAndLogin(page: any) {
    const userEmail = `sched-test-${Date.now()}-${Math.floor(Math.random() * 1000000)}@studyflow.test`;
    await page.goto('/register');
    await page.fill('#name', 'Schedule Tester');
    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }

  async function setupSemesterAndCourses(page: any) {
    // 1. Buat Semester Aktif
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    const semName = `Semester Reguler ${Date.now()}`;
    await page.fill('#create-sem-name', semName);
    await page.fill('#create-sem-year', '2026/2027');
    await page.locator('div[role="dialog"] button:has-text("Simpan Semester")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // 2. Buat Mata Kuliah 1: Struktur Data
    await page.goto('/courses');
    await page.click('button:has-text("Tambah mata kuliah")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    const course1Name = 'Struktur Data & Algoritma';
    await page.fill('#create-course-name', course1Name);
    await page.fill('#create-course-code', 'IF201');
    await page.locator('div[role="dialog"] button:has-text("Simpan Mata Kuliah")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // 3. Buat Mata Kuliah 2: Basis Data
    await page.click('button:has-text("Tambah mata kuliah")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    const course2Name = 'Sistem Basis Data';
    await page.fill('#create-course-name', course2Name);
    await page.fill('#create-course-code', 'IF202');
    await page.locator('div[role="dialog"] button:has-text("Simpan Mata Kuliah")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    return { course1Name, course2Name };
  }

  test('1. Tambah, edit, dan hapus sesi jadwal perkuliahan di /schedule', async ({ page }) => {
    test.setTimeout(70000);
    await registerAndLogin(page);
    const { course1Name } = await setupSemesterAndCourses(page);

    await page.goto('/schedule');
    await expect(page.locator('h1')).toContainText('Jadwal Kuliah');

    // Onboarding empty state awal
    await expect(page.getByText('Belum Ada Jadwal Kuliah')).toBeVisible();

    // Tambah sesi Senin
    await page.click('button:has-text("Tambah jadwal")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    const course1Val = await page.locator('#schedule-course option', { hasText: course1Name }).getAttribute('value');
    await page.selectOption('#schedule-course', course1Val!);
    await page.selectOption('#schedule-day', '1'); // Senin
    await page.fill('#schedule-start-time', '08:00');
    await page.fill('#schedule-end-time', '09:40');
    await page.fill('#schedule-room', 'Lab Komputer 1');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();

    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Verifikasi sesi muncul di grid Senin
    await expect(page.getByText('Lab Komputer 1')).toBeVisible();
    await expect(page.getByText('08:00 – 09:40')).toBeVisible();

    // Edit sesi jadwal via dropdown menu
    const sessionCard = page.locator('.group').filter({ hasText: 'Lab Komputer 1' }).first();
    await sessionCard.locator('button[aria-label^="Menu aksi jadwal"]').click();
    await page.click('text=Edit Sesi');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    await page.fill('#edit-schedule-room', 'Lab Riset 303');
    await page.fill('#edit-schedule-end-time', '10:00');
    await page.locator('div[role="dialog"] button:has-text("Simpan Perubahan")').click();

    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Lab Riset 303').first()).toBeVisible();
    await expect(page.getByText('08:00 – 10:00').first()).toBeVisible();

    // Hapus sesi jadwal via dropdown menu
    const updatedCard = page.locator('.group').filter({ hasText: 'Lab Riset 303' }).first();
    await updatedCard.locator('button[aria-label^="Menu aksi jadwal"]').click();
    await page.click('text=Hapus Sesi');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    // Dialog konfirmasi menyebut nama mata kuliah, hari, dan rentang waktu
    await expect(page.locator('div[role="dialog"]')).toContainText(course1Name);
    await expect(page.locator('div[role="dialog"]')).toContainText('Senin');
    await expect(page.locator('div[role="dialog"]')).toContainText('08:00 – 10:00');

    await page.locator('div[role="dialog"] button:has-text("Hapus Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Kembali ke empty state
    await expect(page.getByText('Belum Ada Jadwal Kuliah')).toBeVisible();
  });

  test('2. Retensi isian formulir jadwal saat request pembuatan gagal HTTP 500', async ({ page }) => {
    test.setTimeout(60000);
    await registerAndLogin(page);
    await setupSemesterAndCourses(page);

    await page.goto('/schedule');
    await page.click('button:has-text("Tambah jadwal")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    await page.selectOption('#schedule-day', '2'); // Selasa
    await page.fill('#schedule-start-time', '10:00');
    await page.fill('#schedule-end-time', '11:40');
    await page.fill('#schedule-room', 'Ruang Teori 404');

    // Mock failure HTTP 500
    await page.route('**/api/schedules', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Gagal menyimpan jadwal karena kendala basis data' } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();

    // Verifikasi alert error muncul, dialog tidak tertutup, dan isian tidak hilang
    await expect(page.locator('div[role="dialog"] [role="alert"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#schedule-day')).toHaveValue('2');
    await expect(page.locator('#schedule-start-time')).toHaveValue('10:00');
    await expect(page.locator('#schedule-end-time')).toHaveValue('11:40');
    await expect(page.locator('#schedule-room')).toHaveValue('Ruang Teori 404');

    // Unroute dan simpan kembali dengan normal
    await page.unroute('**/api/schedules');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Ruang Teori 404').first()).toBeVisible();
  });

  test('3. Deteksi konflik waktu non-blocking & visibilitas konflik saat filter aktif', async ({ page }) => {
    test.setTimeout(75000);
    await registerAndLogin(page);
    const { course1Name, course2Name } = await setupSemesterAndCourses(page);

    await page.goto('/schedule');

    // 1. Tambah sesi 1: Course 1 pada Selasa 10:00 - 11:40
    await page.click('button:has-text("Tambah jadwal")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    const course1Val = await page.locator('#schedule-course option', { hasText: course1Name }).getAttribute('value');
    await page.selectOption('#schedule-course', course1Val!);
    await page.selectOption('#schedule-day', '2'); // Selasa
    await page.fill('#schedule-start-time', '10:00');
    await page.fill('#schedule-end-time', '11:40');
    await page.fill('#schedule-room', 'Lab A');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // 2. Tambah sesi 2: Course 2 pada Selasa 11:00 - 12:40 (Bertabrakan 11:00-11:40)
    await page.click('button:has-text("Tambah jadwal")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    const course2Val = await page.locator('#schedule-course option', { hasText: course2Name }).getAttribute('value');
    await page.selectOption('#schedule-course', course2Val!);
    await page.selectOption('#schedule-day', '2'); // Selasa
    await page.fill('#schedule-start-time', '11:00');
    await page.fill('#schedule-end-time', '12:40');
    await page.fill('#schedule-room', 'Lab B');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Banner konflik non-blocking muncul
    await expect(page.getByText('Jadwal disimpan, tetapi waktunya bertabrakan')).toBeVisible();

    // Kedua sesi tetap tersimpan dan keduanya menampilkan indikator benturan
    await expect(page.getByText('Lab A').first()).toBeVisible();
    await expect(page.getByText('Lab B').first()).toBeVisible();
    const conflictBadges = page.locator('text=Benturan Waktu');
    await expect(conflictBadges.first()).toBeVisible();

    // 3. Uji filter mata kuliah: Pilih Course 2 saja
    const filter2Val = await page.locator('#course-filter option', { hasText: course2Name }).getAttribute('value');
    await page.selectOption('#course-filter', filter2Val!);

    // Sesi Course 1 (Lab A) disembunyikan oleh filter
    await expect(page.getByText('Lab A')).not.toBeVisible();
    await expect(page.getByText('Lab B').first()).toBeVisible();

    // Badge konflik pada Course 2 tetap terlihat dan menyebut tabrakan dengan Course 1
    await expect(page.locator('text=Benturan Waktu').first()).toBeVisible();
    await expect(page.getByText(course1Name).first()).toBeVisible();

    // Reset filter
    await page.click('button:has-text("Reset Filter")');
    await expect(page.getByText('Lab A').first()).toBeVisible();
    await expect(page.getByText('Lab B').first()).toBeVisible();
  });

  test('4. Integrasi Detail Mata Kuliah: Isi konteks form otomatis & tautan sinkron', async ({ page }) => {
    test.setTimeout(75000);
    await registerAndLogin(page);
    const { course1Name } = await setupSemesterAndCourses(page);

    // Buka halaman daftar mata kuliah dan klik ke detail Course 1
    await page.goto('/courses');
    await page.click(`text=${course1Name}`);
    await page.waitForURL('**/courses/**', { timeout: 15000 });

    // Section Jadwal Perkuliahan terlihat di Detail Mata Kuliah
    await expect(page.getByRole('heading', { name: 'Jadwal Perkuliahan' })).toBeVisible();
    await expect(page.getByText('Belum ada sesi jadwal perkuliahan')).toBeVisible();

    // Tambah jadwal langsung dari detail mata kuliah
    await page.locator('div:has-text("Jadwal Perkuliahan") button:has-text("Tambah jadwal")').first().click();
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    // Input mata kuliah harus otomatis terkunci (disabled) sesuai mata kuliah ini
    await expect(page.locator('#schedule-course')).toBeDisabled();
    await expect(page.locator('#schedule-course')).toHaveValue(new RegExp(course1Name));

    // Isi hari Rabu (3), jam 13:00 - 14:40, Ruangan R. 505
    await page.selectOption('#schedule-day', '3'); // Rabu
    await page.fill('#schedule-start-time', '13:00');
    await page.fill('#schedule-end-time', '14:40');
    await page.fill('#schedule-room', 'Ruang Teori 505');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Sesi muncul di daftar jadwal detail mata kuliah
    await expect(page.getByText('Rabu')).toBeVisible();
    await expect(page.getByText('13:00 – 14:40')).toBeVisible();
    await expect(page.getByText('Ruang Teori 505')).toBeVisible();

    // Klik tombol tautan "Buka di Jadwal Mingguan"
    await page.click('a:has-text("Buka di Jadwal Mingguan")');
    await page.waitForURL('**/schedule?courseId=**', { timeout: 15000 });

    // Filter mata kuliah di halaman jadwal harus sudah terisi course1
    await expect(page.locator('#course-filter')).not.toHaveValue('all');
    await expect(page.getByText('Ruang Teori 505').first()).toBeVisible();
  });

  test('5. Agenda mobile menampilkan selector hari yang nyaman & timezone pengguna', async ({ page }) => {
    test.setTimeout(60000);
    // Atur viewport mobile 375x667
    await page.setViewportSize({ width: 375, height: 667 });

    await registerAndLogin(page);
    await setupSemesterAndCourses(page);

    // Tambah jadwal Kamis (4) jam 09:00 - 10:40
    await page.goto('/schedule');
    await page.click('button:has-text("Tambah jadwal")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    await page.selectOption('#schedule-day', '4'); // Kamis
    await page.fill('#schedule-start-time', '09:00');
    await page.fill('#schedule-end-time', '10:40');
    await page.fill('#schedule-room', 'Mobile Room 1');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Pada mobile, selector hari muncul (Sen, Sel, Rab, Kam, Jum, Sab, Min)
    const kamisTab = page.locator('button[aria-label*="Kamis"]').first();
    await expect(kamisTab).toBeVisible();

    // Klik tab hari Kamis
    await kamisTab.click();
    await expect(page.locator('.lg\\:hidden').getByText('Mobile Room 1')).toBeVisible();
    await expect(page.locator('.lg\\:hidden').getByText('09:00 – 10:40')).toBeVisible();

    // Klik tab hari Jumat (kosong)
    const jumatTab = page.locator('button[aria-label*="Jumat"]').first();
    await jumatTab.click();
    await expect(page.locator('.lg\\:hidden').getByText('Tidak ada jadwal kuliah pada hari Jumat')).toBeVisible();

    // Periksa bahwa tidak ada horizontal overflow pada viewport mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // Margin toleransi 2px
  });

  test('6. Widget "Jadwal Hari Ini" di Dashboard: Menampilkan sesi hari ini, status waktu, dan tautan detail/jadwal', async ({ page }) => {
    test.setTimeout(75000);
    await registerAndLogin(page);
    const { course1Name } = await setupSemesterAndCourses(page);

    // Cari hari ini berdasarkan timezone pengguna (Asia/Jakarta)
    const now = new Date();
    const weekdayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(now);
    const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const todayDayOfWeek = dayMap[weekdayStr] || 1;

    // Hitung jam sekarang dalam format HH:mm di Asia/Jakarta
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTimeStr = timeFormatter.format(now);

    // Tambah sesi hari ini di /schedule
    await page.goto('/schedule');
    await page.click('button:has-text("Tambah jadwal")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    const course1Val = await page.locator('#schedule-course option', { hasText: course1Name }).getAttribute('value');
    await page.selectOption('#schedule-course', course1Val!);
    await page.selectOption('#schedule-day', String(todayDayOfWeek));
    await page.fill('#schedule-start-time', '06:00');
    await page.fill('#schedule-end-time', '07:30');
    await page.fill('#schedule-room', 'Ruang Teori 101');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Pergi ke /dashboard
    await page.goto('/dashboard');
    const widget = page.locator('[data-testid="today-schedule-widget"]');
    await expect(widget).toBeVisible();

    // Verifikasi judul widget & tautan "Lihat jadwal"
    await expect(widget.getByRole('heading', { name: 'Jadwal Hari Ini' })).toBeVisible();
    const lihatJadwalLink = widget.locator('a:has-text("Lihat jadwal")');
    await expect(lihatJadwalLink).toBeVisible();
    await expect(lihatJadwalLink).toHaveAttribute('href', '/schedule');

    // Verifikasi sesi ditampilkan di widget
    await expect(widget.getByText('Ruang Teori 101')).toBeVisible();
    await expect(widget.getByText('06:00 – 07:30')).toBeVisible();
    await expect(widget.getByText(course1Name)).toBeVisible();

    // Verifikasi tautan mata kuliah mengarah ke /courses/[id]
    const courseLink = widget.locator(`a:has-text("${course1Name}")`);
    await expect(courseLink).toBeVisible();
    const href = await courseLink.getAttribute('href');
    expect(href).toMatch(/^\/courses\/[a-z0-9_-]+$/i);

    // Verifikasi status waktu dengan teks semantik (Selesai, Akan datang, atau Berlangsung)
    if (currentTimeStr >= '07:30') {
      await expect(widget.getByText('Selesai')).toBeVisible();
    } else if (currentTimeStr < '06:00') {
      await expect(widget.getByText('Akan datang')).toBeVisible();
    } else {
      await expect(widget.getByText('Berlangsung')).toBeVisible();
    }
  });

  test('7. Widget Dashboard: Menangani empty state ("Tidak ada kelas hari ini") dan error state terisolasi dengan coba lagi', async ({ page }) => {
    test.setTimeout(75000);
    await registerAndLogin(page);
    await setupSemesterAndCourses(page);

    // Buka /dashboard sebelum ada jadwal apa pun
    await page.goto('/dashboard');
    const widget = page.locator('[data-testid="today-schedule-widget"]');
    await expect(widget).toBeVisible();

    // Empty state "Tidak ada kelas hari ini"
    await expect(widget.getByText(/Tidak ada kelas hari ini/i)).toBeVisible();
    await expect(widget.locator('a:has-text("Buka Jadwal Lengkap")')).toBeVisible();

    // Simulasikan error API schedules terisolasi
    await page.route('**/api/schedules*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Simulasi kegagalan server jadwal',
          },
        }),
      });
    });

    // Reload halaman dashboard
    await page.reload();

    // Widget menampilkan alert error mandiri
    await expect(widget.getByText('Gagal Memuat Jadwal')).toBeVisible();
    await expect(widget.getByText('Simulasi kegagalan server jadwal')).toBeVisible();
    const retryBtn = widget.getByRole('button', { name: /Coba lagi/i });
    await expect(retryBtn).toBeVisible();

    // Elemen dashboard lain (Header, statistik, tugas, materi) tetap aman dan tidak error
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Materi terbaru')).toBeVisible();

    // Unroute untuk mengembalikan API normal
    await page.unroute('**/api/schedules*');

    // Klik coba lagi di widget jadwal
    await retryBtn.click();

    // Widget pulih ke empty state normal tanpa reload halaman
    await expect(widget.getByText(/Tidak ada kelas hari ini/i)).toBeVisible();
    await expect(widget.getByText('Gagal Memuat Jadwal')).not.toBeVisible();
  });

  test('8. Verifikasi pergantian semester: Widget jadwal hari ini memuat data semester baru dan mengabaikan semester lama', async ({ page }) => {
    test.setTimeout(85000);
    await registerAndLogin(page);

    // Cari hari ini
    const now = new Date();
    const weekdayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(now);
    const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const todayDayOfWeek = dayMap[weekdayStr] || 1;

    // 1. Semester 1 (Aktif pertama kali)
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    const sem1Name = `Semester A ${Date.now()}`;
    await page.fill('#create-sem-name', sem1Name);
    await page.fill('#create-sem-year', '2026/2027');
    await page.locator('div[role="dialog"] button:has-text("Simpan Semester")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Tambah Mata Kuliah di Semester 1
    await page.goto('/courses');
    await page.click('button:has-text("Tambah mata kuliah")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    const courseSem1 = 'Fisika Dasar 1';
    await page.fill('#create-course-name', courseSem1);
    await page.fill('#create-course-code', 'FS101');
    await page.locator('div[role="dialog"] button:has-text("Simpan Mata Kuliah")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Buat jadwal untuk Semester 1 di hari ini
    await page.goto('/schedule');
    await page.click('button:has-text("Tambah jadwal")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    const course1Val = await page.locator('#schedule-course option', { hasText: courseSem1 }).getAttribute('value');
    await page.selectOption('#schedule-course', course1Val!);
    await page.selectOption('#schedule-day', String(todayDayOfWeek));
    await page.fill('#schedule-start-time', '08:00');
    await page.fill('#schedule-end-time', '09:40');
    await page.fill('#schedule-room', 'Ruang Fisika 1');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Periksa di dashboard bahwa Fisika Dasar 1 muncul di widget
    await page.goto('/dashboard');
    const widget = page.locator('[data-testid="today-schedule-widget"]');
    await expect(widget).toBeVisible();
    await expect(widget.getByText(courseSem1)).toBeVisible();
    await expect(widget.getByText('Ruang Fisika 1')).toBeVisible();

    // 2. Buat Semester 2
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    const sem2Name = `Semester B ${Date.now()}`;
    await page.fill('#create-sem-name', sem2Name);
    await page.fill('#create-sem-year', '2027/2028');
    await page.locator('div[role="dialog"] button:has-text("Simpan Semester")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Jadikan Semester 2 Aktif
    const sem2Row = page.locator('tr, li').filter({ hasText: sem2Name }).first();
    const activateBtn = sem2Row.locator('button:has-text("Jadikan Aktif")');
    await activateBtn.click();
    await expect(activateBtn).not.toBeVisible({ timeout: 10000 });
    await expect(sem2Row.getByText('Aktif', { exact: true }).filter({ visible: true })).toBeVisible({ timeout: 10000 });

    // Tambah Mata Kuliah di Semester 2
    await page.goto('/courses');
    await page.click('button:has-text("Tambah mata kuliah")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    const courseSem2 = 'Kimia Dasar 2';
    await page.fill('#create-course-name', courseSem2);
    await page.fill('#create-course-code', 'KM102');
    await page.click('#create-course-sem');
    await page.locator('[role="option"]', { hasText: sem2Name }).click();
    await page.locator('div[role="dialog"] button:has-text("Simpan Mata Kuliah")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Buat jadwal untuk Semester 2 di hari ini
    await page.goto('/schedule');
    await page.click('button:has-text("Tambah jadwal")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    const course2Val = await page.locator('#schedule-course option', { hasText: courseSem2 }).getAttribute('value');
    await page.selectOption('#schedule-course', course2Val!);
    await page.selectOption('#schedule-day', String(todayDayOfWeek));
    await page.fill('#schedule-start-time', '10:00');
    await page.fill('#schedule-end-time', '11:40');
    await page.fill('#schedule-room', 'Ruang Kimia 2');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // 3. Verifikasi di Dashboard: Sesi Semester 2 (Kimia Dasar 2) tampil, dan Semester 1 (Fisika Dasar 1) TIDAK tampil
    await page.goto('/dashboard');
    await expect(widget.getByText(courseSem2)).toBeVisible();
    await expect(widget.getByText('Ruang Kimia 2')).toBeVisible();
    await expect(widget.getByText(courseSem1)).not.toBeVisible();
    await expect(widget.getByText('Ruang Fisika 1')).not.toBeVisible();

    // 4. Verifikasi di /schedule: Semester aktif adalah Semester 2, hanya sesi Semester 2 yang tampil
    await page.goto('/schedule');
    await expect(page.getByText(sem2Name).first()).toBeVisible();
    await expect(page.getByText('Ruang Kimia 2').first()).toBeVisible();
    await expect(page.getByText('Ruang Fisika 1')).not.toBeVisible();
  });

  test('9. Race condition guard: Respons semester lama yang sengaja ditunda tidak menimpa data semester baru', async ({ page }) => {
    test.setTimeout(85000);
    await registerAndLogin(page);

    // Buat Semester 1 dan Semester 2
    await page.goto('/semesters');
    await page.click('button:has-text("Tambah Semester")');
    const sem1Name = `Semester Early ${Date.now()}`;
    await page.fill('#create-sem-name', sem1Name);
    await page.fill('#create-sem-year', '2026/2027');
    const sem1CreateResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/semesters') && res.request().method() === 'POST'
    );
    await page.locator('div[role="dialog"] button:has-text("Simpan Semester")').click();
    const sem1CreateResponse = await sem1CreateResponsePromise;
    const sem1Json = await sem1CreateResponse.json();
    const sem1Opt: string = sem1Json.semester.id;
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Tambah Semester")');
    const sem2Name = `Semester Late ${Date.now()}`;
    await page.fill('#create-sem-name', sem2Name);
    await page.fill('#create-sem-year', '2027/2028');
    const sem2CreateResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/semesters') && res.request().method() === 'POST'
    );
    await page.locator('div[role="dialog"] button:has-text("Simpan Semester")').click();
    const sem2CreateResponse = await sem2CreateResponsePromise;
    const sem2Json = await sem2CreateResponse.json();
    const sem2Opt: string = sem2Json.semester.id;
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Tambah Course 1 di Semester 1
    await page.goto('/courses');
    await page.click('button:has-text("Tambah mata kuliah")');
    const course1 = 'Matematika Diskrit 1';
    await page.fill('#create-course-name', course1);
    await page.click('#create-course-sem');
    await page.locator('[role="option"]', { hasText: sem1Name }).click();
    await page.locator('div[role="dialog"] button:has-text("Simpan Mata Kuliah")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Tambah Course 2 di Semester 2
    await page.click('button:has-text("Tambah mata kuliah")');
    const course2 = 'Kalkulus Lanjut 2';
    await page.fill('#create-course-name', course2);
    await page.click('#create-course-sem');
    await page.locator('[role="option"]', { hasText: sem2Name }).click();
    await page.locator('div[role="dialog"] button:has-text("Simpan Mata Kuliah")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Buat Jadwal untuk Semester 1 (Hari Rabu / 3)
    await page.goto('/schedule');
    await page.click('button:has-text("Tambah jadwal")');
    const c1Opt = await page.locator('#schedule-course option', { hasText: course1 }).getAttribute('value');
    await page.selectOption('#schedule-course', c1Opt!);
    await page.selectOption('#schedule-day', '3'); // Rabu
    await page.fill('#schedule-start-time', '08:00');
    await page.fill('#schedule-end-time', '09:40');
    await page.fill('#schedule-room', 'Lab Diskrit 1');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Aktifkan Semester 2
    await page.goto('/semesters');
    const sem2Row = page.locator('tr, li').filter({ hasText: sem2Name }).first();
    const actBtn = sem2Row.locator('button:has-text("Jadikan Aktif")');
    await actBtn.click();
    await expect(actBtn).not.toBeVisible({ timeout: 10000 });

    // Buat Jadwal untuk Semester 2 (Hari Rabu / 3)
    await page.goto('/schedule');
    await page.click('button:has-text("Tambah jadwal")');
    const c2Opt = await page.locator('#schedule-course option', { hasText: course2 }).getAttribute('value');
    await page.selectOption('#schedule-course', c2Opt!);
    await page.selectOption('#schedule-day', '3'); // Rabu
    await page.fill('#schedule-start-time', '13:00');
    await page.fill('#schedule-end-time', '14:40');
    await page.fill('#schedule-room', 'Lab Kalkulus 2');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Simulasikan race condition:
    // Tahan request schedules untuk Semester 1
    let releaseSem1: (() => void) | null = null;
    const holdPromise = new Promise<void>((resolve) => {
      releaseSem1 = resolve;
    });

    await page.route(`**/api/schedules*semesterId=${sem1Opt}*`, async (route) => {
      await holdPromise;
      await route.continue();
    });

    // Pemicu: Dispatch event pergantian ke Semester 1 (yang ditahan jaringannya)
    await page.evaluate((sId) => {
      window.dispatchEvent(new CustomEvent('studyflow:semester-changed', { detail: { semesterId: sId } }));
    }, sem1Opt);

    // Segera dispatch event pergantian ke Semester 2 (yang berjalan cepat tanpa ditahan)
    await page.evaluate((sId) => {
      window.dispatchEvent(new CustomEvent('studyflow:semester-changed', { detail: { semesterId: sId } }));
    }, sem2Opt);

    // Tunggu data Semester 2 tampil
    await expect(page.getByText('Lab Kalkulus 2').first()).toBeVisible({ timeout: 10000 });

    // Sekarang lepas request Semester 1 yang tertahan tadi
    releaseSem1!();
    await page.waitForTimeout(600);

    // Verifikasi: Data Semester 2 HARUS TETAP TAMPIL. Data Semester 1 TIDAK MENIMPA data Semester 2!
    await expect(page.getByText('Lab Kalkulus 2').first()).toBeVisible();
    await expect(page.getByText('Lab Diskrit 1')).not.toBeVisible();
  });

  test('10. Widget Jadwal Hari Ini: Pergantian hari terkontrol dan perubahan timezone profil memperbarui widget terpasang', async ({ page }) => {
    test.setTimeout(85000);
    await registerAndLogin(page);
    const { course1Name, course2Name } = await setupSemesterAndCourses(page);

    // Tambah 1 jadwal hari Senin (1) jam 08:00 - 10:00 (Ruang Senin A)
    await page.goto('/schedule');
    await page.click('button:has-text("Tambah jadwal")');
    const c1Val = await page.locator('#schedule-course option', { hasText: course1Name }).getAttribute('value');
    await page.selectOption('#schedule-course', c1Val!);
    await page.selectOption('#schedule-day', '1'); // Senin
    await page.fill('#schedule-start-time', '08:00');
    await page.fill('#schedule-end-time', '10:00');
    await page.fill('#schedule-room', 'Ruang Senin A');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Tambah 1 jadwal hari Selasa (2) jam 13:00 - 15:00 (Ruang Selasa B)
    await page.click('button:has-text("Tambah jadwal")');
    const c2Val = await page.locator('#schedule-course option', { hasText: course2Name }).getAttribute('value');
    await page.selectOption('#schedule-course', c2Val!);
    await page.selectOption('#schedule-day', '2'); // Selasa
    await page.fill('#schedule-start-time', '13:00');
    await page.fill('#schedule-end-time', '15:00');
    await page.fill('#schedule-room', 'Ruang Selasa B');
    await page.locator('div[role="dialog"] button:has-text("Simpan Jadwal")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 10000 });

    // Atur jam terkontrol pada Minggu malam: 2026-10-11T23:59:00+07:00 (Minggu)
    await page.clock.install({ time: new Date('2026-10-11T23:59:00+07:00') });
    await page.goto('/dashboard');
    const widget = page.locator('[data-testid="today-schedule-widget"]');
    await expect(widget).toBeVisible();

    // Di hari Minggu, tidak ada kelas
    await expect(widget.getByText(/Tidak ada kelas hari ini \(Minggu\)/i)).toBeVisible();

    // 1. Majukan waktu 70 detik (melewati interval 60 detik dan melewati tengah malam ke Senin 00:00:10 WIB)
    await page.clock.fastForward(70000);

    // Widget secara reaktif mendeteksi pergantian hari tanpa reload halaman
    await expect(widget.getByText('Ruang Senin A')).toBeVisible({ timeout: 10000 });
    await expect(widget.getByText('08:00 – 10:00')).toBeVisible();
    await expect(widget.getByText('Akan datang')).toBeVisible();

    // 2. Majukan waktu ke jam 08:30 Senin (sesi sedang berlangsung)
    await page.clock.fastForward(8.5 * 3600 * 1000);
    await expect(widget.getByText('Berlangsung')).toBeVisible({ timeout: 10000 });

    // 3. Majukan waktu ke jam 10:30 Senin (sesi selesai)
    await page.clock.fastForward(2 * 3600 * 1000);
    await expect(widget.getByText('Selesai')).toBeVisible({ timeout: 10000 });

    // 4. Majukan waktu melewati tengah malam lagi ke Selasa siang (13:30 Selasa)
    // Dari Senin 10:30 ke Selasa 13:30 = 27 jam = 27 * 3600 * 1000 ms
    await page.clock.fastForward(27 * 3600 * 1000);

    // Widget secara reaktif memuat jadwal hari Selasa (Ruang Selasa B) dan status Berlangsung
    await expect(widget.getByText('Ruang Selasa B')).toBeVisible({ timeout: 10000 });
    await expect(widget.getByText('13:00 – 15:00')).toBeVisible();
    await expect(widget.getByText('Berlangsung')).toBeVisible();
    await expect(widget.getByText('Ruang Senin A')).not.toBeVisible();

    // 5. Perubahan timezone profil pengguna memperbarui widget yang sedang terpasang:
    // Pada jam 13:30 WIB Selasa, jika profil diubah ke America/New_York (UTC-4),
    // jam lokal New York adalah 02:30 Selasa.
    // Karena 02:30 < 13:00, status Ruang Selasa B berubah dari "Berlangsung" menjadi "Akan datang"!
    await page.route('**/api/auth/me*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-tz',
            name: 'Schedule Tester',
            email: 'sched-tz@studyflow.test',
            timezone: 'America/New_York',
          },
        }),
      });
    });

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('studyflow:profile-updated'));
    });

    // Status waktu pada widget yang sedang terpasang langsung tersinkronkan
    await expect(widget.getByText('Akan datang')).toBeVisible({ timeout: 10000 });
  });
});
