# CodeLooter

Ekstrak kode dari dokumen praktikum, paper, atau buku teks secara presisi. Tanpa LLM, tanpa cloud AI API, semua pemrosesan dilakukan lokal di server.

CodeLooter menerima file PDF / DOCX / PPTX / MD / IPYNB / TXT / TEX, lalu mengembalikan setiap code block yang ada di dalamnya dalam bahasa yang terdeteksi otomatis. User yang login dapat menyimpan hasil ekstraksi ke akunnya dan mengunduh ulang sebagai file kode (.py, .js, .sql, .R, .cpp, dll.) kapan saja.

## Arsitektur

CodeLooter V2 adalah monorepo dengan tiga komponen yang terpisah dan dapat di-scale secara independen.

### Diagram

```
+-----------------------------+              +---------------------------+
|  FRONTEND (Vercel)          |   HTTPS      |  BACKEND (Render)         |
|  Next.js 16 + React 19      |   + Bearer   |  FastAPI + Python         |
|  ----------------------     |   JWT        |  ----------------------   |
|  Routes:                    | ----------> |  Endpoints:               |
|  - /            (extract)   |              |  - POST /api/auth/register|
|  - /auth        (login)     |              |  - POST /api/auth/login   |
|  - /dashboard   (list)      |              |  - GET  /api/auth/me      |
|  - /snippets/[id] (detail)  |              |  - POST /api/extract      |
|                             |              |  - POST /api/snippets     |
|  Auth: JWT di cookie        |              |  - GET  /api/snippets     |
|  API client: lib/api.ts      |              |  - GET  /api/snippets/{id}|
|                             |              |  - DELETE /api/snippets/{id}|
|                             |              |  - GET  /api/snippets/{id}/download
|                             |              |                           |
|                             |              |  Sidecar:                 |
|                             |              |  scripts/pdf_extract.py  |
|                             |              |  (font analysis + OCR)   |
+-----------------------------+              +-------------+-------------+
                                                             |
                                                             v
                                       +-----------------------------+
                                       |  SUPABASE (PostgreSQL)      |
                                       |  ----------------------    |
                                       |  Tables:                    |
                                       |  - public.profiles          |
                                       |    id, email, password_hash,|
                                       |    name, created_at          |
                                       |  - public.snippets          |
                                       |    id, user_id,             |
                                       |    original_filename,       |
                                       |    blocks (jsonb),          |
                                       |    total_blocks, created_at  |
                                       |                             |
                                       |  RLS: user only sees own    |
                                       +-----------------------------+
```

### Alur data

1. Upload dan ekstrak. User mengunggah PDF di halaman utama. Frontend memanggil `POST /api/extract`. Backend menjalankan `pdf_extract.py` (font analysis + OCR fallback) dan mengembalikan daftar code block beserta bahasa yang terdeteksi.

2. Simpan opsional (butuh login). User yang sudah login dapat menekan tombol Simpan. Frontend memanggil `POST /api/snippets` dengan nama file dan daftar block. Backend menyimpan ke tabel `snippets` di Supabase, dengan `user_id` diambil dari JWT.

3. Daftar dan lihat. User yang sudah login dapat membuka `/dashboard` untuk melihat daftar snippet miliknya. Klik salah satu untuk melihat detail kode di `/snippets/[id]`.

4. Unduh ulang. User menekan tombol Download di halaman detail snippet. Frontend memanggil `GET /api/snippets/{id}/download?block=N`. Backend mengambil text code dari database, lalu membuat file on-the-fly dengan ekstensi sesuai bahasa (Python menjadi `.py`, SQL menjadi `.sql`, dst.). Jika snippet berisi banyak bahasa, backend membungkusnya menjadi satu file `.zip`.

### Yang tidak disimpan di database

- File PDF atau dokumen asli. Hanya `original_filename` (string) yang disimpan.
- Cookie, session ID, atau token selain JWT itu sendiri.
- Log aktivitas user.

### Yang disimpan di database

- Profil user: email dan bcrypt hash password.
- Snippet: nama file asli dan daftar block (JSON berisi `{lang, code, lines, source}` per block).

