# StudyFlow — Design Guidelines

| Informasi | Nilai |
| --- | --- |
| Versi | 1.0 |
| Tanggal | 3 Oktober 2026 |
| Acuan produk | `docs/product_requirements_document.md` v1.0 |
| Lokasi dokumen | `DESIGN.md` di root repository |
| Frontend | Next.js App Router + TypeScript |
| Fondasi UI | Tailwind CSS v4 + shadcn/ui + Lucide |
| Bahasa UI awal | Bahasa Indonesia |
| Tema awal | Mengikuti sistem; pilihan pengguna disimpan |

Dokumen ini adalah sumber acuan visual dan interaksi StudyFlow. PRD menentukan fitur serta aturan bisnis; DESIGN.md menentukan cara pengguna melihat dan mengoperasikannya. Jika terjadi konflik scope, ikuti PRD dan selaraskan dokumen sebelum menambah fitur. Nilai ukuran berikut merupakan default proyek, bukan batas yang menghalangi zoom, teks panjang, atau kebutuhan aksesibilitas.

## 1. Identitas produk

StudyFlow adalah ruang belajar pribadi untuk mahasiswa: mengelola perkuliahan, menyimpan materi, dan berlatih dengan bantuan AI yang merujuk sumber.

**Kesan yang dituju:** tenang, teratur, jelas, dapat dipercaya, dan nyaman dipakai membaca lama.

**Arah visual:** permukaan seperti kertas yang bersih, teks berwarna tinta gelap, aksen biru terukur, pembatas tipis, dan komposisi yang mengutamakan isi. Identitas muncul melalui tipografi, susunan konten akademik, dan konsistensi detail.

**Prioritas:** kejelasan informasi → kemudahan bertindak → efisiensi penggunaan. Aksesibilitas adalah syarat di seluruh lapisan, bukan fitur tambahan pada tahap akhir.

AI hadir sebagai alat belajar pada materi. Tampilan tidak perlu didominasi simbol AI, kilau, robot, atau panel chat saat pengguna sedang mengelola tugas.

## 2. Prinsip desain

1. **Tindakan berikutnya mudah ditemukan.** Setiap halaman mempunyai tujuan dan satu aksi utama yang paling menonjol.
2. **Isi akademik menjadi pusat.** Judul materi, deadline, nama mata kuliah, dan sumber lebih penting daripada dekorasi atau angka statistik.
3. **Kepadatan secukupnya.** Daftar boleh padat selama judul, metadata, dan kontrol tetap terbaca serta mudah disentuh.
4. **Status dapat dipercaya.** Bedakan transfer file, ekstraksi, dan generasi AI. Jangan menampilkan persentase proses yang tidak diketahui.
5. **Pekerjaan aman saat terganggu.** Jelaskan perubahan belum tersimpan, proses yang tetap berjalan, kegagalan, dan opsi pemulihan.
6. **Pola konsisten.** Posisi aksi, dialog, filter, dan pesan status tetap serupa antarhalaman.
7. **Scope terlihat jujur.** MVP tidak menampilkan menu chat, lonceng notifikasi, kalender, atau fitur kolaborasi yang belum berfungsi.

## 3. Bahasa visual yang dihindari

- Gradient dekoratif pada latar, teks judul, tombol, dan kartu statistik.
- Neon glow, glassmorphism, blur luas, serta bayangan berat.
- Memasukkan setiap paragraf atau section ke kartu tersendiri.
- Dashboard berisi deretan kartu KPI besar sebelum tugas yang perlu dikerjakan.
- Hero terlalu tinggi, heading yang memenuhi layar, bento dekoratif tanpa fungsi.
- Ikon emoji sebagai sistem navigasi atau ikon utama produk.
- Badge berwarna berbeda untuk setiap mata kuliah tanpa alasan informasional.
- Chart, persentase kemajuan belajar, streak, testimoni, atau angka pengguna yang tidak didukung data.
- Tombol berbentuk pill di semua tempat. Pill hanya untuk badge kecil bila cocok.
- Animasi melayang, parallax, typing effect, atau confetti pada aktivitas rutin.

## 4. Sistem warna

### 4.1 Token inti

Arah visual baru StudyFlow adalah **ruang belajar yang tenang, rapi, mudah dibaca, dan terasa matang**. Kami menghindari kelebihan kartu, badge warna-warni, serta aksen berlebihan.

- **Light Mode**: Palet bernuansa kertas bersih dan hangat (`#FAFAF9`), surface putih bersih (`#FFFFFF`), teks tinta charcoal gelap (`#18181B`), teks sekunder terukur (`#52525B`), pembatas netral tipis (`#E4E4E7`), aksen indigo terfokus (`#4F46E5`), dan active surface lembut (`#EEF2FF`).
- **Dark Mode**: Charcoal netral bertingkat (`#09090B` background, `#18181B` surface), kontras tinggi tanpa rona layar biru jenuh, teks terang lembut (`#F4F4F5`), dan aksen indigo yang disesuaikan kontrasnya.

| Token | Light | Dark | Penggunaan |
| --- | --- | --- | --- |
| `background` | `#FAFAF9` | `#09090B` | Latar aplikasi utama |
| `foreground` | `#18181B` | `#F4F4F5` | Teks utama (>13:1 kontras) |
| `card` | `#FFFFFF` | `#18181B` | Panel konten, area baca, dialog |
| `card-foreground` | `#18181B` | `#F4F4F5` | Teks di panel |
| `popover` | `#FFFFFF` | `#18181B` | Menu dan popover |
| `popover-foreground` | `#18181B` | `#F4F4F5` | Isi menu dan popover |
| `primary` | `#4F46E5` | `#6366F1` | Aksi utama dan indikator fokus |
| `primary-foreground` | `#FFFFFF` | `#FFFFFF` | Teks pada tombol primary |
| `primary-hover` | `#4338CA` | `#818CF8` | Hover tombol primary |
| `secondary` | `#F4F4F5` | `#27272A` | Tombol pendukung & tag netral |
| `secondary-foreground` | `#27272A` | `#E4E4E7` | Teks secondary |
| `muted` | `#F4F4F5` | `#27272A` | Area latar pendukung, separator ringan |
| `muted-foreground` | `#52525B` | `#A1A1AA` | Metadata dan keterangan (>5:1 kontras) |
| `accent` | `#EEF2FF` | `#1E1B4B` | Pilihan aktif dan hover menu |
| `accent-foreground` | `#4338CA` | `#E0E7FF` | Teks pilihan aktif |
| `border` | `#E4E4E7` | `#27272A` | Batas panel dan pemisah baris |
| `input` | `#D4D4D8` | `#3F3F46` | Batas kontrol formulir |
| `ring` | `#4F46E5` | `#6366F1` | Ring fokus aksesibel |
| `destructive` | `#DC2626` | `#EF4444` | Tombol aksi berbahaya |
| `destructive-foreground` | `#FFFFFF` | `#FFFFFF` | Teks tombol destructive |
| `sidebar` | `#F4F4F5` | `#121215` | Permukaan navigasi samping |
| `sidebar-foreground` | `#18181B` | `#F4F4F5` | Teks navigasi |
| `sidebar-border` | `#E4E4E7` | `#27272A` | Batas sidebar |
| `sidebar-accent` | `#EEF2FF` | `#1E1B4B` | Item menu sidebar aktif |
| `sidebar-accent-foreground` | `#4338CA` | `#E0E7FF` | Teks item aktif sidebar |

### 4.2 Warna status semantik

Aturan ketat token status:
- **Pemisahan Background dan Foreground**: Background status bersifat pastel lembut/tenang, sedangkan teks status menggunakan foreground yang pekat dengan kontras minimal 4.5:1.
- **Larangan Teks Pucat**: Jangan pernah menggunakan warna background (misal hijau muda/merah muda) sebagai warna teks.
- **Ikon dan Teks Berdampingan**: Status tidak boleh disampaikan hanya melalui warna saja.

| Status | Light: surface / text | Dark: surface / text | Ikon & Label Contoh |
| --- | --- | --- | --- |
| Sukses | `#ECFDF5` / `#065F46` | `#064E3B` / `#6EE7B7` | CheckCircle2 — “Selesai” (kontras >7:1) |
| Peringatan | `#FFFBEB` / `#92400E` | `#78350F` / `#FCD34D` | Clock3 — “Terlambat” (kontras >7:1) |
| Gagal | `#FEF2F2` / `#991B1B` | `#7F1D1D` / `#FCA5A5` | AlertCircle — “Gagal diproses” (kontras >7.5:1) |
| Informasi | `#EEF2FF` / `#4338CA` | `#1E1B4B` / `#E0E7FF` | Loader2 — “Memproses” |
| Netral | `#F4F4F5` / `#52525B` | `#27272A` / `#A1A1AA` | Clock — “Dalam antrean” |

### 4.3 Kontras dan penggunaan

- Teks biasa menargetkan minimal kontras 4.5:1 terhadap latar belakang sekitarnya.
- Indikator kontrol, toggle, dan focus ring menargetkan minimal 3:1.
- Hindari opacity rendah pada teks penting (`text-[10px]` atau `text-[11px]` dihapus untuk teks fungsional; gunakan minimal 12–14px).
- Link dalam teks biasa bergaris bawah atau memiliki affordance visual yang jelas.

## 5. Tipografi

Gunakan **Geist Sans** untuk UI dan materi yang dirender aplikasi, dengan fallback `ui-sans-serif, system-ui, sans-serif`. Satu keluarga font cukup. Angka deadline, ukuran file, dan skor memakai tabular numerals bila alignment membantu pemindaian.

