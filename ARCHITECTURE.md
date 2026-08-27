# CodeLooter Architecture

Dokumen ini menjelaskan arsitektur teknis CodeLooter secara detail: komponen, alur data, keputusan desain, dan trade-off.

## Overview

CodeLooter adalah aplikasi web yang mengekstrak code block dari dokumen (PDF, DOCX, MD, IPYNB, dll.) secara presisi tanpa LLM. Arsitekturnya memisahkan frontend, backend, dan database ke dalam 3 service terpisah yang dapat di-scale secara independen.

```
+-------------------+        +-------------------+        +-------------------+
|   FRONTEND        |        |   BACKEND         |        |   DATABASE       |
|   Next.js 16      | HTTPS  |   FastAPI         |        |   Supabase        |
|   React 19        | ------>|   Python 3.12    | ------>|   PostgreSQL     |
|   TypeScript      |  JWT   |   + sidecar       |        |   + RLS          |
|                   |        |   pdf_extract.py  |        |                   |
|   Vercel deploy   |        |   Render deploy   |        |   Supabase hosted|
+-------------------+        +-------------------+        +-------------------+
        |                           |                           |
        |                           |                           |
        v                           v                           v
+-------------------+        +-------------------+        +-------------------+
|   BROWSER         |        |   Tesseract OCR   |        |   auth.users      |
|   Cookie: JWT     |        |   pdftoppm        |        |   public.profiles |
|   Drag-drop UI    |        |   (system deps)   |        |   public.snippets |
+-------------------+        +-------------------+        +-------------------+
```

## Komponen

### 1. Frontend (Next.js 16)

**Lokasi**: `app/`, `components/`, `lib/`, `types/`
**Stack**: Next.js 16 (App Router) + React 19 + TypeScript + lucide-react (icons) + js-cookie
**Deploy**: Vercel (auto-deploy dari GitHub)

#### Routes

| Route | Fungsi | Auth |
|-------|--------|------|
| `/` | Home page: upload file, extract, preview, save | Opsional |
| `/auth` | Login & register | Tidak |
| `/dashboard` | List snippet milik user yang login | Wajib |
| `/snippets/[id]` | Detail snippet + tombol download | Wajib |

#### API Client (`lib/api.ts`)

Wrapper fetch yang:
- Baca JWT dari cookie `cl_token`
- Attach `Authorization: Bearer <jwt>` ke setiap request
- Handle error response (parse `{detail: "..."}` dari FastAPI)
- Typed response (TypeScript interface untuk semua API)

```typescript
// Contoh pemanggilan
const result = await extractCode(file);
// result.blocks: CodeBlock[]
// result.filename: string
// result.total: number
```

#### Auth Flow

```
User register/login
    |
    v
POST /api/auth/login
    |
    v
BE return {access_token: JWT, user: {id, email, name}}
    |
    v
FE simpan ke cookie:
    cl_token = JWT (expire 7 hari, sameSite=lax)
    cl_user = JSON.stringify(user)
    |
    v
Setiap request berikutnya:
    Authorization: Bearer <cl_token>
```

#### Upload Flow

```
User drag-drop file di /
    |
    v
FE validate extension (.pdf/.docx/.md/.ipynb/dll)
    |
    v
POST /api/extract (FormData)
    |
    v
BE extract code blocks (lihat alur di Backend section)
    |
    v
FE display blocks di panel preview
    |
    v
User klik "Simpan" (kalau login)
    |
    v
POST /api/snippets {filename, blocks, total_blocks}
    |
    v
BE insert ke Supabase snippets table
    |
    v
FE redirect ke /snippets/{id}
```

### 2. Backend (FastAPI)

**Lokasi**: `backend/`
**Stack**: FastAPI + Python 3.12 + Pydantic + python-jose (JWT) + passlib (bcrypt) + supabase-py + pdfplumber + pytesseract
**Deploy**: Render (atau Docker untuk OCR support)

#### Module Structure

```
backend/
|-- app/
|   |-- main.py              # FastAPI app + CORS + router registration
|   |-- config.py            # Settings via env var (pydantic-settings)
|   |-- auth.py              # JWT + bcrypt helpers
|   |-- supabase_client.py   # Supabase client (anon + admin)
|   |-- language_detection.py # Deteksi bahasa via pygments + custom override
|   `-- routers/
|       |-- auth.py          # /auth/register, /login, /me
|       |-- extract.py       # /extract (multi-format extractor)
|       `-- snippets.py      # /snippets CRUD + /download
|-- scripts/
|   `-- pdf_extract.py        # Sidecar: font-analysis + OCR fallback
|-- requirements.txt
|-- Dockerfile               # Image dengan Tesseract + poppler
`-- .env.example
```

#### Endpoints

