"""Language detection using LLM (z-ai CLI).

Strategi:
1. Kumpulkan semua code blocks dari 1 file
2. Kirim batch ke LLM via z-ai CLI (1 request untuk semua blocks)
3. LLM return bahasa per block (jauh lebih akurat dari heuristic)
4. Fallback ke heuristic kalau LLM gagal/tidak tersedia
"""
import json
import subprocess
import tempfile
import os
from typing import List
from collections import Counter

# Cache hasil LLM per block hash
_BLOCK_CACHE: dict[str, str] = {}
_MAX_CACHE = 500


def detect_languages_llm(codes: List[str]) -> List[str]:
    """Deteksi bahasa untuk multiple code blocks sekaligus via LLM.

    Args:
        codes: List of code strings

    Returns:
        List of language strings (lowercase), same length as codes
    """
    if not codes:
        return []

    # Step 1: Cek cache
    results = [None] * len(codes)
    uncached_indices = []
    uncached_codes = []

    for i, code in enumerate(codes):
        cache_key = hash(code)
        if cache_key in _BLOCK_CACHE:
            results[i] = _BLOCK_CACHE[cache_key]
        else:
            uncached_indices.append(i)
            uncached_codes.append(code)

    if not uncached_codes:
        return results

    # Step 2: Kirim uncached blocks ke LLM via z-ai CLI
    llm_results = _call_llm_cli(uncached_codes)

    # Step 3: Cache dan gabung
    for j, idx in enumerate(uncached_indices):
        lang = llm_results[j] if j < len(llm_results) else "unknown"
        lang = lang.lower().strip()
        results[idx] = lang
        if len(_BLOCK_CACHE) < _MAX_CACHE:
            _BLOCK_CACHE[hash(codes[idx])] = lang

    return results


def _call_llm_cli(codes: List[str]) -> List[str]:
    """Panggil LLM via z-ai CLI untuk klasifikasi bahasa batch."""
    # Build prompt
    blocks_text = ""
    for i, code in enumerate(codes):
        truncated = code[:300]
        blocks_text += f"---BLOCK {i}---\n{truncated}\n\n"

    prompt = f"""Classify the programming language of each code block below. Reply with ONLY a JSON array of lowercase language names (one per block, in order). Valid: python, r, javascript, typescript, java, cpp, c, sql, kotlin, php, ruby, go, rust, swift, scala, bash, html, css, json, unknown.

{blocks_text}

Reply format: ["r","python","sql"]"""

    output_file = tempfile.mktemp(suffix=".json")

    try:
        proc = subprocess.run(
            ["z-ai", "chat", "-p", prompt, "-o", output_file],
            capture_output=True, text=True, timeout=30,
        )

        if not os.path.exists(output_file):
            return ["unknown"] * len(codes)

        with open(output_file) as f:
            data = json.load(f)
        response = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        import re
        json_match = re.search(r'\[.*?\]', response, re.DOTALL)
        if json_match:
            langs = json.loads(json_match.group())
            return [str(l).lower().strip() for l in langs]
        else:
            langs = re.findall(r'\b(python|r|javascript|typescript|java|cpp|c|sql|kotlin|php|ruby|go|rust|swift|scala|bash|html|css|json|unknown)\b',
                             response.lower())
            return langs if len(langs) == len(codes) else ["unknown"] * len(codes)

    except Exception as e:
        print(f"[llm_detection] Error: {e}", flush=True)
        return ["unknown"] * len(codes)
    finally:
        try:
            os.unlink(output_file)
        except OSError:
            pass


def detect_single_llm(code: str) -> str:
    """Deteksi bahasa untuk 1 code block via LLM."""
    results = detect_languages_llm([code])
    return results[0] if results else "unknown"
