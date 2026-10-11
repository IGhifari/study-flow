# Product Requirements Document — StudyFlow

| Informasi | Nilai |
| --- | --- |
| Versi | 1.0 — rancangan awal |
| Tanggal | 3 Oktober 2026 |
| Pemilik produk | M. Ghifari Bima Khadafi |
| Platform | Website responsif |
| Frontend | Next.js, TypeScript, App Router |
| Backend | Express, TypeScript |
| Target rilis | MVP pribadi, dilanjutkan beta terbatas |
| Lokasi di repository | `docs/product_requirements_document.md` |

Dokumen ini menjadi acuan scope, perilaku produk, prioritas, dan kriteria penerimaan StudyFlow. Detail visual dituangkan terpisah dalam `DESIGN.md`; kontrak API dan skema database diturunkan saat implementasi. Angka kuota dan target pengujian di dokumen ini adalah keputusan awal produk, bukan klaim kemampuan provider atau hasil pengukuran.

## 1. Ringkasan produk

StudyFlow adalah platform belajar pribadi untuk mahasiswa yang menggabungkan pengelolaan mata kuliah, tugas, catatan, dan materi dengan bantuan AI. Mahasiswa dapat menyimpan PDF per mata kuliah, merangkum isinya, lalu berlatih melalui flashcard dan kuis yang merujuk pada materi tersebut.

**Proposisi nilai:** “Atur perkuliahanmu dan pelajari materi sendiri dalam satu tempat.”

Produk dikembangkan bertahap oleh satu developer. Rilis awal berfokus pada pengalaman belajar individu. Kolaborasi kelas, peran dosen, dan administrasi kampus berada di luar MVP.

## 2. Masalah yang diselesaikan

1. Materi tersebar di folder, grup pesan, dan penyimpanan online sehingga sulit ditemukan kembali.
2. Deadline tugas dicatat terpisah dari mata kuliah dan materi pendukungnya.
3. Membaca ulang dokumen panjang membutuhkan waktu; mahasiswa memerlukan ringkasan yang tetap dapat diperiksa terhadap sumber.
4. Latihan aktif seperti flashcard dan kuis harus dibuat manual.
5. Aplikasi chat AI umum tidak otomatis menyediakan organisasi materi, riwayat latihan, dan pengelolaan tugas dalam satu alur.

## 3. Tujuan dan batas keberhasilan

### 3.1 Tujuan produk

- Membantu mahasiswa mengetahui tugas terdekat dan menemukan materi kuliah dengan cepat.
- Memungkinkan alur lengkap: tambah mata kuliah → upload PDF → baca ringkasan → latihan → lihat hasil.
- Menjaga data setiap pengguna tetap privat dan terisolasi.
- Menampilkan kegagalan proses secara jelas beserta langkah pemulihannya.
- Mengendalikan penggunaan AI melalui kuota dan pencatatan pemakaian.

### 3.2 Tujuan portfolio

Menunjukkan penggunaan Next.js, API terpisah, pemrosesan dokumen, antrean pekerjaan, integrasi AI, pengujian akses data, dan deployment beberapa proses. Kualitas alur utama dan ketahanan saat gagal menjadi prioritas daripada jumlah fitur.

### 3.3 Target validasi awal

| Metrik | Target awal | Cara mengukur |
| --- | --- | --- |
| Pengujian kegunaan | Minimal 5 mahasiswa mencoba alur utama | Sesi observasi dengan data uji |
| Keberhasilan onboarding | Minimal 4 dari 5 peserta menyelesaikan mata kuliah pertama, upload, dan membuka ringkasan tanpa bantuan | Catatan sesi |
| Manfaat ringkasan | Minimal 4 dari 5 peserta menilai ringkasan berguna untuk mengulang materi | Pertanyaan penilaian setelah sesi |
| Keberhasilan pipeline | Minimal 95% dari 20 PDF valid selesai diproses pada lingkungan uji yang dicatat | Job log dan dataset uji |
| Isolasi pengguna | Semua skenario akses silang yang ditentukan pada bagian pengujian ditolak | Integration dan E2E tests |

Sampel kecil ini adalah gate beta awal, bukan bukti statistik kesesuaian produk dengan pasar. Tetapkan baseline waktu pemrosesan serta biaya per dokumen sebelum memperluas beta.

## 4. Pengguna dan peran

**Pengguna utama:** mahasiswa yang mengelola beberapa mata kuliah, menerima materi PDF, serta memiliki tugas mingguan.

**Persona awal:** mahasiswa Teknik Informatika yang ingin memisahkan materi per semester, memantau deadline, dan membuat latihan dari materi dosen.

MVP hanya memiliki peran aplikasi `USER`. Pengunjung dapat melihat landing page, mendaftar, dan login. Semua resource akademik dimiliki satu pengguna. Tidak ada dashboard admin, workspace bersama, undangan, atau role dosen dalam MVP.

Istilah owner pada pemeriksaan akses berarti pemilik resource, bukan role baru. Model `Workspace` dan `WorkspaceMember` baru ditambahkan ketika kolaborasi menjadi scope yang disetujui.

## 5. Scope dan prioritas

