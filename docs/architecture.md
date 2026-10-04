# Arsitektur Sistem — StudyFlow

Dokumen ini menjelaskan batas tanggung jawab, struktur monorepo, aliran data, dan prinsip komunikasi antarkomponen pada StudyFlow.

## 1. Ikhtisar Arsitektur

StudyFlow dibangun menggunakan arsitektur modular terpisah untuk memisahkan logika antarmuka, logika bisnis inti, pemrosesan dokumen/AI latar belakang, serta akses basis data.

```
                   +-----------------------------+
                   |   Browser (Pengguna Akhir)  |
                   +--------------+--------------+
                                  |
                                  | HTTP / JSON (CORS/Cookies)
                                  v
+--------------------------+  +--------------------------+
|  apps/web (Next.js)      |  |  apps/api (Express)      |
|  - Rendering UI          |  |  - REST API & Auth       |
|  - App Router & RSC      |  |  - Business Logic        |
|  - Theme & Client State  |  |  - Request Validation    |
+--------------------------+  +------------+-------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v (Prisma ORM)                                v (Enqueue jobs)
       +--------------------------+                  +--------------------------+
       |   packages/database      |                  |   Redis (BullMQ)         |
       |   - PostgreSQL           |                  |   - Queue broker         |
       |   - Data persisten       |                  +------------+-------------+
       +--------------------------+                               |
                    ^                                             v (Consume jobs)
                    |                                +--------------------------+
                    +--------------------------------+  apps/worker (BullMQ)    |
                              (Update status)        |  - Ekstraksi PDF         |
                                                     |  - Generasi AI           |
                                                     +--------------------------+
```

## 2. Batas Tanggung Jawab Komponen

| Lokasi | Komponen | Tanggung Jawab Utama | Batasan Ketat |
| --- | --- | --- | --- |
| `apps/web` | Next.js App Router | Rendering halaman, routing, manajemen tema, UI interaktif, validasi form sisi klien | **TIDAK BOLEH** mengimpor Prisma atau modul database; tidak menyimpan secret server; tidak menduplikasi aturan bisnis API |
| `apps/api` | Express REST API | Autentikasi sesi, otorisasi kepemilikan resource, validasi skema input (Zod), koordinasi job ke antrean, logging terstruktur, pelaporan health/readiness | Menjaga semua akses database di belakang otorisasi; tidak membocorkan connection string, kredensial, atau stack trace ke klien |
| `apps/worker` | BullMQ Worker | Pemrosesan dokumen berat (PDF text extraction), koordinasi generasi AI, retry handling | Hanya berjalan sebagai proses latar belakang; tidak mengekspos port HTTP publik; idempotent terhadap job berulang |
| `packages/shared` | Shared Contracts | Kontrak publik Zod, tipe TypeScript bersama, konstanta sistem (kuota, limit file, queue names) | Aman diimpor oleh browser dan server; **TIDAK BOLEH** memuat modul Node/server privat |
| `packages/database` | Database Layer | Definisi schema Prisma, manajemen migration, ekspor singleton PrismaClient untuk proses server | **HANYA** untuk proses server (`apps/api`, `apps/worker`); tidak boleh bocor ke bundle browser |
| `packages/config` | Shared Config | Konfigurasi TypeScript dasar (`tsconfig.base.json`, `tsconfig.node.json`, `tsconfig.react.json`) | Memastikan konsistensi kompilasi dan typechecking |
| `Redis` | In-memory Broker | Antrean pekerjaan BullMQ dan status pekerjaan sementara | Bukan penyimpanan persisten utama status produk |
| `PostgreSQL` | Relational Database | Penyimpanan relasional persisten data pengguna, perkuliahan, materi, status job, dan hasil AI | Akses terlindung melalui connection string aman |

## 3. Aliran Data dan Prinsip Komunikasi

### 3.1 Health dan Readiness Check
- Endpoint `/health` pada `apps/api` memastikan proses Express aktif dan merespons.
- Endpoint `/ready` memeriksa kesiapan koneksi ke PostgreSQL dan Redis dengan batas waktu (timeout). Bila dependensi tidak siap, mengembalikan status HTTP 503 tanpa membocorkan kredensial.

