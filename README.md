# StudyFlow — Ruang Belajar Pribadi Mahasiswa

StudyFlow adalah platform belajar pribadi untuk mahasiswa yang mengintegrasikan pengelolaan semester, mata kuliah, tugas, catatan, serta materi PDF dengan bantuan AI. Mahasiswa dapat mengunggah dokumen kuliah, merangkum isinya, dan berlatih melalui flashcard serta kuis interaktif yang merujuk langsung ke halaman sumber.

---

## 1. Status Milestone

| Milestone | Deskripsi | Status |
| --- | --- | --- |
| **Milestone 1 — Foundation** | Fondasi monorepo, Next.js, Express, PostgreSQL, Redis, Worker BullMQ, CI, Health/Readiness, Theme Switcher | **Selesai** |
| **Milestone 2 — Authentication & Shell UI** | Registrasi, login, JWT/refresh cookie, profil pengguna, rotasi token atomik, Next.js BFF proxy, sidebar responsif | **Selesai** |
| **Milestone 3 — Semester & Course Management** | Pengelolaan semester aktif/arsip, multi-tenant composite isolation, daftar & detail mata kuliah, onboarding dashboard | **Selesai** |
| **Milestone 4 — Assignments, Notes & Dashboard** | Manajemen tugas kuliah, deadline timezone-aware, editor catatan Markdown, ringkasan dashboard semester aktif | **Selesai** |
| **Milestone 5 — Storage & Document Worker** | Upload PDF langsung ke storage privat, antrean BullMQ & transactional outbox, ekstraksi teks per halaman, kuota storage & upload | **Selesai** |
| **Milestone 6 — AI Summaries** | Ringkasan materi AI dengan Gemini API free tier, kutipan nomor halaman interaktif, mitigasi prompt injection, kuota harian atomik | **Selesai** |
| **Milestone 7 — Flashcards & Quizzes** | Generasi latihan interaktif, penyimpanan jawaban sebelum submit, penilaian & skor di backend, soft-delete turunan saat materi dihapus | **Selesai** |
| **Milestone 8 — MVP Release Prep** | Tahap 1: Verifikasi MVP lokal, E2E suite, evaluasi AI, demo seed, deployment guide, dan checklist rilis | **Selesai (Tahap 1)** |

---

## 2. Struktur Monorepo

Repository ini dikelola menggunakan npm workspaces:

```text
study-flow/
├── apps/
│   ├── web/            # Frontend: Next.js 15 (App Router), Tailwind CSS v4, shadcn/ui, Lucide
│   ├── admin/          # Frontend: Next.js 15 Panel Administrator StudyFlow (Port 3002)
│   ├── api/            # Backend: Express REST API, Zod validation, Health/Readiness
│   └── worker/         # Worker: Proses background BullMQ untuk pengolahan dokumen dan AI
├── packages/
│   ├── shared/         # Zod schemas, kontrak data publik, dan konstanta bersama
│   ├── database/       # Prisma schema, migrations, dan singleton PrismaClient untuk server
│   └── config/         # Konfigurasi TypeScript bersama (tsconfig bases)
├── docs/
│   ├── architecture.md               # Arsitektur sistem dan batas tanggung jawab
│   └── product_requirements_document.md # PRD resmi proyek
├── .github/workflows/ci.yml          # GitHub Actions CI workflow
├── docker-compose.yml                # Layanan lokal PostgreSQL 16 & Redis 7
└── package.json                      # Root workspace scripts dan dependensi
```

---

## 3. Prasyarat Sistem

- **Node.js**: Versi `>= 22.0.0` (disarankan Node 22 LTS).
- **npm**: Versi `>= 10.0.0`.
- **Docker & Docker Compose**: Untuk menjalankan PostgreSQL dan Redis lokal (opsional bila sudah memiliki instance lokal).
- **Sistem Operasi**: Kompatibel dengan Windows (PowerShell), macOS, dan Linux.

---

## 4. Setup Environment

Salin file template `.env.example` ke file `.env` yang sesuai:

### Dari Root (Windows PowerShell):
```powershell
# Buat file .env lokal dari template
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/worker/.env.example apps/worker/.env
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item packages/database/.env.example packages/database/.env
```

