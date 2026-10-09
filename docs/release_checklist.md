# StudyFlow — Release Checklist (Milestone 8)

| Item | Kategori | Deskripsi | Status |
| :--- | :--- | :--- | :--- |
| **01** | Auth & BFF | Registrasi, login, refresh token atomik, rotasi session cookie, pencabutan sesi saat ganti password | **PASS** |
| **02** | Organisasi | Semester aktif tunggal, mata kuliah, pengarsipan, pencegahan hapus relasi silang | **PASS** |
| **03** | Tugas | CRUD, deadline timezone-aware UTC, filter prioritas/status, status `OVERDUE` turunan | **PASS** |
| **04** | Storage PDF | Upload privat via signed URL, batas 20MB & 100 halaman, validasi magic bytes, tolak PDF scan tanpa teks | **PASS** |
| **05** | Background Worker | Antrean BullMQ, outbox event pattern, idempotency key, retry terbatas, penanganan soft-delete saat generate | **PASS** |
| **06** | Ringkasan AI | Model Gemini API free tier, kutipan nomor halaman valid, mitigasi prompt injection, kuota harian atomik | **PASS** |
| **07** | Flashcards & Kuis | Generasi latihan interaktif, penyimpanan jawaban sementara (draft) sebelum submit, skor di backend, kunci tidak bocor | **PASS** |
| **08** | E2E & Tests | Rangkaian pengujian API lulus, tes bff auth lulus, worker smoke test lulus | **PASS** |
| **09** | AI Dataset | 20 PDF valid + 5 fixture negatif teruji secara struktural | **PASS** |
| **10** | Deployment Prep | Panduan arsitektur, environment per proses, migration, backup/restore, rollback, dan health/ready probe | **PASS** |
| **11** | Demo Data | Script seed demo independen (`scripts/seed-demo.mjs`) tanpa mengganggu akun nyata | **PASS** |
| **12** | Domain Deployment | Smoke test autentikasi dan kuota pada domain produksi | **NOT RUN** (Menunggu pilihan hosting) |

---

## Batasan MVP (MVP Limitations)
1. **Format Dokumen**: Hanya mendukung PDF berbasis teks. PDF hasil scan gambar (tanpa lapisan teks/OCR) ditolak dengan kode `SCANNED_PDF_NO_TEXT`.
2. **Ketergantungan AI**: Memerlukan koneksi aktif ke Google AI Studio Gemini API dan kuota harian free tier (20 permintaan/hari). Sistem tidak menyediakan fallback berbayar otomatis.
3. **Kolaborasi**: MVP dirancang murni sebagai ruang belajar pribadi (`USER`). Fitur kolaborasi kelas, multi-user workspace, dan peran dosen berada pada tahap v1.1+.
4. **Realtime**: Pembaruan status menggunakan polling otomatis (bukan Socket.io real-time WebSocket). Socket.io dan reminder terjadwal dijadwalkan pada M10.