| Area | MVP v1 — wajib | v1.1 — setelah MVP stabil | Di luar scope awal |
| --- | --- | --- | --- |
| Akun | Register, login, logout, refresh session, profil, ganti password | Verifikasi email dan reset password mandiri sebelum pendaftaran publik | SSO kampus, organisasi |
| Organisasi | Semester dan mata kuliah pribadi | Pencarian lintas konten | Workspace kolaboratif |
| Tugas | CRUD, deadline, prioritas, status, filter | Tampilan kalender, reminder in-app otomatis | Sinkronisasi kalender eksternal |
| Materi | PDF berbasis teks, private storage, ekstraksi, status, retry | PPTX, DOCX setelah parser tervalidasi | PPT/DOC lama, OCR, video/audio |
| Catatan | Markdown sederhana, simpan manual, preview aman | Autosave dan pencarian isi | Editor kolaboratif |
| AI | Ringkasan, flashcard, kuis pilihan ganda | Tanya-jawab berbasis materi dengan kutipan | Agen AI yang melakukan aksi eksternal |
| Infrastruktur | Redis, BullMQ, worker, polling status | Socket.io dan notifikasi realtime | Microservices, Kubernetes |
| Dashboard | Deadline, tugas terlambat, materi terakhir, hasil kuis | Tren belajar lebih lanjut | Prediksi nilai akademik |

**MVP tetap mencakup AI.** Pengelolaan kuliah tanpa ringkasan dan latihan merupakan milestone internal, belum dianggap StudyFlow v1 selesai.

## 6. Alur pengguna utama

### 6.1 Mulai menggunakan aplikasi

1. Pengguna mendaftar atau login.
2. Pengguna memilih zona waktu; nilai awal `Asia/Jakarta` dan dapat diubah.
3. Dashboard kosong menampilkan aksi “Tambah semester”.
4. Pengguna menambah semester dan mata kuliah pertama.
5. Pengguna dapat menambahkan tugas atau mengunggah materi.

### 6.2 Belajar dari materi

1. Pengguna memilih mata kuliah dan mengunggah PDF.
2. Aplikasi menampilkan progres transfer dan, setelah diterima, status antrean ekstraksi.
3. Worker mengekstrak teks; pengguna boleh meninggalkan halaman.
4. Ketika materi siap, pengguna memilih “Buat ringkasan”. Pengiriman konten kepada provider AI dijelaskan sebelum penggunaan AI pertama.
5. Ringkasan ditampilkan bersama rujukan halaman.
6. Pengguna dapat meminta set flashcard atau kuis secara terpisah; upload tidak otomatis menjalankan semua fitur AI.
7. Hasil tersimpan sehingga membuka ulang halaman tidak memicu biaya generasi baru.

### 6.3 Mengelola tugas

1. Pengguna membuat tugas dengan mata kuliah, judul, deadline, dan prioritas.
2. Tugas tampil pada daftar serta bagian deadline dashboard.
3. Pengguna mengubah status dari belum dikerjakan menjadi sedang dikerjakan atau selesai.
4. Tugas yang belum selesai dan melewati deadline ditandai terlambat.

## 7. Kebutuhan fungsional MVP

### FR-01 — Akun dan sesi

- Registrasi menggunakan nama, email unik tanpa membedakan huruf besar/kecil, dan password minimal 12 karakter; izinkan passphrase.
- Login memberikan pesan kegagalan yang tidak mengungkap keberadaan akun.
- Sesi menggunakan access JWT berumur pendek dan refresh token yang dapat dicabut serta dirotasi. Nilai awal masa berlaku: 15 menit dan 7 hari.
- Profil menyediakan pengubahan nama, zona waktu, serta password. Ganti password memerlukan password saat ini dan mencabut sesi lama.
- Logout mencabut refresh session yang digunakan. Refresh token kedaluwarsa atau telah dicabut mengharuskan login kembali.
- Password disimpan sebagai hash adaptif, refresh token disimpan sebagai hash. Token tidak disimpan di localStorage.
- Reset password mandiri belum menjadi gate MVP pribadi; wajib tersedia sebelum membuka pendaftaran umum.

**Penerimaan:** sesi bertahan setelah reload sesuai masa berlakunya; logout dan ganti password membuat token lama tidak dapat memperbarui sesi; pengguna lain tidak dapat membaca profil privat.

### FR-02 — Semester dan mata kuliah

- Semester memiliki nama, tahun ajaran, dan status aktif/arsip. Maksimal satu semester aktif per pengguna.
- Mata kuliah memiliki nama wajib, kode opsional, nama dosen opsional, deskripsi opsional, serta semester wajib.
- Pengguna dapat membuat, melihat, mengubah, memfilter, dan mengarsipkan data miliknya.
- Pengarsipan menyembunyikan mata kuliah dari daftar aktif dan pembuatan konten baru; konten lama tetap bisa dibaca dan mata kuliah dapat dipulihkan.
- Penghapusan semester atau mata kuliah yang masih memiliki turunan ditolak dengan penjelasan; pengguna mengarsipkan atau menghapus turunannya terlebih dahulu.

**Penerimaan:** daftar terfilter sesuai semester; ID semester milik orang lain tidak dapat digunakan saat membuat mata kuliah.

### FR-03 — Tugas

- Field: mata kuliah, judul, deskripsi opsional, deadline, prioritas `LOW | MEDIUM | HIGH`, status `TODO | IN_PROGRESS | DONE`.
- Daftar mendukung pencarian judul, filter mata kuliah/status/prioritas, serta pengurutan deadline.
- `OVERDUE` merupakan kondisi turunan dari deadline dan status, bukan status yang dipilih pengguna.
- Deadline disimpan sebagai waktu UTC dan ditampilkan dalam zona waktu profil. Input tanggal saja dinormalisasi menjadi pukul 23.59 pada zona waktu tersebut.
- Saat selesai, simpan `completedAt`; saat dibuka kembali, hapus nilai tersebut.

**Penerimaan:** tugas selesai tidak tampil terlambat; perubahan zona waktu mengubah tampilan waktu tanpa mengubah momen deadline.

### FR-04 — Upload dan pengelolaan materi