| Peran | Desktop | Mobile | Bobot / line-height |
| --- | --- | --- | --- |
| Hero landing | 44 px | 32 px | 600 / 1,15 |
| Judul halaman | 28 px | 24 px | 600 / 1,25 |
| Judul section | 20 px | 18 px | 600 / 1,4 |
| Judul item | 16 px | 16 px | 500–600 / 1,5 |
| Body UI | 14–16 px | 16 px | 400 / 1,5 |
| Isi ringkasan/catatan | 16 px | 16 px | 400 / 1,75 |
| Label dan metadata | 13–14 px | 13–14 px | 400–500 / 1,5 |
| Keterangan kecil | 12 px | 12 px | 400 / 1,5; bukan instruksi utama |

- Implementasikan ukuran berbasis rem; tabel menyatakan ekuivalen pada root 16 px. Jangan mengunci ukuran root agar mengalahkan preferensi browser.
- Input text minimal 16 px. Placeholder memberi contoh format, tidak menggantikan label.
- Maksimal tiga tingkat hierarki dominan dalam satu viewport.
- Heading menggunakan sentence case: “Materi terbaru”, bukan semua huruf kapital.
- Lebar baris konten baca sekitar 60–72 karakter; judul panjang boleh membungkus.
- Truncation hanya pada daftar ringkas. Detail menampilkan judul utuh; tooltip tambahan tidak boleh menjadi satu-satunya cara mengakses nama lengkap di mobile.

## 6. Spacing, bentuk, dan permukaan

| Token konseptual | Nilai | Penggunaan |
| --- | --- | --- |
| Spacing scale | 4, 8, 12, 16, 20, 24, 32, 48, 64 px | Jarak konsisten |
| Page gutter | 16 px mobile; 24 px tablet; 32 px desktop | Batas konten |
| Section gap | 24–32 px | Pemisah kelompok utama |
| Panel padding | 16 px mobile; 24 px desktop | Panel baca dan form |
| Radius small | 6 px | Badge dan item menu |
| Radius control | 8 px | Input dan tombol |
| Radius panel | 12 px | Card dan dialog |
| Border | 1 px | Separator dan panel |
| Tinggi kontrol utama | Minimal 44 px | Tombol, select, input satu baris |
| Target ikon interaktif | Minimal 44 × 44 px | Menu, tutup dialog, toggle sidebar |

Set `--radius: 0.75rem`; petakan radius proyek secara eksplisit agar perubahan preset tidak menggeser bentuk komponen.

Permukaan utama dibedakan lewat background dan border. Panel konten tidak memerlukan shadow secara default. Shadow ringan hanya untuk elemen mengambang seperti dialog/menu; gunakan overlay scrim tanpa blur berat. Jangan menumpuk card di dalam card untuk satu kelompok konten.

## 7. App shell dan navigasi

### 7.1 Desktop

- Sidebar expanded 240 px; collapsed sekitar 64 px, cukup untuk target ikon 44 px.
- Gunakan komposisi shadcn `SidebarProvider`, `Sidebar`, `SidebarInset`, dan `SidebarTrigger` sesuai API yang terpasang. Bila menggunakan varian inset, tempatkan main content pada `SidebarInset`; hindari offset margin manual ganda.
- Header konten sekitar 64 px berisi trigger, breadcrumb, segmented theme toggle, dan dropdown menu akun terpadu (profil, pengaturan, dan keluar) yang selalu tersedia di desktop maupun mobile. Footer sidebar bersih tanpa duplikasi kartu identitas maupun tombol keluar ganda.
- Header sticky dengan backdrop-blur halus; konten dan anchor memiliki scroll offset agar tidak tertutup.
- Main content dashboard maksimal 1200 px dan rata tengah dalam area setelah sidebar. Halaman materi dua panel dapat memakai lebar hingga 1440 px.
- Sidebar menampilkan logo StudyFlow, selektor semester aktif, lalu kelompok navigasi Belajar, Perkuliahan, dan Pengaturan.

### 7.2 Hierarki navigasi MVP

| Posisi | Label | Route | Ikon Lucide |
| --- | --- | --- | --- |
| Utama | Dashboard | `/dashboard` | LayoutDashboard |
| Utama | Mata kuliah | `/courses` | BookOpen |
| Utama | Tugas | `/assignments` | ListTodo |
| Utama | Materi | `/materials` | Files |
| Utama | Catatan | `/notes` | NotebookPen |
| Menu semester | Kelola semester | `/semesters` | CalendarRange |
| Footer | Pengaturan | `/settings` | Settings |

Flashcard dan kuis dibuka dari materi. Tidak perlu menu mandiri untuk semua subfitur. Active item memakai accent surface, teks medium, dan `aria-current="page"`; ikon tidak berubah ukuran saat aktif.

### 7.3 Breakpoint proyek

| Lebar viewport | Navigasi | Konten |
| --- | --- | --- |
| Di bawah 768 px | Sidebar menjadi Sheet/drawer | Satu kolom; filter dapat dilipat |
| 768–1023 px | Drawer tetap digunakan | Satu/dua kolom sesuai ruang |
| 1024 px ke atas | Sidebar permanen, dapat diciutkan | Dashboard dua kolom bila cukup |
| 1280 px ke atas | Sidebar permanen | Preview PDF dan hasil belajar dapat berdampingan |

Jika breakpoint bawaan komponen berbeda, selaraskan hook responsif dan CSS pada 1024 px. Jangan sampai drawer dan sidebar permanen aktif bersamaan atau keduanya hilang.

Di mobile, drawer lebar maksimal 320 px atau viewport dikurangi 48 px. Drawer menutup setelah navigasi, mendukung Escape, mengelola fokus, dan mengembalikan fokus ke trigger ketika ditutup. Hindari sidebar tetap yang menimpa halaman.

## 8. Pola komponen

Gunakan komponen shadcn/ui yang sudah dipasang; pilih satu keluarga primitive secara konsisten. Jangan mencampur contoh Base UI dan Radix tanpa menyesuaikan API. Komponen domain membungkus kebutuhan StudyFlow, bukan membuat ulang primitive aksesibel.

| Kebutuhan | Komponen/pola | Aturan |
| --- | --- | --- |
| Aksi | Button | Primary untuk aksi utama; outline/ghost untuk pendukung |
| Input | Field/Label, Input, Textarea, Select | Label permanen, helper dan error terhubung |
| Pilihan tanggal | Date picker atau kontrol tanggal yang aksesibel | Tetap sediakan input keyboard; tampilkan zona waktu |
| Aksi baris | DropdownMenu | Trigger “Aksi untuk [judul]”; aksi hapus dipisahkan |
| Form singkat | Dialog | Max-width sekitar 480–560 px; fokus awal logis |
| Form mobile/filter | Sheet | Konten dapat scroll; footer tidak menutup field |
| Konfirmasi destruktif | AlertDialog | Sebut objek, dampak, tombol “Hapus materi” |
| Status | Badge + ikon/teks | Ringkas; bukan tombol bila tidak interaktif |
| Tab | Tabs | Menandai mode aktif; mendukung keyboard |
| Kemajuan | Progress | Persentase hanya untuk nilai yang terukur |
| Loading | Skeleton atau status inline | Meniru bentuk konten, bukan layar kosong |
| Umpan balik singkat | Toast | Pelengkap, bukan satu-satunya pesan kesalahan |
| Daftar desktop | Table atau list semantik | Hindari table untuk sekadar membuat layout |
| Bantuan ikon | Tooltip + accessible name | Tooltip bukan pengganti label aksesibel |

Loading button mempertahankan lebar dan label, misalnya “Menyimpan…”. Aksi ganda dicegah tanpa menonaktifkan seluruh halaman. Disabled action selalu memiliki penjelasan yang dapat dibaca tanpa hover pada tombol disabled.

Form create/edit yang validasinya gagal tetap menyimpan nilai input. Error muncul di dekat field, dan fokus diarahkan ke error pertama setelah submit. Hindari mengandalkan tombol simpan yang selalu disabled untuk menjelaskan invalid form.

## 9. Rancangan halaman

### 9.1 Landing page (Halaman Publik)

- **Navbar publik**:
  - Logo `BookOpen` berlatar primer dan wordmark `StudyFlow` (link ke `/`), tautan navigasi section seperlunya (`#fitur` dan `#cara-kerja`), pemilih mode tema (`ThemeToggle`), serta tombol Masuk & Daftar.
  - Jika pengguna sudah memiliki sesi login aktif, tombol Masuk/Daftar otomatis digantikan oleh tombol “Dashboard” (`/dashboard`).
  - Responsif tanpa tumpang tindih pada viewport mobile (<640px / 375px) maupun desktop.
- **Hero section**:
  - Satu `<h1>` yang jelas: “Materi, tugas, dan catatan kuliah lebih teratur.”
  - Deskripsi bahasa sederhana: ruang belajar pribadi mahasiswa untuk mengelola semester, tenggat tugas, catatan belajar, dan memahami materi kuliah PDF dengan bantuan AI yang merujuk dokumen sumber.
  - CTA utama menuju pendaftaran (`/register`, `size="lg"`, `h-11`) atau Dashboard (`/dashboard`) bila sudah login. CTA sekunder menuju alur cara kerja (`#cara-kerja`) atau Masuk (`/login`).
  - Menghindari jargon arsitektur (BFF, port, database model, dsb), klaim berlebihan, dekorasi besar, animasi berat, maupun ilustrasi rekaan.
