# StudyFlow — Panduan Kesiapan Deployment (M8)

Dokumen ini menyiapkan langkah rilis **MVP v1** berdasar arsitektur aktual di repositori. Proses, enumerasi environment, perintah build, migration, smoke test, backup/restore, rollback, dan batas layanan gratis tidak menunjuk penyedia hosting tertentu; verifikasi dokumen resmi dilakukan sebelum memilih.

> **Status**: PERSIAPAN. Deployment belum dilakukan. Hosting API, worker, Redis, database, dan domain belum dikonfirmasi.

---

## 1. Proses yang Harus Berjalan

| Proses | Perintah Build | Perintah Run | Kebutuhan |
| --- | --- | --- | --- |
| **Web (Next.js)** | `npm run build --workspace=@studyflow/web` | `npm run start --workspace=@studyflow/web` | Duplicate rejeki server (memori, env react-server) |
| **API (Express)** | `npm run build --workspace=@studyflow/api` | `npm run start --workspace=@studyflow/api` | PostgreSQL, Redis, Storage (Supabase), AI provider |
| **Worker (BullMQ)** | `npm run build --workspace=@studyflow/worker` | `npm run start --workspace=@studyflow/worker` | Redis, PostgreSQL, Storage, AI provider |

**Catatan kritis**:
- Worker **TIDAK boleh** dijalankan di penyedia serverless (function) karena memerlukan proses berkelanjutan yang memakai Redis streams dan retry.
- Sekurangnya **satu instance worker** harus aktif untuk konsumsi antrean dokumen & AI.
- Grafana/Loki, Prometheus, Axiom, atau alat observabilas sejenis **belum** terkunci.

Semua proses memakai satu repo dan satu lockfile (`package-lock.json`).

---

## 2. Kebutuhan Dependensi

| Layanan | Peran | Syarat |
| --- | --- | --- |
| **PostgreSQL (v16)** | Penyimpanan relasional utama (user, semester, materi, job, hasil AI) | Harus bersifat persisten; ptimal diekspos via managed service atau container dengan volume |
| **Redis (v7)** | Antrean BullMQ (`studyflow-document-processing`, `studyflow-ai-generation`, `studyflow-smoke-queue`) | Harus bersifat persisten untuk job yang sedang berjalan; tidak boleh tanpa mitigasi kehilangan data |
| **Supabase Storage** | Bucket privat `studyflow-materials` untuk file PDF | **Wajib bucket privat**; service role key hanya untuk server |

**Ketergantungan AI**: Generasi ringkasan/flashcard/kuis membutuhkan provider Gemini AI (`AI_PROVIDER=gemini`, `GEMINI_API_KEY`). Jika tersedia kuota free tier Google AI Studio, tetap wajib memastikan project tidak mengaktifkan billing.

---

## 3. Variabel Environment per Proses

### 3.1 Umum (dibaca API & Worker)
Tidak ada secret dicetak; berikut hanya NAMA variabel.

| Proses | Variabel |
| --- | --- |
| API | `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN_DAYS`, `STORAGE_DRIVER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `STORAGE_SIGNED_URL_EXPIRES_IN`, `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `PORT`, `NODE_ENV` |
| Worker | `DATABASE_URL`, `REDIS_URL`, `STORAGE_DRIVER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_CALLS_PER_MINUTE`, `AI_MAX_CALLS_PER_JOB`, `NODE_ENV` |
| Web (Next.js) | `NEXT_PUBLIC_API_URL` (URL API untuk browser), `INTERNAL_API_URL` (URL API untuk SSR), `NODE_ENV` |

> **Keamanan**: JANGAN commit nilai secret. Gunakan `.env` per server atau secret manager. Nama variabel mengikuti `apps/api/.env.example`, `apps/worker/.env.example`, `apps/web/.env.example`.

### 3.2 Pengaturan Kunci

| Variabel | Nilai contoh (development) | Catatan |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5433/studyflow_dev?schema=public` | Gunakan kredensial khusus pada produksi, jangan `studyflow_dev_password` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `COOKIE_SECRET` | minimal 32 karakter acak | Buruh restart jika berpindah environment |
| `CORS_ORIGIN` | `https://studyflow.example.com` | Origin frontend untuk CSRF/Origin check |
| `STORAGE_DRIVER` | `supabase` (produksi) / `local` (dev) | `memory`/`none` hanya untuk test/maint |
| `AI_PROVIDER` | `gemini` / `mock` / `none` | `mock` hanya untuk test CI |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model aktif proyek ini; pertahankan konfigurasi |
| `AI_CALLS_PER_MINUTE` | `15` | Sesuaikan dengan kuota project |
| `AI_MAX_CALLS_PER_JOB` | `8` | Batas panggilan per job |

---

## 4. Build, Start, Migration, Probes

### Build seluruh monorepo
```bash
npm run build                        # build shared -> db -> api -> worker -> web
```

### Migration production
```bash
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```
Jalankan sebelum `npm start` pada API/worker; melakukan di lingkungan target.

### Health/Ready probe
- **Liveness**: `GET /health` — HTTP 200 bila proses hidup.
- **Readiness**: `GET /ready` — memeriksa PostgreSQL dan Redis; HTTP 200 bila siap, 503 bila tidak (timeout 2 dtk).
- Konfigurasi container orchestrator: liveness `GET /health`, readiness `GET /ready`, interval 10s, timeout 5s.

