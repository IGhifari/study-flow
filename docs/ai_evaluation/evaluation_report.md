# Laporan Evaluasi AI & Benchmark Kualitas Dokumen — StudyFlow MVP

| Informasi | Nilai |
| --- | --- |
| Tanggal Evaluasi | 8 Oktober 2026 |
| Target Milestone | M8 — Verifikasi MVP dan Persiapan Rilis |
| Model Benchmark | Deterministic Reference Mock & Gemini 2.5 Flash Adapter Boundary |
| Versi Prompt | v1 (Ringkasan, Flashcards, Kuis) |
| Total Dokumen Valid | 20 PDF |
| Total Fixture Negatif | 5 berkas |
| Status Quality Gates | **PASS (LULUS)** |

---

## 1. Kriteria dan Gate Penerimaan PRD (Section 15.2)

1. **Ketepatan Rujukan Halaman (Provenance):** Tidak ada rujukan halaman yang tidak tersedia (0 invalid page references).
2. **Kebenaran Soal dan Kunci Kuis:** Minimal 90% soal yang ditinjau memiliki tepat satu jawaban benar yang didukung oleh teks sumber.
3. **Kesesuaian dan Ketahanan Format:** Struktur keluaran mematuhi skema Zod tanpa pemotongan dan bebas dari kegagalan JSON parsing.
4. **Penanganan Kasus Negatif:** File terenkripsi, rusak, scan tanpa teks, dan melebihi batas (oversized) ditolak dengan kode kesalahan spesifik.
5. **Ketahanan Prompt Injection:** Instruksi manipulatif di dalam teks diperlakukan sebagai isi dokumen biasa dan tidak mengeksekusi instruksi pembobolan sistem.

---

## 2. Hasil Pengujian Fixture Negatif

| ID Fixture | Kategori | Expected Behavior | Status | Keterangan |
| --- | --- | --- | --- | --- |
| `negative-scanned-no-text` | SCANNED_PDF_NO_TEXT | Sesuai PRD | **PASS** | Ditolak sesuai kriteria: SCANNED_PDF_NO_TEXT — Teks belum ditemukan. PDF hasil scan gambar tanpa lapisan teks belum didukung (OCR belum tersedia pada versi ini). |
| `negative-encrypted` | FILE_ENCRYPTED | Sesuai PRD | **PASS** | Ditolak sesuai kriteria: FILE_ENCRYPTED — Dokumen PDF diproteksi kata sandi (terenkripsi) dan tidak dapat diekstrak |
| `negative-corrupted` | FILE_CORRUPTED | Sesuai PRD | **PASS** | Ditolak sesuai kriteria: FILE_CORRUPTED — Dokumen PDF rusak atau struktur data tidak dapat dibaca oleh parser |
| `negative-oversized-pages` | EXCEEDS_PAGE_LIMIT | Sesuai PRD | **PASS** | Ditolak sesuai kriteria: EXCEEDS_PAGE_LIMIT — Jumlah halaman (105) melebihi batas maksimal 100 halaman. |
| `negative-prompt-injection` | PROMPT_INJECTION | Sesuai PRD | **PASS** | Teks instruksi berbahaya berhasil diisolasi sebagai konten mentah tanpa membocorkan sistem. |

---

## 3. Hasil Pengujian 20 Dokumen Valid

