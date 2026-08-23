# Dockerfile untuk backend dengan OCR support
# Pakai kalau Anda mau enable OCR (Tesseract) di Render.
# Render free tier Python tidak punya Tesseract pre-installed,
# jadi butuh Docker image sendiri.

FROM python:3.12-slim

# Install system deps:
# - poppler-utils: pdftotext, pdftoppm (untuk PDF → image untuk OCR)
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

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
