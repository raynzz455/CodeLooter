# CodeLooter — Product Requirements Document (PRD)

## 1. Overview

CodeLooter adalah aplikasi web untuk mengekstrak kode dari dokumen praktikum, paper, dan modul akademik secara presisi. User upload file (PDF/DOCX/MD/IPYNB/TXT), aplikasi mengembalikan setiap code block yang ada di dalamnya, lengkap dengan bahasa yang dipilih user. User yang login dapat menyimpan hasil ekstraksi dan mengunduh ulang sebagai file kode.

## 2. Problem Statement

Mahasiswa dan dosen perlu mengambil kode dari modul praktikum yang sering kali berupa PDF. Saat ini, proses ini dilakukan manual: copy-paste baris per baris dari PDF, yang memakan waktu dan rentan error (karakter rusak, line-wrap, formatting hilang).

Tidak ada tools existing yang presisi untuk:
- Modul berbahasa Indonesia (komentar campur Indonesia + Inggris)
- Kode R yang ditulis di Word dengan font non-monospace (Times New Roman)
- Modul dengan kode terpecah-pecah (dipisah narasi, tabel, rumus matematika)
- Kode yang bercampur dengan R console output (`## ...`)

## 3. Target Users

| User | Use Case | Frekuensi |
|------|----------|-----------|
| Mahasiswa statistika | Ambil kode R dari modul praktikum | Mingguan |
| Mahasiswa teknik informatika | Ambil kode Python/Java/C++ dari modul | Mingguan |
| Dosen | Ambil kode dari paper/jurnal untuk referensi | Bulanan |
| Peneliti | Ekstrak kode dari paper untuk replikasi | Bulanan |

## 4. Goals

### Goal Utama: Presisi Ekstraksi

User upload file PDF modul praktikum → aplikasi mengembalikan SEMUA kode yang ada di dalam file, utuh per blok, tanpa kode terpotong, tanpa narasi ikut masuk, tanpa R console output bercampur.

**Metric**: >= 90% recall (90% baris kode di file ter-extract) dan >= 95% precision (95% baris yang di-extract adalah kode asli, bukan narasi).

### Goal Sekunder: User Experience

1. User pilih bahasa kode di awal (R, Python, SQL, dll.) — tidak perlu auto-detect yang error-prone
2. Hasil ekstraksi bisa di-download sebagai 1 file utuh (mis. `.R` untuk modul R)
3. User login bisa simpan hasil ke akun, akses kapan saja
4. File asli tidak disimpan di server — hanya nama file + text kode

### Goal Tersier: Performance

1. Ekstraksi < 5 detik untuk file < 5MB
2. Tidak ada LLM/API call eksternal (zero token cost, zero dependency)
3. Bisa di-deploy di Vercel (FE) + Render (BE) + Supabase (DB) — total $0 untuk free tier

## 5. Current Architecture

```
+-------------------+        +-------------------+        +-------------------+
|   FRONTEND        |        |   BACKEND         |        |   DATABASE        |
|   Next.js 16      | HTTPS  |   FastAPI Python  |        |   Supabase        |
|   React 19        | ------>|   + pattern_extract| ----->|   PostgreSQL      |
|   TypeScript      | Bearer |                   |        |   + RLS           |
|                   |  JWT   |   Extract:        |        |                   |
|   Vercel          |        |   1. PyMuPDF text  |        |   Supabase hosted|
+-------------------+        |   2. Pattern match |        +-------------------+
                             |   3. Marker split   |
                             |   4. Scan fallback  |
                             |   5. Merge          |
                             |   + OCR fallback    |
                             |   (Tesseract)       |
                             +-------------------+
```

## 6. Sistematik Kekurangan Saat Ini (Jujur dan Mendetail)

### 6.1. Ekstraksi Kode Tidak Presisi

**Kenyataan saat ini**: Ekstraksi masih kurang presisi. Berikut analisis mendetail per masalah:

#### 6.1.1. Kode Terpotong Menjadi Blok-Blok Kecil

**Masalah**: Kode yang seharusnya 1 blok utuh (mis. `library(lmtest)` + 6 baris variable + `summary(vp)`) terpotong jadi 2-3 blok terpisah karena ada 1 baris narasi di tengah.

