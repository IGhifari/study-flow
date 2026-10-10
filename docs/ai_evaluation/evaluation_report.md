# Laporan Evaluasi AI & Benchmark Kualitas Dokumen — StudyFlow

| Metadata Evaluasi | Nilai |
| --- | --- |
| **Waktu Eksekusi** | 2026-10-10T03:33:09.482Z |
| **Node.js Runtime** | v22.17.0 |
| **Versi Kode (Git)** | `53b1cdb` |
| **Mode Evaluasi** | `MOCK` |
| **Provider AI** | `MockAiProviderAdapter (Deterministik)` |
| **Model AI** | `reference-mock-v1` |
| **Versi Prompt** | `v1 (Summary, Flashcard, Quiz)` |
| **Panggilan Provider Dibuat** | 60 (Batas budget: 1000) |
| **Sampel Dokumen Valid Diproses** | 20 dari 20 berkas |
| **Fixture Negatif Diproses** | 5 dari 5 berkas |
| **Status Keseluruhan** | **PASS (MOCK STRUCTURAL & INTEGRATION ONLY)** |

---

## 1. Pemisahan Tiga Lapisan Evaluasi

Sesuai instruksi PRD Bagian 15.2, evaluasi sistem dibagi menjadi 3 lapisan independen:

1. **Lapisan 1: Validasi Dokumen & Ekstraksi**
   Memverifikasi magic bytes (`%PDF-`), integritas struktur berkas, ekstraksi teks riil per halaman menggunakan `pdfjs-dist`, serta penolakan deterministik berkas negatif (scan tanpa teks, berkas rusak, berkas terenkripsi kata sandi, dan berkas melebihi 100 halaman).
2. **Lapisan 2: Integrasi & Validitas Struktur Output AI**
   Memverifikasi keluaran model terhadap skema kontrak Zod publik aplikasi (`SummaryStructuredOutputSchema`, `FlashcardSetStructuredOutputSchema`, `QuizStructuredOutputSchema`), validitas batas provenance (`1 <= pageReference <= totalPages`), ketiadaan duplikasi opsi kuis, serta keabsahan indeks jawaban (`0..3`).
   > *Peringatan Integritas*: Kelulusan lapisan struktur format kuis **TIDAK SAMA** dengan akurasi kebenaran faktual materi.
3. **Lapisan 3: Kualitas Faktual & Penilaian Manual**
   Verifikasi kesesuaian klaim ringkasan, relevansi kartu latihan, dan kebenaran kunci jawaban kuis terhadap teks sumber nyata.
   > *Status Mode Mock*: Seluruh kriteria Layer 3 berstatus **`NOT_EVALUATED`** pada mode mock. Keberhasilan mock tidak pernah dijadikan klaim akurasi faktual provider nyata.

---

## 2. Hasil Evaluasi Fixture Negatif (Lapisan 1)

| ID Fixture | Kategori | Perilaku yang Diharapkan | Status | Keterangan Hasil |
| --- | --- | --- | :---: | --- |
| `negative-scanned-no-text` | SCANNED_PDF_NO_TEXT | SCANNED_PDF_NO_TEXT | **PASS** | Ditolak sesuai kriteria: SCANNED_PDF_NO_TEXT — Teks belum ditemukan. PDF hasil scan gambar tanpa lapisan teks belum didukung (OCR belum tersedia pada versi ini). |
| `negative-encrypted` | FILE_ENCRYPTED | FILE_ENCRYPTED | **PASS** | Ditolak sesuai kriteria: FILE_ENCRYPTED — Dokumen PDF diproteksi kata sandi (terenkripsi) dan tidak dapat diekstrak |
| `negative-corrupted` | FILE_CORRUPTED | FILE_CORRUPTED | **PASS** | Ditolak sesuai kriteria: FILE_CORRUPTED — Dokumen PDF rusak atau struktur data tidak dapat dibaca oleh parser |
| `negative-oversized-pages` | EXCEEDS_PAGE_LIMIT | EXCEEDS_PAGE_LIMIT | **PASS** | Ditolak sesuai kriteria: EXCEEDS_PAGE_LIMIT — Jumlah halaman (105) melebihi batas maksimal 100 halaman. |
| `negative-prompt-injection` | PROMPT_INJECTION | Sesuai PRD | **PASS** | Teks instruksi berbahaya diekstrak sebagai konten mentah biasa tanpa menyebabkan parser crash. (Catatan: Ketahanan model terhadap instruksi dievaluasi pada Layer 2/3). |

> **Catatan Audit Fixture Terenkripsi**: Fixture simulasi berbasis teks biasa (seperti `neg-02-encrypted-sim.pdf`) tidak memiliki dictionary `/Encrypt` PDF dan tidak membuktikan penolakan enkripsi oleh parser. Penolakan hanya terbukti sah pada berkas dengan struktur keamanan terenkripsi aktif (`negative-encrypted.pdf`) yang ditolak dengan kode `FILE_ENCRYPTED`.

---

## 3. Hasil Evaluasi Dokumen Valid (20 Dokumen Diproses)