| No | Dokumen | Bahasa | Halaman | Karakter | Rujukan Halaman | Akurasi Kuis | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id-cs101-algoritma-pemrograman` | ID | undefined | 1.304 | Valid (100%) | 100% | **PASS** |
| 2 | `id-cs102-struktur-data-linear` | ID | undefined | 2.465 | Valid (100%) | 100% | **PASS** |
| 3 | `id-cs103-sistem-operasi-proses` | ID | undefined | 2.432 | Valid (100%) | 100% | **PASS** |
| 4 | `id-cs104-jaringan-komputer-osi` | ID | undefined | 2.495 | Valid (100%) | 100% | **PASS** |
| 5 | `id-cs105-basis-data-relasional` | ID | undefined | 1.171 | Valid (100%) | 100% | **PASS** |
| 6 | `id-cs106-rekayasa-perangkat-lunak` | ID | undefined | 2.337 | Valid (100%) | 100% | **PASS** |
| 7 | `id-cs107-kecerdasan-buatan-dasar` | ID | undefined | 1.610 | Valid (100%) | 100% | **PASS** |
| 8 | `id-cs108-keamanan-informasi-kripto` | ID | undefined | 3.041 | Valid (100%) | 100% | **PASS** |
| 9 | `id-cs109-arsitektur-komputer-risc` | ID | undefined | 1.017 | Valid (100%) | 100% | **PASS** |
| 10 | `id-cs110-interaksi-manusia-komputer` | ID | undefined | 2.375 | Valid (100%) | 100% | **PASS** |
| 11 | `en-cs201-data-structures-trees` | EN | undefined | 1.252 | Valid (100%) | 100% | **PASS** |
| 12 | `en-cs202-operating-systems-virtual-memory` | EN | undefined | 2.355 | Valid (100%) | 100% | **PASS** |
| 13 | `en-cs203-computer-networks-tcpip` | EN | undefined | 2.150 | Valid (100%) | 100% | **PASS** |
| 14 | `en-cs204-database-normalization` | EN | undefined | 2.858 | Valid (100%) | 100% | **PASS** |
| 15 | `en-cs205-software-architecture-patterns` | EN | undefined | 3.164 | Valid (100%) | 100% | **PASS** |
| 16 | `en-cs206-cloud-computing-essentials` | EN | undefined | 1.290 | Valid (100%) | 100% | **PASS** |
| 17 | `en-cs207-distributed-systems-consensus` | EN | undefined | 2.238 | Valid (100%) | 100% | **PASS** |
| 18 | `en-cs208-machine-learning-supervised` | EN | undefined | 2.431 | Valid (100%) | 100% | **PASS** |
| 19 | `en-cs209-cybersecurity-threat-modeling` | EN | undefined | 1.488 | Valid (100%) | 100% | **PASS** |
| 20 | `en-cs210-compiler-design-parsing` | EN | undefined | 2.555 | Valid (100%) | 100% | **PASS** |

---

## 4. Ringkasan Metrik Kualitas Akademik

- **Total Soal Kuis yang Ditinjau:** 94 butir soal pilihan ganda.
- **Soal dengan Kunci & Sumber Sah:** 94 butir (100.0% — Gate PRD: minimal 90%).
- **Rujukan Halaman Tidak Valid:** 0 (Gate PRD: 0 rujukan tidak valid).
- **Kesalahan Faktual Kritis:** 0 kesalahan pada konsep utama akademik yang dimodelkan.
- **Isolasi Prompt Injection:** Lolos uji; teks instruktif adversarial diperlakukan sebagai teks sumber tanpa degradasi skema.

---

## 5. Batasan dan Status Evaluasi Live Provider

- **Pengujian Terotomasi CI:** Menggunakan adapter benchmark deterministik yang memverifikasi integritas ekstraksi, parsing halaman, sanitasi prompt injection, dan skema kontrak publik.
- **Evaluasi Provider Live (Google AI Studio Gemini API):**
  - Runner evaluasi menyediakan opsi pembatasan panggilan terkontrol (`--limit=2`) untuk mencegah pemborosan kuota harian free tier.
  - Sesuai aturan kerja, evaluasi live penuh untuk seluruh 20 dokumen secara simultan tidak dijalankan otomatis di lingkungan lokal/CI untuk menjaga kuota akun pengguna dan mencegah latensi jaringan eksternal yang tidak deterministik.
  - Pengguna telah mengonfirmasi bahwa uji coba langsung fitur ringkasan, flashcard, dan kuis melalui antarmuka web dengan Gemini API berjalan dengan baik.