## Strategi ekstraksi kode

Backend menggunakan `pdf_extract.py` yang mengimplementasikan beberapa strategi berurutan.

### 1. Font-based detection (untuk PDF text-based)

Strategi utama. Menggunakan `pdfplumber` untuk membaca metadata font setiap karakter di PDF. Font monospace (Courier, Consolas, JetBrains Mono, LMMono, dll.) dianggap sebagai kode, font serif atau sans-serif (Times New Roman, Calibri, Arial) dianggap sebagai narasi.

Langkah:
- Ekstrak semua karakter beserta informasi fontname, posisi (top, x0, x1), dan size.
- Identifikasi font monospace yang dipakai di halaman tersebut.
- Group karakter monospace per baris berdasarkan koordinat top.
- Gabungkan baris-baris adjacent (gap vertikal kurang dari 35pt) menjadi satu block.
- Post-process: repair line-wrap PDF, strip R console output (`## ...`), filter fragment artifact.

### 2. OCR fallback (untuk PDF image-based)

Jika strategi 1 tidak menemukan font monospace sama sekali, kemungkinan PDF berbasis gambar (screenshot kode). Backend otomatis beralih ke OCR:

- `pdftoppm` mengkonversi 20 halaman pertama PDF ke PNG dengan DPI 200.
- `tesseract --psm 6 tsv` melakukan OCR pada setiap gambar, mengembalikan teks beserta posisi.
- Heuristic `looks_like_code_line()` mengidentifikasi baris yang terlihat seperti kode.
- Grouping baris kode menjadi block, sama seperti strategi 1.

### 3. Heuristic token-density (fallback di route Next.js lama)

Jika kedua strategi di atas gagal atau file bukan PDF, route Next.js `/api/extract` lama masih aktif sebagai fallback. Strategi ini menggunakan `pdftotext -layout` untuk ekstraksi teks, lalu `highlight.js` untuk deteksi bahasa berdasarkan token density dan keyword.

### 4. Strategi khusus format