| No | ID Dokumen | Bahasa | Hlm | Ekstraksi | Rujukan Hlm | Skema Zod | Struktur Kuis | Akurasi Faktual | Status |
| :-: | --- | :-: | :-: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `id-cs101-algoritma-pemrograman` | ID | 2 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 2 | `id-cs102-struktur-data-linear` | ID | 6 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 3 | `id-cs103-sistem-operasi-proses` | ID | 4 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 4 | `id-cs104-jaringan-komputer-osi` | ID | 3 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 5 | `id-cs105-basis-data-relasional` | ID | 2 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 6 | `id-cs106-rekayasa-perangkat-lunak` | ID | 5 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 7 | `id-cs107-kecerdasan-buatan-dasar` | ID | 3 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 8 | `id-cs108-keamanan-informasi-kripto` | ID | 4 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 9 | `id-cs109-arsitektur-komputer-risc` | ID | 2 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 10 | `id-cs110-interaksi-manusia-komputer` | ID | 5 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 11 | `en-cs201-data-structures-trees` | EN | 2 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 12 | `en-cs202-operating-systems-virtual-memory` | EN | 5 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 13 | `en-cs203-computer-networks-tcpip` | EN | 4 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 14 | `en-cs204-database-normalization` | EN | 3 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 15 | `en-cs205-software-architecture-patterns` | EN | 6 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 16 | `en-cs206-cloud-computing-essentials` | EN | 2 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 17 | `en-cs207-distributed-systems-consensus` | EN | 4 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 18 | `en-cs208-machine-learning-supervised` | EN | 3 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 19 | `en-cs209-cybersecurity-threat-modeling` | EN | 2 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 20 | `en-cs210-compiler-design-parsing` | EN | 5 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |

---

## 4. Ringkasan Metrik & Quality Gates PRD

- **Dokumen Valid Lulus Uji Struktur & Skema:** 20/20 (100.0%)
- **Fixture Negatif Ditangani Sesuai Spesifikasi:** 5/5
- **Total Butir Soal Kuis Diuji Strukturnya:** 94 butir
- **Soal Kuis dengan Format Struktur Valid (4 opsi unik, indeks 0..3):** 94 butir (100.0%)
- **Rujukan Halaman di Luar Batas (Invalid Page References):** 0 rujukan (Gate PRD: tepat 0 rujukan)
- **Kriteria yang Belum Dinilai (NOT_EVALUATED):** 40 kriteria
  - Akurasi faktual kunci jawaban kuis: **NOT_EVALUATED** (mewajibkan review manual terhadap sumber)
  - Kesetiaan ringkasan materi terhadap sumber: **NOT_EVALUATED**
  - Ketahanan perilaku model terhadap prompt injection: **NOT_EVALUATED** (Mock adapter tidak mengeksekusi prompt LLM)

---

## 5. Format Audit & Lembar Penilaian Manual (Lapisan 3)

Berikut adalah sampel butir keluaran konkret beserta cuplikan teks sumber dari halaman yang dirujuk untuk keperluan audit manual manusia:

| ID Dokumen | Jenis | Nomor Soal / Kartu | Pertanyaan / Konsep | Halaman Rujukan | Cuplikan Teks Sumber | Status Review |
| --- | :-: | :-: | --- | :-: | --- | :---: |
| `id-cs101-algoritma-pemrograman` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Dasar Algoritma dan Pemrograman Kompu..." | **NOT_EVALUATED** |
| `id-cs102-struktur-data-linear` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Struktur Data Linear: Array, List, St..." | **NOT_EVALUATED** |
| `id-cs103-sistem-operasi-proses` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Manajemen Proses dan Penjadwalan CPU..." | **NOT_EVALUATED** |
| `id-cs104-jaringan-komputer-osi` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Model Referensi OSI 7 Lapisan dan Pro..." | **NOT_EVALUATED** |
| `id-cs105-basis-data-relasional` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Pengantar Basis Data Relasional dan S..." | **NOT_EVALUATED** |
| `id-cs106-rekayasa-perangkat-lunak` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Prinsip Rekayasa Perangkat Lunak dan ..." | **NOT_EVALUATED** |
| `id-cs107-kecerdasan-buatan-dasar` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Pengantar Kecerdasan Buatan dan Repre..." | **NOT_EVALUATED** |
| `id-cs108-keamanan-informasi-kripto` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Kriptografi dan Keamanan Informasi..." | **NOT_EVALUATED** |
| `id-cs109-arsitektur-komputer-risc` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Arsitektur Komputer: Perbandingan RIS..." | **NOT_EVALUATED** |
| `id-cs110-interaksi-manusia-komputer` | quiz | #1 | Soal 1: Berdasarkan materi pada halaman 1, manakah pernyataa... | Hlm 1 | "Halaman 1 dari dokumen Interaksi Manusia dan Komputer: Prins..." | **NOT_EVALUATED** |

---

## 6. Pernyataan Pertanggungjawaban & Batasan

1. **Koreksi Terhadap Laporan Masa Lalu**:
   Laporan evaluasi sebelumnya menyatakan akurasi kuis 100% dan penolakan prompt injection berhasil, namun hasil tersebut hanya mencerminkan pengujian struktur keluaran template mock dan penemuan teks serangan pada ekstraksi. Laporan saat ini memisahkan secara tegas antara keabsahan format sintaksis (Layer 2) dan kebenaran faktual materi (Layer 3).
2. **Kondisi Pengujian Live**:
   Pengujian live provider (`--provider=gemini`) memerlukan konfigurasi kunci API dan dibatasi secara ketat oleh pembatas kuota `BudgetTrackedAdapter` guna mencegah pembengkakan biaya.