| Method | Path | Deskripsi | Auth |
|--------|------|-----------|------|
| POST | `/api/auth/register` | Daftar user baru | Tidak |
| POST | `/api/auth/login` | Login user, return JWT | Tidak |
| GET | `/api/auth/me` | Profil user yang login | Wajib |
| POST | `/api/extract` | Ekstrak code blocks dari file | Tidak |
| POST | `/api/snippets` | Simpan hasil ekstraksi | Wajib |
| GET | `/api/snippets` | Daftar snippet user | Wajib |
| GET | `/api/snippets/{id}` | Detail 1 snippet | Wajib |
| DELETE | `/api/snippets/{id}` | Hapus snippet | Wajib |
| GET | `/api/snippets/{id}/download` | Download sebagai file kode | Wajib |

#### Extract Flow (multi-strategy)

```
POST /api/extract dengan file upload
    |
    v
Validasi: extension + size (max 50MB)
    |
    v
Route berdasarkan extension:
    |
    +-- PDF --> panggil sidecar pdf_extract.py
    |           |
    |           +-- Font-analysis (pdfplumber)
    |           |       - identifikasi font monospace per char
    |           |       - group char per line
    |           |       - merge adjacent lines jadi block
    |           |       - filter ASCII art + fragment
    |           |       - return blocks
    |           |
    |           +-- Kalau 0 block terdeteksi:
    |               OCR fallback (Tesseract)
    |                   - pdftoppm render halaman ke PNG
    |                   - tesseract OCR per halaman
    |                   - heuristic filter baris kode
    |                   - return blocks
    |
    +-- MD --> parse fenced code blocks (``` atau ~~~)
    |
    +-- IPYNB --> parse JSON, ambil cell_type=code
    |
    +-- HTML --> parse <pre><code> blocks + unescape entities
    |
    +-- TEX --> parse \begin{lstlisting}/verbatim/minted
    |
    +-- TXT --> heuristic token-density scoring
    |
    +-- DOCX/PPTX/XLSX --> TODO (pakai python-docx/python-pptx)
    |
    v
Untuk setiap block:
    - Kalau lang = "unknown" atau kosong:
        deteksi via language_detection.py
    |
    v