### Graceful shutdown
API `apps/api/src/server.ts` menangkap `SIGTERM`/`SIGINT`:
- Menutup HTTP server, melepas `prisma`, Redis, dan antrean.
- Force-exit setelah 10s jika timeout.

Worker `apps/worker/src/worker.ts` perlu menangani `SIGTERM` agar job yang sedang diproses tidak hilang (lihat Section 5).

---

## 5. Operasi: Backup, Restore, Pemulihan Job, Rollback

### 5.1 Backup database
```bash
# PostgreSQL
pg_dump -U studyflow_user -d studyflow_dev -h localhost -p 5433 -F c -f studyflow-dev.dump
# Atau versi managed service (dump via dashboard/CLI)
```

### 5.2 Restore database
```bash
# PostgreSQL
createdb -U studyflow_user -h localhost -p 5433 studyflow_dev_restored
pg_restore -U studyflow_user -h localhost -p 5433 -d studyflow_dev_restored studyflow-dev.dump
```

### 5.3 Pemulihan job/queue
- Semua status job tersimpan di PostgreSQL (`processing_jobs`).
- Bila Redis hilang tetapi PostgreSQL masih utuh: **outbox dispatcher** (`startOutboxDispatcherLoop`) akan mengirim ulang event yang belum mencapai antrean.
- Worker memakai **idempotency key** sehingga job yang terkirim ganda tidak menciptakan duplikat.
- Bila perlu memicu ulang manual, enqueue melalui outbox (bukan langsung ke BullMQ) untuk konsistensi.

### 5.4 Rollback aplikasi
1. Ambil backup DB (lihat §5.1).
2. Deploy versi sebelumnya pada seluruh proses (web, api, worker).
3. Jalankan migration mundur `npx prisma migrate resolve` sesuai dokumentasi Prisma (atau perbaiki schema langsung hanya bila benar-benar perlu dan terdokumentasi).
4. Pantau `/ready` dan health; verifikasi alur login/upload/quiz.

---

## 6. Konfigurasi Domain, Proxy, Cookie, Refresh, Origin/CSRF

| Area | Kebutuhan yang Harus Diuji |
| --- | --- |
| **Domain** | Pastikan `CORS_ORIGIN` sama dengan origin browser yang dipakai |
| **Proxy/Reverse** | Web (`:3000`), API (`:4000`) — proxy meneruskan `Set-Cookie`, `Origin/Referer` sesuai |
| **Cookie** | `SameSite=Lax`, `HttpOnly`, `Secure` di production; refresh token disimpan di DB sebagai hash |
| **Refresh** | Alur `POST /api/auth/refresh` harus berhasil pada deployment domain (replay protection aktif) |
| **Origin/CSRF** | Semua mutasi memvalidasi `Origin` dan `Referer` sesuai `CORS_ORIGIN`; diuji pada deployment |
| **Browser connection** | Test login/register, logout, hapus materi, upload, quiz pada domain final — tidak pakai localhost |

---

## 7. Batas Layanan Gratis yang Perlu Diperiksa (Bukan Rekomendasi)

Saat memilih hosting, verifikasi dokumen resmi penyedia:

| Kebutuhan | Yang Harus Diperiksa |
| --- | --- |
| **Worker persisten** | Mendukung proses Node/container yang terus berjalan (bukan function/serverless timeout) |
| **Koneksi Redis** | Latency dan akses dari server/worker (mungkin memerlukan Redis berbayar/managed) |
| **PostgreSQL** | Ketersediaan dan konektivitas persistens (possibly managed) |
| **Supabase free tier** | Limit storage & request; private bucket tetap gratis; cek akses service role |
| **Google AI Studio free tier** | Kuota per menit/hari; free tier Tidak menjamin tanpa henti |

Angka kuota aplikasi PRD (200MB storage, 10 upload/hari, 20 generasi/hari, 2 job aktif) adalah batas produk, bukan klaim yang sumbu bagi kapasitas provider.

---

## 8. Ringkasan Blocker/Keputusan Sebelum Rilis

| Item | Status | Yang Diperlukan |
| --- | --- | --- |
| Hosting API/Worker/Redis | **BELUM DIPILIH** | Verifikasi dukungan process/container persistens, koneksi Redis |
| Domain & TLS | **BELUM DIPILIH** | Nama domain final; sertifikat; CDN opsional |
| Supabase produksi | **BELUM DIKONFIRMASI** | Project real, bucket privat, ekspor service role key |
| Google AI API key produksi | **TIDAK MITIGASI** | Dependency pada kuota free tier |
| Backup/pemulihan | **BELUM DIUJI** | Jalankan satu uji restore sebelum beta |
| Smoke test deployment | **BELUM DIJALANKAN** | Setelah hosting dipilih |

>Satu catatan kehati-hatian: Ketergantungan pada kuota AI free tier berarti **MVP tidak dapat dianggap "release" secara penuh** sampai deployment di domain sebenarnya berhasil ditest dan smoke test diterima.

---

## 9. Panduan Setelah Hosting Dikonfirmasi

1. Pilih provider dengan dukungan proses/container persisten (mis. host VPS, Platform-as-a-Service dengan worker, atau control plane Kubernetes).
2. Siapkan secret manager/server env sesuai §3.
3. Jalankan `npm run build`, `npx prisma migrate deploy`, start semua proses.
4. Uji `/health`, `/ready`, lalu smoke test auth + upload + quiz pada domain.
5. Simpan hasil smoke di `docs/evaluation/`.