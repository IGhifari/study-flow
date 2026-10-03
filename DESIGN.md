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

Gunakan token semantik dari global CSS. Nilai hex di bawah adalah sumber palet; jangan menulis warna hardcoded di setiap komponen. Konversi ke OKLCH diperbolehkan selama hasil visual tetap setara.

| Token | Light | Dark | Penggunaan |
| --- | --- | --- | --- |
| `background` | `#F7F8FA` | `#111722` | Latar aplikasi |
| `foreground` | `#172033` | `#E8EDF5` | Teks utama |
| `card` | `#FFFFFF` | `#192231` | Panel, area baca, dialog |
| `card-foreground` | `#172033` | `#E8EDF5` | Teks di panel |
| `popover` | `#FFFFFF` | `#192231` | Menu dan popover |
| `popover-foreground` | `#172033` | `#E8EDF5` | Isi popover |
| `primary` | `#2457C5` | `#8AB4FF` | Aksi utama dan indikator fokus |
| `primary-foreground` | `#FFFFFF` | `#101B2E` | Teks pada primary |
| `primary-hover` | `#1D46A0` | `#A5C5FF` | Hover tombol primary |
| `secondary` | `#EDF0F5` | `#253145` | Tombol pendukung berisi |
| `secondary-foreground` | `#25334A` | `#DCE5F3` | Teks secondary |
| `muted` | `#EDF0F5` | `#202B3D` | Skeleton dan area pendukung |
| `muted-foreground` | `#586578` | `#A8B3C5` | Metadata dan helper text |
| `accent` | `#EAF0FC` | `#223656` | Pilihan aktif dan hover menu |
| `accent-foreground` | `#1D46A0` | `#BED4FF` | Teks pilihan aktif |
| `border` | `#DFE3EA` | `#344155` | Separator dekoratif |
| `input` | `#8290A3` | `#738196` | Batas kontrol form |
| `ring` | `#2457C5` | `#8AB4FF` | Focus ring |
| `destructive` | `#B4232C` | `#F58D98` | Aksi berbahaya |
| `destructive-foreground` | `#FFFFFF` | `#281116` | Teks tombol destructive |
| `sidebar` | `#F0F3F8` | `#151D2A` | Permukaan navigasi |
| `sidebar-foreground` | `#25334A` | `#DCE5F3` | Teks navigasi |

Alias `sidebar-primary` dan foreground-nya ke pasangan primary; `sidebar-accent` ke accent; `sidebar-border` ke border; `sidebar-ring` ke ring. Definisikan alias pada kedua tema. Chart belum dibutuhkan MVP; jangan menambahkan visualisasi untuk memenuhi token chart bawaan.

### 4.2 Warna status

| Status | Light: surface / text | Dark: surface / text | Ikon dan label contoh |
| --- | --- | --- | --- |
| Sukses | `#EAF7F0` / `#166044` | `#143629` / `#8AE0B5` | CheckCircle2 — “Selesai” |
| Peringatan | `#FFF5DE` / `#875000` | `#3A2D14` / `#F5CD7B` | Clock3 — “Terlambat” |
| Gagal | `#FDEEEE` / `#AE2929` | `#402125` / `#FFAAAA` | CircleAlert — “Gagal diproses” |
| Informasi/proses | Pasangan accent | Pasangan accent | LoaderCircle/FileText + label tahap |
| Netral | Pasangan muted | Pasangan muted | Clock3 — “Dalam antrean” |

Gunakan token tambahan `success`, `success-foreground`, `warning`, `warning-foreground`, `danger`, dan `danger-foreground` untuk pasangan tersebut. `danger` adalah surface pesan error; `destructive` adalah fill tombol tindakan berbahaya.

Warna status selalu disertai teks atau ikon. Prioritas tugas ditulis “Rendah”, “Sedang”, “Tinggi”; prioritas tinggi tidak otomatis berarti gagal. Warna merah digunakan untuk kegagalan dan aksi berbahaya, amber untuk deadline terlambat.

### 4.3 Kontras dan penggunaan

