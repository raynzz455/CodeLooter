# Contributing to CodeLooter

Terima kasih sudah tertarik berkontribusi ke CodeLooter. Dokumen ini menjelaskan cara setup development environment, alur kontribusi, dan convention yang harus diikuti.

## Prasyarat

Sebelum mulai, pastikan Anda punya:

- Node.js 18 atau lebih baru (cek dengan `node --version`)
- Python 3.11 atau lebih baru (cek dengan `python3 --version`)
- Git (cek dengan `git --version`)
- Akun Supabase (free tier cukup) di https://supabase.com
- Docker dan Docker Compose (opsional, untuk dev lokal terisolasi)

Untuk dukungan OCR (PDF image-based):
- Tesseract OCR: `sudo apt install tesseract-ocr` (Linux) atau `brew install tesseract` (macOS)
- poppler-utils: `sudo apt install poppler-utils` (Linux) atau `brew install poppler` (macOS)

## Setup Development Environment

### Opsi A: Manual setup (FE dan BE di proses terpisah)

1. **Clone repo**:
   ```bash
   git clone https://github.com/raynzz455/CodeLooter.git
   cd CodeLooter
   ```

2. **Setup Supabase**:
   - Buat project baru di https://supabase.com/dashboard
   - Buka SQL Editor, paste isi `supabase/migrations/001_init.sql`, klik Run
   - Catat dari Settings → API: URL, anon key, service_role key

3. **Setup backend**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env, isi dengan nilai dari Supabase dashboard
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
   BE akan jalan di http://localhost:8000. Swagger docs di http://localhost:8000/docs.

4. **Setup frontend** (di terminal baru):
   ```bash
   # Dari root repo
   cp .env.local.example .env.local
   # Edit .env.local, default sudah OK (http://localhost:8000/api)
   npm install
   npm run dev
   ```
   FE akan jalan di http://localhost:3000.

### Opsi B: Docker Compose (semua service sekali jalan)

1. **Setup env files**:
   ```bash
   cp .env.local.example .env.local
   cp backend/.env.example backend/.env
   # Edit backend/.env dengan nilai asli dari Supabase
   ```

2. **Jalankan semua service**:
   ```bash
   docker compose up
   ```
   FE di http://localhost:3000, BE di http://localhost:8000, Redis di localhost:6379.

3. **Untuk stop**:
   ```bash
   docker compose down
   ```

## Alur Kontribusi

1. **Fork repo** di GitHub (kalau Anda external contributor)
2. **Buat branch baru** dari `main`:
   ```bash
   git checkout -b feat/nama-fitur
   # atau: fix/nama-bug, docs/nama-dokumen, refactor/nama-refactor
   ```
3. **Buat perubahan**, commit dengan pesan yang jelas:
   ```bash
   git commit -m "feat(extract): tambah dukungan format ODT"
   ```
4. **Push branch** ke fork Anda:
   ```bash
   git push origin feat/nama-fitur
   ```
5. **Buat Pull Request** ke `main` branch repo utama

## Convention Commit Message

Pakai format Conventional Commits:

```
<type>(<scope>): <subject>

<body optional>

<footer optional>
```

### Type yang valid

| Type | Kapan dipakai |
|------|---------------|
| `feat` | Fitur baru |
| `fix` | Bug fix |
| `docs` | Dokumentasi saja (README, CONTRIBUTING, dll) |
| `style` | Formatting, whitespace, titik koma (tidak ubah logic) |
| `refactor` | Refactor code tanpa ubah behavior |
| `perf` | Performance improvement |
| `test` | Tambah/koreksi test |
| `chore` | Maintenance: deps, config, build script |
| `ci` | CI/CD changes |
| `revert` | Revert commit sebelumnya |

### Scope (opsional)

Pakai nama modul atau area: `extract`, `auth`, `snippets`, `frontend`, `backend`, `pdf`, `ui`.

### Contoh

```
feat(extract): tambah dukungan format ODT via python-docx

Implementasi extractor baru untuk file .odt (OpenDocument Text).
Pakai library python-docx untuk parse, lalu reuse heuristic
token-density yang sama dengan TXT extraction.

Closes #42
```

## Code Style

### Python (Backend)

- Pakai formatter `black` (line length 100)
- Pakai linter `ruff` atau `flake8`
- Type hints wajib untuk function signature
- Docstring untuk semua public function (Google style)

```python
def detect_language(code: str) -> str:
    """Deteksi bahasa dari string kode.

    Args:
        code: String kode yang akan di-detect bahasanya.

    Returns:
        string bahasa lowercase, mis. "python", "r", "unknown".

    Raises:
        ValueError: kalau code kosong atau bukan string.
    """
    ...
```

### TypeScript (Frontend)

- Pakai formatter `prettier` (default config)
- Strict TypeScript, no `any` kecuali benar-benar perlu
- Functional component + hooks (no class component)
- Named export (bukan default export) untuk reusable components

```typescript
interface CodeBlockProps {
  code: string;
  lang: string;
  onCopy?: () => void;
}

export function CodeBlock({ code, lang, onCopy }: CodeBlockProps) {
  // ...
}
```

## Testing

### Backend

```bash
cd backend
# Run all tests (TODO: tambah pytest test suite)
pytest

# Run specific test file
pytest tests/test_language_detection.py

# Run with coverage
pytest --cov=app --cov-report=html
```

### Frontend

```bash
# Run unit tests (TODO: tambah Jest/Vitest setup)
npm test

# Run e2e tests (TODO: tambah Playwright setup)
npm run e2e
```

### Manual test extract

```bash
# Test BE dengan sample file
curl -X POST -F 'file=@sample.pdf' http://localhost:8000/api/extract

# Test language detection
cd backend
python3 -c "
from app.language_detection import detect_language
print(detect_language('print(\"hello\")'))
"
```

## Struktur Repo

Baca `ARCHITECTURE.md` untuk detail arsitektur dan alur data.

Singkatnya:
- `app/` — Frontend Next.js (pages, components)
- `backend/` — Backend FastAPI (routers, services, scripts)
- `lib/` — Frontend utility (API client)
- `supabase/migrations/` — SQL schema
- `scripts/` — Utility scripts (kalau ada)

## Pull Request Review

Setiap PR akan direview dengan checklist berikut:

- [ ] Code mengikuti style guide (Python: black+flake8, TS: prettier)
- [ ] Type hints / TypeScript types lengkap
- [ ] Test coverage tidak turun (kalau ada test suite)
- [ ] Dokumentasi update (README kalau ada fitur baru)
- [ ] Tidak ada secret/credential yang di-commit
- [ ] Commit message mengikuti Conventional Commits
- [ ] Tidak ada `console.log` / `print` yang tertinggal
- [ ] Error handling proper (tidak ada bare `except`)

## Reporting Issues

Saat buat issue baru, sertakan:

1. **Deskripsi masalah**: apa yang terjadi, apa yang diharapkan
2. **Langkah reproduksi**: step-by-step cara trigger masalah
3. **Environment**:
   - OS (Linux/macOS/Windows)
   - Browser (kalau masalah FE)
   - Versi Node/Python
   - Apakah pakai Docker atau manual setup
4. **Log error** (kalau ada): paste full stack trace
5. **Sample file** (kalau masalah extract): upload PDF yang bermasalah

## License

Dengan berkontribusi ke CodeLooter, Anda setuju bahwa kontribusi Anda akan dilisensikan di bawah MIT License.

## Pertanyaan?

- Email: raynss455x@gmail.com
- GitHub Issues: https://github.com/raynzz455/CodeLooter/issues
