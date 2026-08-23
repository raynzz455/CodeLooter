# CodeLooter

**Ekstrak kode dari dokumen praktikum/paper secara presisi — tanpa LLM.**

CodeLooter menerima file PDF/DOCX/PPTX/MD/IPYNB/TXT/TEX, lalu mengembalikan
setiap code block yang ada di dalamnya dalam bahasa yang terdeteksi otomatis.
User login bisa simpan hasil ekstraksi ke akunnya dan download ulang sebagai
file kode (.py/.js/.sql/dll) kapan saja.

## 🏗️ Arsitektur V2 (Backend + Frontend terpisah)

```
┌─────────────────────────────────────┐         ┌──────────────────────────┐
│  FRONTEND (Vercel)                  │         │  BACKEND (Render)        │
│  Next.js 16 + React 19              │  HTTPS  │  FastAPI + Python        │
│  ────────────────────────           │ ───────▶│  ─────────────────────── │
│  Routes:                            │  Bearer │  Endpoints:              │
│  • /            (home + extract)   │  JWT    │  • POST /api/auth/regis  │
│  • /auth        (login/register)    │         │  • POST /api/auth/login  │
│  • /dashboard   (list snippets)     │         │  • GET  /api/auth/me     │
│  • /snippets/[id] (view+download)   │         │  • POST /api/extract     │
│                                    │         │  • POST /api/snippets    │
│  Auth: JWT di cookie (js-cookie)   │         │  • GET  /api/snippets    │
│  API client: lib/api.ts             │         │  • GET  /api/snippets/{id}│
└─────────────────────────────────────┘         │  • DELETE /api/snippets/{id}│
                                                │  • GET  /api/snippets/{id}/download
                                                │                          │
                                                │  Sidecar:                │
                                                │  scripts/pdf_extract.py  │
                                                │  (font-based + OCR)      │
                                                └──────────────┬───────────┘
                                                               │
                                                               ▼
                                          ┌──────────────────────────────────┐
                                          │  SUPABASE (PostgreSQL)           │
                                          │  ────────────────────────────── │
                                          │  Tables:                         │
                                          │  • public.profiles               │
                                          │    - id (uuid, pk)              │
                                          │    - email (unique)              │
                                          │    - password_hash (bcrypt)     │
                                          │    - name                        │
                                          │  • public.snippets               │
                                          │    - id (uuid, pk)              │
                                          │    - user_id (fk → profiles.id)  │
                                          │    - original_filename (text)    │
                                          │    - blocks (jsonb)              │
                                          │    - total_blocks (int)         │
                                          │    - created_at (timestamptz)   │
                                          │  RLS: user hanya akses miliknya │
                                          └──────────────────────────────────┘
```

### Alur data

1. **Upload & Extract**: User upload PDF → FE panggil `POST /api/extract` →
   BE jalankan `pdf_extract.py` (font analysis + OCR fallback) → return code blocks
2. **Save (opsional, butuh login)**: FE panggil `POST /api/snippets` dengan
   filename + blocks → BE insert ke Supabase `snippets` table dengan `user_id`
   dari JWT
3. **List & View**: User login → buka `/dashboard` → FE panggil
   `GET /api/snippets` → tampilkan list
4. **Download**: User klik download di `/snippets/[id]` → FE panggil
   `GET /api/snippets/{id}/download?block=N` → BE ambil text code dari DB,
   generate file (atau ZIP kalau multi-lang), return sebagai blob

### Yang TIDAK disimpan di DB

- ❌ File PDF/dokumen asli (cuma `original_filename` string)
- ❌ Log aktivitas user
- ❌ Cookies atau session ID (JWT self-contained)

### Yang disimpan di DB

- ✅ User profile (email + bcrypt hash password)
- ✅ Filename + blocks (JSON array: `{lang, code, lines, source}` per block)