- Pemeriksaan sRGB awal: body light terhadap background 15,31:1; teks muted light di panel 5,92:1; tombol primary light 6,47:1; primary dark 8,25:1.
- Batas input terhadap panel: light 3,25:1 dan dark 4,04:1. Separator `border` bukan satu-satunya penanda kontrol interaktif.
- Angka tersebut hanya memeriksa pasangan dasar. Verifikasi ulang hover, opacity, selected, focus, error, dan hasil render nyata.
- Teks normal menargetkan minimal 4,5:1; indikator dan batas kontrol yang diperlukan untuk mengenalinya menargetkan 3:1 terhadap warna sekitar.
- Link dalam paragraf bergaris bawah. Teks warna primary tidak menggantikan link affordance.
- Jangan menggunakan opacity rendah pada teks penting atau seluruh isi panel.

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
- Header konten sekitar 64 px berisi trigger, breadcrumb, dan kontrol tema. Profil berada di footer sidebar.
- Header boleh sticky; konten dan anchor memiliki scroll offset agar tidak tertutup.
- Main content dashboard maksimal 1200 px dan rata tengah dalam area setelah sidebar. Halaman materi dua panel dapat memakai lebar hingga 1440 px.
- Sidebar menampilkan StudyFlow, pilihan semester, navigasi, lalu akun/pengaturan. Pemilih semester bukan pemilih organisasi.

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

### 9.1 Landing page

- Navbar: logo/wordmark, link “Fitur” dan “Cara kerja”, tema, “Masuk”, serta “Mulai belajar” jika registrasi aktif.
- Hero dua kolom desktop: judul “Materi rapi. Belajar lebih terarah.”, deskripsi singkat, CTA, dan preview produk yang menggambarkan aplikasi sebenarnya. Mobile menjadi satu kolom.
- Preview boleh memakai contoh statis berlabel “Contoh tampilan”; jangan membuat kontrol palsu tampak dapat digunakan.
- Section berikutnya: kelola kuliah, pelajari PDF, latihan; diikuti penjelasan tiga langkah dan CTA penutup.
- Tidak ada pricing, logo kampus, testimoni, angka pengguna, atau janji peningkatan nilai tanpa dasar.
- Ketika beta terbatas belum membuka registrasi, CTA diarahkan ke akses yang benar-benar tersedia dan copy menjelaskan status beta. Jangan membuat waitlist baru tanpa scope PRD.

### 9.2 Login dan register

- Form terpusat maksimal 420 px; heading singkat, label jelas, dan link perpindahan login/register.
- Desktop boleh memakai panel samping sederhana dengan manfaat produk; mobile fokus pada form.
- Field password memiliki toggle berlabel “Tampilkan password”/“Sembunyikan password”.
- Jelaskan panjang password sesuai validasi; pesan login gagal tetap umum.
- Tautan lupa password hanya tampil setelah flow reset benar-benar tersedia sesuai PRD.

### 9.3 Dashboard

Urutan konten mengikuti kebutuhan harian:

1. Header “Dashboard”, semester aktif, tanggal dalam zona waktu profil, CTA “Tambah tugas”.
2. Ringkasan angka kecil dalam satu baris: tugas hari ini, terlambat, dan selesai. Label rentang/filter selalu terlihat; tidak perlu tiga kartu besar.
3. Area utama sekitar dua pertiga lebar berisi “Tugas terdekat”, dengan judul, mata kuliah, deadline, dan status.
4. Kolom pendukung berisi “Materi terbaru” maksimal lima item dan aksi “Unggah materi”.
5. Hasil kuis terbaru berada setelah konten prioritas. Gunakan daftar ringkas; chart belum diperlukan.

Mobile mengikuti urutan header → ringkasan → tugas → materi → hasil kuis. Tidak boleh memindahkan daftar tugas ke bawah blok dekoratif.

Jika belum ada semester, tampilkan satu empty state “Mulai dari semester pertamamu” dengan CTA “Tambah semester”. Setelah ada semester tetapi belum ada mata kuliah, CTA berubah menjadi “Tambah mata kuliah”. Jangan menampilkan semua empty state onboarding sekaligus.

### 9.4 Semester dan mata kuliah