- **Fitur inti nyata**:
  - Tampilan ringkas fitur yang didukung aplikasi: Semester & Mata Kuliah, Pemantauan Tugas (status terlambat/hari ini/mendatang), Catatan Kuliah Markdown, Pembaca Materi PDF, Ringkasan Konsep AI, serta Flashcard & Kuis Latihan.
  - Disusun menggunakan grid terstruktur dengan tipografi bersih dan pemisah netral tipis.
- **Alur belajar 3 langkah**:
  - Penjelasan alur sederhana bernomor: 01 Atur Semester & Kuliah → 02 Unggah Dokumen & Tugas → 03 Pelajari & Evaluasi Diri.
- **Prinsip transparansi AI**:
  - Kartu catatan edukatif yang jujur: menjelaskan bahwa ringkasan, flashcard, dan kuis adalah alat bantu belajar yang merujuk nomor halaman dokumen asli, sehingga mahasiswa didorong selalu memverifikasi konsep pada dokumen sumbernya.
  - Tidak menjanjikan AI selalu akurat, tidak menjanjikan kuota tanpa batas atau layanan gratis selamanya tanpa dasar produk.
  - Tanpa testimoni rekaan, angka pengguna fiktif, logo mitra palsu, maupun pricing dummy.
- **Footer ringkas**:
  - Hak cipta produk StudyFlow dan tautan navigasi internal nyata (Beranda, Fitur, Cara Kerja, Masuk, Daftar / Dashboard). Bebas dari tautan kebijakan atau bantuan palsu yang berujung 404.

### 9.2 Login dan register

- **Layout & identitas visual**:
  - Form terpusat maksimal 420 px (`max-w-[420px] mx-auto`); header auth menyajikan identitas konsisten dengan app shell (logo `BookOpen` berlatar primer, wordmark StudyFlow, dan `ThemeToggle`).
  - Menghindari panel dekoratif besar, ilustrasi mengambang, statistik palsu, atau jargon teknis.
  - Judul yang jelas (“Masuk ke StudyFlow” / “Daftar Akun StudyFlow”), deskripsi singkat pembimbing, dan satu CTA utama yang menonjol.
- **Form controls & aksesibilitas**:
  - Label permanen pada setiap field (`Label htmlFor`), error field diumumkan dekat kontrol menggunakan `aria-invalid` dan `aria-describedby` (`text-destructive text-xs`).
  - Alert error umum dari server menggunakan semantik `role="alert"` dan `aria-live="polite"` dengan teks pembungkus aman (`break-words`).
  - Banner sukses pendaftaran (`registered=true`) menggunakan border emerald pastel dan ikon `CheckCircle2` hijau.
  - Dukungan penuh autofill dan password manager: `autoComplete="name"`, `autoComplete="email"`, `autoComplete="current-password"`, dan `autoComplete="new-password"`.
  - Formulir dapat dikirim dengan menekan tombol `Enter` pada field mana pun.
- **Toggle password aksesibel**:
  - Setiap field password dilengkapi tombol toggle `Eye` / `EyeOff` bersemantik `type="button"`, `aria-label` eksplisit (“Tampilkan password” / “Sembunyikan password”), dan target sentuh minimal 44×44 px pada mobile (`after:absolute after:-inset-2 sm:after:hidden touch-manipulation`).
- **Kestabilan layout & ketahanan formulir**:
  - Tombol CTA submit (`h-10 w-full font-semibold`) mempertahankan dimensi saat beralih ke state pending/loading (`Loader2` spinner halus + “Memproses…”), tanpa layout shift.
  - Retensi input non-sensitif: nama dan alamat email tetap dipertahankan 100% utuh di dalam form ketika submit gagal, sehingga pengguna tidak perlu mengetik ulang dari awal.
  - Tautan perpindahan antar halaman Login dan Register selalu mempertahankan parameter `returnUrl` (jika ada).
  - Tidak menampilkan fitur yang belum didukung backend seperti OAuth sosial, lupa password mandiri, atau verifikasi email.

### 9.3 Dashboard

Urutan konten mengikuti kebutuhan harian dan prioritas tindakan belajar:

1. **Header ringkas**: Judul “Dashboard”, konteks semester aktif, tanggal hari ini beserta zona waktu profil (ditampilkan sekali), dan satu aksi utama “Tambah tugas”. Pada layar sempit (<640px), breadcrumb app shell menyembunyikan akar “StudyFlow” sehingga nama halaman aktif, pemilih tema, dan tombol profil tidak bertabrakan pada 375px.
2. **Ringkasan statistik padat**: 
   - **Desktop (>=640px)**: Satu baris strip terpadu 3 kolom berpemisah tipis dengan padding vertikal terukur: tugas hari ini (belum selesai & batas 23.59), terlambat (tautan langsung ke daftar bila ada), dan selesai. Ketika total tugas masih nol, tampilkan keterangan “Belum ada tugas” sebagai pengganti kalkulasi “0 dari 0 (0%)”.
   - **Mobile (<640px)**: Tiga baris ringkas terpadu (label di kiri, angka dan keterangan singkat di kanan). Ikon dekoratif dan deskripsi tambahan disembunyikan agar konten tugas utama segera terlihat (*above the fold*).
3. **Area utama tugas (2/3 lebar desktop)**:
   - **Empty state terpadu**: Jika hari ini dan 7 hari mendatang sama-sama kosong, tampilkan satu panel terpadu ringkas tanpa tinggi minimum berlebihan. Bedakan status “Belum ada tugas tercatat” (total tugas semester = 0) dari “Tidak ada deadline dalam 7 hari ke depan” (semua deadline terdekat aman/tuntas).
   - **Pengelompokan ketika ada tugas**: Pisahkan menjadi “Tugas Hari Ini” dan “Tugas 7 Hari Mendatang” menggunakan daftar berpemisah (`divide-y`), checkbox aksesibel keyboard, deadline jam/tanggal, dan badge prioritas (Tinggi/Sedang/Rendah). Empty state per kelompok tetap ringkas dengan ikon kecil dan satu kalimat keterangan.
4. **Area pendamping materi (1/3 lebar desktop)**: “Materi terbaru” dibatasi maksimal 5 item dengan tombol “Unggah materi” di header panel dan tautan “Lihat semua materi” di footer. Jarak antarbaris dipadatkan, dan judul panjang terpotong dengan elipsis agar tidak mendorong tombol aksi “Buka” keluar panel.
5. **Mobile**: Mengikuti tata letak satu kolom vertikal berdasarkan prioritas (Header ringkas → 3 baris statistik ringkas → Tugas terdekat → Materi terbaru). Jarak antarbagian dirapatkan secara proporsional.

Jika belum ada semester, tampilkan satu empty state “Mulai dari semester pertamamu” dengan CTA “Tambah semester”. Setelah ada semester tetapi belum ada mata kuliah, CTA berubah menjadi “Tambah mata kuliah”. Jangan menampilkan semua empty state onboarding sekaligus.

### 9.4 Semester dan mata kuliah

#### 9.4.1 Kelola Semester (/semesters)
- **Header halaman dan kontrol**:
  - Judul “Kelola Semester”, ikon `CalendarRange`, keterangan ringkas, indikator semester aktif saat ini, dan satu CTA utama “Tambah Semester” (`size="standard"`, tinggi 36 px / `h-9`).
- **Toolbar status dan pencarian**:
  - Filter status berbasis tab segmented: Semua, Aktif, dan Arsip.
  - Input pencarian nama semester atau tahun ajaran (`h-9`) dengan tombol reset filter ketika filter atau kata kunci aktif.
- **Daftar semester desktop dan mobile**:
  - Desktop (>=768px): Tabel terstruktur dengan kolom Nama Semester, Tahun Ajaran, Mata Kuliah Terkait, Status, dan Aksi.
  - Mobile (<768px): Flat clean list berpemisah (`divide-y`) tanpa kartu bertingkat, menyajikan nama semester, badge status, tahun ajaran, jumlah mata kuliah, dan aksi cepat.
  - Pembedaan status eksplisit (kombinasi teks dan ikon/badge semantik):
    - *Aktif*: Badge primer tebal dengan ikon `Check` dan teks “Aktif”.
    - *Non-aktif*: Badge outline netral dengan teks “Non-aktif”.
    - *Arsip*: Badge secondary netral dengan teks “Arsip”.
- **Aksi aktivasi semester & sinkronisasi**:
  - Tombol “Jadikan Aktif” (`size="sm"`, `h-8`) muncul pada semester non-aktif yang tidak berstatus arsip.
  - Saat aktivasi berlangsung, tampilkan status pending (`Loader2` animasi memutar + “Mengaktifkan…”) dan cegah pengiriman request ganda (`disabled={Boolean(activatingId)}`).
  - Status aktif baru **hanya ditampilkan setelah server mengonfirmasi keberhasilan**.
  - Setelah berhasil, sinkronkan selector semester sidebar dan komponen terkait melalui custom event `studyflow:semester-changed` dan `router.refresh()`.
  - Jika aktivasi gagal, status sebelumnya tetap dipertahankan dan pesan kesalahan ditampilkan dalam alert ramah.
- **Menu aksi dan touch target**:
  - Aksi sekunder (Edit semester, Arsipkan/Pulihkan, Hapus semester) dikelompokkan dalam menu dropdown tiga titik (`MoreVertical`, `size="icon-sm"`, `h-8 w-8`).
  - Target sentuh tombol aksi pada mobile memenuhi minimal 44×44 px (`after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation`).

