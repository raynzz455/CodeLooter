"""Extract router: terima file, jalankan extractor, return code blocks.

Mendukung:
- PDF: via pdf_extract.py sidecar (font-analysis + OCR fallback)
- MD, IPYNB, TXT, TEX, HTML: parse langsung di Python (tidak butuh sidecar)
- DOCX, PPTX, XLSX: TODO di iterasi berikutnya (bisa pakai python-docx, python-pptx)

Deteksi bahasa dilakukan di BE via language_detection.py (pygments + custom override).
"""
import os
import sys
import json
import re
import tempfile
import subprocess
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Request
from pydantic import BaseModel

from ..language_detection import detect_language

router = APIRouter(prefix="/extract", tags=["extract"])


# Path ke script Python (relative ke file ini: backend/app/routers/extract.py)
# parents[0] = routers, parents[1] = app, parents[2] = backend
SIDECAR_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "pdf_extract.py"
SIDECAR_TIMEOUT = 300  # 5 menit (OCR butuh waktu lama)

# Format yang bisa diproses langsung di BE (tanpa sidecar)
PLAIN_TEXT_EXTS = {"txt", "tex", "latex", "sty", "cls"}
MARKDOWN_EXTS = {"md", "markdown"}
IPYNB_EXTS = {"ipynb"}
HTML_EXTS = {"html", "htm"}

# Format yang butuh sidecar Python pdf_extract.py
PDF_EXTS = {"pdf"}

# Format yang didukung oleh officeparser (Node.js) — untuk V1, masih pakai FE route lama
# TODO: integrasikan python-docx/python-pptx di iterasi berikutnya
OFFICE_EXTS = {"docx", "pptx", "xlsx"}

