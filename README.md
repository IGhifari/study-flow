# StudyFlow — Ruang Belajar Pribadi Mahasiswa

StudyFlow adalah platform belajar pribadi untuk mahasiswa yang mengintegrasikan pengelolaan semester, mata kuliah, tugas, catatan, serta materi PDF dengan bantuan AI. Mahasiswa dapat mengunggah dokumen kuliah, merangkum isinya, dan berlatih melalui flashcard serta kuis interaktif yang merujuk langsung ke halaman sumber.

---

## 1. Status Milestone

| Milestone | Deskripsi | Status |
| --- | --- | --- |
| **Milestone 1 — Foundation** | Fondasi monorepo, Next.js, Express, PostgreSQL, Redis, Worker BullMQ, CI, Health/Readiness, Theme Switcher | **Selesai** |
| **Milestone 2 — Authentication & Shell UI** | Registrasi, login, JWT/refresh cookie, profil pengguna, rotasi token atomik, Next.js BFF proxy, sidebar responsif | **Selesai** |
| **Milestone 3 — Semester & Course Management** | Pengelolaan semester aktif/arsip, multi-tenant composite isolation, daftar & detail mata kuliah, onboarding dashboard | **Selesai** |
| **Milestone 4 — Assignments, Notes & Dashboard** | Manajemen tugas, deadline, Markdown notes, status ringkasan | Mendatang |
| **Milestone 5 — Storage & Document Worker** | Upload PDF privat, antrean ekstraksi teks BullMQ | Mendatang |
| **Milestone 6 — AI Summaries** | Integrasi AI dengan kutipan halaman sumber | Mendatang |
| **Milestone 7 — Flashcards & Quizzes** | Generasi latihan interaktif dan penilaian di backend | Mendatang |

---

## 2. Struktur Monorepo

Repository ini dikelola menggunakan npm workspaces:

```text
study-flow/
├── apps/
│   ├── web/            # Frontend: Next.js 15 (App Router), Tailwind CSS v4, shadcn/ui, Lucide
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
- **Backend API** (port `4000`):
  ```bash
  npm run dev:api
  ```
- **Worker BullMQ**:
  ```bash
  npm run dev:worker
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