#### 9.4.2 Daftar Mata Kuliah (/courses)
- **Header halaman**:
  - Judul “Mata Kuliah”, ikon `BookOpen`, konteks semester aktif (misal: “Semester Aktif: [Nama Semester]”), dan satu CTA utama “Tambah mata kuliah” (`size="standard"`, `h-9`).
  - Jika belum ada semester sama sekali, tampilkan warning alert ramah yang mengarahkan pengguna membuat semester terlebih dahulu.
- **Toolbar pencarian dan filter**:
  - Dropdown pemilih semester (`h-9`), toggle tab status Aktif / Arsip, dan input pencarian mata kuliah atau kode (`h-9`).
  - Tombol reset filter muncul ketika pencarian atau filter sedang aktif.
- **Tampilan tabel desktop dan flat list mobile**:
  - Desktop (>=768px): Tabel rapi dengan kolom Mata Kuliah (nama tebal berpembalut teks aman *break-words*, kode font-mono, deskripsi ringkas), Semester (`CalendarRange`), Dosen Pengampu (`User`), Status (Aktif / Arsip), dan Aksi.
  - Mobile (<768px): Flat list bersih (`divide-y`) tanpa kartu bertingkat berlebih. Baris atas memuat nama tautan, kode, badge status, dan menu dropdown tiga titik. Baris bawah memuat metadata semester, dosen, dan tombol tautan “Detail”.
  - Judul panjang tidak mendorong tombol aksi keluar layar berkat pembungkus teks aman (*break-words*).
- **Aksi baris**:
  - Tombol tautan “Detail” (`size="sm"`, `h-8`) untuk membuka halaman detail mata kuliah.
  - Menu dropdown terpadu (`MoreVertical`, `size="icon-sm"`, `h-8 w-8`) dengan opsi: “Edit mata kuliah” (`Pencil`), “Arsipkan / Pulihkan” (`Archive` / `RotateCcw`), dan “Hapus mata kuliah” (`Trash2`, teks merah destruktif).
  - Target sentuh tombol pada mobile minimal 44×44 px tanpa tumpang tindih.

#### 9.4.3 Detail Mata Kuliah (/courses/[id])
- **Hierarki visual terstruktur**:
  - Baris atas: Navigasi kembali “Kembali ke Daftar Mata Kuliah” (`size="sm"`, `h-8`, target sentuh 44×44 px) dan aksi header (Edit, Arsipkan/Pulihkan, Hapus).
  - Judul utama: Nama mata kuliah besar (`text-2xl sm:text-3xl font-bold break-words`), badge kode font-mono, dan status badge (Aktif / Arsip).
  - Banner peringatan: Jika mata kuliah atau semester induknya berstatus arsip, tampilkan banner peringatan bahwa konten bersifat hanya-baca (*read-only*).
  - Kisi metadata ringkas: Semester, Dosen Pengampu, dan Tahun Ajaran. Disertai deskripsi/silabus (jika tersedia) dengan pembalut teks aman.
- **Tab konten utama**:
  - Tab terpadu WAI-ARIA: “Tugas ([jumlah])”, “Catatan ([jumlah])”, dan “Materi ([jumlah])”.
  - Tab Tugas: Header dengan tombol “Tambah tugas” (`size="standard"`), tabel tugas desktop & kartu mobile, checkbox status toggle dengan loader optimistik, penanda tenggat waktu & overdue, serta badge prioritas.
  - Tab Catatan: Header dengan tombol “Buat catatan” (`size="standard"`), kartu catatan dengan judul tautan tebal, waktu diperbarui, dan tautan buka editor.
  - Tab Materi: Header dengan tombol “Unggah materi” (`size="standard"`), tabel materi desktop & kartu mobile dengan badge status pemrosesan (`MaterialStatusBadge`), ukuran file, jumlah halaman, dan tautan lihat materi.
- **Modal tambah tugas & buat catatan khusus mata kuliah**:
  - Form terikat langsung ke `courseId` yang sedang dibuka tanpa memerlukan pemilihan ulang mata kuliah.
  - Retensi input (*input retention*) jika submit gagal, scrollable pada layar ponsel (`max-h-[90vh] overflow-y-auto`), dan tombol Batal/Simpan berukuran standard 36 px.

#### 9.4.4 Dialog Tambah, Edit, Arsip, dan Hapus
- **Retensi input pada kegagalan form**:
  - Seluruh form dialog (Tambah/Edit Semester & Tambah/Edit Mata Kuliah) mempertahankan isian pengguna saat submit gagal akibat validasi server atau jaringan error.
  - Dilengkapi `noValidate` untuk konsistensi pesan error semantik kustom.
  - Dialog dapat digulir nyaman pada layar ponsel pendek (`max-h-[90vh] overflow-y-auto`) dengan tombol aksi selalu terlihat di footer dialog.
- **Konfirmasi destruktif dan keakuratan aturan backend**:
  - Dialog konfirmasi hapus secara spesifik menyebutkan nama objek yang akan dihapus (`<strong className="text-foreground break-words">{name}</strong>`).
  - Menjelaskan dampak aktual sesuai batasan backend:
    - *Mata Kuliah*: Sistem menolak penghapusan jika mata kuliah masih memiliki materi, tugas, atau catatan aktif. Pengguna disarankan mengarsipkan mata kuliah bila perkuliahan telah selesai.
    - *Semester*: Sistem menolak penghapusan jika semester telah memiliki mata kuliah di dalamnya. Pengguna disarankan mengarsipkan semester bila perkuliahan telah selesai.
  - Jika permintaan hapus atau arsip gagal di server, dialog tetap terbuka dan menampilkan pesan error dalam alert destruktif.

### 9.5 Tugas

- **Header halaman dan konteks semester**:
  - Judul “Tugas”, konteks semester aktif (misal: “Semester Ganjil 2024/2025”), jumlah tugas terdaftar, dan satu CTA utama “Tambah tugas” (`size="standard"`, tinggi 36 px / `h-9`).
  - Jika belum ada mata kuliah aktif di semester berjalan, tampilkan banner peringatan ramah yang mengarahkan pengguna untuk membuat mata kuliah terlebih dahulu.
- **Toolbar pencarian dan filter terpadu**:
  - Input pencarian judul tugas (`h-9`), dropdown filter mata kuliah aktif (`h-9`), dropdown filter status (`h-9`), dan dropdown filter prioritas (`h-9`).
  - Kontrol urutan deadline (`ArrowUpDown`, `size="icon-sm"`, `h-9 w-9`) dan toggle filter tugas terlambat (`Clock`, `size="icon-sm"`, `h-9 w-9`).
  - Sediakan tombol “Hapus filter” ketika ada kriteria pencarian/filter aktif. Pencarian dan filter bekerja di tingkat server (*server-side query*).
  - Pada layar sempit (<768px/640px), kontrol tersusun rapi membungkus (*flex-wrap*) tanpa menyebabkan *horizontal overflow*.
- **Daftar tugas desktop (>=768px)**:
  - Tabel terstruktur dengan kolom: Status (checkbox aksesibel), Judul Tugas (judul utama tebal berpembalut teks aman *break-words* beserta deskripsi ringkas opsional), Mata Kuliah (nama mata kuliah dengan ikon buku), Tenggat Waktu (tanggal & jam lokal dengan zona waktu profil pengguna), Prioritas (Badge semantik: Tinggi, Sedang, Rendah), dan Aksi.
  - Pembedaan status waktu & penyelesaian menggunakan **kombinasi teks eksplisit dan indikator visual semantik** (bukan warna semata):
    - *Terlambat*: Badge/penanda merah dengan ikon `AlertTriangle` dan teks “Terlambat”.
    - *Hari ini*: Badge/penanda amber dengan ikon `Clock` dan teks “Hari ini”.
    - *Mendatang*: Badge/penanda netral dengan ikon `Calendar` dan teks “Mendatang”.
    - *Selesai*: Checkbox tercentang, judul dicoret halus, badge/penanda emerald dengan ikon `CheckCircle2` dan teks “Selesai” beserta tanggal penyelesaian.
  - Aksi baris dikelompokkan dalam menu dropdown terpadu (`MoreVertical`, `size="icon-sm"`, `h-8 w-8`) berisi opsi: “Edit tugas” (`Pencil`) dan “Hapus tugas” (`Trash2`, teks merah destruktif). Kolom aksi memiliki lebar tetap (*fixed*) sehingga judul panjang tidak mendorong aksi keluar layar.
- **Daftar tugas mobile (<768px)**:
  - Kartu daftar berpemisah ringkas dengan hierarki yang sama: Checkbox status di kiri atas, judul tugas tebal dengan badge prioritas di kanan atas, baris mata kuliah dan deskripsi di tengah, serta baris bawah berisi tenggat waktu berpenanda status (teks + ikon) dan menu dropdown aksi tiga titik (`MoreVertical`).
  - Menu aksi memiliki area sentuh minimal 44×44 px (`after:absolute after:-inset-1 sm:after:hidden touch-manipulation`) untuk kenyamanan penggunaan layar sentuh.
- **Interaksi checkbox status & ketahanan jaringan**:
  - Checkbox memiliki label aksesibel (`aria-label`) yang dinamis sesuai status saat ini.
  - Mendukung pembaruan optimistik (*optimistic update*). Jika request server gagal, status otomatis dipulihkan (*rollback*) ke kondisi tersimpan dan menampilkan pesan error yang jelas.
  - Selama proses pembaruan berlangsung, kontrol dinonaktifkan dengan indikator spinner halus untuk mencegah *double click* atau pengiriman request ganda.