- Materi dimiliki pengguna dan terhubung dengan tepat satu mata kuliah.
- MVP menerima PDF berbasis teks, maksimal 20 MB dan 100 halaman per file. Batas jumlah halaman diverifikasi setelah file diterima.
- PDF terenkripsi, rusak, atau tidak memiliki teks yang dapat diproses ditolak dengan alasan yang jelas; PDF scan diberi petunjuk bahwa OCR belum tersedia.
- Validasi ekstensi, MIME, signature file, ukuran, dan batas parsing dilakukan di server/worker; tidak hanya di browser.
- File disimpan dalam bucket privat. Preview/download hanya melalui otorisasi backend dan URL akses berumur pendek.
- Judul materi dapat diedit. Mengganti file dibuat sebagai materi baru pada MVP agar hasil AI lama tidak tercampur dengan sumber baru.
- Daftar menunjukkan judul, mata kuliah, tanggal upload, ukuran, serta status pemrosesan.
- Status materi: `UPLOADING → QUEUED → PROCESSING → READY`; kegagalan menjadi `FAILED` dengan kode kesalahan yang aman untuk pengguna.
- Retry hanya tersedia untuk kegagalan sementara atau setelah masalah dapat diperbaiki. File invalid harus diunggah ulang sebagai materi baru.
- Penghapusan materi memerlukan konfirmasi yang menyebutkan dampaknya: file, teks, hasil AI, flashcard, kuis, dan attempt terkait dihapus; catatan manual dipertahankan dengan tautan materi dikosongkan.
- Job aktif wajib memeriksa status penghapusan sebelum menyimpan hasil. Pembersihan storage yang gagal diulang; data yang dihapus langsung tidak dapat diakses.

**Penerimaan:** upload valid tetap diproses setelah halaman ditutup; file yang gagal tidak terlihat siap; pengguna lain tidak dapat meminta URL file privat.

### FR-05 — Catatan

- Catatan memiliki judul, isi Markdown, mata kuliah wajib, dan materi terkait opsional.
- Editor menyediakan simpan manual serta penanda perubahan belum tersimpan. Navigasi keluar memberi peringatan bila ada perubahan.
- Markdown preview disanitasi; HTML berbahaya dan script tidak dieksekusi.
- Pengguna dapat membuat, membaca, mengubah, dan menghapus catatan sendiri.

**Penerimaan:** isi tersimpan dapat dibuka kembali; catatan tetap ada jika materi terkait dihapus.

### FR-06 — Ringkasan AI

- Hanya dapat dibuat dari materi berstatus `READY` dengan teks memadai.
- Ringkasan berisi gambaran umum, konsep penting, penjelasan singkat, istilah kunci, serta rujukan halaman PDF.
- Bahasa keluaran awal Bahasa Indonesia; istilah teknis asli dapat dipertahankan.
- Nomor halaman merujuk indeks halaman PDF mulai dari 1; label halaman tercetak di dokumen dapat berbeda dan hal ini dijelaskan di UI.
- Sistem menyimpan provenance halaman sejak ekstraksi. Kutipan harus berasal dari potongan sumber yang benar-benar digunakan, bukan nomor yang bebas dikarang model.
- Materi panjang diproses dalam bagian-bagian yang mempertahankan halaman sumber. Materi melebihi batas pemrosesan ditolak dengan pesan jelas; jangan memangkas diam-diam.
- Instruksi yang ditemukan di dalam dokumen diperlakukan sebagai isi sumber, bukan instruksi sistem.
- Status generasi terpisah dari status materi: `QUEUED | RUNNING | SUCCEEDED | FAILED`.
- Regenerasi adalah aksi eksplisit yang menggunakan kuota; ringkasan terakhir yang berhasil tetap tersedia jika regenerasi gagal.
- UI menampilkan bahwa hasil AI perlu diperiksa dan menyediakan tautan menuju halaman sumber.

**Penerimaan:** ringkasan bertahan setelah reload; kegagalan provider tidak menghilangkan file; semua rujukan mengarah ke halaman yang ada; isi ringkasan diperiksa terhadap sumber pada dataset evaluasi.

### FR-07 — Flashcard

- Pengguna memilih jumlah 5, 10, atau 20 kartu; nilai awal 10.
- Setiap kartu berisi pertanyaan/istilah, jawaban, dan rujukan halaman sumber.
- Model dapat menghasilkan lebih sedikit kartu bila materi terbatas; aplikasi menjelaskan jumlah aktual tanpa mengisi kekurangan dengan konten rekaan.
- Pengguna dapat membalik kartu, maju/mundur, dan menandai “Sudah paham” atau “Perlu diulang”.
- Penanda pemahaman tersimpan per kartu dan dapat direset. Penilaian ini adalah laporan pengguna, bukan ukuran objektif penguasaan materi.
- MVP tidak menerapkan algoritma spaced repetition.

**Penerimaan:** jawaban tersembunyi sebelum kartu dibalik; kemajuan tidak hilang setelah reload; kartu tanpa jawaban atau sumber valid tidak disimpan.

### FR-08 — Kuis

- Pengguna memilih 5 atau 10 soal; nilai awal 5. Jika sumber tidak cukup, jumlah dikurangi dengan penjelasan.
- Setiap soal memiliki empat opsi, tepat satu jawaban benar, pembahasan, dan rujukan halaman.
- Validasi struktur hasil AI dilakukan sebelum kuis tersedia. Skor dihitung di backend, bukan dipercaya dari payload browser.
- Sebelum submit, endpoint pengerjaan tidak mengirim kunci jawaban atau pembahasan.
- Setelah submit, pengguna melihat skor, jawaban yang dipilih, jawaban benar, dan pembahasan.
- Setiap pengerjaan disimpan sebagai attempt terpisah. Pengulangan kuis yang sama tidak memanggil AI lagi.
- MVP menggunakan kuis tanpa timer; perubahan/generasi baru tidak memodifikasi soal pada attempt yang sudah disubmit.