- Semester menggunakan daftar dengan tahun ajaran, penanda aktif/arsip, serta menu edit/arsip.
- Mata kuliah menggunakan grid sederhana: tiga kolom jika ruang cukup, dua pada ukuran menengah, satu pada mobile. Card berisi judul, kode/dosen bila tersedia, dan ringkasan konten yang berasal dari data.
- Setiap card mempunyai satu link judul dan menu aksi terpisah; hindari tombol bersarang dalam link yang membungkus seluruh card.
- Detail mata kuliah: breadcrumb, judul, metadata, lalu tab “Materi”, “Tugas”, “Catatan”. Aksi utama mengikuti tab.
- Arsip tetap dapat dibaca. Banner menjelaskan pembatasan penambahan data dan menyediakan aksi pulihkan sesuai PRD.
- Penghapusan yang ditolak karena masih memiliki turunan memberi penjelasan dan opsi arsip; jangan menampilkan keberhasilan palsu.

### 9.5 Tugas

- Toolbar: pencarian judul, filter mata kuliah/status/prioritas, urutan deadline, dan “Tambah tugas”.
- Desktop: table dengan judul, mata kuliah, deadline, prioritas, status, dan menu aksi.
- Mobile: list dengan judul di baris pertama, metadata di bawah, dan kontrol status yang tetap mudah disentuh. Semua informasi penting dari tabel tetap tersedia.
- Deadline menampilkan tanggal/jam konkret; label seperti “Besok” hanya pelengkap. Zona waktu terlihat dalam form dan informasi deadline.
- Tugas terlambat memakai ikon jam dan teks “Terlambat”; tugas selesai tidak mewarisi warna peringatan.
- Form: judul, mata kuliah, deskripsi opsional, deadline, prioritas, status. Jika hanya memilih tanggal, jelaskan waktu default 23.59 sesuai PRD.
- Filter aktif dapat direset melalui “Hapus filter”. Hasil kosong akibat filter berbeda dari belum punya tugas.

### 9.6 Daftar dan upload materi

- Tampilan utama berupa daftar file; kolom judul, mata kuliah, ukuran/halaman, waktu upload, dan status.
- Dropzone hanya ada di dialog/area upload, bukan memenuhi dashboard.
- Selalu sediakan tombol pilih file; drag-and-drop merupakan tambahan.
- Copy batas: “PDF berbasis teks, maksimal 20 MB dan 100 halaman. PDF hasil scan belum didukung.” Ambil nilai dari konfigurasi bersama agar sesuai backend.
- Form meminta mata kuliah dan judul yang dapat diisi dari nama file. File mulai diproses setelah pengguna menekan “Unggah materi”.
- Persentase transfer ditampilkan hanya bila dapat diukur. Selesai transfer berubah menjadi label antrean/ekstraksi, bukan 100% belajar selesai.
- Dialog menyampaikan “Setelah upload selesai, kamu boleh meninggalkan halaman. Pemrosesan tetap berjalan.” Upload yang belum selesai tidak diberi janji berjalan di background setelah tab ditutup.

### 9.7 Detail materi — pusat pengalaman belajar

- Header: breadcrumb, judul lengkap, mata kuliah, status, dan menu download/hapus.
- Pada viewport lebar, kiri sekitar 55% untuk preview PDF, kanan 45% untuk tab “Ringkasan”, “Flashcard”, “Kuis”. Tetap jaga lebar baris teks; hindari panel sangat sempit.
- Di bawah 1280 px gunakan pilihan utama “Dokumen” dan “Belajar”; panel belajar memuat tab ringkasan/flashcard/kuis. Pertahankan tab serta posisi sumber saat berpindah.
- Preview menyediakan halaman sebelumnya/berikutnya, nomor halaman, zoom, dan download. Jangan mengandalkan gestur pinch sebagai satu-satunya kontrol.
- PDF boleh memerlukan scroll lokal pada zoom tinggi; halaman aplikasi dan toolbar tetap reflow.
- Saat preview tidak didukung/gagal, tampilkan “Pratinjau belum tersedia” dan aksi download terotorisasi. Ringkasan yang tersedia tetap dapat digunakan.
- Ringkasan ditata seperti catatan: gambaran umum, konsep, istilah, dengan rujukan halaman berupa link kecil yang jelas.
- Klik “Hal. 4” membuka halaman PDF tersebut. Pada mobile, pindahkan ke mode dokumen dan sediakan “Kembali ke ringkasan”; jangan membuka tab baru tanpa kebutuhan.
- Jelaskan sekali bahwa rujukan memakai urutan halaman PDF. Jangan mengklaim label halaman tercetak selalu sama.
- Ringkasan belum dibuat: tampilkan manfaat singkat, keterangan kuota, dan “Buat ringkasan”. Hindari panel kosong tanpa aksi.
- Sebelum penggunaan AI pertama, jelaskan pengiriman teks materi ke provider sesuai PRD. Tindakan lanjut harus eksplisit dan informatif.
- Regenerasi ada di aksi sekunder. Copy menjelaskan penggunaan kuota dan bahwa hasil lama tetap tersedia bila proses baru gagal.