- **Dialog tambah dan edit tugas**:
  - Urutan field terstruktur: Judul Tugas * (min 2, max 200 karakter), Mata Kuliah * (pilihan mata kuliah aktif), Tenggat Waktu * (tanggal dan jam dengan keterangan zona waktu profil pengguna yang ringkas), Prioritas & Status (grid 2 kolom), serta Deskripsi/Catatan (opsional).
  - Jika submit gagal akibat validasi server atau kendala jaringan, isian form pengguna tetap dipertahankan (*input retention*) dan pesan error ditampilkan di bagian atas form.
  - Tombol simpan dinonaktifkan selama proses pengiriman dengan label loading yang jelas (“Menyimpan…” / “Memperbarui…”).
  - Dialog mendukung *scrolling* vertikal yang nyaman pada layar ponsel (`max-h-[90vh] overflow-y-auto`) dengan tombol Batal dan Simpan selalu dapat dijangkau.
- **Dialog hapus tugas**:
  - Konfirmasi destruktif menyebutkan judul tugas yang akan dihapus secara spesifik dan menjelaskan konsekuensi penghapusan permanen.
  - Tombol “Batal” (`variant="outline" size="standard"`) dan “Hapus Tugas” (`variant="destructive" size="standard"`).
  - Jika penghapusan gagal di server, dialog tetap terbuka menampilkan pesan kesalahan tanpa merusak alur pengguna.
- **Penanganan state halaman**:
  - *Loading*: Skeleton terstruktur untuk tabel desktop dan kartu mobile.
  - *Gagal memuat*: Peringatan ramah dengan tombol “Coba Lagi” (`RefreshCw`).
  - *Belum ada tugas (Onboarding)*: Tampilan tenang berikon `ListTodo`, penjelasan manfaat pencatatan tugas, dan tombol “Tambah tugas”.
  - *Filter tanpa hasil*: Pesan spesifik bahwa tidak ada tugas yang cocok dengan kriteria pencarian/filter aktif, disertai tombol “Hapus filter”.

### 9.6 Daftar dan upload materi

- **Header halaman**: Judul “Materi”, konteks semester aktif beserta jumlah berkas, dan satu aksi utama “Unggah materi” berukuran proporsional (`size="standard"`, tinggi 36 px / `h-9`). Hindari banner besar atau statistik dekoratif yang menggeser daftar.
- **Toolbar pencarian dan filter**:
  - Input pencarian judul materi (`h-9`), dropdown filter mata kuliah aktif (`h-9`), dan dropdown filter status pemrosesan (`h-9`).
  - Pada mobile (<640px), kontrol tersusun responsif membungkus tanpa menyebabkan overflow horizontal.
  - Sediakan tombol “Hapus filter” (`size="sm"`, `h-8`) ketika pencarian atau filter sedang aktif. Pencarian dan filter bekerja di tingkat server (*server-side query*).
- **Daftar materi desktop (>=768px)**:
  - Tabel terstruktur dengan judul materi sebagai informasi utama (teks tebal dengan tautan ke detail materi) dan nama berkas asli sebagai metadata sekunder di bawahnya.
  - Nama panjang dibatasi dengan lebar maksimal aman dan atribut judul lengkap (`title`) agar tidak mendorong kolom aksi keluar layar.
  - Kolom metadata: Mata kuliah, ukuran berkas (MB), jumlah halaman (`hal.`), waktu unggah (dengan zona waktu profil), dan status pemrosesan.
  - Aksi utama berupa tombol “Buka” (`size="sm"`), dan aksi sekunder menggunakan dropdown menu terpadu (`MoreVertical`, `size="icon-sm"`, `h-8 w-8`) berisi opsi: Buka materi, Coba lagi pemrosesan (jika gagal), Unduh berkas asli (jika siap), dan Hapus materi (dengan dialog konfirmasi penghapusan permanen).
- **Daftar materi mobile (<768px)**:
  - Kartu/list berpemisah ringkas dengan hierarki yang sama: judul materi di baris pertama, badge status di sudut kanan atas, metadata berurutan di baris tengah, serta tombol “Buka Materi” (`size="sm"`) dan menu aksi sekunder di sudut kanan bawah. Hindari elemen interaktif bersarang (*nested links/buttons*).
- **Badge status pemrosesan dokumen**:
  - `READY`: Hijau success (“Siap dipelajari”).
  - `PROCESSING`: Indigo info dengan spinner halus (“Membaca isi PDF…”), menandakan ekstraksi teks & halaman sedang berlangsung di antrean worker.
  - `QUEUED`: Abu-abu netral dengan jam (“Dalam antrean”).
  - `FAILED`: Merah danger dengan ikon peringatan dan penyebab kegagalan spesifik (misal: scan gambar tanpa teks, melebihi 100 hal., terenkripsi, melebihi 20 MB).
  - Status pemrosesan dokumen dibedakan tegas dari status generasi AI (ringkasan/flashcard/kuis dihasilkan di dalam detail materi sesuai permintaan pengguna).
- **Alur dan dialog unggah**:
  - Format dan batasan: “PDF berbasis teks, maksimal 20 MB dan 100 halaman. PDF hasil scan belum didukung.” Nilai diselaraskan dengan konstanta konfigurasi `@studyflow/shared`.
  - Dropzone memiliki tombol eksplisit “Pilih Berkas PDF” yang dapat diakses melalui keyboard di samping interaksi *drag-and-drop*.
  - Menampilkan nama berkas terpilih, ukuran dalam MB, dan mata kuliah tujuan secara jelas sebelum dikirim.
  - Membedakan proses pengunggahan dari proses ekstraksi:
    - Selama transfer jaringan: Tampilkan persentase transfer riil dari proses unggah (`transferPercent%`), bukan progres buatan.
    - Setelah unggah: Tampilkan status verifikasi dan penjadwalan ekstraksi di antrean worker.
    - Salinan penjelas PRD: “Setelah upload selesai, kamu boleh meninggalkan halaman. Pemrosesan ekstraksi tetap berjalan di latar belakang.”
  - Cegah submit berulang saat proses transfer atau finalisasi berlangsung.
  - Jika terjadi kegagalan jaringan/server, pertahankan berkas dan isian form yang masih dapat digunakan, serta tampilkan pesan error yang jelas tanpa mereset pilihan pengguna secara sepihak.
  - Dialog responsif dan nyaman digunakan pada layar 375px dengan tombol aksi proporsional: “Batal” (`variant="outline" size="standard"`) dan “Unggah Materi” (`variant="default" size="standard"`).
- **Proporsi tombol di seluruh aplikasi**:
  - Tombol CTA utama (Header, Form Submit, Empty State, dan Dialog Aksi): tinggi 36 px (`size="standard"`, `h-9`), padding horizontal 14 px (`px-3.5`), teks 14 px (`text-sm`), dan ikon 16 px (`h-4 w-4`). Diterapkan konsisten di Dashboard, Materi, Tugas Kuliah, Catatan Belajar, Mata Kuliah, Kelola Semester, Pengaturan, dan seluruh modal dialog.
  - Tombol sekunder dalam toolbar/daftar: tinggi 32 px (`size="sm"`, `h-8`), padding horizontal 10–12 px, teks 12 px (`text-xs`), ikon 14 px.
  - Tombol ikon saja: `size="icon"` (36 px / `h-9 w-9`) untuk kontrol toolbar independen, dan `size="icon-sm"` (32 px / `h-8 w-8`) untuk aksi per-baris tabel/kartu.
  - Pada mobile, target sentuh dipertahankan nyaman minimal 40–44 px melalui bantuan area sentuh tak kasat mata (`after:absolute after:-inset-1 sm:after:hidden touch-manipulation`) tanpa memperbesar wujud visual tombol.

### 9.7 Detail materi — pusat pengalaman belajar

- **Header detail materi**:
  - Tombol kembali ke daftar materi (“Kembali ke Materi”, `size="sm"`), judul materi sebagai heading utama (`h1`) dengan `break-words` agar judul panjang tidak mendorong tombol keluar layar, dan link konteks mata kuliah.
  - Status pemrosesan dokumen semantik (`MaterialStatusBadge`) dan penanda arsip jika mata kuliah/semester diarsipkan.
  - Metadata ringkas dalam satu baris fleksibel: nama berkas asli, ukuran file dalam MB, jumlah halaman, dan waktu unggah dalam zona waktu profil pengguna.
  - Aksi utama: Tombol “Unduh Berkas” (jika dokumen `READY`, `size="standard"`, `h-9`) atau “Coba Lagi” (jika `FAILED`, `size="standard"`).
  - Aksi sekunder dikelompokkan dalam menu dropdown terpadu (`MoreVertical`, `size="icon-sm"`, `h-9 w-9`) berisi opsi: Edit Judul Materi, Buka di Tab Baru, Perbarui Tautan Unduh, dan Hapus Materi (dengan dialog konfirmasi destruktif permanen).
- **Navigasi konten**:
  - Menggunakan `Tabs` shadcn/ui terstruktur: Dokumen PDF (`FileText`), Ringkasan AI (`Sparkles`), Flashcard (`Layers`), Kuis (`HelpCircle`), dan Teks Ekstraksi (`BookOpen`).
  - `TabsList` mendukung keyboard (Arrow navigation) dan responsif pada mobile dengan *horizontal scroll* (`overflow-x-auto flex-nowrap`) tanpa teks terpotong.
  - Pergantian tab mempertahankan status dan input pengguna (tidak mereset progres kuis yang sedang dikerjakan atau memicu pembuatan AI otomatis).