**Penerimaan:** skor sama dengan jumlah jawaban benar dibagi jumlah soal dikali 100; submit berulang dengan ID attempt sama tidak membuat hasil ganda; pengguna lain tidak dapat membuka hasil.

### FR-09 — Dashboard

- Menampilkan semester aktif, tugas hari ini, deadline tujuh hari ke depan, jumlah tugas terlambat, materi terbaru, dan attempt kuis terbaru.
- Statistik dibatasi pada semester aktif dan rentang waktu yang tertulis. Materi terbaru maksimal lima item.
- Persentase tugas selesai dihitung dari tugas selesai dibagi seluruh tugas pada filter aktif; bila tidak ada tugas, tampilkan empty state, bukan persentase menyesatkan.
- Empty state memiliki aksi yang relevan. Kegagalan satu bagian tidak menyamarkan data lain menjadi angka nol.
- Semua angka dihitung dari data pengguna; tidak menggunakan statistik demo dalam akun nyata.

### FR-10 — Job, status, dan kuota

- Ekstraksi dan generasi AI berjalan di worker terpisah menggunakan Redis + BullMQ. API mengembalikan penerimaan job tanpa menunggu hasil AI.
- PostgreSQL menyimpan status produk dan hasil; Redis digunakan untuk antrean, bukan satu-satunya penyimpanan hasil.
- Pengiriman job dan pembaruan database harus dapat direkonsiliasi bila salah satunya gagal. Gunakan transactional outbox atau mekanisme rekonsiliasi setara yang diuji.
- Setiap pekerjaan memiliki identitas/idempotency key. Retry atau pengiriman ganda tidak membuat hasil serta notifikasi ganda.
- Maksimal tiga attempt otomatis total untuk kegagalan sementara, dengan jeda meningkat. Kesalahan validasi tidak diulang otomatis.
- Job tertunda dan worker restart dapat dipulihkan. Pembatalan/penghapusan materi mencegah penyimpanan hasil baru.
- Polling status awal setiap lima detik hanya ketika ada pekerjaan aktif; berhenti saat selesai dan lakukan backoff ketika gagal. Status tetap dapat diperoleh tanpa Socket.io.
- Kuota awal per pengguna: 200 MB storage, 10 upload baru per hari, 20 permintaan generasi AI per hari, dan maksimal dua generasi aktif bersamaan. Reset kuota harian pukul 00.00 UTC dan tampilkan waktu reset dalam zona waktu profil.
- Kuota diperiksa serta dicadangkan secara atomik sebelum enqueue. Retry internal tidak mengurangi kuota pengguna lagi. Job terminal gagal melepaskan reservasi kuota; biaya provider yang sudah timbul tetap dicatat secara internal.
- Sediakan batas biaya global yang dapat dikonfigurasi; saat batas tercapai, AI ditunda dengan pesan jelas, sedangkan fitur kuliah tetap berfungsi.

**Penerimaan:** dua klik cepat tidak membuat dua pekerjaan untuk permintaan yang sama; dua worker tidak menyimpan output ganda; kegagalan enqueue tidak membuat materi selamanya berstatus antre.

### FR-11 — Jadwal Kuliah Mingguan

- **Struktur Sesi Mingguan**:
  - Jadwal berulang mingguan terkait langsung dengan satu mata kuliah (`courseId`).
  - Semester mengikuti relasi mata kuliah (`course.semesterId`), bukan dipilih secara terpisah untuk mencegah inkonsistensi data.
  - Satu mata kuliah dapat memiliki beberapa sesi per minggu (misalnya sesi kuliah teori dan sesi praktikum di hari yang sama atau berbeda).
  - Setiap sesi memiliki atribut:
    - `dayOfWeek`: Hari perkuliahan (1 = Senin hingga 7 = Minggu).
    - `startTime`: Waktu mulai kuliah dalam format 24 jam `"HH:mm"` lokal pengguna (contoh `"08:00"`).
    - `endTime`: Waktu selesai kuliah dalam format 24 jam `"HH:mm"` lokal pengguna (contoh `"09:40"`).
    - `room`: Lokasi / ruangan perkuliahan opsional (maksimal 100 karakter).
- **Aturan Validasi Waktu**:
  - Waktu selesai harus lebih besar daripada waktu mulai (`startTime < endTime`).
  - Sesi jadwal lintas tengah malam (`startTime > endTime`) belum didukung pada versi ini dan ditolak dengan pesan yang jelas.
  - Sesi jadwal identik untuk mata kuliah yang sama (kombinasi `courseId`, `dayOfWeek`, `startTime`, `endTime` sama) ditolak dengan status 409 Conflict.
- **Deteksi Konflik Waktu (Schedule Conflict)**:
  - Jadwal yang bertabrakan waktu tetap diperbolehkan untuk disimpan (tidak memblokir operasi simpan), namun API mengembalikan metadata/flag konflik (`hasConflict: true`, daftar `conflicts`) agar antarmuka dapat memberi peringatan yang jelas kepada mahasiswa.
  - Evaluasi konflik hanya membandingkan sesi dalam semester yang sama dan hari yang sama milik pengguna yang sama.
  - Sesi waktu yang berdampingan (misalnya 08:00–10:00 dan 10:00–12:00) bukan merupakan konflik.
  - Pembaruan sesi (edit) mengecualikan sesi itu sendiri dari perbandingan konflik.
  - Sesi pada semester yang berbeda tidak dianggap konflik.