## 🚀 Quick Start (Development)

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase project (https://supabase.com)
- Tesseract OCR + poppler-utils (untuk OCR image-based PDF):
  ```bash
  sudo apt install tesseract-ocr poppler-utils
  ```

### 1. Setup Supabase

Buat project di https://supabase.com, lalu jalankan SQL migration:

```bash
# Buka Supabase SQL Editor, paste isi file ini, klik Run
cat supabase/migrations/001_init.sql
```

### 2. Setup Backend

```bash
cd backend

# Copy env example
cp .env.example .env
# Edit .env, isi dengan URL & key dari Supabase dashboard
# - CL_SUPABASE_URL
# - CL_SUPABASE_ANON_KEY
# - CL_SUPABASE_SERVICE_ROLE_KEY
# - CL_JWT_SECRET (generate dengan: openssl rand -base64 48)

# Install deps
pip install -r requirements.txt

# Run
uvicorn app.main:app --reload --port 8000
```

BE akan jalan di http://localhost:8000. Swagger docs di http://localhost:8000/docs.

### 3. Setup Frontend

```bash
# Dari root repo
npm install

# Set env var
echo 'NEXT_PUBLIC_API_BASE=http://localhost:8000/api' > .env.local

# Run
npm run dev
```

FE akan jalan di http://localhost:3000.

## 📦 Deploy ke Production

### Frontend → Vercel

1. Push repo ke GitHub
2. Buka https://vercel.com → Import project → pilih repo
3. Set env var:
   - `NEXT_PUBLIC_API_BASE` = `https://codelooter-api.onrender.com/api`
4. Deploy

### Backend → Render

1. Buka https://render.com → New → Web Service → connect GitHub repo
2. Setting:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**: isi semua `CL_*` dari `.env` local
3. Deploy

**Untuk OCR support** (image-based PDF), pakai Docker image:
- Render service type: Docker
- Dockerfile path: `backend/Dockerfile`

### Database → Supabase

Sudah setup di step 1. Tidak perlu deploy terpisah — Supabase hosted.

## 🛠️ Stack Teknologi

| Layer | Tech | Alasan |
|-------|------|--------|
| Frontend | Next.js 16 + React 19 | Vercel deploy seamless, App Router untuk SSR/SSG |
| Backend | FastAPI (Python) | Native pdfplumber/pytesseract, async, auto-docs |
| Database | Supabase (PostgreSQL) | Free tier, RLS bawaan, dashboard mudah |
| Auth | JWT (python-jose) + bcrypt | Self-contained token, tidak butuh session store |
| PDF parsing | pdfplumber | Font analysis paling akurat |
| OCR | Tesseract | Open-source, banyak bahasa didukung |
| Hosting FE | Vercel | Free hobby tier, auto-deploy dari GitHub |
| Hosting BE | Render | Free tier untuk Python, support Docker untuk OCR |

## 📁 Struktur Repo

```
CodeLooter/
├── app/                          # Next.js FE
│   ├── api/extract/route.ts     # (legacy, bisa dihapus kalau BE live)
│   ├── auth/page.tsx             # Login/register page
│   ├── dashboard/page.tsx        # User's snippet list
│   ├── snippets/[id]/page.tsx    # Snippet detail + download
│   ├── page.tsx                  # Home (extract + save)
│   ├── layout.tsx
│   └── globals.css
├── components/                   # React components (SplashScreen, dll)
├── lib/api.ts                   # FE API client (fetch wrapper)
├── types/index.ts                # TypeScript types
│
├── backend/                      # FastAPI BE
│   ├── app/
│   │   ├── main.py               # FastAPI app + CORS + router registration
│   │   ├── config.py             # Settings (env var)
│   │   ├── auth.py               # JWT + bcrypt helpers
│   │   ├── supabase_client.py    # Supabase client (anon + admin)
│   │   └── routers/
│   │       ├── auth.py           # /auth/register, /login, /me
│   │       ├── extract.py        # /extract (PDF → code blocks)
│   │       └── snippets.py       # /snippets CRUD + /download
│   ├── scripts/pdf_extract.py    # Sidecar: font analysis + OCR
│   ├── requirements.txt
│   ├── Dockerfile                # For Render Docker deploy (with OCR)
│   └── .env.example
│
├── supabase/migrations/
│   └── 001_init.sql              # Schema: profiles + snippets tables
│
├── render.yaml                   # Render deploy config
├── package.json                  # FE deps
├── next.config.ts
└── README.md
```

## 🔐 Keamanan

- **JWT secret**: minimal 32 karakter, generate dengan `openssl rand -base64 48`
- **Service role key**: hanya di BE, JANGAN expose ke FE
- **RLS**: aktif di Supabase `snippets` table, user hanya akses miliknya
- **CORS**: BE hanya accept request dari origin yang di-whitelist
- **Password**: hash bcrypt (cost factor 12), tidak pernah disimpan plain text
- **File upload**: max 50MB (configurable via `CL_MAX_UPLOAD_MB`)
- **Cookie**: `sameSite: "lax"`, expire 7 hari

## 📝 License

MIT