### 3.2 Pemrosesan Latar Belakang (Worker & BullMQ)
- Pemrosesan asinkron tidak menahan request HTTP pengguna. API menerbitkan job ke antrean Redis, mencatat status persisten di PostgreSQL, dan mengembalikan HTTP 202 beserta ID pekerjaan.
- Worker mengambil pekerjaan, memperbarui status, dan mencatat kegagalan secara terstruktur.
- Pada Milestone 1, disediakan **Smoke Job** internal (`studyflow-smoke-queue`) untuk memverifikasi fungsionalitas enqueue dan consume tanpa bergantung pada penyedia AI eksternal.

### 3.3 Keamanan dan Isolasi Data
- Setiap query data mewajibkan verifikasi identitas dan kepemilikan (`userId`).
- Kredensial server dan token AI hanya diakses oleh proses backend/worker via environment variables tanpa prefix `NEXT_PUBLIC_`.

### 3.4 Aliran Autentikasi dan Single-Origin BFF (Milestone 2)

```
[Browser]
   │
   │ 1. Request via Same-Origin (e.g. POST http://localhost:3000/api/auth/login)
   ▼
[Next.js App Router BFF Proxy] (apps/web/src/app/api/auth/[...path]/route.ts)
   │
   │ 2. Forward request, cookies, Origin, Referer, Client Request-ID
   ▼
[Express REST API] (apps/api/src/routes/auth.ts)
   │
   ├─► 3. Origin / CSRF Verification (originCheck.ts)
   ├─► 4. Business Logic & Authentication (auth.service.ts)
   ├─► 5. Database Verification (User, RefreshSession via Prisma)
   └─► 6. Set HttpOnly Cookie (studyflow_access_token [15m], studyflow_refresh_token [7d])
   │
   ▼
[Next.js BFF Proxy]
   │
   │ 7. Forward Set-Cookie headers (getSetCookie()) back to Browser
   ▼
[Browser Cookie Store]
```

#### Komponen Utama Autentikasi:
1. **Single-Origin BFF Proxy**:
   - Seluruh pemanggilan auth oleh antarmuka browser melewati route handler `/api/auth/[...path]` di origin Next.js.
   - Menyederhanakan penanganan cookie first-party `SameSite=Lax` dan menghindari masalah cross-origin cookie pada berbagai browser dan environment deployment.
2. **Dual-Token & Rotasi Atomik**:
   - **Access Token**: JWT berumur pendek (default 15 menit), berisi klaim `userId`, `email`, dan `tokenVersion`.
   - **Refresh Session**: Token acak kriptografis berkekuatan tinggi (32-byte hex), disimpan hanya dalam bentuk hash SHA-256 di basis data dengan masa berlaku 7 hari.
   - Setiap pemanggilan refresh merotasi token lama menjadi token baru. Jika token lama digunakan kembali setelah rotasi (replay attack), seluruh sesi pada akun/keluarga sesi tersebut segera dicabut.
3. **Pencegahan CSRF**:
   - Endpoint mutasi (POST, PATCH, PUT, DELETE) mewajibkan validasi `Origin` dan `Referer` terhadap domain yang diizinkan (`originCheckMiddleware`).
4. **Invalidasi Sesi Seketika (Token Versioning)**:
   - Penggantian password meningkatkan kolom `tokenVersion` pada model `User` dan menandai seluruh `RefreshSession` aktif sebagai revoked (`isRevoked: true`).
   - Setiap middleware autentikasi memvalidasi `tokenVersion` access token terhadap nilai aktual di basis data, sehingga access token lama langsung ditolak seketika tanpa harus menunggu masa berlaku 15 menit berakhir.
5. **Proteksi Route Privat**:
   - Next.js Middleware (`apps/web/src/middleware.ts`) melindungi rute `/dashboard` dan `/settings` dengan memeriksa keberadaan sesi cookie, melakukan redirect ke `/login?returnUrl=...`.
   - Server Component (`getServerSessionUser`) memverifikasi keabsahan sesi secara aman di server sebelum merender data pengguna.