### 9.8 Flashcard

- Setup: pilihan 5/10/20 kartu, nilai awal 10, lalu “Buat flashcard”. Jelaskan bila jumlah aktual lebih sedikit karena materi terbatas.
- Mode belajar maksimal sekitar 720 px, dengan nama materi dan “Kartu 3 dari 10”.
- Pertanyaan dan jawaban dibaca di area stabil; jawaban dibuka dengan “Tampilkan jawaban”. Tidak wajib memakai animasi flip 3D.
- Setelah jawaban terbuka, tampilkan “Perlu diulang” dan “Sudah paham”, kemudian navigasi sebelumnya/berikutnya.
- Tombol penilaian tidak aktif sebelum jawaban dilihat. Kartu dapat dilewati dengan navigasi; jangan memaksa penilaian palsu.
- Penanda pemahaman dilabeli sebagai penilaian pribadi. Akhir sesi menampilkan jumlah yang ditandai, bukan klaim penguasaan materi.

### 9.9 Kuis dan hasil

- Setup: 5/10 soal, nilai awal 5, informasi “Tanpa batas waktu”, dan “Buat kuis”.
- Sebelum mulai, tampilkan jumlah soal dan nama materi. Mode pengerjaan menggunakan lebar baca sekitar 760 px.
- Satu soal dominan per tampilan, empat opsi berupa radio dengan seluruh label dapat diklik. Ada navigasi soal dan indikator yang sudah dijawab tanpa membocorkan benar/salah.
- Skor, jawaban benar, dan pembahasan hanya tampil setelah submit berhasil di backend.
- Jika ada soal kosong, tampilkan konfirmasi jumlah soal yang belum dijawab sebelum “Kumpulkan jawaban”.
- Bila submit gagal, pertahankan jawaban dan izinkan retry. Jangan menunjukkan hasil sukses sebelum respons server.
- Tampilkan peringatan sebelum meninggalkan attempt yang belum disubmit bila jawaban belum tersimpan. Jangan menjanjikan autosave/resume sebelum didukung backend.
- Hasil: skor, jumlah benar/total, dan waktu submit; berikutnya daftar pembahasan dengan pilihan pengguna, kunci, dan sumber.
- “Kerjakan lagi” memakai kuis yang sama tanpa biaya AI baru. “Buat kuis baru” adalah aksi terpisah dengan penjelasan kuota.

### 9.10 Catatan

- Daftar catatan menampilkan judul, mata kuliah, dan waktu edit terakhir.
- Editor lebar maksimal 900 px; toolbar ringkas untuk formatting Markdown yang benar-benar didukung.
- Desktop dapat memakai dua panel tulis/preview; mobile memakai tab “Tulis” dan “Pratinjau”.
- Tombol “Simpan” selalu mudah ditemukan, disertai “Belum disimpan” atau “Tersimpan pukul …”. MVP memakai simpan manual sesuai PRD.
- Perubahan belum tersimpan memicu peringatan saat meninggalkan halaman. Jangan menyatakan “Semua perubahan tersimpan” sebelum server berhasil.
- Materi yang dihapus tidak menghapus catatan; tampilkan keterangan sumber sudah tidak tersedia jika relevan.

### 9.11 Pengaturan

- Section berurutan: profil, zona waktu, tampilan, keamanan, penggunaan.
- Tema menyediakan “Sistem”, “Terang”, “Gelap”, konsisten dengan kontrol di header. Kunjungan pertama mengikuti sistem.
- Kuota menunjukkan nilai terpakai/total dan waktu reset lokal. Contoh angka dalam desain harus dilabeli contoh; production memakai data API.
- Kapasitas storage dan kuota generasi AI ditampilkan terpisah. Batas biaya operasional internal tidak ditampilkan sebagai saldo pengguna.
- Ganti password menjelaskan bahwa sesi lama akan diakhiri sesuai PRD.

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
