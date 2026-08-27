# Changelog

Semua perubahan penting pada CodeLooter akan didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
dan versi mengikuti [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Integrasi `python-docx` untuk format DOCX
- Integrasi `python-pptx` untuk format PPTX
- Rate limiting pakai `slowapi`
- Caching extract result di Redis
- Progress bar untuk OCR via SSE
- Full-text search snippet

## [0.3.0] - 2026-08-23

### Added

- **Multi-format extract di backend**: sekarang BE handle PDF, MD, IPYNB, HTML, TXT, TEX
  (sebelumnya hanya PDF). Implementasi di `backend/app/routers/extract.py` dengan
  router per format.
- **Language detection module baru**: `backend/app/language_detection.py`. Pakai
  pygments + custom heuristic untuk 18 bahasa (R, Python, Java, C++, SQL, PHP,
  JavaScript, TypeScript, HTML, CSS, JSON, Go, Rust, Kotlin, Ruby, Bash, C,
  Markdown). Test accuracy: 100% (18/18 bahasa terdeteksi benar).
- **Deployment files**: `.env.local.example` untuk FE, `backend/.env.example` update
  dengan komentar panduan lengkap, `docker-compose.yml` untuk dev lokal (FE + BE +
  Redis), `Dockerfile.frontend` untuk FE container.
- **Documentation**: `CONTRIBUTING.md` (alur kontribusi, code style, testing),
  `ARCHITECTURE.md` (diagram detail, keputusan desain, trade-off), `CHANGELOG.md`.

### Changed

- **Backend extract router**: refactor untuk support multi-format. Sebelumnya hanya
  PDF via sidecar, sekarang route ke extractor yang sesuai berdasarkan extension.
- **Language detection**: pindahkan dari FE (highlight.js) ke BE (pygments + custom
  heuristic). Custom detection untuk R, SQL, bash, PHP, Java override pygments
  yang sering salah.
- **README**: rewrite tanpa emoji, lebih informatif. Tambah tabel endpoint API,
  schema database, hasil benchmark, limitasi & roadmap.

### Removed

- **Legacy FE route**: hapus `app/api/extract/route.ts` (829 baris). FE sekarang
  100% panggil BE via `lib/api.ts`. Tidak ada duplikasi logic antara FE dan BE.

### Fixed

- **R detection accuracy**: sebelumnya pygments sering salah deteksi R sebagai
  Python atau Kotlin. Sekarang custom `detect_r()` pakai 30+ pattern khas R
  (`<-`, `cat(`, `qt(`, `qnorm(`, `%>%`, `library(`, dll.).
- **JSON detection**: bug `import json` tidak ada di `language_detection.py`,
  causing silent failure. Fixed.
- **TypeScript vs JavaScript**: TypeScript sekarang di-cek sebelum JavaScript
  (sebelumnya `function` match JavaScript duluan).
- **Bash vs PHP**: bash script dengan `echo $var` salah terdeteksi sebagai PHP.
  Sekarang `detect_bash()` cek `#!/bin/bash` shebang dulu, skip PHP detection
  kalau bash.

## [0.2.0] - 2026-08-23

### Added

- **Full-stack architecture**: monorepo dengan frontend Next.js + backend FastAPI
  + database Supabase. Sebelumnya monolithic Next.js dengan Python sidecar.
- **Backend FastAPI baru**: `backend/app/` dengan routers untuk auth, extract,
  snippets. JWT auth (python-jose) + bcrypt (passlib) + Supabase client.
- **Auth router**: `/api/auth/register`, `/login`, `/me`. Password di-hash bcrypt,
  JWT expire 7 hari.
- **Snippets router**: CRUD lengkap untuk simpan hasil ekstraksi. User hanya
  bisa akses snippet miliknya (RLS + BE enforcement).
- **Download endpoint**: `GET /api/snippets/{id}/download?block=N`. Generate file
  on-the-fly dari text code di DB. Single block = 1 file, multi-bahasa = ZIP.
- **Supabase schema**: `supabase/migrations/001_init.sql`. Tabel `profiles` (user)
  dan `snippets` (hasil ekstraksi). RLS aktif.
- **Frontend pages baru**: `/auth` (login/register), `/dashboard` (list snippet),
  `/snippets/[id]` (detail + download).
- **API client**: `lib/api.ts` dengan JWT di cookie (js-cookie). Auto-attach
  Authorization header.
- **Docker config**: `backend/Dockerfile` dengan Tesseract + poppler untuk OCR.
- **Render config**: `render.yaml` untuk deploy BE.
- **Backend env example**: `backend/.env.example` dengan 5 env var.

### Changed

- **Frontend auth flow**: sekarang pakai `/auth` page dedicated, bukan modal
  pop-up. Token di cookie, bukan localStorage.
- **Frontend home page**: tambah tombol "Save snippet" (hanya muncul kalau user
  login). Hapus mock RECENT_FILES, ganti jadi link ke dashboard.
- **README**: rewrite lengkap dengan arsitektur baru, alur data, deploy guide.

## [0.1.0] - 2026-08-23

### Added

- **Font-based PDF code extraction**: strategi utama pakai pdfplumber untuk baca
  font info per char. Identifikasi font monospace (Courier, Consolas, LMMono, dll.)
  sebagai kode, font serif/sans-serif sebagai narasi.
- **OCR fallback**: kalau font-based tidak menemukan block (PDF image-based),
  otomatis pakai Tesseract. Pipeline: pdftoppm render PDF → PNG, tesseract OCR
  per halaman, heuristic filter baris kode.
- **ASCII art filter**: deteksi & skip tabel ASCII (`|---|---|`), box drawing
  chars (`─│┌┐└┘├┤┬┴┼`), separator (`----`, `====`).
- **Single-line block support**: izinkan 1 baris block jika punya STRONG_KEYWORDS
  (`CREATE DATABASE`, `import`, `def class`, dll.).
- **PDF line-wrap repair**: gabung baris yang terpotong PDF (`lower\n_bound` →
  `lower_bound`, `simul\nasi` → `simulasi`).
- **R output stripping**: buang `## ...` dan `[1] ...` (R console output) dari
  kode yang di-extract.
- **Fragment filter**: deteksi & skip artifact PDF (`gga 0.005333174`,
  `hingga 1.771651`).
- **Block merging & splitting**: gabung adjacent blocks, split per `# Kasus N`.
- **Performance**: 1-15 detik untuk text PDF, 50-75 detik untuk image PDF.

### Performance Benchmark

Tested pada 12 modul praktikum + laporan dari berbagai universitas:

| Modul | Pages | Size | Time | Blocks |
|-------|-------|------|------|--------|
| Mestat 2 (R) | 11 | 0.7 MB | 2.6s | 6 |
| C++ UM Malang | 12 | 0.8 MB | 1.9s | 8 |
| Java UNAS | 73 | 3.9 MB | 12.8s | 7 |
| Python lkhibra | 88 | 5.7 MB | 5.0s | 105 |
| SQL YAI | 28 | 1.5 MB | 2.9s | 15 |
| Web UNG | 37 | 0.6 MB | 2.6s | 34 |
| AI UAD | 71 | 1.1 MB | 9.2s | 19 |

## [0.0.1] - Initial release

### Added

- Next.js monolith dengan `/api/extract` route
- officeparser untuk DOCX/PPTX/XLSX
- highlight.js untuk deteksi bahasa
- Comic-style UI dengan splash screen animatif
- Drag-drop upload, preview, copy, download

[Unreleased]: https://github.com/raynzz455/CodeLooter/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/raynzz455/CodeLooter/releases/tag/v0.3.0
[0.2.0]: https://github.com/raynzz455/CodeLooter/releases/tag/v0.2.0
[0.1.0]: https://github.com/raynzz455/CodeLooter/releases/tag/v0.1.0
[0.0.1]: https://github.com/raynzz455/CodeLooter/releases/tag/v0.0.1