**Penyebab**: Pattern-based extraction pakai marker (`# Kasus N`, `Kode Penyelesaian:`) sebagai pembatas. Kalau ada narasi di antara kode yang tidak punya marker, kode terpotong.

**Contoh nyata di MODUL 3_MEDSTAT2.pdf**:
```
data_penilaian <- data.frame(...)   ← Block #2 (5 lines)
print(data_penilaian)               ← Block #2
                                    ← BARIS NARASI (Interpretasi)
cor.test(...)                       ← Block #5 (7 lines, terpisah)
```

Seharusnya: `data.frame` + `print` + `cor.test` = 1 blok utuh.

**Dampak**: User harus manual gabungkan blok-blok setelah download.

#### 6.1.2. Narasi Ikut Terekstrak Sebagai Kode

**Masalah**: Baris narasi yang mengandung karakter kode-like (mis. `X-squared = 2.2222 menunjukkan bahwa...`) ikut masuk ke blok kode.

**Penyebab**: `is_code_line()` terlalu longgar. Baris dengan `=` dan angka dianggap kode padahal itu kalimat interpretasi.

**Contoh nyata**:
```
Block #4 (false positive):
X-squared = 2.2222 menunjukkan bahwa penyimpangan antara data aktual
dan data yang diharapkan relatif kecil, dan Karena p-value = 0.136 > 0.05
```

**Dampak**: User dapat kode yang bercampur narasi.

#### 6.1.3. Kode Hilang (False Negative)

**Masalah**: Beberapa baris kode tidak ter-extract karena tidak cocok dengan pattern manapun.

**Penyebab**: `is_code_line()` terlalu ketat untuk baris seperti `volume_penjualan <- c(45000, ...)` yang tidak punya keyword R khas (hanya assignment `<-`).

**Dampak**: Kode tidak lengkap. User harus cek manual file asli.

#### 6.1.4. Line-Wrap PDF Merusak Kode

**Masalah**: PDF sering memotong baris panjang di tengah. Contoh: `biaya_promosi <- c(1500000, ..., 170` dipotong, lalu baris berikutnya `0000, 2200000)`. Hasilnya kode rusak.

**Penyebab**: Tidak ada logic untuk detect dan repair line-wrap di pattern extraction. Ada logic `repair_line_wraps` di sidecar lama, tapi pattern_extract.py tidak pakai.

**Dampak**: Kode tidak bisa di-run langsung karena variabel rusak.

#### 6.1.5. R Console Output Bercampur

**Masalah**: Baris `##` (R console output) kadang masih masuk ke blok kode, kadang tidak.

**Penyebab**: Logic `is_r_output()` ada tapi tidak konsisten. Kadang `##` di-include sebagai "soft" baris, kadang di-skip.

**Dampak**: Kode bercampur dengan output, tidak bisa di-run langsung.

### 6.2. Language Detection Tidak Reliable

**Masalah**: Auto-detect bahasa sering salah. R dengan `print()` dikenali sebagai Python. Python dengan `<-` (typo) dikenali sebagai R.

**Penyebab**: Pattern matching manual (`<-` = R, `print(` = Python) tidak reliable. `print()` ada di R dan Python. `<-` bisa muncul di Python (arrow library).

**Status saat ini**: User bisa pilih bahasa manual (default: R). Tapi `auto` mode masih buruk.

### 6.3. UI/UX Tidak Intuitif

#### 6.3.1. Panel "PILIH BAHASA" di Kiri Tidak Jelas Fungsinya

**Masalah**: User bingung — apakah pilih bahasa di kiri untuk filter preview atau untuk tentukan bahasa ekstraksi?

**Penyebab**: Panel kiri awalnya untuk filter preview hasil (pilih bahasa mana yang ditampilkan). Sekarang juga dipakai untuk tentukan bahasa ekstraksi. Dua fungsi dalam 1 UI = confusing.

#### 6.3.2. Tidak Ada Progress Indicator untuk OCR

**Masalah**: OCR butuh 60+ detik. User lihat "SEDANG MENGEKSTRAK..." tanpa progress.