ALL_SUPPORTED_EXTS = (
    PDF_EXTS | PLAIN_TEXT_EXTS | MARKDOWN_EXTS | IPYNB_EXTS | HTML_EXTS | OFFICE_EXTS
)


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
    """Ekstrak code blocks dari file yang di-upload.

    Format didukung:
    - PDF (font-based + OCR fallback via Tesseract)
    - Markdown (.md) — fenced code blocks
    - IPYNB (.ipynb) — code cells
    - HTML (.html) — text content dengan code blocks
    - TXT / TEX / LATEX — plain text + LaTeX verbatim/lstlisting

    Format yang belum didukung di BE (pakai FE route lama):
    - DOCX, PPTX, XLSX (TODO: integrasi python-docx/python-pptx)

    File TIDAK disimpan ke DB. Hanya filename yang dipreserve di response.
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
    if ext not in ALL_SUPPORTED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Format .{ext} tidak didukung. Format yang didukung: {', '.join(sorted(ALL_SUPPORTED_EXTS))}"
        )

    # Route ke extractor yang sesuai
    if ext in PDF_EXTS:
        blocks = await extract_pdf(content, ext)
    elif ext in MARKDOWN_EXTS:
        blocks = extract_markdown(content.decode("utf-8", errors="replace"))
    elif ext in IPYNB_EXTS:
        blocks = extract_ipynb(content.decode("utf-8", errors="replace"))
    elif ext in HTML_EXTS:
        blocks = extract_html(content.decode("utf-8", errors="replace"))
    elif ext in PLAIN_TEXT_EXTS:
        blocks = extract_plain_text(content.decode("utf-8", errors="replace"), ext)
    elif ext in OFFICE_EXTS:
        # TODO: implementasi pakai python-docx / python-pptx
        raise HTTPException(
            status_code=400,
            detail=f"Format .{ext} belum didukung di BE. Sementara gunakan FE route lama /api/extract. Integrasi python-docx/python-pptx akan datang di iterasi berikutnya."
        )
    else:
        raise HTTPException(status_code=400, detail=f"Format .{ext} tidak didukung")

    # Deteksi bahasa untuk setiap block
    for block in blocks:
        if not block.lang or block.lang == "unknown":
            block.lang = detect_language(block.code)

    return ExtractResponse(
        blocks=blocks,
        filename=filename,
        size=len(content),
        total=len(blocks),
        stats=None,
    )


# ─── PDF extraction via sidecar ───
async def extract_pdf(content: bytes, ext: str) -> list[CodeBlock]:
    """Ekstrak code blocks dari PDF via pdf_extract.py sidecar."""
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

    return [
        CodeBlock(
            index=i,
            lang=b.get("lang", "unknown"),  # akan di-override oleh detect_language
            code=b["code"],
            lines=b["lines"],
            source=b.get("source", "font"),
        )
        for i, b in enumerate(result.get("blocks", []))
    ]


# ─── Markdown extraction ───
FENCED_RE = re.compile(
    r"```(\w*)\n?([\s\S]*?)```|~~~(\w*)\n?([\s\S]*?)~~~",
    re.MULTILINE,
)


def extract_markdown(text: str) -> list[CodeBlock]:
    """Ekstrak fenced code blocks dari Markdown."""
    blocks = []
    idx = 0
    for m in FENCED_RE.finditer(text):
        hint = (m.group(1) or m.group(3) or "").lower().strip()
        code = (m.group(2) or m.group(4) or "").strip()
        if len(code) < 10:
            continue
        # Pakai hint kalau ada, kalau tidak akan di-detect nanti
        lang = hint if hint else "unknown"
        blocks.append(CodeBlock(
            index=idx,
            lang=lang,
            code=code,
            lines=code.count("\n") + 1,
            source="fenced",
        ))
        idx += 1
    return blocks


# ─── IPYNB extraction ───
def extract_ipynb(text: str) -> list[CodeBlock]:
    """Ekstrak code cells dari Jupyter Notebook."""
    try:
        nb = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="IPYNB file bukan JSON valid")

    blocks = []
    idx = 0
    for cell in nb.get("cells", []):
        if cell.get("cell_type") != "code":
            continue
        source = cell.get("source", "")
        if isinstance(source, list):
            code = "".join(source)
        else:
            code = str(source)
        code = code.strip()
        if len(code) < 10:
            continue
        # IPYNB default Python, biar detect_language confirm
        blocks.append(CodeBlock(
            index=idx,
            lang="unknown",  # akan di-detect nanti
            code=code,
            lines=code.count("\n") + 1,
            source="ipynb",
        ))
        idx += 1
    return blocks


# ─── HTML extraction ───
def extract_html(text: str) -> list[CodeBlock]:
    """Ekstrak <pre><code> blocks dari HTML."""
    # Cari <pre><code>...</code></pre> atau <code class="language-X">
    pre_code_re = re.compile(
        r"<pre[^>]*>\s*<code[^>]*>([\s\S]*?)</code>\s*</pre>",
        re.IGNORECASE,
    )
    code_class_re = re.compile(
        r'<code[^>]*class=["\']language-(\w+)["\'][^>]*>([\s\S]*?)</code>',
        re.IGNORECASE,
    )

    blocks = []
    idx = 0

    # Pattern 1: <pre><code class="language-X">...</code></pre>
    for m in pre_code_re.finditer(text):
        # Cek apakah ada class language-X
        full_match = m.group(0)
        class_match = code_class_re.search(full_match)
        if class_match:
            hint = class_match.group(1).lower()
            code = class_match.group(2)
        else:
            hint = ""
            code = m.group(1)

        # Unescape HTML entities
        code = (code
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
                .replace("&quot;", '"')
                .replace("&#39;", "'")
                .strip())
        if len(code) < 10:
            continue
        blocks.append(CodeBlock(
            index=idx,
            lang=hint if hint else "unknown",
            code=code,
            lines=code.count("\n") + 1,
            source="html",
        ))
        idx += 1

    return blocks


# ─── Plain text / LaTeX extraction ───
def extract_plain_text(text: str, ext: str) -> list[CodeBlock]:
    """Ekstrak code blocks dari plain text atau LaTeX file.

    Untuk .tex: cari \begin{lstlisting}, \begin{verbatim}, \begin{minted}
    Untuk .txt: pakai heuristic token-density (sederhana)
    """
    if ext in {"tex", "latex", "sty", "cls"}:
        return extract_latex(text)
    else:
        # .txt: heuristic sederhana
        return extract_txt_heuristic(text)


def extract_latex(text: str) -> list[CodeBlock]:
    """Ekstrak code dari LaTeX lstlisting/verbatim/minted."""
    blocks = []
    idx = 0

    # \begin{lstlisting}[language=X]...\end{lstlisting}
    lst_re = re.compile(
        r"\\begin\{lstlisting\}(?:\[language=([^\]]+)\])?([\s\S]*?)\\end\{lstlisting\}",
        re.MULTILINE,
    )
    for m in lst_re.finditer(text):
        hint = (m.group(1) or "").lower().strip()
        code = (m.group(2) or "").strip()
        if len(code) < 10:
            continue
        blocks.append(CodeBlock(
            index=idx,
            lang=hint if hint else "unknown",
            code=code,
            lines=code.count("\n") + 1,
            source="latex",
        ))
        idx += 1

    # \begin{verbatim}...\end{verbatim}
    verb_re = re.compile(
        r"\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}",
        re.MULTILINE,
    )
    for m in verb_re.finditer(text):
        code = (m.group(1) or "").strip()
        if len(code) < 10:
            continue
        blocks.append(CodeBlock(
            index=idx,
            lang="unknown",  # akan di-detect
            code=code,
            lines=code.count("\n") + 1,
            source="latex",
        ))
        idx += 1

    # \begin{minted}{lang}...\end{minted}
    mint_re = re.compile(
        r"\\begin\{minted\}(?:\{?\s*(\w+)\s*\}?)?([\s\S]*?)\\end\{minted\}",
        re.MULTILINE,
    )
    for m in mint_re.finditer(text):
        hint = (m.group(1) or "").lower().strip()
        code = (m.group(2) or "").strip()
        if len(code) < 10:
            continue
        blocks.append(CodeBlock(
            index=idx,
            lang=hint if hint else "unknown",
            code=code,
            lines=code.count("\n") + 1,
            source="latex",
        ))
        idx += 1

    return blocks


def extract_txt_heuristic(text: str) -> list[CodeBlock]:
    """Heuristic sederhana untuk TXT — pakai scoring kode-like per baris."""
    lines = text.split("\n")
    if not lines:
        return []

    # Score setiap baris
    def score_line(line: str) -> int:
        t = line.strip()
        if not t:
            return 0
        # Pattern kode umum
        score = 0
        if re.search(r"\b(def|class|import|from|return|if|else|elif|for|while|"
                     r"function|var|let|const|public|private|static|void|int|float|"
                     r"library|require|print|echo|SELECT|FROM|WHERE)\b", t):
            score += 2
        if re.search(r"[(){}\[\];=<>+\-*/\\&|!?:,'\".]", t):
            score += 1
        if re.search(r"\b\w+\s*\(", t):  # function call
            score += 1
        if re.search(r"<-|->|%>%|:=", t):
            score += 2
        if re.match(r"^\s*#", t):
            score += 1
        return score

    # Group adjacent kode-like lines jadi blocks
    blocks = []
    current_block_lines = []
    idx = 0
    THRESHOLD = 2

    for line in lines:
        if score_line(line) >= THRESHOLD:
            current_block_lines.append(line)
        else:
            if len(current_block_lines) >= 2:
                code = "\n".join(current_block_lines).strip()
                if len(code) >= 10:
                    blocks.append(CodeBlock(
                        index=idx,
                        lang="unknown",  # akan di-detect
                        code=code,
                        lines=code.count("\n") + 1,
                        source="heuristic",
                    ))
                    idx += 1
            current_block_lines = []

    # Flush sisa
    if len(current_block_lines) >= 2:
        code = "\n".join(current_block_lines).strip()
        if len(code) >= 10:
            blocks.append(CodeBlock(
                index=idx,
                lang="unknown",
                code=code,
                lines=code.count("\n") + 1,
                source="heuristic",
            ))

    return blocks
