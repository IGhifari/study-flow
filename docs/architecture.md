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
- Setiap query data pada tahap selanjutnya mewajibkan verifikasi pemilik (`userId`).
- Kredensial server dan token AI hanya diakses oleh proses backend/worker via environment variables tanpa prefix `NEXT_PUBLIC_`.