**Dampak**: User pikir aplikasi hang.

#### 6.3.3. Hasil Ekstraksi Tidak Bisa Diedit

**Masalah**: User tidak bisa edit kode hasil ekstraksi sebelum download. Kalau ada 1 baris salah, user harus download, edit manual di editor, save.

### 6.4. Performance Issues

#### 6.4.1. Cache Tidak Invalidation Setelah Code Update

**Masalah**: Setelah BE update, cache lama masih return hasil yang salah. User harus manual `DELETE /api/extract/cache`.

**Penyebab**: Cache key hanya hash file content, tidak include version code BE.

#### 6.4.2. OCR Sangat Lambat

**Masalah**: OCR 60-75 detik untuk 20 halaman. Tidak ada parallel processing.

**Penyebab**: Tesseract dijalankan sequential per halaman.

### 6.5. Backend Issues

#### 6.5.1. Banyak Dead Code

**Masalah**: Repo punya banyak file yang tidak dipakai:
- `backend/app/language_detection.py` — sudah diganti pattern_extract
- `backend/scripts/minimodel_extract.py` — sudah tidak dipakai
- `backend/scripts/pdf_extract.py` — masih dipanggil sebagai sidecar, tapi pattern_extract juga dipakai
- `backend/app/llm_detection.py` — sudah dihapus tapi masih ada reference

**Dampak**: Maintenance nightmare. Dev baru bingung mana yang aktif.

#### 6.5.2. Tidak Ada Test Suite

**Masalah**: Tidak ada unit test atau integration test. Setiap perubahan manual di-test dengan upload file.

**Dampak**: Regression sulit di-detect. Perubahan kecil bisa break fitur lain tanpa diketahui.

#### 6.5.3. Rate Limiting Terlalu Ketat

**Masalah**: 10 extract per jam per IP. User yang test berkali-kali cepat kena limit.

### 6.6. Deployment Issues

#### 6.6.1. Render Free Tier Sleep

**Masalah**: Render free tier sleep after 15 min idle. First request = 30+ detik cold start.

#### 6.6.2. Docker Image Besar

**Masalah**: Docker image dengan Tesseract + poppler ~500MB. Build lambat.

#### 6.6.3. Tidak Ada CI/CD

**Masalah**: Setiap push manual test. Tidak ada automated test sebelum deploy.

### 6.7. Database Issues

#### 6.7.1. Snippet Tidak Bisa Edit

**Masalah**: User simpan snippet, tidak bisa edit kodenya. Harus hapus + save ulang.

#### 6.7.2. Tidak Ada Search

**Masalah**: User tidak bisa cari snippet berdasarkan konten kode atau nama file.

## 7. Goals untuk Output (Mendetail)

### 7.1. Output yang Diinginkan

Saat user upload modul praktikum R (mis. MODUL 3_MEDSTAT2.pdf), output yang diinginkan:

```
Block #0 | R | 8 lines
    data_ipk = (...)
    Tabel.kontingensi = as.matrix(read.table(textConnection(data_ipk),
                                 header = TRUE, row.names = 1))
    print(Tabel.kontingensi)
    chisq.test(Tabel.kontingensi, correct = FALSE)

Block #1 | R | 7 lines
    data_gaji = (...)
    Tabel.kontingensi = as.matrix(read.table(textConnection(data_gaji),
                                 header = TRUE, row.names = 1))
    print(Tabel.kontingensi)
    chisq.test(Tabel.kontingensi, correct = FALSE)

Block #2 | R | 8 lines
    data_penilaian <- data.frame(
      karyawan = 1:12,
      nilai_kepuasan = c(5.8, 8.1, ...),
      kenaikan_gaji = c(3.3, 6.7, ...))
    print(data_penilaian)
    cor.test(data_penilaian$nilai_kepuasan, data_penilaian$kenaikan_gaji,
             method = c("pearson"), conf.level = 0.95)

Block #3 | R | 7 lines
    data_mahasiswa <- data.frame(...)
    print(data_mahasiswa)
    cor.test(...)

Block #4 | R | 8 lines
    library(lmtest)
    tahun <- 2001:2010
    biaya_promosi <- c(1500000, ..., 2200000)
    volume_penjualan <- c(45000, ..., 60000)
    data_biaya <- data.frame(tahun, biaya_promosi, volume_penjualan)
    vp <- lm(volume_penjualan ~ biaya_promosi, data = data_biaya)
    summary(vp)

Block #5 | R | 7 lines
    data_toko <- data.frame(...)
    print(data_toko)
    vp <- lm(jumlah_pengunjung ~ jumlah_iklan, data = data_toko)
    summary(vp)
```

