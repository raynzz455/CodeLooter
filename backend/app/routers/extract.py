"""Extract router: terima file PDF, jalankan pdf_extract.py sidecar,
return code blocks. Tidak butuh auth (anonymous bisa pakai).

Tapi kalau user login dan mau simpan hasil, mereka akan panggil
endpoint /snippets (yang butuh auth) dengan hasil dari sini.
"""
import os
import sys
import json
import tempfile
import subprocess
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Request
from pydantic import BaseModel

router = APIRouter(prefix="/extract", tags=["extract"])


# Path ke script Python (relative ke file ini: backend/app/routers/extract.py)
# parents[0] = routers, parents[1] = app, parents[2] = backend
SIDECAR_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "pdf_extract.py"
SIDECAR_TIMEOUT = 300  # 5 menit (OCR butuh waktu lama)


class CodeBlock(BaseModel):
    index: int
    lang: str
    code: str
    lines: int
    source: str = "font"


class ExtractResponse(BaseModel):
    blocks: list[CodeBlock]
    filename: str
    size: int
    total: int
    stats: dict | None = None


@router.post("", response_model=ExtractResponse)
async def extract_code(request: Request, file: UploadFile = File(...)):
    """Terima file PDF/DOCX/PPTX/MD/IPYNB, return code blocks.

    File TIDAK disimpan ke DB. Hanya filename yang dipreserve di response,
    kalau user mau save, FE akan POST /snippets dengan filename + blocks.

    Format didukung:
    - PDF (font-based + OCR fallback)
    - DOCX, PPTX, XLSX (via officeparser — TODO: integrasi nanti)
    - MD, IPYNB, TXT, TEX (via heuristic — TODO: integrasi nanti)

    Untuk V1, hanya PDF yang di-support di backend Python.
    """
    # Baca file
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File kosong")

    # Cek ukuran
    max_bytes = int(os.environ.get("CL_MAX_UPLOAD_MB", "50")) * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran file {len(content)/1024/1024:.1f}MB melebihi batas {max_bytes/1024/1024:.0f}MB"
        )

    # Validasi extension
    filename = file.filename or "upload.pdf"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    supported = {"pdf", "docx", "pptx", "xlsx", "md", "ipynb", "txt", "tex"}
    if ext not in supported:
        raise HTTPException(
            status_code=400,
            detail=f"Format .{ext} tidak didukung. Format yang didukung: {', '.join(sorted(supported))}"
        )

    # Untuk V1: hanya PDF yang diproses via Python sidecar
    # Format lain (docx, md, ipynb) — TODO di iterasi berikutnya
    if ext != "pdf":
        raise HTTPException(
            status_code=400,
            detail=f"Format .{ext} belum didukung di backend V1. Sementara hanya .pdf yang bisa diproses. Format lain akan datang di iterasi berikutnya."
        )

    # Tulis file ke temp dir lalu panggil sidecar
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        proc = subprocess.run(
            [sys.executable, str(SIDECAR_SCRIPT), tmp_path],
            capture_output=True, text=True, timeout=SIDECAR_TIMEOUT
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail=f"Proses ekstraksi timeout setelah {SIDECAR_TIMEOUT}s. File mungkin terlalu besar atau berbasis gambar (OCR lambat)."
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Sidecar error: {proc.stderr[:500]}"
        )

    try:
        result = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sidecar output bukan JSON valid: {e}. Output: {proc.stdout[:300]}"
        )

    if "error" in result and "blocks" not in result:
        raise HTTPException(status_code=422, detail=result["error"])

    blocks = [
        CodeBlock(
            index=i,
            lang=b.get("lang", "unknown"),
            code=b["code"],
            lines=b["lines"],
            source=b.get("source", "font"),
        )
        for i, b in enumerate(result.get("blocks", []))
    ]

    return ExtractResponse(
        blocks=blocks,
        filename=filename,
        size=len(content),
        total=len(blocks),
        stats=result.get("stats"),
    )
