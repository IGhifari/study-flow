# Laporan Evaluasi AI & Benchmark Kualitas Dokumen — StudyFlow

| Metadata Evaluasi | Nilai |
| --- | --- |
| **Waktu Eksekusi** | 2026-10-10T06:03:48.270Z |
| **Node.js Runtime** | v22.17.0 |
| **Versi Kode (Git)** | `3572454` |
| **Mode Evaluasi** | `MOCK` |
| **Provider AI** | `MockAiProviderAdapter (Deterministik)` |
| **Model AI** | `reference-mock-v1` |
| **Versi Prompt** | `v1 (Summary, Flashcard, Quiz)` |
| **Panggilan Provider Dibuat** | 9 (Batas budget: 1000) |
| **Sampel Dokumen Valid Diproses** | 3 dari 20 berkas |
| **Fixture Negatif Diproses** | 0 dari 5 berkas |
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


> **Catatan Audit Fixture Terenkripsi**: Fixture simulasi berbasis teks biasa (seperti `neg-02-encrypted-sim.pdf`) tidak memiliki dictionary `/Encrypt` PDF dan tidak membuktikan penolakan enkripsi oleh parser. Penolakan hanya terbukti sah pada berkas dengan struktur keamanan terenkripsi aktif (`negative-encrypted.pdf`) yang ditolak dengan kode `FILE_ENCRYPTED`.

---

## 3. Hasil Evaluasi Dokumen Valid (3 Dokumen Diproses)

| No | ID Dokumen | Bahasa | Hlm | Ekstraksi | Rujukan Hlm | Skema Zod | Struktur Kuis | Akurasi Faktual | Status |
| :-: | --- | :-: | :-: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `id-cs101-algoritma-pemrograman` | ID | 2 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 2 | `id-cs102-struktur-data-linear` | ID | 6 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |
| 3 | `id-cs103-sistem-operasi-proses` | ID | 4 | **PASS** | **PASS** | **PASS** | **PASS** | *NOT_EVALUATED* | **PASS** |

---

## 4. Ringkasan Metrik & Quality Gates PRD

- **Dokumen Valid Lulus Uji Struktur & Skema:** 3/3 (100.0%)
- **Evaluasi Fixture Negatif & Keamanan:** 5/5 fixture sesuai ekspektasi
  - 4 fixture ditolak sesuai error yang diharapkan (SCANNED_PDF_NO_TEXT, FILE_ENCRYPTED, FILE_CORRUPTED, EXCEEDS_PAGE_LIMIT).
  - 1 fixture prompt injection berhasil diekstrak (teks berbahaya terbaca tanpa menyebabkan crash parser).
- **Ketahanan Model Terhadap Prompt Injection:** **NOT_EVALUATED** (Mode mock tidak mengeksekusi prompt LLM; ketahanan perilaku model memerlukan pengujian adversarial live)
- **Total Butir Soal Kuis Diuji Strukturnya:** 14 butir
- **Soal Kuis dengan Format Struktur Valid (4 opsi unik, indeks 0..3):** 14 butir (100.0%)
- **Rujukan Halaman di Luar Batas (Invalid Page References):** 0 rujukan (Gate PRD: tepat 0 rujukan)
- **Kriteria yang Belum Dinilai (NOT_EVALUATED):** 6 kriteria
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

---

## 6. Pernyataan Pertanggungjawaban & Batasan

1. **Koreksi Terhadap Laporan Masa Lalu**:
   Laporan evaluasi sebelumnya menyatakan akurasi kuis 100% dan penolakan prompt injection berhasil, namun hasil tersebut hanya mencerminkan pengujian struktur keluaran template mock dan penemuan teks serangan pada ekstraksi. Laporan saat ini memisahkan secara tegas antara keabsahan format sintaksis (Layer 2) dan kebenaran faktual materi (Layer 3).
2. **Kondisi Pengujian Live**:
   Pengujian live provider (`--provider=gemini`) memerlukan konfigurasi kunci API dan dibatasi secara ketat oleh pembatas kuota `BudgetTrackedAdapter` guna mencegah pembengkakan biaya.
