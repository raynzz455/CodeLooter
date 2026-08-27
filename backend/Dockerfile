# Dockerfile untuk backend CodeLooter dengan uv (fast Python package manager)
# Image base: python:3.12-slim + Tesseract OCR + poppler + uv
# Build: docker build -t codelooter-backend ./backend
# Run: docker run -p 8000:8000 codelooter-backend

# Stage 1: Build dengan uv (cache layer terpisah supaya cepat)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

# Install system deps untuk OCR + PDF processing
# - poppler-utils: pdftotext, pdftoppm (untuk PDF -> image untuk OCR)
# - tesseract-ocr: OCR engine
# - tesseract-ocr-eng: English language pack
# - libgl1: dependency untuk Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pyproject.toml dulu (untuk cache layer)
COPY pyproject.toml ./

# Sync dependencies pakai uv (jauh lebih cepat dari pip)
# --frozen: pakai lockfile kalau ada, kalau tidak resolve dari pyproject.toml
# --no-dev: skip dev dependencies
RUN uv sync --frozen --no-dev 2>/dev/null || uv sync --no-dev

# Copy source code
COPY . .

# Stage 2: Runtime (final image yang lebih kecil)
FROM python:3.12-slim

# Install runtime system deps (tanpa build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy virtualenv dari builder (sudah berisi semua deps)
COPY --from=builder /app /app

# Set PATH supaya binary dari .venv bisa diakses
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Run uvicorn dengan uv virtualenv
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
