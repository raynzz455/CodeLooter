"""LLM-based code extraction — kirim full text ke LLM, minta extract code blocks.

Pendekatan ini menggantikan SEMUA heuristic manual (mini-model, scoring, if-else).
LLM paham konteks dokumen dan bisa distinguish code vs prose secara natural.

Pipeline:
1. Extract semua text dari PDF (via PyMuPDF, per halaman)
2. Kirim text ke LLM dengan prompt: "Extract all code blocks, return as JSON"
3. LLM return [{code, lang}, ...]
4. Return ke user

Keunggulan:
- Tidak ada heuristic manual yang error-prone
- Akurasi tinggi (LLM paham struktur dokumen)
- Code + language detection dalam 1 request
- Bisa handle PDF, DOCX, TXT, MD (semua text-based)
"""
import json
import subprocess
import tempfile
import os
import re
from typing import List, Dict, Any


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract semua text dari PDF via PyMuPDF."""
    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        all_text = []
        for page_idx in range(doc.page_count):
            page = doc[page_idx]
            text = page.get_text("text")
            if text.strip():
                all_text.append(f"--- PAGE {page_idx + 1} ---\n{text}")
        doc.close()
        return "\n\n".join(all_text)
    except ImportError:
        return ""
    except Exception:
        return ""


def extract_code_via_llm(full_text: str, max_chars: int = 12000) -> List[Dict[str, Any]]:
    """Kirim text ke LLM, minta extract code blocks.

    Args:
        full_text: Full text dari dokumen
        max_chars: Max chars yang dikirim ke LLM (token limit)

    Returns:
        List of {code, lang} dicts
    """
    if not full_text or len(full_text.strip()) < 50:
        return []

    # Truncate kalau terlalu panjang (LLM token limit)
    truncated = full_text[:max_chars]
    if len(full_text) > max_chars:
        truncated += "\n... (text truncated)"

    prompt = f"""You are a code extraction tool. Extract ALL code blocks from the document below.

Return a JSON array. Each element: {{"code": "...", "lang": "r"}} where lang is lowercase.

Rules:
- Extract ONLY actual code (not prose/narrative)
- Include multi-line code as one block
- Remove R console output (lines starting with ##)
- Detect language: r, python, javascript, typescript, java, cpp, c, sql, kotlin, php, ruby, go, rust, swift, scala, bash, html, css, json, unknown
- Preserve code as-is (indentation, variables, etc.)
- If no code found, return empty array []

Document:
{truncated}

Return ONLY the JSON array, no explanation:"""

    output_file = tempfile.mktemp(suffix=".json")

    try:
        proc = subprocess.run(
            ["z-ai", "chat", "-p", prompt, "-o", output_file],
            capture_output=True, text=True, timeout=60,
        )

        if not os.path.exists(output_file):
            return []

        with open(output_file) as f:
            data = json.load(f)
        response = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        # Parse JSON array dari response
        json_match = re.search(r'\[[\s\S]*\]', response)
        if json_match:
            blocks = json.loads(json_match.group())
            # Validate: each block must have code and lang
            result = []
            for b in blocks:
                if isinstance(b, dict) and "code" in b:
                    code = b["code"].strip()
                    if len(code) >= 10:
                        result.append({
                            "code": code,
                            "lang": b.get("lang", "unknown").lower().strip(),
                            "lines": code.count("\n") + 1,
                            "source": "llm",
                            "page": 1,
                        })
            return result

        return []

    except Exception as e:
        print(f"[llm_extract] Error: {e}", flush=True)
        return []
    finally:
        try:
            os.unlink(output_file)
        except OSError:
            pass


def extract_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """Main entry: extract code blocks from PDF via LLM."""
    full_text = extract_text_from_pdf(pdf_path)
    if not full_text:
        return []
    return extract_code_via_llm(full_text)


def extract_from_text(text: str) -> List[Dict[str, Any]]:
    """Extract code blocks from plain text via LLM."""
    return extract_code_via_llm(text)