**Karakteristik output ideal**:
1. **Setiap blok = 1 kesatuan kode yang bisa di-run langsung** (tidak terpotong di tengah)
2. **Tidak ada narasi/interpretasi** yang ikut masuk
3. **Tidak ada `##` R output** yang ikut masuk
4. **Line-wrap diperbaiki** (kode panjang yang dipotong PDF digabung kembali)
5. **Semua blok terdeteksi** (tidak ada kode yang hilang)
6. **Bahasa** = sesuai pilihan user (R untuk modul statistika)
7. **Download** = 1 file `.R` dengan comment separator antar blok

### 7.2. Acceptance Criteria

| Criteria | Target | Current Status |
|----------|--------|----------------|
| Recall (baris kode ter-extract) | >= 90% | ~70% (masih ada kode hilang) |
| Precision (baris yang di-extract adalah kode) | >= 95% | ~85% (narasi masih ikut) |
| Kode utuh per blok | Ya | Tidak (masih terpotong) |
| R output (`##`) tidak ikut | Ya | Sebagian (masih ada yang lolos) |
| Line-wrap diperbaiki | Ya | Tidak (belum diimplementasi di pattern_extract) |
| 1 file download | Ya | Ya (sudah diimplementasi) |
| Pilih bahasa manual | Ya | Ya (sudah diimplementasi) |
| Ekstraksi < 5 detik | Ya | Ya untuk text PDF, 60+ detik untuk OCR |

## 8. Roadmap Perbaikan

### Phase 1: Fix Ekstraksi (Prioritas Tertinggi)

1. **Gabungkan blok yang terpotong**: Implementasi look-back/look-ahead di pattern_extract — kalau baris sebelumnya kode dan baris setelahnya kode, jangan putus walau ada narasi di tengah.

2. **Filter narasi lebih ketat**: Tambah prose detection yang cek rasio kata biasa per baris. Kalau > 40% kata biasa → bukan kode.

3. **Repair line-wrap**: Port `repair_line_wraps` logic dari pdf_extract.py ke pattern_extract.py.

4. **Strip R output konsisten**: Pastikan SEMUA baris `##` di-skip, tidak ada yang lolos.

### Phase 2: UX Improvement

5. **Edit kode sebelum download**: Tambah editor inline di halaman snippet detail.

6. **Progress bar untuk OCR**: Pakai SSE atau polling untuk update progress.

7. **Clear UI**: Panel kiri hanya untuk pilih bahasa ekstraksi. Hasil preview pakai tabs terpisah.

### Phase 3: Reliability

8. **Hapus dead code**: Bersihkan file yang tidak dipakai.

9. **Tambah test suite**: Unit test untuk pattern_extract, language detection, API endpoints.

10. **Cache versioning**: Tambah version key ke cache supaya invalid otomatis saat BE update.

## 9. Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Frontend | Next.js 16 + React 19 + TypeScript | Vercel deploy, SSR/SSG |
| Backend | FastAPI (Python 3.12) | Native pdfplumber/PyMuPDF/Tesseract |
| Database | Supabase (PostgreSQL) | Free tier, RLS bawaan |
| PDF parsing | PyMuPDF | Cepat, preserve whitespace |
| OCR | Tesseract (opsional) | Untuk image-based PDF |
| Auth | JWT + bcrypt | Stateless, tidak butuh session store |
| Package manager | uv | Cepat, lockfile reproducible |
| Hosting FE | Vercel | Free, auto-deploy |
| Hosting BE | Render | Free tier Python, support Docker |