- **Pembaca PDF**:
  - Ruang baca utama yang lapang (`h-[620px]` di mobile hingga `h-[860px]` di desktop) dengan pembatas tipis netral.
  - Toolbar interaktif responsif yang membungkus rapi pada layar sempit:
    - Navigasi halaman: Tombol halaman sebelumnya (`ChevronLeft`), input nomor halaman langsung, indikator total halaman, dan tombol halaman selanjutnya (`ChevronRight`).
    - Kontrol pembesaran: Tombol perkecil (`ZoomOut`), persentase zoom (klik untuk reset ke 100%), dan perbesar (`ZoomIn`).
    - Quick actions: Perbarui tautan (jika sesi signed URL kedaluwarsa), Buka di Tab Baru, dan Unduh.
  - Penanganan status yang jelas:
    - *Loading*: Spinner transparan di dalam frame pembaca.
    - *Gagal memuat*: Peringatan ramah dengan opsi “Muat Ulang Tautan” dan “Unduh Berkas Langsung”.
    - *Antrean/Ekstraksi*: Kartu tenang dengan penjelasan bahwa dokumen sedang dianalisis di antrean background worker.
- **Tab Ringkasan AI**:
  - Mengadopsi hierarki membaca seperti buku/catatan akademik bersih dengan lebar baris terukur (`max-w-3xl`):
    - Hindari membungkus setiap paragraf dalam kartu terpisah dengan border tebal.
    - *Ringkasan Utama*: Paragraf pembuka mengalir yang jelas.
    - *Konsep Kunci*: Daftar terstruktur berpemisah tipis (`divide-y`) dengan nama konsep tebal, penjelasan ringkas, dan tombol rujukan halaman interaktif.
    - *Struktur & Bagian Materi*: Sub-heading terstruktur dengan nomor halaman sumber dan isi materi.
    - *Istilah Penting*: Glosarium dengan font monospace, definisi, dan nomor halaman.
  - Referensi halaman tampil sebagai tombol ringkas (misal: “Hal. 4”) yang saat diklik langsung membuka tab Dokumen PDF, melompat ke halaman tersebut, dan menggulir ke viewport PDF dengan banner konfirmasi halaman sumber.
  - Pembedaan status generasi AI:
    - *Belum dibuat*: Kartu ajakan belajar dengan kuota harian tersisa dan tombol “Buat Ringkasan Sekarang” (`size="standard"`).
    - *Sedang diproses*: Indikator antrean AI tanpa persentase/countdown palsu; tombol dinonaktifkan untuk mencegah submit ganda.
    - *Berhasil*: Teks utuh dengan tombol “Salin Teks” dan “Regenerasi” (dengan dialog konfirmasi kuota).
    - *Gagal*: Penjelasan aman dengan tombol “Coba Buat Lagi” tanpa mengurangi kuota harian.
    - Jika pembaharuan data sementara gagal, hasil ringkasan lama yang masih valid tetap dipertahankan.

### 9.8 Flashcard — kartu belajar interaktif

- **Setup dialog**:
  - Pilihan jumlah kartu: 5, 10, atau 20 kartu (default 10) dalam tombol grid yang nyaman (`size="standard"`).
  - Penjelasan kuota AI dan rujukan nomor halaman dokumen PDF.
- **Mode belajar (Deck Player)**:
  - Lebar kartu terukur `max-w-2xl mx-auto` untuk fokus belajar tanpa distraksi.
  - Bar status atas: Nomor kartu aktif (“Kartu 3 dari 10”), indikator penilaian pribadi (“X Paham • Y Perlu Diulang”), serta tombol rujukan halaman (“Lihat Hal. X”) yang melompat ke pembaca PDF.
  - Kartu belajar stabil: Pertanyaan di sisi depan dan jawaban di sisi belakang.
  - Aksesibilitas membalik kartu: Mendukung klik langsung pada kartu, tombol keyboard Spasi / Enter, serta tombol eksplisit “Tampilkan Jawaban” / “Sembunyikan Jawaban” di bawah kartu.
  - Hindari animasi flip 3D berlebihan; hormati preferensi sistem `motion-reduce:transition-none` dengan transisi warna halus.
  - Jawaban panjang dan multi-paragraf dapat dibaca tuntas melalui area gulir internal kartu (`max-h-[360px] overflow-y-auto`) tanpa terpotong (*no clipping*).
  - Penandaan pemahaman: Tombol “Perlu Diulang” (amber) dan “Sudah Paham” (emerald) dengan ukuran sentuh minimal 44×44 px pada mobile.
  - Navigasi stepper: Tombol “Sebelumnya” dan “Selanjutnya” dengan indikator posisi kartu di tengah.

### 9.9 Kuis dan hasil evaluasi

- **Tiga tahap tampilan**:
  1. *Sebelum mulai*: Kartu pengantar kuis dengan judul materi, jumlah soal pilihan ganda, dan tombol CTA utama “Mulai Kerjakan Kuis”.
  2. *Pengerjaan kuis*: Lebar terukur `max-w-2xl mx-auto`. Soal aktif dominan dengan indikator progres soal terjawab riil (“3 / 5 Terjawab”) dan status penyimpanan draft server (“Menyimpan jawaban...”, “Tersimpan”, atau “Gagal simpan (Coba lagi)”).
     - Pilihan jawaban menggunakan semantik radio lengkap (`role="radiogroup"`, `role="radio"`, `aria-checked`), seluruh baris dapat diklik, dan huruf pilihan (A, B, C, D) di dalam lingkaran semantik indigo saat dipilih.
     - Kisi navigasi nomor soal di bagian bawah untuk melompat antarsoal dengan indikator status: aktif (fokus ring), sudah dijawab (emerald), dan belum dijawab (muted).
     - Retensi jawaban: Tab Kuis dipertahankan aktif di latar belakang (`forceMount`) sehingga perpindahan antar-tab tidak menghilangkan jawaban yang sedang dipilih.
     - Modal konfirmasi submit: Menjelaskan jumlah soal yang belum dijawab jika ada (“Perhatian: Terdapat X soal yang belum Anda jawab”) dan menonaktifkan submit ganda.
     - Kunci jawaban dan pembahasan tidak pernah dibocorkan sebelum submit berhasil.
  3. *Hasil kuis*:
     - Banner skor besar (0–100) dan rasio benar/total (“X / Y Jawaban Benar”).
     - Tombol “Ulangi Kuis” (memulai attempt baru dari kuis yang sama) dan “Kembali ke Beranda Kuis”.
     - Daftar pembahasan terstruktur: Setiap soal dilengkapi status Benar/Salah menggunakan teks dan ikon (`CheckCircle2` hijau untuk Benar, `XCircle` merah untuk Salah).
     - Pembedaan jawaban: Kunci jawaban ditandai badge teks & ikon “Kunci Jawaban”, pilihan salah pengguna ditandai “Pilihan Anda (Salah)”, dan pilihan benar pengguna ditandai “Pilihan Anda (Benar)”.
     - Pembahasan akademik dilengkapi tombol “Buka Referensi Halaman X” yang melompat langsung ke halaman pembaca PDF.

### 9.10 Catatan

- **Header halaman dan konteks semester**:
  - Judul “Catatan”, konteks semester aktif beserta jumlah catatan terdaftar, dan satu CTA utama “Buat catatan” (`size="standard"`, tinggi 36 px / `h-9`).
  - Jika belum ada mata kuliah aktif di semester berjalan, tampilkan banner peringatan ramah yang mengarahkan pengguna untuk membuat mata kuliah terlebih dahulu.
- **Toolbar pencarian dan filter terpadu**:
  - Input pencarian judul catatan (`h-9`) dan dropdown filter mata kuliah aktif (`h-9`).
  - Sediakan tombol “Hapus filter” ketika pencarian atau filter sedang aktif. Pencarian dan filter bekerja di tingkat server (*server-side query*).
  - Pada layar sempit (<768px/640px), kontrol tersusun rapi membungkus (*flex-wrap*) tanpa menyebabkan *horizontal overflow*.
- **Daftar catatan desktop dan mobile**:
  - Desain ringkas dan bersih tanpa kartu bertingkat yang berlebihan (*no excessive nested cards*).
  - Judul catatan menjadi informasi utama (tautan teks tebal dengan ikon dokumen), diikuti nama mata kuliah, tautan materi terkait (jika ada), dan waktu terakhir diperbarui dalam zona waktu profil pengguna.
  - Judul panjang dibatasi dengan pembalut teks aman (*break-words*) sehingga tidak mendorong kolom aksi keluar layar.
  - Aksi baris dikelompokkan dalam menu dropdown terpadu tiga titik (`MoreVertical`, `size="icon-sm"`, `h-8 w-8`) berisi opsi: “Buka editor” (`Pencil`) dan “Hapus catatan” (`Trash2`, teks merah destruktif).
  - Pada mobile, target sentuh tombol aksi minimal 44×44 px (`after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation`).
