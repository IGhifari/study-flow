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
   - Next.js Middleware (`apps/web/src/middleware.ts`) melindungi rute `/dashboard`, `/semesters`, `/courses`, dan `/settings` dengan memeriksa keberadaan sesi cookie, melakukan redirect ke `/login?returnUrl=...`.
   - Server Component (`getServerSessionUser`) memverifikasi keabsahan sesi secara aman di server sebelum merender data pengguna.

### 3.5 Pengelolaan Semester dan Mata Kuliah (Milestone 3)

```
[Browser Client]
   │
   ├─► GET/POST/PATCH/DELETE /api/semesters (BFF Next.js Proxy)
   │      │
   │      ▼
   │   [Express API: semesterRouter]
   │      ├─► Origin/CSRF & Auth Verification
   │      ├─► Aturan Bisnis & Invarian Sisi Server
   │      └─► Prisma Client (packages/database)
   │             ▼
   │          [PostgreSQL: semesters table]
   │             ├─► Partial Index: CREATE UNIQUE INDEX semesters_one_active_per_user
   │             │   ON semesters(user_id) WHERE is_active = true
   │             └─► Check: NOT (is_active AND archived_at IS NOT NULL)
   │
   └─► GET/POST/PATCH/DELETE /api/courses (BFF Next.js Proxy)
          │
          ▼
       [Express API: courseRouter]
          ├─► Origin/CSRF & Auth Verification
          ├─► Larangan membuat matkul di semester arsip
          └─► Prisma Client (packages/database)
                 ▼
              [PostgreSQL: courses table]
                 └─► Composite FK: FOREIGN KEY (semester_id, user_id)
                     REFERENCES semesters(id, user_id) ON DELETE NO ACTION
```

#### Invarian Integritas Data Milestone 3:
1. **Maksimal Satu Semester Aktif per Pengguna**:
   - Ditegakkan ganda: pada lapisan logika transaksi di `semester.service.ts` dan pada lapisan basis data melalui partial unique index PostgreSQL `semesters_one_active_per_user` (`WHERE is_active = true`).
   - Pembuatan semester pertama pengguna secara otomatis bernilai aktif (`isActive: true`).
   - Aktivasi semester baru secara atomik menonaktifkan semester aktif sebelumnya dalam satu transaksi database.
2. **Kondisi Semester Arsip**:
   - Pengarsipan semester aktif secara otomatis menghapus status aktif (`isActive = false`).
   - Semester yang diarsipkan dilarang diaktifkan kembali sebelum melalui proses pemulihan (unarchive).
   - Mata kuliah baru dilarang ditambahkan ke dalam semester yang sedang diarsipkan (`SEMESTER_ARCHIVED`).
3. **Integritas Kepemilikan Silang (Cross-Tenant Isolation)**:
   - Relasi mata kuliah ke semester menggunakan composite key `(semester_id, user_id) REFERENCES semesters(id, user_id)`.
   - Menjamin secara mutlak di level PostgreSQL bahwa pengguna A tidak dapat mengaitkan mata kuliah miliknya ke semester milik pengguna B, bahkan jika ID semester diketahui.
4. **Perlindungan Penghapusan Semester**:
   - Semester yang masih memiliki mata kuliah tidak dapat dihapus (`SEMESTER_HAS_COURSES`, HTTP 409). Pengguna diarahkan untuk mengarsipkan semester atau menghapus mata kuliah di dalamnya terlebih dahulu.
5. **Isolasi Database Pengujian (Test DB Guard)**:
   - Modul `apps/api/src/config/testDbGuard.ts` memvalidasi koneksi basis data pada environment test (`NODE_ENV === 'test'`).
   - Seluruh eksekusi test runner (Vitest) secara ketat dibatasi hanya dapat terhubung ke basis data dengan akhiran `_test` (`studyflow_test`). Eksekusi terhadap `studyflow_dev` atau basis data non-test ditolak seketika demi mencegah kontaminasi data pengembang.


