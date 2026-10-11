import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('StudyFlow Flashcard and Quiz Functional Verification (Stage 13)', () => {
  test('Verify Flashcard study player, Quiz attempt, tab switching retention, draft save failure retention, and review', async ({
    page,
  }) => {
    test.setTimeout(240000);
    const timestamp = Date.now();
    const userEmail = `learn-flow-${timestamp}@studyflow.test`;
    const testPassword = 'SecretPass123!';

    page.on('console', (msg) => console.log(`[BROWSER CONSOLE ${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[BROWSER UNCAUGHT]: ${err.message}`));

    // 1. Registrasi & Login
    await page.goto('/register');
    await page.fill('#name', 'Rifqi Mahasiswa');
    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Buat Akun")');
    await page.waitForURL('**/login?registered=true', { timeout: 15000 });

    await page.fill('#email', userEmail);
    await page.fill('#password', testPassword);
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/dashboard', { timeout: 20000 });

    // 2. Buat Semester
    await page.click('a[href="/semesters"]:has-text("Tambah Semester")');
    await page.waitForURL('**/semesters');
    await page.click('button:has-text("Tambah Semester")');
    await page.fill('#create-sem-name', 'Semester Genap 2026/2027');
    await page.fill('#create-sem-year', '2026/2027');
    await page.click('button:has-text("Simpan Semester")');
    await expect(page.locator('text=Semester Genap 2026/2027')).toBeVisible({ timeout: 10000 });

    // 3. Tambah Mata Kuliah
    await page.goto('/courses');
    await page.click('button:has-text("Tambah Mata Kuliah")');
    await page.selectOption('#create-course-sem', { index: 1 });
    await page.fill('#create-course-name', 'Algoritma dan Struktur Data Lanjutan');
    await page.fill('#create-course-code', 'IF2110');
    await page.click('button:has-text("Simpan Mata Kuliah")');
    await expect(page.locator('text=Algoritma dan Struktur Data')).toBeVisible({ timeout: 10000 });

    // 4. Unggah Materi PDF
    await page.goto('/materials');
    await expect(page.locator('h1').getByText('Materi')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Unggah materi")');
    await expect(page.locator('div[role="dialog"] h2:has-text("Unggah Materi PDF")')).toBeVisible();

    await page.selectOption('#upload-course', { index: 1 });
    const materialTitle = 'Modul Pohon Biner, AVL Tree, dan Red-Black Tree';
    await page.fill('#upload-title', materialTitle);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Pilih Berkas PDF")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve('apps/web/e2e/fixtures/sample.pdf'));

    await page.locator('div[role="dialog"] button:has-text("Unggah Materi")').click();
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({ timeout: 20000 });

    // Tunggu materi selesai diproses dan siap dipelajari
    await expect(page.locator('table').getByText('Siap dipelajari')).toBeVisible({ timeout: 45000 });

    // 5. Buka Halaman Detail Materi
    await page.click(`text=${materialTitle}`);
    await page.waitForURL('**/materials/**', { timeout: 15000 });
    await expect(page.locator('h1').getByText('Modul Pohon Biner')).toBeVisible({ timeout: 15000 });

    // =========================================================================
    // 6. UJI TAB FLASHCARD
    // =========================================================================
    await page.click('button[role="tab"]:has-text("Flashcards")');

    // 6a. Verifikasi Empty State & Buat Flashcard Baru
    await expect(page.locator('text=Belum Ada Flashcard')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Buat Flashcard Sekarang")');
    await expect(page.locator('div[role="dialog"] h2:has-text("Buat Flashcard dengan AI")')).toBeVisible();
    await page.click('button:has-text("Mulai Pembuatan")');
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible();

    // Tunggu Flashcard terbentuk oleh Mock AI worker
    await expect(page.locator('text=Kartu 1 dari')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('text=0 Paham')).toBeVisible();
    await expect(page.locator('text=0 Perlu Diulang')).toBeVisible();

    // 6b. Uji Tombol Eksplisit "Tampilkan Jawaban"
    await expect(page.locator('text=Pertanyaan / Istilah')).toBeVisible();
    await page.locator('div[role="tabpanel"]:not([hidden]) button:has-text("Tampilkan Jawaban")').click();
    await expect(page.locator('text=Jawaban / Penjelasan')).toBeVisible();
    await expect(page.locator('div[role="tabpanel"]:not([hidden]) button:has-text("Sembunyikan Jawaban")')).toBeVisible();

    // 6c. Uji Penanda Pemahaman "Sudah Paham" (otomatis melangkah ke kartu 2)
    await page.locator('div[role="tabpanel"]:not([hidden]) button:has-text("Sudah Paham")').click();
    await expect(page.locator('text=Kartu 2 dari')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=1 Paham')).toBeVisible();

    // 6d. Uji Navigasi Stepper "Sebelumnya" & "Selanjutnya"
    await page.locator('div[role="tabpanel"]:not([hidden]) button:has-text("Sebelumnya")').click();
    await expect(page.locator('text=Kartu 1 dari')).toBeVisible();
    await page.locator('div[role="tabpanel"]:not([hidden]) button:has-text("Selanjutnya")').click();
    await expect(page.locator('text=Kartu 2 dari')).toBeVisible();

    // =========================================================================
    // 7. UJI TAB KUIS & RETENSI JAWABAN SAAT GANTI TAB
    // =========================================================================
    await page.click('button[role="tab"]:has-text("Kuis")');

    // 7a. Verifikasi Empty State & Buat Kuis Baru
    await expect(page.locator('text=Belum Ada Kuis')).toBeVisible({ timeout: 10000 });
    await page.locator('div[role="tabpanel"]:not([hidden]) button:has-text("Buat Kuis Sekarang")').click();
    await expect(page.locator('div[role="dialog"] h2:has-text("Buat Kuis dengan AI")')).toBeVisible();
    await page.click('button:has-text("Mulai Pembuatan")');
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible();

    // Tunggu Kuis siap & Tampilkan Halaman Pengantar (Landing Screen)
    await expect(page.locator('button:has-text("Mulai Kerjakan Kuis")')).toBeVisible({ timeout: 45000 });
    await page.click('button:has-text("Mulai Kerjakan Kuis")');

    // 7b. Verifikasi Runner Pengerjaan Soal 1
    await expect(page.locator('text=Soal 1 dari 5')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=0 / 5 Terjawab')).toBeVisible();

    // Pilih opsi radio pertama (A)
    const optionA = page.locator('div[aria-label^="Pilihan jawaban"] button[role="radio"]').first();
    await optionA.click();

    // Verifikasi semantik radio terpilih dan progres terupdate
    await expect(optionA).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('text=1 / 5 Terjawab')).toBeVisible({ timeout: 10000 });

    // Tunggu konfirmasi draft tersimpan dari server
    await expect(page.locator('text=Tersimpan')).toBeVisible({ timeout: 15000 });

    // 7c. VERIFIKASI RETENSI JAWABAN: GANTI KE TAB LAIN LALU KEMBALI
    // Berpindah ke tab "Dokumen PDF"
    await page.click('button[role="tab"]:has-text("Dokumen PDF")');
    await expect(page.locator('iframe[title^="Pratinjau PDF"]')).toBeVisible({ timeout: 10000 });

    // Kembali ke tab "Kuis"
    await page.click('button[role="tab"]:has-text("Kuis")');

    // Verifikasi jawaban soal 1 TETAP TERPILIH dan progres TETAP 1 / 5 Terjawab
    await expect(page.locator('text=Soal 1 dari 5')).toBeVisible();
    await expect(page.locator('text=1 / 5 Terjawab')).toBeVisible();
    await expect(optionA).toHaveAttribute('aria-checked', 'true');

    // =========================================================================
    // 8. UJI KEGAGALAN PENYIMPANAN DRAFT YANG MEMPERTAHANKAN JAWABAN & RETRY
    // =========================================================================
    // Pindah ke Soal 2
    await page.locator('div[role="tabpanel"]:not([hidden]) button:has-text("Selanjutnya")').click();
    await expect(page.locator('text=Soal 2 dari 5')).toBeVisible();

    // Intercept endpoint PATCH draft answers untuk mensimulasikan kegagalan jaringan
    let simulateFailure = true;
    await page.route('**/api/attempts/*/answers', async (route) => {
      if (simulateFailure && route.request().method() === 'PATCH') {
        simulateFailure = false;
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    // Pilih opsi B (indeks 1) pada Soal 2 saat server error disimulasikan
    const optionB = page.locator('div[aria-label^="Pilihan jawaban"] button[role="radio"]').nth(1);
    await optionB.click();

    // Verifikasi indikator error / retry muncul
    await expect(
      page.locator('text=Gagal simpan (Coba lagi)').or(page.locator('text=Gagal menyimpan draft'))
    ).toBeVisible({ timeout: 15000 });

    // Verifikasi jawaban pilihan B TETAP DIPERTAHANKAN (tidak ter-reset)
    await expect(optionB).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('text=2 / 5 Terjawab')).toBeVisible();

    // Hapus intercept route dan lakukan retry simpan
    await page.unroute('**/api/attempts/*/answers');
    const retryBtn = page.locator('button:has-text("Gagal simpan (Coba lagi)"), button:has-text("Coba Lagi")').first();
    await retryBtn.click();

    // Verifikasi draft berhasil tersimpan setelah retry
    await expect(page.locator('text=Tersimpan')).toBeVisible({ timeout: 15000 });

    // Jawab sisa soal (3, 4, 5) menggunakan kisi nomor soal
    // Soal 3
    await page.locator('button[title^="Buka soal 3"]').click();
    await page.locator('div[aria-label^="Pilihan jawaban"] button[role="radio"]').first().click();

    // Soal 4
    await page.locator('button[title^="Buka soal 4"]').click();
    await page.locator('div[aria-label^="Pilihan jawaban"] button[role="radio"]').nth(2).click();

    // Soal 5
    await page.locator('button[title^="Buka soal 5"]').click();
    await page.locator('div[aria-label^="Pilihan jawaban"] button[role="radio"]').first().click();

    await expect(page.locator('text=5 / 5 Terjawab')).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // 9. SUBMIT KUIS, EVALUASI NILAI & REVIEW REFERENSI SUMBER
    // =========================================================================
    await page.locator('div[role="tabpanel"]:not([hidden]) button:has-text("Selesai & Kumpulkan")').click();
    await expect(page.locator('div[role="dialog"] h2:has-text("Kumpulkan Jawaban Kuis?")')).toBeVisible();
    await expect(page.locator('text=Seluruh pertanyaan telah Anda jawab')).toBeVisible();

    await page.click('button:has-text("Ya, Kumpulkan Jawaban")');
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible();

    // Verifikasi Tampilan Hasil Kuis
    await expect(page.locator('h3:has-text("Hasil Pengerjaan Kuis")')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Nilai (0-100)')).toBeVisible();
    await expect(page.locator('text=Jawaban Benar')).toBeVisible();
    await expect(page.locator('text=Pembahasan & Referensi Materi')).toBeVisible();

    // Verifikasi Pembedaan Status Teks/Ikon pada Hasil
    await expect(page.locator('span:has-text("Benar"), span:has-text("Salah")').first()).toBeVisible();
    await expect(page.locator('text=Kunci Jawaban').first()).toBeVisible();

    // Verifikasi Tautan Referensi Halaman melompat ke PDF
    const refLink = page.locator('button:has-text("Buka Referensi Halaman")').first();
    await expect(refLink).toBeVisible();
    await refLink.click();

    // Tab berpindah ke Dokumen PDF
    await expect(page.locator('iframe[title^="Pratinjau PDF"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Dokumen PDF', selected: true })).toBeVisible();
  });
});
