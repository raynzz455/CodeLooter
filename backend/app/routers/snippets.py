"""Snippets router: CRUD untuk simpan & ambil hasil ekstraksi user.

Strategi penyimpanan:
- Yang disimpan: filename (string) + blocks (JSON array of {lang, code, lines})
- Yang TIDAK disimpan: file PDF/dokumen asli
- Setiap snippet milik 1 user (RLS: user hanya akses miliknya)

Download endpoint:
- GET /snippets/{id}/download?lang=python&block=0
  - Kalau block=0 (default), download semua block digabung jadi 1 file
  - Kalau block=N, hanya block ke-N
  - Lang dipakai untuk ekstensi file (.py, .js, .sql, .R, .cpp, dll)
  - Untuk multi-block, zip jadi 1 file .zip (TODO iterasi berikutnya)
"""
import io
import zipfile
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field
from typing import Annotated
from ..supabase_client import get_supabase_admin
from .auth import get_current_user_id

router = APIRouter(prefix="/snippets", tags=["snippets"])


# ─── Schemas ───
class BlockIn(BaseModel):
    index: int
    lang: str
    code: str
    lines: int
    source: str = "font"


class SnippetIn(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    blocks: list[BlockIn]
    total_blocks: int | None = None


class SnippetOut(BaseModel):
    id: str
    filename: str
    blocks: list[BlockIn]
    total_blocks: int
    created_at: str
    user_id: str


class SnippetListItem(BaseModel):
    id: str
    filename: str
    total_blocks: int
    created_at: str


# ─── Mapping bahasa → ekstensi file ───
LANG_EXT = {
    "python": "py",
    "r": "R",
    "javascript": "js",
    "typescript": "ts",
    "java": "java",
    "cpp": "cpp",
    "c": "c",
    "sql": "sql",
    "kotlin": "kt",
    "php": "php",
    "ruby": "rb",
    "go": "go",
    "rust": "rs",
    "swift": "swift",
    "scala": "scala",
    "bash": "sh",
    "shell": "sh",
    "html": "html",
    "css": "css",
    "json": "json",
    "yaml": "yml",
    "markdown": "md",
    "unknown": "txt",
}


def get_ext(lang: str) -> str:
    """Get file extension for a language."""
    return LANG_EXT.get(lang.lower(), "txt")


def slugify_filename(name: str) -> str:
    """Buat safe filename dari original filename."""
    # Strip extension & special chars
    base = name.rsplit(".", 1)[0] if "." in name else name
    safe = "".join(c for c in base if c.isalnum() or c in "-_").strip() or "snippet"
    return safe[:50]  # max 50 char


# ─── Routes ───
@router.post("", response_model=SnippetOut, status_code=status.HTTP_201_CREATED)
def create_snippet(
    payload: SnippetIn,
    user_id: str = Depends(get_current_user_id),
):
    """Simpan hasil ekstraksi ke DB. Butuh auth.

    Hanya simpan: filename + blocks (text code). TIDAK simpan file asli.
    """
    admin = get_supabase_admin()
    result = admin.table("snippets").insert({
        "user_id": user_id,
        "original_filename": payload.filename,
        "blocks": [b.model_dump() for b in payload.blocks],
        "total_blocks": payload.total_blocks or len(payload.blocks),
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Gagal menyimpan snippet")

    s = result.data[0]
    return SnippetOut(
        id=s["id"],
        filename=s["original_filename"],
        blocks=[BlockIn(**b) for b in s["blocks"]],
        total_blocks=s["total_blocks"],
        created_at=s["created_at"],
        user_id=s["user_id"],
    )


@router.get("", response_model=list[SnippetListItem])
def list_snippets(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
):
    """List semua snippet milik user yang login."""
    admin = get_supabase_admin()
    result = (
        admin.table("snippets")
        .select("id, original_filename, total_blocks, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [
        SnippetListItem(
            id=r["id"],
            filename=r["original_filename"],
            total_blocks=r["total_blocks"],
            created_at=r["created_at"],
        )
        for r in result.data
    ]


@router.get("/{snippet_id}", response_model=SnippetOut)
def get_snippet(
    snippet_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Ambil 1 snippet by ID. Hanya pemilik yang bisa lihat."""
    admin = get_supabase_admin()
    result = (
        admin.table("snippets")
        .select("*")
        .eq("id", snippet_id)
        .eq("user_id", user_id)  # RLS enforcement di BE
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Snippet tidak ditemukan")
    s = result.data[0]
    return SnippetOut(
        id=s["id"],
        filename=s["original_filename"],
        blocks=[BlockIn(**b) for b in s["blocks"]],
        total_blocks=s["total_blocks"],
        created_at=s["created_at"],
        user_id=s["user_id"],
    )


@router.delete("/{snippet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_snippet(
    snippet_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Hapus snippet. Hanya pemilik."""
    admin = get_supabase_admin()
    result = (
        admin.table("snippets")
        .delete()
        .eq("id", snippet_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Snippet tidak ditemukan")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Download as file ───
@router.get("/{snippet_id}/download")
def download_snippet(
    snippet_id: str,
    block: int = Query(-1, ge=-1, description="Block index. -1 = all blocks (digabung)."),
    user_id: str = Depends(get_current_user_id),
):
    """Download snippet sebagai file kode.

    - block=-1: gabung semua block jadi 1 file (atau zip kalau multi-lang)
    - block=N: hanya block ke-N, ekstensi sesuai lang

    BE generate file on-the-fly dari text code di DB.
    """
    admin = get_supabase_admin()
    result = (
        admin.table("snippets")
        .select("*")
        .eq("id", snippet_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Snippet tidak ditemukan")

    s = result.data[0]
    blocks = s["blocks"]
    base_filename = slugify_filename(s["original_filename"])

    # Mode 1: download single block
    if block >= 0:
        if block >= len(blocks):
            raise HTTPException(status_code=400, detail=f"Block index {block} out of range (0-{len(blocks)-1})")
        b = blocks[block]
        ext = get_ext(b["lang"])
        content = b["code"].encode("utf-8")
        filename = f"{base_filename}_{block}_{b['lang']}.{ext}"
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    # Mode 2: download all blocks
    # Gabung SEMUA blocks jadi 1 file, ext berdasarkan bahasa MAYORITAS
    if len(blocks) == 0:
        raise HTTPException(status_code=400, detail="Snippet kosong, tidak ada yang di-download")

    # Hitung bahasa mayoritas (voting)
    from collections import Counter
    lang_counts = Counter(b["lang"] for b in blocks)
    majority_lang = lang_counts.most_common(1)[0][0] if lang_counts else "unknown"
    ext = get_ext(majority_lang)

    # Gabung semua blocks jadi 1 file
    # Pisah tiap block dengan komentar separator
    combined_parts = []
    for b in blocks:
        lang = b["lang"]
        # Comment separator sesuai bahasa
        if ext in ("py",):
            sep = f"# {'=' * 60}\n# Block {b['index']} ({lang})\n# {'=' * 60}\n"
        elif ext in ("R",):
            sep = f"# {'=' * 60}\n# Block {b['index']} ({lang})\n# {'=' * 60}\n"
        elif ext in ("js", "ts", "java", "cpp", "c", "kt", "go", "rs", "swift", "scala"):
            sep = f"// {'=' * 60}\n// Block {b['index']} ({lang})\n// {'=' * 60}\n"
        elif ext in ("sql",):
            sep = f"-- {'=' * 60}\n-- Block {b['index']} ({lang})\n-- {'=' * 60}\n"
        else:
            sep = f"# === Block {b['index']} ({lang}) ===\n"
        combined_parts.append(sep + b["code"])

    combined = "\n\n".join(combined_parts)
    content = combined.encode("utf-8")
    filename = f"{base_filename}_all.{ext}"

    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