- **Lifecycle & Invarian Arsip**:
  - Penghapusan mata kuliah secara otomatis menghapus seluruh sesi jadwal terkait (`CASCADE`).
  - Mata kuliah atau semester yang diarsipkan bersifat hanya-baca (read-only): penambahan, pengubahan, atau penghapusan sesi jadwal ditolak dengan pesan error.
  - Nilai informasi dosen (`lecturer`) pada mata kuliah menjadi fallback default pengampu untuk seluruh sesi.

**Penerimaan:** sesi jadwal tersimpan dengan urutan hari (Senin–Minggu) lalu jam mulai; multi-tenant isolation terjaga penuh; konflik waktu terdeteksi dengan tepat tanpa menolak penyimpanan.

#### Rencana Antarmuka UI (Tahap Berikutnya):
1. **Tampilan Mingguan Desktop**: Grid kalender visual Senin s/d Jumat/Minggu yang menampilkan blok waktu perkuliahan, kode ruangan, dan indikator peringatan konflik waktu.
2. **Agenda Harian Mobile**: Tampilan daftar timeline harian yang ringkas, responsif, dan mudah dibaca tanpa overflow horizontal.
3. **Widget "Jadwal Hari Ini" di Dashboard**: Kartu sorotan pada dashboard belajar yang menampilkan daftar mata kuliah yang harus dihadiri hari ini berdasarkan hari aktif di zona waktu pengguna.

## 8. Pengembangan v1.1

### 8.1 Ask StudyFlow — tanya-jawab berbasis materi

- Chat dibatasi pada satu materi atau satu mata kuliah yang dipilih secara eksplisit.
- Hanya materi `READY` milik pengguna dalam scope tersebut yang dapat diretrieval.
- Pipeline meliputi pemotongan teks, penyimpanan metadata halaman, embeddings/index, retrieval, dan generasi jawaban dengan kutipan.
- Otorisasi dilakukan sebelum retrieval, bukan sekadar menyaring hasil jawaban.
- Bila tidak ada bukti memadai, jawab bahwa informasi tidak ditemukan dalam materi. Jangan menyajikan pengetahuan umum sebagai kutipan dokumen.
- Riwayat percakapan tersimpan. Penghapusan sumber menghapus chunk/index terkait dan menandai rujukan lama sebagai sumber yang sudah dihapus.
- Chat memiliki kuota dan batas konteks tersendiri yang ditetapkan sebelum fitur dirilis.
- Pilihan provider/model embeddings dan penyimpanan vektor diputuskan melalui evaluasi sebelum milestone chat; tidak wajib dibangun pada MVP.

### 8.2 Realtime dan reminder

- Socket.io memperbarui status job serta notifikasi dalam aplikasi melalui room pengguna yang terautentikasi.
- PostgreSQL menyimpan notifikasi dan status dibaca; event socket hanya mempercepat pembaruan tampilan.
- Setelah reconnect, aplikasi mengambil status terbaru melalui API agar event yang terlewat tidak menghilangkan informasi.
- Reminder tugas dibuat 24 jam dan 1 jam sebelum deadline; job memeriksa ulang status tugas serta deadline terkini. Tugas selesai, dihapus, atau deadline berubah tidak menerima pengingat lama.
- Email, WhatsApp, dan push browser berada di luar tahap ini.

## 9. Struktur halaman dan pengalaman pengguna

| Route konseptual | Fungsi |
| --- | --- |
| `/` | Landing page dan penjelasan produk |
| `/login`, `/register` | Autentikasi |
| `/dashboard` | Ringkasan kegiatan akademik |
| `/semesters` | Pengelolaan semester |
| `/courses`, `/courses/[id]` | Mata kuliah dan tab materi, tugas, catatan |
| `/assignments` | Daftar dan filter tugas |
| `/materials`, `/materials/[id]` | Daftar materi, preview, status, hasil AI |
| `/notes`, `/notes/[id]` | Daftar dan editor catatan |
| `/flashcards/[setId]` | Mode latihan flashcard |
| `/quizzes/[id]`, `/attempts/[id]` | Pengerjaan kuis dan hasil |
| `/settings` | Profil, zona waktu, tema, penggunaan kuota |
| `/assistant` | Chat berbasis materi, v1.1 |

- Navigasi dashboard menggunakan sidebar desktop dan drawer mobile berbasis shadcn/ui.
- Desain tenang, mudah dibaca, dengan hierarki yang jelas; detail warna, tipografi, spacing, dan komponen diatur dalam `DESIGN.md`.
- Tema terang/gelap mengikuti sistem pada kunjungan awal, lalu menyimpan pilihan pengguna.
- Bahasa UI awal Bahasa Indonesia. Dukungan bilingual tidak menjadi gate MVP.
- Semua halaman data menyediakan keadaan loading, kosong, gagal, dan berhasil. Status tidak dibedakan melalui warna saja.
- Target penggunaan pada lebar 360 px, 768 px, dan 1440 px tanpa overflow horizontal halaman utama.
- Pengguna keyboard dapat mengoperasikan dialog, form, flashcard, dan kuis; label form, focus indicator, serta kontras harus diperiksa sebelum rilis.

## 10. Arsitektur dan stack

| Lapisan | Pilihan |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Lucide |
| Form dan data interaktif | React Hook Form, Zod, TanStack Query |
| API | Express + TypeScript, REST |
| Database | PostgreSQL + Prisma |
| Autentikasi | Access JWT, refresh session yang dirotasi |
| File | Supabase Storage, private bucket |
| Background processing | Redis + BullMQ, worker terpisah |
| AI | Satu provider awal: OpenAI atau Gemini, dipilih melalui evaluasi |
| Realtime | Socket.io pada v1.1 |
| Pengujian | Vitest, pengujian API, Playwright |
| Infrastruktur | Docker Compose untuk lokal, GitHub Actions, Vercel untuk web |