### Variabel Utama:
- **`DATABASE_URL`**: `postgresql://studyflow_user:studyflow_dev_password@localhost:5433/studyflow_dev?schema=public`
- **`REDIS_URL`**: `redis://localhost:6379`
- **`PORT`**: `4000` (Port backend API)
- **`NEXT_PUBLIC_API_URL`**: `http://localhost:4000` (URL API untuk browser)

---

## 5. Menjalankan Layanan Database & Redis

Jalankan container PostgreSQL dan Redis menggunakan Docker Compose:

```bash
docker compose up -d
```

Untuk memeriksa status container:
```bash
docker compose ps
```

Container dilengkapi healthcheck otomatis:
- PostgreSQL StudyFlow siap di port `5433` (port default 5433 digunakan agar tidak bentrok dengan instalasi PostgreSQL lokal bawaan di port 5432)
- Redis siap di port `6379`

Untuk menghentikan:
```bash
docker compose down
```

---

## 6. Instalasi dan Persiapan Basis Data

1. **Pasang seluruh dependensi monorepo:**
   ```bash
   npm install
   ```

2. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

3. **Jalankan Migrasi Database (Development):**
   ```bash
   npm run db:migrate:dev
   ```
   Perintah ini akan menerapkan skema migrasi `User` dan `RefreshSession` ke basis data PostgreSQL tanpa menghapus atau mereset data yang ada.

4. **Build shared packages:**
   ```bash
   npm run build:shared
   ```

---

## 7. Menjalankan Aplikasi

### Menjalankan Semua Proses Bersamaan:
Perintah ini akan menjalankan frontend Next.js, backend Express, dan BullMQ worker secara serentak:
```bash
npm run dev
```

### Menjalankan Layanan Secara Terpisah:
- **Frontend Web** (port `3000`):
  ```bash
  npm run dev:web
  ```
- **Admin Dashboard Web** (port `3002`):
  ```bash
  npm run dev:admin
  ```
- **Backend API** (port `4000`):
  ```bash
  npm run dev:api
  ```
- **Worker BullMQ**:
  ```bash
  npm run dev:worker
  ```

### Bootstrap / Promosi Akun Administrator:
Untuk memberikan role `ADMIN` pada pengguna yang sudah terdaftar:
```bash
npm run promote:admin -- user@example.com
```
Atau tanpa konfirmasi interaktif (misalnya untuk automasi):
```bash
npm run promote:admin -- user@example.com --yes
```

---

## 8. Verifikasi dan Pengujian

Jalankan quality gates dan rangkaian test yang tersedia:

- **Typecheck**: Memeriksa tipe TypeScript di semua workspace:
  ```bash
  npm run typecheck
  ```
- **Lint**: Memeriksa kualitas kode:
  ```bash
  npm run lint
  ```
- **Unit & Integration Tests (API & Worker)**:
  ```bash
  npm run test
  ```
- **Pengujian Khusus Backend Auth (Vitest)**:
  ```bash
  npm run test --workspace=@studyflow/api
  ```
  *Catatan*: Pengujian otomatis API menggunakan database terpisah `studyflow_test` secara otomatis untuk menjaga integritas data development.
- **Pengujian Integrasi End-to-End BFF Auth (Next.js -> Express)**:
  ```bash
  npm run test:bff
  ```
  Menguji pendaftaran, login, cookie HttpOnly, proteksi rute privat `/dashboard` dan `/settings`, pembaruan profil, perubahan password dengan pencabutan sesi instan, dan logout melalui proxy Next.js.
- **Pengujian Browser Playwright End-to-End (E2E)**:
  ```bash
  # 1. Bangun bundle Next.js untuk E2E ke direktori .next-e2e:
  npm run build:e2e

  # 2. Verifikasi kepatuhan isolasi konfigurasi E2E:
  npm run test:e2e:config

  # 3. Jalankan test E2E Chromium:
  npm run test:e2e
  ```
  Menjalankan flow kritis MVP secara hermetis.
  *Catatan Isolasi Ketat*: E2E Playwright mewajibkan konfigurasi test eksplisit (`DATABASE_URL_TEST` berakhiran `_test`, dan `REDIS_URL_TEST` menggunakan database terpisah misalnya DB 15). Fallback ke `DATABASE_URL` atau `REDIS_URL` development telah dihapus; jika konfigurasi test tidak tersedia atau menunjuk target tidak aman, setup E2E menolak eksekusi seketika sebelum migrasi, seed, atau server dimulai. URL test yang divalidasi hanya diteruskan ke proses anak API dan Worker, bukan ke frontend Next.js.