- **Editor catatan — ruang menulis terfokus**:
  - Ruang baca dan tulis lapang dengan lebar maksimal terukur (`max-w-4xl` hingga `max-w-5xl`) tanpa dekorasi yang mengalihkan perhatian.
  - Header editor menampilkan navigasi kembali, konteks mata kuliah, indikator status penyimpanan real-time, dan tombol utama “Simpan” (`size="standard"`, `h-9`).
  - Metadata ringkas: satu baris bersih yang menampilkan mata kuliah dan pemilih tautan materi terkait.
  - Pembedaan status simpan yang jujur dan tegas:
    - *Belum disimpan*: Titik amber dengan teks “Belum disimpan”.
    - *Menyimpan*: Spinner `Loader2` halus dengan teks “Menyimpan…”.
    - *Tersimpan*: Ikon centang hijau dengan teks “Tersimpan pukul [jam lokal]”. Tidak pernah menampilkan status tersimpan sebelum backend mengonfirmasi keberhasilan.
    - *Gagal*: Ikon peringatan merah dengan teks “Gagal menyimpan” beserta pesan error yang aman.
  - Format Markdown: Menggunakan editor textarea native yang ringan dipadukan dengan tab “Tulis” dan “Pratinjau” (*Safe Markdown Rendering*). Toolbar markdown menyediakan pintasan esensial (Heading, Bold, Italic, Code, List, Quote, Link) tanpa memasang library rich-text yang berat atau toolbar dekoratif.
- **Perlindungan data dan pencegahan kehilangan tulisan**:
  - *Navigation Guard*: Perubahan lokal yang belum disimpan memicu konfirmasi terpadu (`Dialog`) saat pengguna mencoba berpindah halaman (klik navigasi internal maupun tombol *Browser Back/Forward*).
  - Pilihan dialog guard: “Tetap mengedit” (mempertahankan posisi editor), “Buang perubahan dan lanjutkan”, serta “Simpan dan lanjutkan”.
  - *Ketahanan Jaringan*: Jika proses simpan gagal (HTTP 500, koneksi putus, atau konflik), sistem membatalkan perpindahan halaman dan menjaga tulisan lokal pengguna tetap 100% utuh di textarea.
  - *In-flight Typing*: Pengetikan yang dilakukan saat proses simpan sedang berlangsung tidak dianggap tersimpan dan mempertahankan status belum disimpan (*dirty*) setelah respons selesai.
  - *Konflik Versi*: Menampilkan banner konflik yang menjelaskan situasi jika catatan telah diubah di sesi lain, disertai opsi “Muat Ulang Versi Server” atau “Timpa Server dengan Tulisan Ini” tanpa menimpa tulisan lokal secara sepihak.
- **Dialog tambah dan hapus catatan**:
  - *Tambah Catatan*: Judul *, Mata Kuliah *, dan isi awal opsional. Menerapkan *input retention* saat submit gagal dan dapat digulir nyaman pada layar ponsel (`max-h-[90vh] overflow-y-auto`).
  - *Hapus Catatan*: Konfirmasi destruktif menyebutkan judul catatan yang akan dihapus secara spesifik. Jika penghapusan gagal, dialog tetap terbuka menampilkan pesan error.
- **Penanganan state halaman**:
  - *Loading*: Skeleton terstruktur untuk tabel desktop dan kartu mobile.
  - *Gagal memuat*: Peringatan ramah dengan tombol “Coba Lagi” (`RefreshCw`).
  - *Belum ada catatan (Onboarding)*: Tampilan tenang berikon `FileText`, penjelasan manfaat catatan belajar, dan tombol “Buat catatan”.
  - *Filter tanpa hasil*: Pesan spesifik bahwa tidak ada catatan yang cocok dengan kriteria filter, disertai tombol “Hapus filter”.

### 9.11 Pengaturan Akun

- **Struktur halaman & layout**:
  - Lebar form terfokus `max-w-3xl` yang nyaman dibaca dan dioperasikan pada layar laptop maupun ponsel.
  - Header halaman: Judul “Pengaturan Akun” berikon `Settings` dan deskripsi singkat fungsi halaman.
  - Pengelompokan bagian berbasis kartu bersih terpisah: Profil Pengguna, Tampilan & Tema, Keamanan Akun (Ganti Password), serta Penyimpanan & Kuota.
- **Profil pengguna & zona waktu**:
  - *Email*: Ditampilkan sebagai informasi akun permanen (`readOnly`, `disabled`, font mono netral). Tidak menyiratkan status verifikasi karena backend belum memiliki verifikasi email mandiri.
  - *Nama Lengkap*: Input teks wajib (min 2, max 100 karakter).
  - *Zona Waktu Akademik*: Pemilih format IANA standar (`RadixSelect`) dilengkapi penjelasan pengaruhnya terhadap konversi tanggal tugas, deadline, dan waktu update catatan.
  - *Pemisahan Form*: Form profil mandiri dengan tombol aksi “Simpan Profil” (`size="standard"`, `h-9`). Tombol hanya aktif ketika data telah berubah (`isProfileDirty`).
  - *Retensi Input saat Gagal*: Jika server mengembalikan kegagalan (HTTP 500 / validasi), nilai isian yang diketik pengguna tetap 100% utuh tanpa reset ke data lama, dan error ditampilkan via alert destruktif.
  - *Sinkronisasi Header*: Saat pembaruan profil berhasil, sistem memancarkan custom event `studyflow:profile-updated` sehingga nama pengguna dan avatar inisial pada header shell langsung tersinkronisasi tanpa menunggu reload halaman.
- **Tampilan & tema**:
  - Preferensi tema antarmuka (Sistem, Terang, Gelap) diselaraskan langsung dengan kontrol `ThemeToggle`.
- **Keamanan akun (Ganti password)**:
  - Form independen dengan 3 field terstruktur: Password Saat Ini (`current-password`), Password Baru (`new-password`), dan Konfirmasi Password Baru (`new-password`).
  - Setiap field dilengkapi tombol toggle `Eye` / `EyeOff` aksesibel bersemantik `type="button"` dan touch target mobile 44×44 px.
  - Persyaratan validasi sesuai skema backend: Password saat ini wajib diisi; Password baru minimal 12 karakter dan harus berbeda dari password saat ini; Konfirmasi password harus cocok.
  - Banner peringatan menjelaskan konsekuensi pencabutan seluruh sesi aktif di perangkat lain.
  - Pencegahan submit ganda dengan status loading (`Loader2` + “Mengubah password…”).
  - Pesan error server ditampilkan secara inline tanpa menutup form.
  - Pengosongan field password setelah operasi berhasil dan redirect otomatis ke halaman login.
  - Menjaga kerahasiaan: Password tidak pernah disimpan di `localStorage`, session, console log, atau laporan.
- **Penyimpanan & kuota upload**:
  - Menampilkan kapasitas penyimpanan aktual via API `getStorageUsage()` dengan progress bar proporsional (MB terpakai / total batas).
  - Menampilkan kuota upload harian dan waktu reset otomatis (00:00 UTC) serta batasan file PDF (maks 20 MB, 100 halaman, teks murni).

## 10. Status async dan pemulihan

Status materi dan status generasi AI adalah dua hal berbeda. Materi siap tidak berarti ringkasan sudah dibuat.

| Keadaan | Tampilan pengguna | Aksi |
| --- | --- | --- |
| Upload berjalan | “Mengunggah… 42%” bila terukur | Jangan tawarkan cancel bila backend belum mendukung |
| Antrean ekstraksi | “Menunggu pemrosesan” | Boleh meninggalkan halaman setelah upload selesai |
| Ekstraksi berjalan | “Membaca isi PDF…” | Status inline; halaman lain tetap berfungsi |
| Materi siap | “Siap dipelajari” | Buat ringkasan/flashcard/kuis |
| PDF tidak valid | “PDF ini tidak bisa dibaca” + alasan | Unggah file pengganti sebagai materi baru |
| PDF scan | “Teks belum ditemukan. PDF hasil scan belum didukung.” | Gunakan PDF berbasis teks |
| AI dalam antrean | “Menunggu giliran” | Tampilkan hasil lama jika ada |
| AI berjalan | “Menyusun ringkasan…” atau nama pekerjaan | Tanpa countdown atau persentase rekaan |
| Gagal sementara | “Proses belum berhasil” + penjelasan aman | “Coba lagi” jika diperbolehkan API |
| Kuota habis | Jumlah pemakaian dan waktu reset | Baca hasil yang sudah ada tetap tersedia |
| Layanan AI ditunda | “Pembuatan dengan AI sementara tidak tersedia” | Pengelolaan kuliah tetap tersedia |
| Koneksi terputus | Banner ringan “Koneksi terputus” | Pertahankan data lama dengan label; sinkronkan kembali |

- Jangan mengganti data terakhir menjadi angka nol saat request gagal.
- Jangan memakai toast berulang pada setiap polling yang gagal. Tampilkan satu pesan persisten yang diperbarui.
- Status completion dapat diumumkan sekali melalui live region sopan; polling tidak terus menginterupsi pembaca layar.
- Ketika item dihapus, kembali ke daftar dengan pesan sukses hanya setelah backend menerima penghapusan. Jelaskan dampak sebelum tindakan, bukan setelahnya.
- Retry memakai ketersediaan dari backend; UI tidak menebak semua error dapat diulang.

## 11. Microcopy

Gunakan Bahasa Indonesia yang singkat, ramah, dan konkret. Panggilan “kamu” boleh dipakai dalam penjelasan; judul dan label tetap ringkas. Istilah navigasi konsisten: “Tugas”, “Materi”, “Mata kuliah”, “Ringkasan”, “Flashcard”, “Kuis”.

