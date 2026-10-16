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

#### 3.4.1 Identifikasi Klien dan Rate Limiting (Browser → BFF → Express API)

```
[Browser / Klien]
      │
      │ 1. Request (dengan header IP pengguna / spoofing potensial)
      ▼
[Next.js App Router BFF Proxy] (apps/web/src/app/api/auth/[...path]/route.ts)
      │
      ├─► Mode Default (TRUSTED_CLIENT_IP_HEADER unset / 'none'):
      │   TIDAK mempercayai header IP dari klien; forward 127.0.0.1.
      │   Seluruh pengguna berbagi bucket IP; perlindungan akun aktif.
      │
      ├─► Mode Reverse Proxy Terpercaya (TRUSTED_CLIENT_IP_HEADER='x-real-ip'):
      │   Hanya membaca satu header terkonfigurasi yang dijamin ditimpa oleh ingress.
      │   Header alternatif diabaikan. Validasi format IP ketat (IPv4/IPv6 via isIP()).
      │   Akses publik langsung ke origin port BFF wajib dibatasi firewall.
      ▼
[Express REST API] (apps/api)
      │
      ├─► Express trust proxy = 'loopback' (Hanya mempercayai loopback BFF 127.0.0.1/::1)
      ├─► IP Rate Limiter (authRateLimiter)
      ├─► Account Defense-in-Depth (loginAccountRateLimiter: hash SHA-256 email)
      └─► RedisRateLimitStore: Atomik via Lua Script (INCR + PEXPIRE seketika)
      │
      ▼ (Respons 429 jika melebihi batas)
[Next.js BFF Proxy]
      │
      └─► Meneruskan Retry-After dan header RateLimit-* utuh ke browser klien
```

1. **Model Kepercayaan Header Ingress**:
   - Secara default, BFF menolak mempercayai header IP yang dikirim peramban (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `Forwarded`).
   - Pada **Mode Default** (tanpa ingress terpercaya yang diverifikasi), identifikasi IP perorangan melalui BFF belum tersedia; seluruh request diteruskan dengan alamat loopback `127.0.0.1`. Perlindungan terhadap credential stuffing ditegakkan pada tingkat akun (`loginAccountRateLimiter`) menggunakan hash SHA-256 identifier yang dinormalisasi.
   - Pada **Mode Reverse Proxy Terpercaya**, sistem administrator mengonfigurasi variabel `TRUSTED_CLIENT_IP_HEADER` secara eksplisit (misal `x-real-ip` atau `cf-connecting-ip`). Ingress proxy (Nginx, Cloudflare, ALB) wajib dikonfigurasi untuk selalu menimpa header tersebut dari IP TCP koneksi nyata, dan akses langsung ke origin BFF dari internet harus diblokir oleh firewall. BFF mengabaikan seluruh header alternatif dan memvalidasi sintaks IPv4/IPv6 menggunakan `isIP()` sebelum meneruskannya ke backend.
2. **Pembatasan Trust Proxy Express**:
   - Express dikonfigurasi dengan `trust proxy = 'loopback'` secara default, sehingga hanya mempercayai `X-Forwarded-For` dari hop terdekat (BFF lokal). Koneksi langsung dari luar jaringan tidak dapat memalsukan identitas klien.
3. **Penyimpanan Terdistribusi & Atomisitas Lua**:
   - `RedisRateLimitStore` menggunakan evaluasi script Lua atomik (`INCR` + `PEXPIRE` saat `hits == 1` + `PTTL`).
   - Mencegah kebocoran kunci tanpa batas waktu (TTL) bila proses terhenti di tengah eksekusi, serta menjamin pembagian kuota yang presisi antarinstandi Express API.
4. **Passthrough Header Respons 429**:
   - BFF meneruskan header `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, dan `RateLimit-Reset` dari Express ke respons browser tanpa modifikasi.

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

### 3.6 Arsitektur Penyimpanan & Pemrosesan Dokumen (Milestone 5)

```
[Browser / Klien]
   │
   │ 1. POST /api/materials/initiate-upload (BFF Proxy)
   ▼
[Express API: materialRouter]
   │
   ├─► Verifikasi kuota: storageUsed < 200MB, dailyUploads < 10 (00:00 UTC reset)
   ├─► Verifikasi mata kuliah: ownership & status non-arsip
   ├─► Transaksi DB: Material (status: UPLOADING), StorageUsage (reservasi bytes)
   ├─► Generate signed upload URL via Supabase Storage
   ▼
[Browser / Klien]
   │
   │ 2. Direct PUT/POST file PDF ke Supabase Storage (Signed Upload URL)
   ▼
[Supabase Storage Private Bucket]
   │
   │ 3. POST /api/materials/finalize-upload (BFF Proxy)
   ▼
[Express API: materialRouter]
   │
   ├─► Verifikasi keberadaan file di Storage via metadata check
   ├─► Transaksi DB atomik:
   │     ├─ Update Material (status: QUEUED)
   │     ├─ Create ProcessingJob (status: PENDING, attempts: 0, maxAttempts: 3)
   │     └─ Insert OutboxEvent (eventType: DOCUMENT_PROCESSING_REQUESTED)
   ▼