## 10. API Specification

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register user baru |
| POST | `/api/auth/login` | No | Login, return JWT |
| GET | `/api/auth/me` | Yes | Profil user |
| POST | `/api/extract?lang=r` | No | Ekstrak kode dari file. `lang` = bahasa pilihan user |
| POST | `/api/snippets` | Yes | Simpan hasil ekstraksi |
| GET | `/api/snippets` | Yes | List snippet user |
| GET | `/api/snippets/{id}` | Yes | Detail snippet |
| DELETE | `/api/snippets/{id}` | Yes | Hapus snippet |
| GET | `/api/snippets/{id}/download?block=-1` | Yes | Download sebagai file |

### Extract Request

```
POST /api/extract?lang=r
Content-Type: multipart/form-data
Body: file=<binary>

Response:
{
  "blocks": [
    {"index": 0, "lang": "r", "code": "...", "lines": 8, "source": "pattern"}
  ],
  "filename": "MODUL 3_MEDSTAT2.pdf",
  "size": 336090,
  "total": 6
}
```

## 11. Database Schema

### Table: profiles

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | User ID |
| email | text (unique) | Email user |
| password_hash | text | Bcrypt hash |
| name | text | Nama (opsional) |
| created_at | timestamptz | |

### Table: snippets

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Snippet ID |
| user_id | uuid (FK) | Pemilik |
| original_filename | text | Nama file asli (tanpa konten) |
| blocks | jsonb | `[{index, lang, code, lines}]` |
| total_blocks | int | Jumlah blok |
| created_at | timestamptz | |

RLS aktif: user hanya bisa akses snippet miliknya.

## 12. Kekurangan Saya Selama Membangun Project Ini

### 12.1. Over-Engineering

Saya terlalu banyak ganti strategi tanpa benar-benar memahami masalah:
1. **Font-based extraction** (pdfplumber) — gagal untuk PDF tanpa font monospace
2. **Heuristic token-density scoring** — terlalu banyak if-else, akurasi rendah
3. **Mini-model probabilistic scoring** — kompleks tapi tidak lebih baik dari simple pattern
4. **LLM-based extraction** — pakai token, tidak reliable, terlalu slow
5. **Pattern-based extraction** (current) — paling baik tapi masih ada bug

Seharusnya saya analisis file user DULU, baru pilih strategi. Bukan coba-coba strategi dan lihat hasilnya.

### 12.2. Tidak Pivot Cepat Saat Gagal

Saat font-based extraction gagal untuk PDF user (Times New Roman), saya habiskan waktu terlalu lama mencoba fix font detection (tambah monospace patterns, tune threshold). Seharusnya saya langsung pivot ke strategi lain.

### 12.3. Tidak Minta Feedback Lebih Awal

Saya bangun banyak fitur (rate limiting, caching, Docker, OCR) sebelum ekstraksi inti berfungsi dengan baik. Seharusnya saya validasi ekstraksi dulu dengan 1 file user, baru tambah fitur pendukung.

### 12.4. Cache Bug yang Menyebabkan Kebingungan

Cache 24 jam menyebabkan user selalu dapat hasil lama setelah BE update. Ini bug kritis yang saya tidak anticipate. Seharusnya cache versioning dari awal.

### 12.5. Banyak Dead Code

Repo penuh dengan file yang tidak dipakai (minimodel_extract.py, language_detection.py, llm_*.py, scripts/pdf_extract.py yang lama). Ini karena saya tidak hapus kode lama saat ganti strategi.

### 12.6. Tidak Ada Test

Saya test manual dengan upload file setiap kali ada perubahan. Seharusnya saya bangun test suite dari awal dengan ground truth dataset (file user + expected output).

## 13. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recall | >= 90% | Bandingkan baris kode yang ter-extract vs baris kode asli di file |
| Precision | >= 95% | Bandingkan baris kode yang benar vs baris narasi yang ikut |
| User satisfaction | >= 4/5 | Survey user setelah ekstraksi |
| Ekstraksi time | < 5s | Untuk file < 5MB text PDF |
| Download conversion | 1 file utuh | Semua blok gabung jadi 1 file |
| Bahasa accuracy | 100% | User pilih bahasa → semua blok pakai bahasa tsb |