Return ExtractResponse {blocks, filename, size, total, stats}
```

#### Language Detection Strategy

Deteksi bahasa pakai pipeline 3 layer:

1. **Custom detection** (prioritas tinggi — fix pygments mistake):
   - R: 30+ pattern khas (`<-`, `cat(`, `qt(`, `qnorm(`, `%>%`, dll.)
   - SQL: 2+ SQL keyword berbeda
   - Bash: `#!/bin/bash` shebang atau 2+ bash pattern
   - PHP: `<?php`, `$var`, `echo $`
   - Java: `public class`, `System.out`, `import java.` (tanpa `std::`)

2. **Heuristic keyword-based** (lebih reliable dari pygments untuk short snippet):
   - Go: `package X` + `func`
   - Rust: `fn` + `let mut` / `println!`
   - Kotlin: `fun`, `val + listOf`, `when(`
   - Ruby: `def...end` (Python tidak pakai `end`)
   - JSON: parse sebagai JSON
   - CSS: `color:`, `margin:`, `padding:`
   - HTML: tag `<html>`, `<body>`, dll.
   - C++: `#include`, `std::`
   - C: `int main()` tanpa `std::`
   - Python: `def`, `import`, `print(`
   - JavaScript: `console.log`, `const`, `let`, `function`
   - TypeScript: `: string`, `interface X {`

3. **pygments guess_lexer** (last resort):
   - Pakai alias resmi pygments (lebih reliable dari name)
   - Skip "text"/"plaintext" (return unknown)

Test accuracy: 18/18 bahasa terdeteksi benar (100%).

#### Auth Middleware

```python
# Dependency injection untuk endpoint yang butuh auth
def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if creds is None or not creds.credentials:
        raise HTTPException(401, "Authorization header missing")
    payload = decode_access_token(creds.credentials)
    return payload["sub"]  # user_id dari JWT

# Pakai di endpoint
@router.get("/snippets")
def list_snippets(user_id: str = Depends(get_current_user_id)):
    # user_id dijamin valid di sini
    ...
```

#### Snippet Save & Download Flow

```
POST /api/snippets {filename, blocks, total_blocks}
    |
    v
Auth: extract user_id dari JWT
    |
    v
Insert ke Supabase:
    INSERT INTO snippets (user_id, original_filename, blocks, total_blocks)
    VALUES (user_id, 'laporan.pdf', [{lang, code, lines, source}, ...], 5)
    |
    v
Return snippet object dengan ID

GET /api/snippets/{id}/download?block=N
    |
    v
Auth: extract user_id dari JWT
    |
    v
Query DB: SELECT * FROM snippets WHERE id=? AND user_id=?
    (RLS juga enforce user_id match)
    |
    v
Ambil blocks[N].code + blocks[N].lang
    |
    v
Map lang ke ekstensi:
    python -> .py, r -> .R, javascript -> .js, sql -> .sql, dll.
    |
    v
Generate file:
    - block=-1, semua block bahasa sama: gabung jadi 1 file
    - block=-1, multi-bahasa: ZIP berisi multiple file
    - block=N: 1 file saja
    |
    v
Return StreamingResponse dengan Content-Disposition: attachment
```

### 3. Database (Supabase PostgreSQL)

**Lokasi**: Hosted Supabase
**Schema**: `supabase/migrations/001_init.sql`

#### Tables

##### `public.profiles`

User account. Tidak pakai Supabase Auth bawaan (supabase.auth.users) untuk simplicity — kita kelola sendiri dengan bcrypt hash.

| Column | Type | Constraint | Keterangan |
|--------|------|------------|------------|
| id | uuid | PK, default gen_random_uuid() | ID unik user |
| email | text | UNIQUE, NOT NULL | Email user, disimpan lowercase |
| password_hash | text | NOT NULL | Bcrypt hash (cost factor 12) |
| name | text | | Nama user (opsional) |
| created_at | timestamptz | default now() | Timestamp registrasi |
| updated_at | timestamptz | default now() | Timestamp update terakhir |

Trigger `handle_updated_at` auto-update `updated_at` saat row di-update.

##### `public.snippets`

Hasil ekstraksi yang disimpan user. **File asli TIDAK disimpan**, hanya nama file + text code.

| Column | Type | Constraint | Keterangan |
|--------|------|------------|------------|
| id | uuid | PK, default gen_random_uuid() | ID unik snippet |
| user_id | uuid | FK → profiles.id, NOT NULL | Pemilik snippet |
| original_filename | text | NOT NULL | Nama file asli (mis. "laporan.pdf") |
| blocks | jsonb | NOT NULL | Array `[{index, lang, code, lines, source}, ...]` |
| total_blocks | int | NOT NULL, default 0 | Jumlah block |
| created_at | timestamptz | default now() | Timestamp simpan |

ON DELETE CASCADE: kalau user dihapus, semua snippet miliknya juga dihapus.

#### Row Level Security (RLS)

RLS aktif di `snippets`. User hanya bisa:
- SELECT baris miliknya (`auth.uid() = user_id`)
- INSERT baris dengan `user_id` = dirinya sendiri
- UPDATE/DELETE baris miliknya

Backend pakai service_role key yang **bypass RLS**. RLS tetap aktif untuk defense-in-depth kalau ada bug di BE.

#### Indexes

- `profiles_email_idx` pada `profiles(email)` — untuk lookup login cepat
- `snippets_user_id_idx` pada `snippets(user_id)` — untuk query list snippet user
- `snippets_created_at_idx` pada `snippets(created_at DESC)` — untuk sort by terbaru

## Keputusan Desain dan Trade-off

### 1. Kenapa Python untuk backend, bukan Node.js?

CodeLooter butuh **font analysis char-level** untuk PDF. Library terbaik untuk ini:
- `pdfplumber` (Python) — beri char + font info per karakter
- `pdf.js` (Node.js) — beri text saja, tidak ada font info

Node.js tidak punya equivalent pdfplumber. Kalau pakai NestJS, kita tetap butuh Python sidecar — artinya 2 service, 2 bahasa, tanpa benefit.

### 2. Kenapa FastAPI, bukan Flask/Django?

- FastAPI: async native, auto Swagger docs, Pydantic validation
- Flask: sync, butuh Flask-RESTX untuk Swagger, manual validation
- Django: terlalu heavy untuk API-only, ORM tidak perlu (pakai Supabase client)

### 3. Kenapa custom JWT, bukan Supabase Auth bawaan?

- Supabase Auth JWT expire 1 jam, terlalu cepat untuk UX
- Custom JWT: expire 7 hari, simpler flow
- Tapi: tidak bisa revoke sebelum expire (trade-off)

Workaround untuk revoke: tambah tabel `revoked_tokens` di DB (TODO V2).

### 4. Kenapa simpan blocks sebagai JSONB, bukan tabel terpisah?

- JSONB: 1 query untuk ambil seluruh snippet + blocks
- Tabel terpisah: butuh JOIN, lebih lambat untuk read
- Trade-off: sulit untuk query "cari semua block bahasa Python milik user X"

Untuk V1, JSONB cukup. Kalau perlu search/filter per block, migrate ke tabel terpisah.

### 5. Kenapa tidak simpan file PDF asli?

- Privacy: file user mungkin berisi data sensitif
- Storage cost: PDF bisa 50MB, simpan banyak = mahal
- Tidak perlu: text code di DB cukup untuk regenerate file via download endpoint

Trade-off: user tidak bisa re-extract kalau ada bug di extractor lama. Tapi user bisa upload ulang.

### 6. Kenapa FE dan BE terpisah?

- Vercel (FE) tidak support Python native + Tesseract
- Render (BE) tidak optimal untuk Next.js SSR
- Scale independent: kalau OCR banyak dipakai, scale BE saja

Trade-off: 2 deploy, CORS issue, network latency antar service.

### 7. Kenapa OCR pakai Tesseract, bukan cloud API (AWS Textract, Google Vision)?

- Tesseract: free, open-source, jalan lokal
- Cloud API: lebih akurat tapi bayar per request + privacy issue

Trade-off: Tesseract kurang akurat untuk kode kompleks (sering salah baca `<` `>` `$`). Tapi untuk modul dengan font jelas, OCR jarang dipakai (font-analysis cukup).

## Security Model

### Auth

- Password di-hash dengan bcrypt (cost factor 12)
- JWT signed dengan HS256, secret min 32 char
- JWT payload: `{sub: user_id, email, iat, exp, iss}`
- Expire 7 hari (configurable via `CL_JWT_EXPIRE_MINUTES`)

### Authorization

- BE dependency `get_current_user_id` parse JWT, return user_id
- Setiap endpoint protected panggil dependency ini
- BE juga enforce `user_id` di query Supabase (`eq("user_id", user_id)`)
- RLS Supabase sebagai defense-in-depth

### CORS

- BE whitelist origin via `CL_CORS_ORIGINS`
- Default: `["http://localhost:3000"]` untuk dev
- Production: `["https://codelooter.vercel.app"]`
- `allow_credentials=True` supaya cookie + Authorization header terkirim

### File Upload

- Max 50MB (configurable via `CL_MAX_UPLOAD_MB`)
- Validasi extension di BE (whitelist)
- File ditulis ke temp dir, diproses, langsung dihapus (tidak persistent)
- File asli tidak pernah disimpan ke DB

### Secrets Management

- Semua secret via env var (tidak hardcoded)
- `.env` file di `.gitignore` (tidak di-commit)
- `backend/.env.example` sebagai dokumentasi (placeholder value)
- Production: env var di Render/Vercel dashboard
- Service role key Supabase: rahasia, hanya di BE

## Performance Characteristics

Berdasarkan benchmark 12 modul dari berbagai universitas:

| Metrik | Font-based | OCR fallback |
|--------|------------|--------------|
| Avg time | 5-12 detik | 50-75 detik |
| Avg time per page | 0.1-0.2 detik | 2.5-3.5 detik |
| Avg blocks | 8-30 | 9-36 |
| Accuracy | 80-100% | 60-70% |

Bottleneck:
- OCR: Tesseract proses per halaman (sequential, tidak paralel)
- PDF besar: pdfplumber load semua char ke memory
- Network: file 5MB upload dari Vercel ke Render butuh 1-2 detik

## Scalability

### Vertical scale (single instance)

- Render Starter ($7/mo): 512MB RAM, 0.1 CPU
- Render Standard ($25/mo): 2GB RAM, 1 CPU
- Render Pro ($85/mo): 8GB RAM, 4 CPU

### Horizontal scale

- Render mendukung multiple instances (autoscale)
- Tapi session harus stateless (JWT sudah solve ini)
- File upload: pakai S3 untuk temp storage (kalau butuh persistent)

### Database

- Supabase free: 500MB storage, 50K MAU
- Supabase Pro ($25/mo): 8GB storage, 100K MAU, daily backup
- Untuk > 100K MAU: pakai connection pooler (PgBouncer)

## Monitoring & Observability

### Logging

- BE: `print()` ke stdout (Render capture)
- FE: `console.log()` ke browser dev tools
- Error: FastAPI auto-log ke stderr

### Health Check

- Endpoint `/health` return `{"status": "ok"}`
- Render pakai ini untuk cek service hidup (auto-restart kalau gagal)
- Vercel: otomatis, tidak perlu health check

### Metrics (TODO V2)

- Tambah `/metrics` endpoint pakai `prometheus-fastapi-instrumentator`
- Track: request count, latency, error rate, extract duration per format
- Integrate dengan Grafana atau Render dashboard

## Roadmap

Lihat `CHANGELOG.md` untuk history perubahan.

Prioritas berikutnya:
1. Integrasi python-docx/python-pptx untuk format Office
2. Rate limiting pakai `slowapi`
3. Caching extract result (Redis sudah ada di docker-compose)
4. Progress bar untuk OCR (SSE atau WebSocket)
5. Full-text search snippet (Supabase pgvector atau Algolia)
6. Share snippet via public URL (opsional, kalau user mau)