[Outbox Dispatcher]
   │
   │ 4. Meneruskan event ke BullMQ Queue: studyflow-document-processing
   ▼
[Redis BullMQ]
   │
   │ 5. Worker polling / consume job
   ▼
[Worker: documentWorker (apps/worker)]
   │
   ├─► Cek status Material di database (idempotency & soft-delete check)
   ├─► Unduh buffer file dari private storage via service role adapter
   ├─► Validasi PDF: magic bytes (%PDF-), batas 20MB, batas 100 halaman
   ├─► Ekstraksi teks per halaman (1-indexed) menggunakan pdfjs-dist
   ├─► Deteksi file scan tanpa teks: tolak dengan kode SCANNED_PDF_NO_TEXT
   ├─► Simpan hasil per halaman (MaterialPage) dalam satu transaksi DB
   ├─► Update Material status menjadi READY dan commit pemakaian kuota storage
   └─► Bersihkan file sementara
```

#### Invarian Integritas Data Milestone 5:
1. **Pencegahan Upload Melewati BFF (Memory Protection)**:
   - File biner PDF diunggah langsung oleh browser ke Supabase Storage via signed URL terotorisasi.
   - Node.js runtime pada BFF Next.js dan Express API tidak menampung buffer file multi-megabyte dalam heap memory, mencegah degradasi latensi server.
2. **Rekonsiliasi Transaksional (Transactional Outbox Pattern)**:
   - Data status produk dan pengiriman pesan ke BullMQ diikat melalui tabel `outbox_events` dalam transaksi ACID PostgreSQL.
   - Dispatcher outbox menjamin pekerjaan tetap terkirim ke Redis meskipun terjadi restart server setelah transaksi database selesai.
3. **Idempotensi & Penanganan Retry Worker**:
   - Setiap job memiliki `idempotencyKey` yang stabil (`doc-extract-{materialId}-{activeJobId}`).
   - Kegagalan sementara (network/timeout) dicoba ulang otomatis maksimal 3 kali dengan exponential backoff.
   - Kegagalan validasi permanen (file rusak, file scan tanpa teks, password-encrypted) tidak di-retry dan langsung ditandai `FAILED` dengan kode kesalahan aman.
4. **Perlindungan Invarian Relasi & Penghapusan**:
   - Mata kuliah yang masih memiliki materi PDF aktif (`deletedAt: null`), tugas, atau catatan dilarang dihapus (`COURSE_HAS_MATERIALS` / `COURSE_HAS_ASSIGNMENTS` / `COURSE_HAS_NOTES`, HTTP 409). Apabila seluruh materi pada mata kuliah telah berstatus soft-delete (`deletedAt !== null`) dan tidak ada tugas maupun catatan tersisa, `DELETE /api/courses/:id` membersihkan permanen baris materi berstatus soft-delete tersebut lalu menghapus mata kuliah dalam satu transaksi terkunci (`FOR UPDATE`), sementara riwayat `ProcessingJob` tetap utuh (`onDelete: SetNull`).
   - Penghapusan materi PDF (`DELETE /api/materials/:id`) mengosongkan relasi `materialId` pada catatan terkait (`onDelete: SetNull`) tanpa menghapus catatan kuliah pengguna, serta menghapus entri sematan terkait pada `pinned_items` agar tidak menahan kuota pin pengguna.
   - Objek di storage dihapus dan kuota penyimpanan pengguna dikembalikan secara atomik. Jika materi dihapus saat sedang diproses (`UPLOADING`, `QUEUED`, `PROCESSING`), reservasi kuota segera dilepas dan worker membatalkan penulisan hasil.

#### 3.7.1 Arsitektur Driver Penyimpanan & Pemulihan Pipeline:
1. **Pemilihan Driver Eksplisit (`STORAGE_DRIVER`)**:
   - `local`: Menggunakan direktori filesystem bersama (`.storage/materials/`), memungkinkan API dan worker yang berjalan pada proses terpisah di mesin pengembang saling bertukar file tanpa konfigurasi pihak ketiga.
   - `supabase`: Menggunakan Supabase Storage dengan bucket privat (`studyflow-materials`). Mengharuskan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.
   - `memory`: Mock storage in-memory khusus pengujian hermetis (`vitest`).
   - `none`: Mode degradasi aman; upload/download mengembalikan `503 STORAGE_UNAVAILABLE` sementara entitas perkuliahan, tugas, dan catatan tetap beroperasi normal.
2. **Outbox Dispatcher Loop & Retry Hapus Berkas**:
   - API menjalankan loop periodik background (`startOutboxDispatcherLoop`) untuk mengirimkan event yang tertunda pasca-restart server.
   - Event `DOCUMENT_CLEANUP_REQUESTED` dijadwalkan ulang bila penghapusan file di storage gagal pada saat `DELETE /api/materials/:id`.
3. **Pembersihan Unggahan Terbengkalai (`sweepAbandonedUploads`)**:
   - Dokumen dalam status `UPLOADING` yang melebihi batas waktu 2 jam secara otomatis ditandai `FAILED` (`UPLOAD_ABANDONED`) dan kuota yang tereservasi dilepas.