### 10.1 Batas tanggung jawab

- Next.js menangani rendering, routing, dan UI. Gunakan Server Components untuk bagian yang sesuai serta Client Components untuk editor, kuis, upload, dan interaksi lain.
- Express memiliki business logic, otorisasi, akses Prisma, serta koordinasi job. Next.js tidak membuat lapisan business logic kedua atau mengakses database langsung.
- Route Handler Next.js boleh digunakan sebagai adapter/BFF tipis untuk kebutuhan sesi dan akses satu origin; bukan tempat menjalankan ekstraksi atau worker.
- Strategi awal autentikasi browser menggunakan cookie HttpOnly, Secure di production, dan SameSite yang sesuai. Adapter satu origin meneruskan kredensial ke Express; endpoint yang mengubah data memvalidasi Origin dan perlindungan CSRF. Akses cookie dari server Next.js dan alur refresh diuji sejak milestone autentikasi.
- Data pengguna tidak masuk shared/public cache. Kunci cache client mencakup identitas pengguna dan dibersihkan saat logout.
- API dan worker berjalan pada host yang mendukung proses Node/container persisten. Vercel pada rancangan ini menjadi host frontend; penyedia host API, worker, dan Redis dipilih sebelum deployment.
- Supabase dipakai untuk storage; autentikasi tetap milik Express. Kredensial storage privileged hanya tersedia di backend/worker, tidak dikirim ke browser.

### 10.2 Struktur monorepo

```text
apps/
  web/                 # Next.js
  api/                 # Express REST API
  worker/              # Consumer job ekstraksi dan AI
packages/
  shared/              # Schema Zod dan tipe kontrak publik
  database/            # Prisma schema, migrations, client untuk server
  config/              # Konfigurasi TypeScript dan lint bersama
docs/
  product_requirements_document.md
  architecture.md
  api.openapi.json
DESIGN.md
docker-compose.yml
```

Package database tidak boleh diimpor ke bundle browser. Versi dependencies kompatibel dan versi Node yang didukung dipilih saat foundation, lalu dikunci dalam lockfile; PRD ini tidak menetapkan nomor versi framework selain keputusan Tailwind v4 yang sudah disepakati.

## 11. Model data konseptual

| Entitas | Data dan relasi utama |
| --- | --- |
| User | Nama, email, passwordHash, timezone; pemilik seluruh data pribadi |
| RefreshSession | User, tokenHash, expiry, revokedAt, relasi rotasi |
| Semester | User, nama, tahun ajaran, aktif/arsip |
| Course | User, semester, nama, kode, dosen, arsip |
| Assignment | User, course, judul, deadline, priority, status, completedAt |
| Material | User, course, storageKey, MIME, bytes, pageCount, status, errorCode |
| MaterialPage | Material, pageNumber, extractedText; menjaga asal kutipan |
| ProcessingJob | User, material, type, status, idempotencyKey, attempts, timestamps |
| Summary | User, material, isi terstruktur, sumber, model, promptVersion |
| Note | User, course, material opsional, judul, Markdown |
| FlashcardSet / Flashcard | User, material, pasangan pertanyaan-jawaban, halaman sumber, penanda pemahaman |
| Quiz / QuizQuestion | User, material, soal, opsi, kunci, pembahasan, sumber |
| QuizAttempt / QuizAnswer | User, quiz, jawaban, skor, waktu submit |
| UsageRecord | User, request/job, reservasi kuota, token, perkiraan biaya bila tersedia |
| OutboxEvent atau padanannya | Pengiriman pekerjaan yang dapat direkonsiliasi |

Tambahan v1.1: `MaterialChunk`, embedding/index metadata, `Conversation`, `ChatMessage`, dan `Notification`.

Foreign key dan validasi service harus menjaga konsistensi pemilik antarentitas. ID resource yang valid bukan bukti hak akses. Relasi, indeks, constraint unik, serta kebijakan cascade difinalisasi dalam migration dan dokumentasi arsitektur.

## 12. Kontrak layanan minimum

Daftar berikut adalah batas kapabilitas API, bukan spesifikasi payload final.

| Kelompok | Kapabilitas |
| --- | --- |
| `/api/auth/*` | Register, login, refresh, logout, profil, ganti password |
| `/api/semesters`, `/api/courses` | CRUD sesuai aturan arsip dan penghapusan |
| `/api/assignments`, `/api/notes` | CRUD dan filter dengan pagination |
| `/api/materials` | Inisiasi upload, finalisasi/verifikasi, daftar, detail, hapus, retry, akses file |
| `/api/materials/:id/summary` | Lihat hasil dan minta generasi |
| `/api/materials/:id/flashcard-sets` | Daftar set dan minta generasi |
| `/api/materials/:id/quizzes` | Daftar kuis dan minta generasi |
| `/api/jobs/:id` | Status job milik pengguna |
| `/api/flashcards/:id` | Simpan penanda pemahaman |
| `/api/quizzes/:id/attempts` | Mulai pengerjaan dan submit jawaban |
| `/api/attempts/:id` | Hasil pengerjaan |
| `/api/dashboard`, `/api/usage` | Agregasi dashboard dan pemakaian kuota |
| `/health`, `/ready` | Status proses dan kesiapan dependency tanpa membocorkan secret |