| Konteks | Copy contoh |
| --- | --- |
| Materi kosong | “Belum ada materi. Unggah PDF untuk mulai belajar.” |
| Filter kosong | “Tidak ada tugas yang cocok dengan filter ini.” |
| Tugas selesai | “Tugas ditandai selesai.” |
| Error simpan | “Catatan belum tersimpan. Coba lagi; tulisanmu masih ada di halaman ini.” |
| Output AI | “Dibuat dengan AI. Periksa bagian penting pada sumber.” |
| Hapus materi | “Hapus ‘Pengantar Algoritma’? File, hasil AI, flashcard, kuis, dan hasil pengerjaan terkait akan dihapus. Catatan manual tetap disimpan.” |
| Batas kuota | “Kuota pembuatan AI hari ini habis. Tersedia kembali [tanggal dan jam lokal].” |
| Sumber dihapus | “Materi sumber sudah dihapus.” |

Tombol menggunakan verba: “Tambah tugas”, “Unggah materi”, “Simpan catatan”. Hindari label umum “Submit”, pesan “Oops!”, serta istilah internal seperti BullMQ, token budget, embedding, atau HTTP 500 pada alur produk. Detail teknis opsional hanya berupa ID bantuan saat berguna untuk pelaporan error.

## 12. Motion dan interaksi

- Hover/focus 120–160 ms; dialog/menu 160–200 ms; perpindahan panel maksimal 200 ms.
- Gunakan opacity dan transform kecil hanya bila membantu orientasi. Hindari gerakan pada seluruh halaman.
- Skeleton boleh statis. Spinner untuk proses berjalan tidak perlu disertai animasi dekoratif lain.
- Hormati `prefers-reduced-motion`: hilangkan flip, gerakan panel nonesensial, dan smooth scroll otomatis; status tetap terbaca.
- Hover tidak boleh menggeser layout atau menjadi satu-satunya cara menemukan aksi.
- Tidak ada suara, confetti, atau animasi hadiah otomatis saat menyelesaikan kuis.

## 13. Aksesibilitas dan responsivitas

- Gunakan landmark header/nav/main, skip link ke konten, satu H1, dan urutan heading logis.
- Semua kontrol dapat dioperasikan dengan keyboard. Radio, tabs, menu, dan dialog mengikuti perilaku primitive aksesibel yang dipilih.
- Focus ring setidaknya 2 px dengan offset yang terlihat. Jangan menghapus outline tanpa pengganti.
- Dialog memiliki judul, deskripsi bila diperlukan, focus management, dan tombol tutup berlabel. Fokus tidak tertutup header/footer sticky.
- Link memakai elemen link dan aksi memakai button. Jangan membuat div klik untuk kontrol utama.
- State terpilih dibedakan lewat label/check/border selain warna. Error field memakai `aria-invalid` dan deskripsi terhubung.
- Target interaktif utama minimal 44 px sebagai standar kenyamanan proyek; tidak mengklaim angka ini sebagai satu-satunya ketentuan WCAG.
- Uji lebar 360, 768, 1024, dan 1440 px, ditambah reflow sekitar 320 CSS px dan zoom browser hingga 200–400% sesuai skenario.
- PDF/table intrinsik boleh memiliki scroll lokal berlabel; konten halaman, tombol, dialog, dan form tetap reflow tanpa clipping.
- Toolbar membungkus atau memindahkan filter ke Sheet; jangan mengecilkan seluruh kontrol agar muat.
- Footer aksi mobile mempertimbangkan safe-area dan keyboard virtual. Pengguna tetap dapat mencapai field terakhir serta tombol simpan.
- Jangan mengklaim “WCAG compliant” hanya berdasarkan penggunaan shadcn/ui; verifikasi alur aktual.

## 14. Pedoman implementasi Next.js

- Tempatkan token tema dan typography global pada `apps/web/app/globals.css` atau path setara jika proyek memakai `src/app`; pilih satu struktur dan gunakan konsisten.
- Konfigurasi shadcn menunjuk stylesheet dan alias yang benar pada workspace web. Pertahankan semantic token pairing untuk foreground/surface.
- Untuk Tailwind v4, expose token tambahan melalui theme mapping sesuai setup proyek. Jangan menyalin konfigurasi dari versi berbeda tanpa mengecek integrasi.
- Server Components menjadi default untuk struktur yang sesuai. Batasi Client Components pada interaksi, form, editor, preview, tema, dan state yang memerlukannya.
- Jangan menjadikan seluruh app shell client hanya untuk satu toggle. Letakkan provider pada boundary yang diperlukan.
- Theme preference diterapkan sedini mungkin untuk menghindari flash tema dan mismatch hydration; uji pilihan sistem, pilihan tersimpan, serta reload.
- Gunakan data dan status API yang nyata. TanStack Query mengelola cache interaktif; bersihkan data pengguna pada logout sesuai PRD.
- Simpan filter/tab yang berguna di URL agar tombol back dan tautan bekerja. Nilai sensitif dan isi catatan tidak masuk URL.
- Komponen domain yang dapat digunakan ulang: `PageHeader`, `EmptyState`, `ErrorState`, `MaterialStatus`, `SourceReference`, `AssignmentRow`, `UsageIndicator`. Buat hanya saat pola benar-benar muncul.
- Gunakan loading/error boundary seperlunya; jangan menutupi seluruh layar untuk error pada satu widget dashboard.
- Ikuti API komponen yang terpasang. Jangan mengganti preset, primitive, font, atau token secara diam-diam saat mengerjakan satu halaman.

## 15. Fitur lanjutan — belum ditampilkan pada MVP

Ketentuan berikut menjadi arah awal saat milestone PRD terkait dikerjakan, bukan izin menambah scope sekarang.

- **Ask StudyFlow:** pemilih scope materi/mata kuliah terlihat di atas chat, kutipan dapat dibuka, keadaan “informasi tidak ditemukan” jelas, dan composer tidak menutupi pesan di mobile.
- **Notifikasi:** badge jumlah belum dibaca hanya dari data nyata; panel menyimpan item setelah reconnect dan menyediakan status baca.
- **Reminder:** gunakan deadline dalam zona waktu pengguna; jangan menggambarkan notifikasi in-app sebagai email atau push.
- **Kalender:** ditambahkan setelah daftar tugas stabil dan tidak menghilangkan alternatif daftar yang mudah dibaca.

## 16. Checklist penerimaan desain

### Konsistensi dan scope

- [ ] Semua halaman mengikuti token, skala spacing, radius, tipografi, serta posisi aksi yang sama.
- [ ] Sidebar/header/content tidak tumpang tindih saat expanded, collapsed, maupun mobile.
- [ ] Tidak ada menu fitur yang belum tersedia, angka palsu, CTA mati, atau chart tanpa kebutuhan.
- [ ] Setiap halaman memiliki loading, empty, error, dan success state yang relevan.

### Alur inti

- [ ] Pengguna baru diarahkan dari semester ke mata kuliah, lalu tugas/upload.
- [ ] Upload, ekstraksi, dan generasi AI mempunyai status yang berbeda dan dapat dipahami.
- [ ] Rujukan halaman dapat dibuka dan pengguna dapat kembali ke konteks baca.
- [ ] Kuis menyembunyikan jawaban sebelum submit; gagal submit mempertahankan input.
- [ ] Catatan membedakan belum tersimpan dan tersimpan; navigasi keluar ditangani.
- [ ] Kuota habis/gagal AI tetap memungkinkan membaca hasil yang sudah ada.
- [ ] Konfirmasi hapus menyatakan dampak sesuai PRD.

### Visual dan aksesibilitas

- [ ] Light dan dark diuji pada ukuran 360, 768, 1024, serta 1440 px.
- [ ] Judul panjang, daftar kosong, isi padat, dan teks Bahasa Indonesia tidak terpotong.
- [ ] Kontras state final diuji, termasuk hover, focus, selected, dan error.
- [ ] Alur utama dapat dijalankan dengan keyboard; dialog mengembalikan fokus dengan benar.
- [ ] Zoom/reflow, reduced motion, serta target sentuh diperiksa.
- [ ] Tidak ada horizontal overflow halaman akibat sidebar, grid, toolbar, atau form.

## 17. Petunjuk untuk coding agent

1. Baca `docs/product_requirements_document.md`, `DESIGN.md`, dan instruksi repository sebelum mengubah UI.
2. Kerjakan milestone/halaman yang diminta, lengkap dengan state dan perilaku responsifnya.
3. Gunakan skill desain proyek yang relevan jika tersedia; jangan memuat semua skill tanpa kebutuhan.
4. Gunakan primitive shadcn yang ada, lalu susun komponen domain sesuai pola dokumen ini.
5. Hindari menambah fitur di luar PRD untuk mengisi ruang kosong dalam layout.
6. Verifikasi hasil render dengan data realistis pada kedua tema dan viewport yang relevan. Pemeriksaan visual tidak digantikan hanya oleh build sukses.
7. Laporkan halaman yang berubah, kondisi yang telah diperiksa, dan keterbatasan nyata. Perbarui dokumen jika keputusan desain berubah secara sengaja.

## 18. Referensi

Palet, layout, ukuran, dan microcopy adalah keputusan desain StudyFlow. Dokumentasi berikut dipakai untuk memeriksa integrasi serta acuan aksesibilitas, diakses 3 Oktober 2026:

- [shadcn/ui — Theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui — Sidebar](https://ui.shadcn.com/docs/components/sidebar)
- [W3C — WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)

## 19. Riwayat perubahan

| Versi | Tanggal | Perubahan |
| --- | --- | --- |
| 1.0 | 3 Oktober 2026 | Arah visual awal, token light/dark, shell responsif, rancangan seluruh halaman MVP, state AI, dan checklist implementasi |