- LaTeX: deteksi `\begin{lstlisting}`, `\begin{verbatim}`, `\begin{minted}` block.
- IPYNB: parse JSON, ambil cell dengan `cell_type == "code"`.
- Markdown: deteksi fenced code block (` ``` ` atau `~~~`).
- DOCX/PPTX: gunakan `officeparser` dengan `includeBreakNodes: true` untuk preserve `<w:br/>`.

## Komponen repo

```
CodeLooter/
|
|-- app/                              Frontend Next.js
|   |-- page.tsx                      Home: upload + extract + tombol Simpan
|   |-- auth/page.tsx                 Login dan register
|   |-- dashboard/page.tsx            Daftar snippet user
|   |-- snippets/[id]/page.tsx       Detail snippet + tombol download
|   |-- api/extract/route.ts          Legacy fallback untuk format non-PDF
|   |-- layout.tsx
|   `-- globals.css
|
|-- components/                        React UI components
|   |-- SplashScreen.tsx
|   `-- data.ts
|
|-- lib/api.ts                         Frontend API client (fetch wrapper)
|                                     - JWT di cookie via js-cookie
|                                     - Auto-attach Authorization: Bearer
|
|-- types/index.ts                    TypeScript types
|
|-- backend/                           Backend FastAPI
|   |-- app/
|   |   |-- main.py                   FastAPI app + CORS + router registration
|   |   |-- config.py                 Settings via env var (pydantic-settings)
|   |   |-- auth.py                   JWT + bcrypt helpers
|   |   |-- supabase_client.py        Supabase client (anon + admin)
|   |   `-- routers/
|   |       |-- auth.py              /auth/register, /login, /me
|   |       |-- extract.py           /extract (PDF -> code blocks)
|   |       `-- snippets.py          /snippets CRUD + /download
|   |-- scripts/
|   |   `-- pdf_extract.py            Sidecar: font analysis + OCR fallback
|   |-- requirements.txt
|   |-- Dockerfile                   Image dengan Tesseract + poppler
|   `-- .env.example
|
|-- supabase/migrations/
|   `-- 001_init.sql                 Schema: profiles + snippets + RLS
|
|-- render.yaml                       Konfigurasi deploy Render
|-- package.json                      Frontend deps
|-- next.config.ts
`-- README.md
```

## Setup development

### Prasyarat

- Node.js 18 atau lebih baru.
- Python 3.11 atau lebih baru.
- uv (Python package manager, jauh lebih cepat dari pip). Install: https://docs.astral.sh/uv/
- Akun Supabase (https://supabase.com, free tier tersedia).
- Tesseract OCR dan poppler-utils untuk dukungan OCR (opsional, hanya untuk PDF image-based):
  ```
  sudo apt install tesseract-ocr poppler-utils
  ```

### 1. Setup database Supabase

1. Buat project baru di https://supabase.com/dashboard.
2. Buka SQL Editor, paste isi file `supabase/migrations/001_init.sql`, klik Run.
3. Buka Settings, bagian API, catat:
   - Project URL (contoh: `https://abcd1234.supabase.co`)
   - anon public key
   - service_role key (rahasia, hanya untuk backend)

### 2. Setup dan jalankan backend

```bash
cd backend

# Salin env example
cp .env.example .env

# Edit .env, isi dengan nilai dari Supabase dashboard
# CL_SUPABASE_URL=https://abcd1234.supabase.co
# CL_SUPABASE_ANON_KEY=eyJ...
# CL_SUPABASE_SERVICE_ROLE_KEY=eyJ...
# CL_JWT_SECRET=<generate dengan: openssl rand -base64 48>
# CL_CORS_ORIGINS=["http://localhost:3000"]

# Install dependency Python via uv (reproducible dari uv.lock)
uv sync

# Jalankan server development
uv run uvicorn app.main:app --reload --port 8000
```

Backend akan berjalan di http://localhost:8000. Dokumentasi Swagger tersedia di http://localhost:8000/docs.

### 3. Setup dan jalankan frontend

```bash
# Dari root repo
npm install

# Buat file .env.local
echo 'NEXT_PUBLIC_API_BASE=http://localhost:8000/api' > .env.local

# Jalankan dev server
npm run dev
```

Frontend akan berjalan di http://localhost:3000.

## Deploy ke production

### Frontend ke Vercel

1. Push repo ke GitHub.
2. Buka https://vercel.com, klik Add New Project, pilih repo CodeLooter.
3. Pada bagian Environment Variables, tambah:
   - `NEXT_PUBLIC_API_BASE` = `https://<nama-app-render>.onrender.com/api`
4. Klik Deploy. Vercel akan otomatis build dan deploy setiap kali ada push ke branch main.

### Backend ke Render

1. Buka https://render.com, klik New, pilih Web Service.
2. Connect GitHub repo `raynzz455/CodeLooter`.
3. Setting:
   - Name: `codelooter-api` (atau sesuai selera)
   - Runtime: Python 3
   - Root Directory: `backend`
   - Build Command: `pip install uv && uv sync --frozen --no-dev`
   - Start Command: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Instance Type: Free atau Starter (rekomendasi Starter untuk OCR)
4. Pada bagian Environment, tambah semua variabel dari `.env` lokal:
   - `CL_SUPABASE_URL`
   - `CL_SUPABASE_ANON_KEY`
   - `CL_SUPABASE_SERVICE_ROLE_KEY`
   - `CL_JWT_SECRET`
   - `CL_CORS_ORIGINS` = `["https://<nama-app-vercel>.vercel.app"]`
5. Klik Create Web Service.

Untuk dukungan OCR (PDF image-based), pakai Docker image:
- Ganti service type menjadi Docker.
- Dockerfile path: `backend/Dockerfile` (sudah include Tesseract, poppler, dan uv).

### Database Supabase

Tidak perlu deploy terpisah. Supabase hosted. Cukup jalankan migration SQL satu kali (lihat langkah Setup database di atas).

### Update CORS setelah deploy

Setelah URL Vercel diketahui, update env var di Render:
```
CL_CORS_ORIGINS=["https://codelooter.vercel.app"]
```
Restart backend.

## Endpoint API

Semua endpoint di-prefix dengan `/api`. Autentikasi via `Authorization: Bearer <jwt>`.

### Auth

| Method | Path | Deskripsi | Auth |
|--------|------|-----------|------|
| POST | `/auth/register` | Daftar user baru. Body: `{email, password, name?}` | tidak |
| POST | `/auth/login` | Login user. Body: `{email, password}`. Return JWT. | tidak |
| GET | `/auth/me` | Ambil profil user yang sedang login. | ya |

### Extract

| Method | Path | Deskripsi | Auth |
|--------|------|-----------|------|
| POST | `/extract` | Ekstrak kode dari file. Body: `multipart/form-data` dengan field `file`. | tidak |

Response:
```json
{
  "blocks": [
    {"index": 0, "lang": "python", "code": "...", "lines": 10, "source": "font"},
    {"index": 1, "lang": "r", "code": "...", "lines": 5, "source": "font"}
  ],
  "filename": "laporan.pdf",
  "size": 102400,
  "total": 2,
  "stats": {"total_chars": 1000, "code_chars": 600, "code_ratio": 0.6, "ocr_used": false}
}
```

### Snippets

| Method | Path | Deskripsi | Auth |
|--------|------|-----------|------|
| POST | `/snippets` | Simpan hasil ekstraksi. Body: `{filename, blocks, total_blocks}`. | ya |
| GET | `/snippets` | Daftar snippet milik user. Query: `limit`, `offset`. | ya |
| GET | `/snippets/{id}` | Ambil satu snippet berdasarkan ID. | ya |
| DELETE | `/snippets/{id}` | Hapus snippet. | ya |
| GET | `/snippets/{id}/download?block=N` | Download sebagai file. `block=-1` untuk semua block. | ya |

Behavior download:
- `block=-1` dan semua block berbahasa sama: gabungkan jadi satu file dengan ekstensi sesuai bahasa.
- `block=-1` dan multi-bahasa: bungkus jadi satu file `.zip` berisi multiple file.
- `block=N`: kembalikan hanya block ke-N, dengan ekstensi sesuai bahasa block tersebut.

Mapping bahasa ke ekstensi: python=py, r=R, javascript=js, typescript=ts, java=java, cpp=cpp, sql=sql, kotlin=kt, php=php, ruby=rb, go=go, rust=rs, swift=swift, bash=sh, html=html, css=css, json=json, yaml=yml, unknown=txt.

## Schema database

File `supabase/migrations/001_init.sql` membuat dua tabel.

### profiles

| Column | Type | Keterangan |
|--------|------|-----------|
| id | uuid (PK) | auto-generated via `gen_random_uuid()` |
| email | text (unique) | email user, disimpan lowercase |
| password_hash | text | bcrypt hash, cost factor 12 |
| name | text | opsional |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | auto-update via trigger |

### snippets

| Column | Type | Keterangan |
|--------|------|-----------|
| id | uuid (PK) | auto-generated |
| user_id | uuid (FK) | references profiles.id, ON DELETE CASCADE |
| original_filename | text | nama file asli yang di-upload user |
| blocks | jsonb | array berisi `{index, lang, code, lines, source}` per block |
| total_blocks | int | jumlah block |
| created_at | timestamptz | default now() |

Row Level Security (RLS) aktif di tabel `snippets`. User hanya bisa SELECT, INSERT, UPDATE, DELETE baris miliknya sendiri. Backend menggunakan service_role key yang bypass RLS untuk operasi write, namun RLS tetap aktif untuk operasi langsung dari frontend (kalau ada).

## Keamanan

- JWT secret minimal 32 karakter. Generate dengan `openssl rand -base64 48`.
- Service role key Supabase hanya ada di backend, tidak pernah di-expose ke frontend.
- Password di-hash dengan bcrypt cost factor 12.
- CORS di-whitelist, hanya menerima request dari origin yang didaftarkan.
- File upload maksimal 50MB, dapat diubah via env var `CL_MAX_UPLOAD_MB`.
- Cookie JWT menggunakan `sameSite: "lax"`, expire 7 hari.
- Untuk produksi yang lebih ketat, pertimbangkan httpOnly cookie via Next.js API route proxy.

## Hasil benchmark

Berikut hasil pengujian ekstraksi pada 12 modul praktikum dan laporan dari berbagai universitas di Indonesia.

| Modul | Pages | Size | Time | Blocks | Metode |
|-------|-------|------|------|--------|--------|
| Mestat 2 (R) | 11 | 0.7 MB | 2.6s | 6 | font |
| C++ UM Malang | 12 | 0.8 MB | 1.9s | 8 | font |
| Java UNAS | 73 | 3.9 MB | 12.8s | 7 | font |
| Python lkhibra | 88 | 5.7 MB | 5.0s | 105 | font |
| Algo Python UNJ | 18 | 0.6 MB | 2.5s | 4 | font |
| SQL YAI | 28 | 1.5 MB | 2.9s | 15 | font |
| SQL UNIKOM | 43 | 0.6 MB | 2.3s | 1 | font |
| Web UNG | 37 | 0.6 MB | 2.6s | 34 | font |
| AI UAD | 71 | 1.1 MB | 9.2s | 19 | font |
| Java PENS (laporan) | 5 | 0.03 MB | 2.0s | 3 | font |
| Python Unissula (laporan) | 21 | 0.6 MB | 54.2s | 9 | OCR |
| Python UNPAS (laporan) | 17 | 0.5 MB | 73.0s | 0 | narasi-only |

Rata-rata waktu ekstraksi font-based: 5-12 detik untuk modul 50-90 halaman. OCR fallback membutuhkan 50-75 detik untuk modul 17-21 halaman (karena harus render PDF ke PNG lalu OCR per halaman).

## Stack teknologi

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Frontend | Next.js 16 + React 19 | Vercel deploy seamless, App Router untuk SSR/SSG |
| Backend | FastAPI (Python) | Native pdfplumber dan pytesseract, async, auto-docs Swagger |
| Database | Supabase (PostgreSQL) | Free tier, RLS bawaan, dashboard mudah |
| Auth | JWT (python-jose) + bcrypt (passlib) | Self-contained token, tidak butuh session store |
| PDF parsing | pdfplumber | Font analysis paling akurat untuk PDF text-based |
| OCR | Tesseract + pdftoppm | Open-source, dukungan banyak bahasa |
| Hosting FE | Vercel | Free hobby tier, auto-deploy dari GitHub |
| Hosting BE | Render | Free tier untuk Python, support Docker untuk OCR |

## Limitasi dan roadmap

1. Deteksi bahasa belum dipindahkan ke backend. Saat ini backend mengembalikan `lang: "unknown"` untuk semua block. Untuk produksi, pindahkan logic highlight.js dari `app/api/extract/route.ts` ke backend, atau gunakan `pygments` di Python.

2. Format selain PDF belum didukung di backend. Saat ini backend hanya menangani `.pdf`. Untuk `.docx`, `.md`, `.ipynb`, frontend masih memakai route Next.js lama (`/api/extract`). Route tersebut dapat dihapus setelah backend mendukung semua format.

3. Token di cookie rentan XSS. Untuk produksi yang lebih ketat, gunakan httpOnly cookie via Next.js API route sebagai proxy. Saat ini pakai `sameSite: "lax"` + JWT expire 7 hari.

4. Rate limiting belum diimplementasikan. Tambahkan `slowapi` di backend untuk mencegah abuse endpoint `/extract`.

5. OCR lambat (50-75 detik untuk 20 halaman). Bisa diparalelkan dengan multiprocessing atau dijadwalkan via queue (Celery + Redis).

6. Tidak ada progress bar untuk OCR. User menunggu 60+ detik tanpa feedback. Bisa diatasi dengan SSE atau WebSocket untuk push progress update.

7. Tidak ada fitur "force OCR" di UI. Beberapa PDF punya text layer tapi kualitasnya buruk. User harus bisa memilih untuk skip font analysis dan langsung pakai OCR.

## License

MIT. Silakan gunakan untuk keperluan akademik atau komersial.