Gunakan respons error konsisten dengan kode aplikasi dan pesan aman. Resource milik pengguna lain diperlakukan tidak ditemukan. Job async mengembalikan HTTP 202 serta ID job. Daftar memakai pagination, nilai awal 20 dan maksimal 100 item. Payload serta error codes dituangkan dalam OpenAPI selama tiap milestone.

## 13. Keamanan, privasi, dan keandalan

- Semua query resource memverifikasi pemilik. Pengujian wajib mencakup read, write, delete, file URL, job status, serta relasi silang pengguna.
- Password, token, signed URL, isi PDF, prompt lengkap, dan jawaban privat tidak masuk log aplikasi secara default.
- Secret hanya berada di environment server. File konfigurasi contoh berisi placeholder.
- Rate limit diterapkan pada autentikasi, upload, dan generasi AI; kuota bisnis terpisah dari rate limit trafik.
- Worker membatasi waktu, memori, jumlah halaman, serta ukuran hasil ekstraksi. Konten PDF atau keluaran model tidak pernah dieksekusi sebagai kode.
- Semua output AI diperiksa schema dan dirender sebagai teks/Markdown yang disanitasi.
- Pengguna diberi penjelasan bagian konten yang dikirim ke provider AI. Jangan menjanjikan kebijakan retensi provider sebelum provider dan ketentuannya diverifikasi.
- Penghapusan materi segera mencabut akses dan menjadwalkan pembersihan seluruh data turunan. Target pembersihan storage maksimal 24 jam; kegagalan dicatat untuk pemulihan.
- Sebelum beta dengan data nyata: tetapkan kebijakan backup/retensi dan lakukan satu uji restore. Penghapusan akun mandiri masuk gate sebelum pendaftaran publik; beta terbatas boleh menggunakan permintaan penghapusan manual yang terdokumentasi.
- Perubahan status, kegagalan worker, antrean tertunda, dan penggunaan provider dapat diamati melalui log terstruktur dengan request/job ID.
- Operasi penting memakai transaksi, idempotency, atau kompensasi; tidak mengandalkan “exactly once” pada layanan eksternal.

## 14. Target nonfungsional

| Area | Target awal dan kondisi ukur |
| --- | --- |
| API biasa | p95 di bawah 800 ms untuk read/write sederhana pada 20 pengguna virtual bersamaan; tidak termasuk transfer file/AI |
| Pengakuan job | p95 di bawah 2 detik setelah file tersedia dan validasi ringan selesai |
| Navigasi/dashboard | Halaman tetap dapat digunakan tanpa menunggu ekstraksi atau AI selesai |
| Ketahanan | Restart worker tidak menghilangkan materi, hasil yang berhasil, atau status akhir yang dapat direkonsiliasi |
| Responsivitas | Alur utama dapat dipakai pada tiga ukuran viewport di bagian UX |
| Observabilitas | Setiap job gagal memiliki ID, tahap, waktu, kode penyebab, dan jumlah attempt |
| Reproduksibilitas | README menjelaskan setup lokal, environment, migration, seed, dan perintah menjalankan web/API/worker |

Waktu AI dipengaruhi ukuran dokumen dan provider. Ukur p50/p95 pada dataset tetap sebelum menetapkan SLA beta; tampilkan status proses, bukan estimasi waktu yang belum terukur.

## 15. Pengujian dan evaluasi AI

### 15.1 Pengujian aplikasi

- Unit: deadline dan zona waktu, perhitungan skor, transisi status, validasi output, reservasi kuota.
- Integration: sesi dan pencabutan token, akses silang pengguna, konsistensi relasi, storage authorization, enqueue/retry, pembersihan data, submit attempt idempotent.
- Worker: restart di tengah proses, event/job ganda, provider timeout/429/5xx, respons AI invalid, materi dihapus saat job berjalan, Redis sementara tidak tersedia.
- E2E: register/login → buat semester/mata kuliah → tambah tugas → upload → ringkasan → flashcard → kuis → lihat hasil → logout.
- CI menggunakan provider AI mock yang deterministik. Evaluasi provider nyata dijalankan terkontrol dan berkuota; keberhasilan mock bukan bukti kualitas AI nyata.
- Smoke test autentikasi, cookie, akses file privat, dan queue dilakukan pada domain deployment sebenarnya.

### 15.2 Dataset evaluasi

Siapkan minimal 20 PDF valid yang boleh digunakan, mencakup Bahasa Indonesia/Inggris, dokumen pendek/panjang, tabel, dan tata letak dua kolom. Tambahkan fixture negatif terpisah: scan tanpa teks, encrypted, rusak, oversized, dan teks yang mencoba memberi instruksi kepada AI.

Untuk subset yang ditinjau manual, catat kesetiaan ringkasan, kecocokan halaman sumber, relevansi flashcard, kejelasan soal, serta kebenaran kunci jawaban. Gate awal: tidak ada kutipan ke halaman yang tidak ada; minimal 90% soal yang ditinjau memiliki satu jawaban benar yang didukung sumber; kesalahan faktual kritis pada konsep utama menghalangi rilis sampai diperbaiki atau fitur dibatasi. Simpan ukuran sampel dan hasil penilaian bersama prompt/model yang digunakan.

## 16. Milestone implementasi

Pengujian, validasi, dan dokumentasi dilakukan di setiap milestone. Keamanan tidak ditunda sampai akhir.