- **Verifikasi Docker Image Multi-Stage (Clean Build)**:
  ```bash
  docker build -f apps/api/Dockerfile -t studyflow-api:latest .
  docker build -f apps/worker/Dockerfile -t studyflow-worker:latest .
  docker build -f apps/web/Dockerfile -t studyflow-web:latest .
  ```
- **Evaluasi Performa Ekstraksi & Kualitas AI**:
  ```bash
  npm run eval:ai
  ```
  Menjalankan evaluasi dataset representatif berbasis dokumen akademik nyata dan failure fixtures menggunakan runner resmi terpadu ([`scripts/run-ai-evaluation.ts`](file:///scripts/run-ai-evaluation.ts)) dengan sumber kebenaran data di [`docs/ai_evaluation/manifest.json`](file:///docs/ai_evaluation/manifest.json).

  Sistem memisahkan 3 lapisan evaluasi secara akuntabel sesuai PRD Bagian 15.2:
  1. **Lapisan 1 (Validasi Dokumen & Ekstraksi)**: Ekstraksi teks PDF nyata per halaman via `pdfjs-dist`, validasi magic bytes, serta pembuktian penolakan deterministik berkas negatif (PDF scan tanpa teks, berkas rusak, PDF terenkripsi dengan proteksi kata sandi nyata, dan dokumen melebihi batas 100 halaman).
  2. **Lapisan 2 (Integrasi & Validitas Struktur Output AI)**: Validasi keluaran model terhadap skema Zod publik aplikasi (`SummaryStructuredOutputSchema`, `FlashcardSetStructuredOutputSchema`, `QuizStructuredOutputSchema`), pengecekan batasan referensi halaman (`1 <= pageReference <= totalPages`), validitas opsi kuis (tepat 4 opsi unik, indeks `0..3`), dan kejelasan penjelasan.
  3. **Lapisan 3 (Kualitas Faktual & Review Manual)**: Evaluasi kebenaran faktual klaim ringkasan, kartu flashcard, dan kunci jawaban kuis terhadap teks sumber asli. Pada mode Mock, seluruh kriteria Lapisan 3 ditandai strictly **`NOT_EVALUATED`** dan tidak menggelembungkan metrik kelulusan sistem.

  **Opsi CLI Runner Resmi**:
  ```bash
  # Mode mock standar (mengevaluasi seluruh dataset manifest)
  npm run eval:ai

  # Membatasi jumlah dokumen valid (misal 5 dokumen)
  npx tsx scripts/run-ai-evaluation.ts --limit=5

  # Hanya menguji berkas kegagalan/negatif
  npx tsx scripts/run-ai-evaluation.ts --negative-only

  # Menjalankan pengujian live provider dengan pengawasan kuota ketat
  npx tsx scripts/run-ai-evaluation.ts --provider=gemini --limit=2 --max-calls=6
  ```
  Laporan komprehensif disimpan secara otomatis di [`docs/ai_evaluation/evaluation_report.md`](file:///docs/ai_evaluation/evaluation_report.md) beserta log audit JSON di `docs/ai_evaluation/results-<timestamp>.json`.
- **Demo Data Seeding**:
  ```bash
  npm run seed:demo
  ```
  Menyiapkan akun demo (`demo.student@studyflow.test`) dengan data perkuliahan realistis secara aman dan idempotent tanpa menghapus atau mengganggu data pengguna lain.
- **Build**: Membangun seluruh paket dan aplikasi:
  ```bash
  npm run build
  ```

---

## 9. Arsitektur Autentikasi & Kontrak API (Milestone 2)

Sistem autentikasi StudyFlow menggunakan arsitektur single-origin BFF (Backend-for-Frontend):
- Browser berinteraksi dengan rute `/api/auth/*` pada origin Next.js (`http://localhost:3000`).
- Token disimpan aman dalam cookie **HttpOnly** (`studyflow_access_token` [15m], `studyflow_refresh_token` [7d]).
- Token refresh disimpan dalam basis data hanya sebagai hash SHA-256 dan dirotasi secara atomik pada setiap request refresh (dengan deteksi replay otomatis).
- Pergantian password menaikkan versi token pengguna (`tokenVersion`) sehingga seluruh access token dan sesi lama langsung tidak berlaku di server.
- Kontrak lengkap OpenAPI 3.1.0 tersedia di [`docs/api.openapi.json`](file:///docs/api.openapi.json).

---

## 10. Menjalankan Smoke Test Worker

Smoke test internal disediakan untuk memverifikasi antrean dan konsumsi job BullMQ tanpa memerlukan panggilan model AI:

1. Pastikan Redis dan proses worker aktif:
   ```bash
   npm run dev:worker
   ```
2. Pada terminal terpisah, kirimkan smoke job:
   ```bash
   npm run worker:smoke
   ```
   Script akan memvalidasi payload, mengirim job ke antrean `studyflow-smoke-queue`, dan menunggu hasil penyelesaian dari worker.

---

## 11. Endpoint Health & Readiness

Backend Express menyediakan dua endpoint pemantauan:

- **`GET http://localhost:4000/health`**:
  Memastikan proses API hidup dan merespons. Mengembalikan status `200 OK` dengan metadata uptime dan environment.
- **`GET http://localhost:4000/ready`**:
  Memeriksa konektivitas nyata ke PostgreSQL dan Redis dengan mekanisme timeout 2 detik. Mengembalikan `200 OK` bila kedua layanan siap, atau `503 Service Unavailable` bila dependensi belum siap (tanpa membocorkan kredensial).

---

## 12. Troubleshooting

- **Port 5432 atau 6379 sudah terpakai:**
  Jika Anda telah memiliki instance PostgreSQL atau Redis lokal yang sedang berjalan di mesin Anda, Anda dapat menggunakannya langsung dengan menyesuaikan `DATABASE_URL` dan `REDIS_URL` di `.env`, atau ubah port mapping pada `docker-compose.yml`.
- **Prisma Client belum ter-generate:**
  Jalankan `npm run db:generate`.
- **Paket `@studyflow/shared` tidak ditemukan saat build:**
  Pastikan menjalankan `npm run build:shared` sebelum membangun aplikasi web atau worker.

---

## 13. Konfigurasi Supabase Storage & Dokumen Worker (Milestone 5)

StudyFlow menggunakan **Supabase Storage** dengan bucket privat untuk menyimpan materi perkuliahan dalam format PDF berbasis teks.

### 13.1 Alur Upload & Pemrosesan
1. **Inisiasi (`POST /api/materials/initiate-upload`)**:
   - Browser meminta URL upload terotorisasi melalui BFF -> Express API.
   - Server memverifikasi kepemilikan mata kuliah, kuota storage pengguna (maks 200 MB), kuota upload harian (maks 10 file/hari, reset 00:00 UTC), dan status arsip.
   - Server mereservasi kuota, membuat entri `Material` berstatus `UPLOADING`, dan menerbitkan signed upload URL dari Supabase Storage.
2. **Transfer Langsung ke Storage**:
   - Browser mengunggah payload file PDF langsung ke Supabase Storage via signed URL tanpa membebani throughput memory BFF Next.js.
3. **Finalisasi (`POST /api/materials/finalize-upload`)**:
   - Browser memberi tahu server bahwa upload selesai.
   - Server memverifikasi keberadaan file di storage, mengunci status menjadi `QUEUED`, membuat `ProcessingJob`, dan mencatat `OutboxEvent`.
   - Dispatcher outbox meneruskan pekerjaan ke antrean BullMQ (`studyflow-document-processing`).
4. **Ekstraksi Teks oleh Worker (`apps/worker`)**:
   - Worker mengambil pekerjaan, memverifikasi integritas PDF (magic bytes `%PDF-`), batas maksimal 100 halaman, dan batas maksimal 20 MB.
   - Teks diekstrak per halaman (1-indexed) menggunakan `pdfjs-dist` dengan mempertahankan provenance nomor halaman untuk fitur AI mendatang.
   - Dokumen tanpa lapisan teks (scanned image) ditolak dengan kode `SCANNED_PDF_NO_TEXT` (OCR tidak didukung pada versi ini).
   - Setelah seluruh halaman tersimpan di database, status diubah menjadi `READY` dan kuota storage dikomit secara atomik.

### 13.2 Pemilihan Storage Driver (`STORAGE_DRIVER`)
StudyFlow mendukung 4 driver storage yang dapat dipilih secara eksplisit melalui environment variable `STORAGE_DRIVER`:

| Driver | Deskripsi | Lingkungan Penggunaan |
| --- | --- | --- |
| `local` (Default Dev) | Menyimpan file pada filesystem lokal (`.storage/materials/`). Mendukung transfer berkas lintas proses antara Express API dan Worker background tanpa akun pihak ketiga. | Local Development |
| `supabase` | Menggunakan Supabase Storage dengan bucket privat melalui `@supabase/storage-js`. Memerlukan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`. | Production / Staging |
| `memory` | In-memory Mock Storage untuk pengujian otomatis terisolasi yang cepat. | Unit & Integration Test (`vitest`) |
| `none` | Menonaktifkan storage dengan aman. Endpoint upload/download mengembalikan `503 STORAGE_UNAVAILABLE` tanpa mengganggu fitur perkuliahan, tugas, dan catatan. | Maintenance / Storage Off |

> **Catatan Keamanan Produksi**: Pada lingkungan `production`, sistem **tidak akan pernah** secara diam-diam beralih ke mock in-memory jika kredensial Supabase hilang. Sistem akan mengembalikan status `STORAGE_UNAVAILABLE` yang aman bagi pengguna.

### 13.3 Panduan Konfigurasi Supabase Storage (Live Deployment)
Bila ingin menghubungkan ke instance Supabase nyata:
1. Masuk ke dashboard [Supabase](https://supabase.com) dan buka proyek Anda.
2. Buka menu **Storage** -> pilih **New Bucket**:
   - **Bucket Name**: `studyflow-materials` (wajib persis sesuai nilai `SUPABASE_STORAGE_BUCKET`).
   - **Public bucket**: **Disabled / Off (Wajib Privat)**. Jangan pernah mengaktifkan public bucket untuk dokumen pengguna.
   - **Allowed MIME types**: `application/pdf`.
   - **Maximum file size limit**: 20 MB (20,971,520 bytes).
3. Masuk ke menu **Project Settings** -> **API**:
   - Salin **Project URL** ke `SUPABASE_URL`.
   - Salin **service_role secret key** (bukan `anon` public key!) ke `SUPABASE_SERVICE_ROLE_KEY`.
4. Tambahkan konfigurasi ke file environment:
   - **Backend API**: `apps/api/.env`
   - **Worker Background**: `apps/worker/.env`
   ```env
   STORAGE_DRIVER="supabase"
   SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key"
   SUPABASE_STORAGE_BUCKET="studyflow-materials"
   ```
5. **Restart Proses**:
   Restart kedua proses server agar membaca variabel lingkungan baru:
   - Restart API: Hentikan dan jalankan kembali `npm run dev:api`.
   - Restart Worker: Hentikan dan jalankan kembali `npm run dev:worker`.

*Peringatan Keamanan*: Kredensial `service_role` memiliki hak akses administratif penuh. Jangan pernah memberi prefix `NEXT_PUBLIC_`, mengunggahnya ke Git, mencetak nilainya dalam log, atau membagikannya ke browser!

---

## 14. Ringkasan Materi dengan AI (Milestone 6)

StudyFlow mengintegrasikan model Large Language Model (LLM) untuk menghasilkan ringkasan akademis terstruktur secara otomatis dari materi PDF yang telah diekstrak. Fitur ini dirancang khusus menggunakan **free tier tanpa billing**.

### 14.1 Pemilihan Provider & Ketentuan Free Tier
- **Provider**: Google AI Studio Gemini API (`gemini-3.5-flash-lite` — model aktif proyek ini; pertahankan konfigurasi & secret yang bekerja).
- **Free Tier**: Pengguna **wajib memastikan bahwa project Google AI Studio miliknya berada pada Free Tier** tanpa mengaktifkan billing / pay-as-you-go. Jangan menambahkan kartu kredit atau mengaktifkan penagihan pada Google Cloud Console. Batas kuota gratis (seperti rate limit per menit dan kuota harian) sepenuhnya diatur oleh kebijakan resmi Google AI Studio untuk wilayah dan akun terkait.
- **Tanpa Fallback Berbayar**: Sistem StudyFlow dirancang tanpa mekanisme fallback otomatis ke model atau provider berbayar. Jika kuota provider habis (`429`), sistem menampilkan pesan error informatif yang aman dan tidak melakukan retry tanpa henti.
- **Kebijakan Penggunaan Data**: Pada Google AI Studio free tier, prompt dan konten teks dapat ditinjau oleh Google sesuai kebijakan privasi AI Studio. Oleh karena itu, pengujian disarankan menggunakan sampel materi edukasi non-sensitif.
- **Model Adapter**:
  - `gemini` : Provider riil menggunakan Google AI Studio API. Wajib menyertakan `GEMINI_API_KEY`. Jika API key belum dikonfigurasi, sistem mengembalikan status `503 AI_PROVIDER_UNCONFIGURED` secara aman dan tidak beralih ke mock.
  - `mock` : Mock adapter deterministik berbahasa Indonesia yang **hanya aktif jika dipilih secara eksplisit** (`AI_PROVIDER="mock"`) untuk pengujian otomatis hermetis.
  - `none` : Mode penonaktifan eksplisit yang mengembalikan status `503 AI_PROVIDER_UNAVAILABLE` tanpa mengganggu fitur perkuliahan lainnya.
- **Dukungan Dokumen Panjang & Chunking**: Dokumen dibagi ke dalam chunk terstruktur (maksimal 40.000 karakter per bagian, batas maksimal 3 chunk + 1 sintesis penggabungan). Dokumen yang melebihi 100 halaman atau 300.000 karakter ditolak di awal (`DOCUMENT_TOO_LARGE`) sebelum memanggil provider AI untuk mencegah ringkasan parsial yang menyesatkan.

### 14.2 Batas Kuota & Konkurensi Aplikasi
- **Batas Harian Pengguna**: Maksimal **20 ringkasan per pengguna per hari**, direset otomatis pada pukul **00:00 UTC**.
- **Batas Konkurensi**: Maksimal **2 proses generasi AI aktif bersamaan per pengguna**.
- **Reservasi Atomik**: Kuota harian dan slot konkurensi direservasi secara atomik di PostgreSQL dalam transaksi sebelum pekerjaan didispatch.
- **Idempotensi**: Klik ganda atau pengiriman ulang saat pekerjaan berstatus `QUEUED` atau `PROCESSING` tidak akan menduplikasi pekerjaan maupun menghabiskan kuota ganda.

### 14.3 Keandalan & Semantika Regenerasi
- **Pertahanan Prompt Injection**: Seluruh teks halaman PDF diperlakukan sebagai masukan tidak tepercaya (*untrusted input*). Sistem prompt memerintahkan model untuk mengabaikan instruksi apa pun yang tertanam di dalam isi dokumen.
- **Validasi Terstruktur Zod**: Keluaran model divalidasi ketat menggunakan schema JSON (`title`, `overview`, `keyConcepts`, `sections`, `keyTerms`). Seluruh kutipan nomor halaman dibatasi pada rentang valid `1..totalPages`.
- **Preservasi Regenerasi**: Jika pengguna meminta regenerasi dan pemanggilan AI gagal (misal timeout atau rate limit), ringkasan sukses sebelumnya **tetap dipertahankan utuh** sehingga pengguna tidak kehilangan materi belajar.
- **Asinkron Melalui BullMQ**: Pemrosesan LLM berjalan di antrean background worker `studyflow-ai-generation` dengan timeout 45 detik via `AbortSignal.timeout` dan retry terbatas hanya untuk transient error.

### 14.4 Panduan Menjalankan dengan Google AI Studio (Live Testing)
1. Dapatkan API Key gratis di [Google AI Studio](https://aistudio.google.com/app/apikey) (pastikan akun gratis tanpa billing diaktifkan).
2. Tambahkan konfigurasi ke file `apps/api/.env` dan `apps/worker/.env`:
   ```env
   AI_PROVIDER="gemini"
   GEMINI_API_KEY="AIzaSy..."
   GEMINI_MODEL="gemini-3.5-flash-lite"
   ```
3. Restart proses backend API dan Worker background:
   - `npm run dev:api`
   - `npm run dev:worker`
4. Buka halaman detail materi `/materials/[id]` pada browser:
   - Pilih tab **"Ringkasan AI"**.
   - Klik **"Buat Ringkasan AI Sekarang"**.
   - Klik nomor halaman referensi (misal `[Hal 2]`) pada konsep atau bagian untuk langsung berpindah ke tampilan PDF pada halaman tersebut!