| Milestone | Hasil | Gate selesai |
| --- | --- | --- |
| M1 — Foundation | Monorepo, Next.js, Express, PostgreSQL, Redis, Docker Compose, CI | Semua proses dasar dapat dijalankan; lint, typecheck, build lulus |
| M2 — Auth dan shell UI | Register/login, cookie/refresh, profil, sidebar responsif | Tes lifecycle sesi dan layout dasar lulus |
| M3 — Semester dan mata kuliah | Organisasi data dan ownership | CRUD, arsip, relasi silang pengguna diuji |
| M4 — Tugas, catatan, dashboard dasar | Deadline, status, editor Markdown, empty states | Alur kuliah pribadi berfungsi dan perhitungan waktu benar |
| M5 — Storage dan worker | Upload PDF privat, ekstraksi, polling, retry, rekonsiliasi | File negatif ditangani; restart dan penghapusan saat job aktif diuji |
| M6 — Ringkasan AI | Provider adapter, kuota, kutipan, hasil tersimpan | Dataset awal dievaluasi; timeout dan output invalid tertangani |
| M7 — Flashcard dan kuis | Generasi, latihan, attempt, penilaian backend | Kunci tidak bocor sebelum submit; hasil dan progress tersimpan |
| M8 — MVP release | E2E, evaluasi AI, deployment, demo, README | Definition of Done v1 terpenuhi |
| M9 — Ask StudyFlow | Retrieval, chat dengan sumber, history | Isolasi retrieval dan jawaban tanpa bukti diuji |
| M10 — Realtime dan reminder | Socket.io, notifikasi tersimpan, deadline reminders | Reconnect dan deduplikasi berjalan |
| M11 — Beta/public readiness | Masukan pengguna, reset password, verifikasi email, penghapusan akun | Gate pendaftaran publik, kuota, dan biaya ditinjau |

Urutan ini memindahkan background jobs sebelum fitur AI karena ekstraksi dan generasi bergantung pada worker. M9–M11 bukan syarat untuk menyatakan MVP pribadi selesai.

## 17. Definition of Done v1

- Seluruh kebutuhan MVP FR-01 sampai FR-10 berjalan sesuai acceptance criteria.
- Alur penuh dari registrasi hingga hasil kuis berhasil pada deployment.
- Tidak ada jalur yang diketahui dapat membaca atau mengubah data pengguna lain.
- Dataset PDF dan evaluasi AI memenuhi gate yang ditetapkan; kegagalan dijelaskan di UI.
- Job ganda/retry/restart dan penghapusan materi tidak merusak konsistensi data.
- Kuota, pembatasan biaya, dan status pemakaian sudah aktif.
- CI lint, typecheck, build, serta pengujian kritis lulus.
- UI utama diverifikasi pada mobile, tablet, desktop, serta penggunaan keyboard.
- Demo memakai materi contoh yang boleh dibagikan; data demo tidak tercampur dengan akun pengguna nyata.
- README, environment example, OpenAPI, diagram arsitektur, migration, dan panduan menjalankan worker tersedia.
- Deployment web/API/worker/database/Redis/storage terdokumentasi dan smoke test berhasil.

## 18. Risiko dan penanganan

| Risiko | Penanganan |
| --- | --- |
| Scope terlalu besar untuk satu developer | Selesaikan M1–M8; chat dan realtime tetap tahap lanjutan |
| Biaya AI membesar | Generasi eksplisit, hasil disimpan, kuota atomik, batas biaya global |
| Ekstraksi PDF tidak akurat | Mulai PDF berbasis teks, simpan provenance, uji layout berbeda, tolak dokumen tak memadai |
| AI mengarang informasi | Konteks terikat sumber, validasi kutipan, evaluasi manual dan indikator hasil AI |
| Job hilang/duplikat | Status persisten, outbox/rekonsiliasi, idempotency, retry terbatas |
| Kebocoran materi pribadi | Private bucket, ownership checks, URL sementara, tes akses silang |
| Masalah cookie pada deployment | Adapter satu origin dan smoke test autentikasi sejak M2 |
| Infrastruktur melebihi budget | Pilih host berdasarkan kebutuhan proses persisten dan ukur pemakaian sebelum beta |

## 19. Keputusan terbuka dan waktu penetapan

| Keputusan | Batas penetapan | Dasar keputusan |
| --- | --- | --- |
| Provider/model AI awal | Sebelum M6 | Kualitas Bahasa Indonesia, format terstruktur, biaya aktual, privasi, latency |
| Budget bulanan dan batas biaya global | Sebelum M6 memakai provider nyata | Batas pengeluaran pemilik; tanpa nilai ini hanya mode mock/local |
| Parser PDF | Saat M5 | Akurasi halaman, layout, batas sumber daya, lisensi |
| Host API/worker/Redis dan domain | Sebelum M8 | Dukungan proses persisten, konektivitas, biaya, observabilitas |
| Retensi backup dan prosedur penghapusan | Sebelum beta dengan data nyata | Kebutuhan pemulihan dan kebijakan privasi yang dipublikasikan |
| Embedding/index retrieval | Sebelum M9 | Dataset, kualitas retrieval, biaya, kemudahan operasi |

Semua fitur di luar scope memerlukan pembaruan PRD sebelum diimplementasikan. Perubahan yang memengaruhi kuota, data pengguna, atau kriteria rilis dicatat pada riwayat versi.

## 20. Referensi teknis

Referensi ini mendukung batas teknis rancangan; pilihan scope dan angka target merupakan keputusan produk StudyFlow. Diakses 3 Oktober 2026.

- [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components): pembagian komponen server dan interaksi client.
- [BullMQ — Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs): pekerjaan yang aman ketika dicoba kembali.
- [Supabase — Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals): bucket privat dan akses file terotorisasi.

## 21. Riwayat perubahan

| Versi | Tanggal | Perubahan |
| --- | --- | --- |
| 1.0 | 3 Oktober 2026 | PRD awal; Next.js + Express; MVP personal dengan PDF, ringkasan, flashcard, kuis; chat/realtime menjadi v1.1 |
