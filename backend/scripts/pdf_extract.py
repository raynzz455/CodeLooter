#!/usr/bin/env python3
"""
CodeLooter PDF Extractor — Font-based Code Block Detection + OCR fallback
======================================================================

Strategi:
1. Font analysis via pdfplumber — deteksi region monospace sebagai code block
2. ASCII art / box drawing filter — buang tabel, separator, diagram
3. Single-line block support — untuk statement penting (CREATE DATABASE, import, def class)
4. OCR fallback — pakai Tesseract untuk PDF berbasis gambar (image-based PDF)
"""
import sys
import json
import argparse
import re
import os
import subprocess
import tempfile
from typing import List, Dict, Any, Tuple, Set
from collections import defaultdict, Counter

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed. Run: uv add pdfplumber"}))
    sys.exit(1)

try:
    import pytesseract
    from PIL import Image
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


# ─── Font classification ───
MONOSPACE_PATTERNS = [
    "courier", "mono", "consolas", "menlo", "monaco", "jetbrains",
    "fira code", "fira mono", "source code", "inconsolata",
    "ubuntu mono", "roboto mono", "dejavu sans mono", "liberation mono",
    "noto sans mono", "cascadia", "iosevka", "hack", "anonymice",
    "profont", "terminus", "lucida console", "lm mono", "lmtypewriter",
    "typewriter", "mono-", "mono ", "mono8", "pc terminal", "ocr a",
    "ocr b", "ocr-a", "ocr-b", "andy", "saxmono", "go mono",
]

MATH_FONT_PATTERNS = [
    "cambria math", "stix", "latin modern math", "tex gyre termes math",
    "asana math", "xits math", "lucida bright math", "mathjax",
]


def normalize_fontname(fontname: str) -> str:
    if "+" in fontname:
        return fontname.split("+", 1)[1]
    return fontname


def is_monospace_font(fontname: str) -> bool:
    fn = normalize_fontname(fontname).lower()
    if any(p in fn for p in MATH_FONT_PATTERNS):
        return False
    return any(p in fn for p in MONOSPACE_PATTERNS)


# ─── Char grouping ───
def group_chars_by_line(chars: List[Dict]) -> List[List[Dict]]:
    if not chars:
        return []
    sorted_chars = sorted(chars, key=lambda c: (round(c["top"], 1), c["x0"]))
    lines = []
    current_line = [sorted_chars[0]]
    current_top = round(sorted_chars[0]["top"], 1)

    for c in sorted_chars[1:]:
        if abs(c["top"] - current_top) < 3:
            current_line.append(c)
        else:
            lines.append(current_line)
            current_line = [c]
            current_top = round(c["top"], 1)
    if current_line:
        lines.append(current_line)

    return [sorted(line, key=lambda c: c["x0"]) for line in lines]


def line_to_text(line: List[Dict]) -> str:
    if not line:
        return ""
    parts = []
    prev_x1 = None
    for c in line:
        if prev_x1 is not None:
            gap = c["x0"] - prev_x1
            if gap > 1.5:
                char_widths = [c2["x1"] - c2["x0"] for c2 in line if c2["x1"] > c2["x0"]]
                avg_w = sum(char_widths) / len(char_widths) if char_widths else 6.0
                n_spaces = max(1, round(gap / avg_w))
                parts.append(" " * n_spaces)
        parts.append(c["text"])
        prev_x1 = c["x1"]
    return "".join(parts)


def get_line_indent(line: List[Dict]) -> float:
    if not line:
        return 0
    return min(c["x0"] for c in line)


# ─── ASCII art / box drawing detection ───
ASCII_ART_PATTERNS = [
    re.compile(r"^[\s|+\-─┼┬┴┌┐└┘├┤]{5,}$"),
    re.compile(r"^\s*\|[^\n]*\|[^\n]*\|[^\n]*\|[^\n]*$"),
    re.compile(r"^[\s\-=]{8,}$"),
    re.compile(r"^[\s│┃║]{3,}[^\n]*[\s│┃║]{3,}$"),
    re.compile(r"^\s*\d+\s*\|\s*\w+\s*\|\s*\w+\s*\|"),
]


def is_ascii_art(line: str) -> bool:
    t = line.strip()
    if not t:
        return False
    for p in ASCII_ART_PATTERNS:
        if p.match(t):
            return True
    pipe_count = t.count("|")
    if pipe_count >= 3 and len(t) > 10:
        if not re.search(r"\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|JOIN)\b", t, re.IGNORECASE):
            if pipe_count / len(t) > 0.05:
                if re.match(r"^[\s\w\d.,+-]*\|[\s\w\d.,+-]+\|", t):
                    return True
    return False


# ─── Block detection ───
def detect_code_blocks(pdf_path: str) -> Dict[str, Any]:
    blocks = []
    font_stats = Counter()
    code_chars_count = 0
    total_chars = 0

    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            chars = page.chars
            if not chars:
                continue

            page_fonts = Counter(c["fontname"] for c in chars)
            mono_fonts_on_page = {f for f in page_fonts if is_monospace_font(f)}
            font_stats.update(page_fonts)

            if not mono_fonts_on_page:
                continue

            mono_chars = [c for c in chars if c["fontname"] in mono_fonts_on_page]
            code_chars_count += len(mono_chars)
            total_chars += len(chars)

            if not mono_chars:
                continue

            mono_lines = group_chars_by_line(mono_chars)

            candidate_lines = []
            for line in mono_lines:
                text = line_to_text(line).rstrip()
                if not text.strip():
                    continue
                if is_ascii_art(text):
                    continue
                top = min(c["top"] for c in line)
                indent = get_line_indent(line)
                candidate_lines.append({
                    "page": page_idx,
                    "top": top,
                    "indent": indent,
                    "text": text,
                })

            if not candidate_lines:
                continue

            MAX_BLOCK_GAP = 35.0
            current_block: List[Dict] = []
            for line in candidate_lines:
                if not current_block:
                    current_block = [line]
                    continue
                prev = current_block[-1]
                if line["page"] != prev["page"]:
                    blocks.append(current_block)
                    current_block = [line]
                    continue
                gap = line["top"] - prev["top"]
                if gap <= MAX_BLOCK_GAP:
                    current_block.append(line)
                else:
                    blocks.append(current_block)
                    current_block = [line]
            if current_block:
                blocks.append(current_block)

    # Convert blocks to output format with single-line block support
    STRONG_KEYWORDS = re.compile(
        r"^\s*("
        r"#include|#define|#ifndef|#ifdef|"
        r"import\s+\w|from\s+\w+\s+import|"
        r"library\s*\(|require\s*\(|"
        r"package\s+\w|"
        r"public\s+class|private\s+class|protected\s+class|class\s+\w+|"
        r"def\s+\w+|function\s+\w+|func\s+\w+|fn\s+\w+|"
        r"interface\s+\w+|enum\s+\w+|struct\s+\w+|"
        r"namespace\s+\w+|module\s+\w+|"
        r"<\?php|"
        r"CREATE\s+(DATABASE|TABLE|INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER)|"
        r"DROP\s+(DATABASE|TABLE|INDEX|VIEW)|"
        r"ALTER\s+TABLE|"
        r"USE\s+\w+|"
        r"SELECT\s+\*\s+FROM|SELECT\s+\w+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM"
        r")",
        re.IGNORECASE,
    )

    output_blocks = []
    for block in blocks:
        if len(block) < 2:
            single_text = block[0]["text"]
            if not STRONG_KEYWORDS.match(single_text):
                continue
            if len(single_text.strip()) < 15:
                continue
        text = "\n".join(line["text"] for line in block)
        text = postprocess_block(text)
        if len(text) < 10:
            continue
        output_blocks.append({
            "code": text,
            "page": block[0]["page"] + 1,
            "lines": len(block),
            "source": "font",
            "_page0": block[0]["page"],
            "_top_start": block[0]["top"],
            "_top_end": block[-1]["top"],
        })

    # Post-merge: combine adjacent blocks
    merged = []
    MAX_MERGE_GAP = 50.0
    MAX_MERGED_LINES = 100
    for b in output_blocks:
        if not merged:
            merged.append(b)
            continue
        prev = merged[-1]
        same_page = b["_page0"] == prev["_page0"]
        next_page = b["_page0"] == prev["_page0"] + 1
        gap = b["_top_start"] - prev["_top_end"]
        should_merge = (
            (same_page and gap <= MAX_MERGE_GAP)
            or next_page
        ) and prev["lines"] + b["lines"] <= MAX_MERGED_LINES
        if should_merge:
            prev["code"] = prev["code"] + "\n" + b["code"]
            prev["lines"] = prev["lines"] + b["lines"]
            prev["_top_end"] = b["_top_end"]
            prev["_page0"] = b["_page0"]
            prev["page"] = b["page"]
        else:
            merged.append(b)

    for b in merged:
        for k in ("_page0", "_top_start", "_top_end"):
            b.pop(k, None)

    # Post-split: split blocks containing multiple "# Kasus N" markers
    final_blocks = []
    KASUS_PATTERN = re.compile(r"^[ \t]*#[ \t]*[Kk]asus[ \t]+\d+\b", re.MULTILINE)
    for b in merged:
        code = b["code"]
        matches = list(KASUS_PATTERN.finditer(code))
        if len(matches) > 1:
            for i, m in enumerate(matches):
                start = m.start()
                end = matches[i + 1].start() if i + 1 < len(matches) else len(code)
                chunk = code[start:end].strip()
                if len(chunk) >= 10:
                    final_blocks.append({
                        "code": chunk,
                        "page": b["page"],
                        "lines": chunk.count("\n") + 1,
                        "source": "font",
                    })
        else:
            final_blocks.append(b)
    merged = final_blocks

    # Final filter: drop blocks that are pure fragments
    cleaned = []
    for b in merged:
        code = b["code"].strip()
        if "\n" not in code and len(code) < 30:
            continue
        real_code_lines = 0
        for line in code.split("\n"):
            t = line.strip()
            if not t:
                continue
            is_real = (
                re.search(r"<-|->", t)
                or re.search(r"(?<!.)\w+\s*=\s*\S", t)
                or re.search(r":=", t)
                or re.search(r"\.\w+\s*\(", t)
                or re.search(r"\b\w+\s*\(", t)
                or re.match(r"^\s*(def|class|function|func|fn|import|library|require|module|export|"
                            r"package|public|private|protected|static|void|int|float|double|long|"
                            r"string|var|let|const|return|if|else|elif|for|while|switch|case|break|"
                            r"continue|try|catch|finally|throw|raise|namespace|using|include|"
                            r"struct|enum|interface|extends|implements|new|async|await|yield|lambda)\b", t)
                or re.match(r"^\s*(#|//|--|/\*)", t)
                or re.search(r"\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|"
                             r"GROUP\s+BY|ORDER\s+BY|HAVING|UNION|VALUES|SET|TABLE|DATABASE|"
                             r"INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER)\b", t, re.IGNORECASE)
                or re.match(r"^\s*(\$|mysql>|>>>|>>>>|PS\s+>|\[[\w@.-]+\][:#]?)", t)
                or re.match(r"^\s*>\s*\w", t)
                or re.search(r"</?\w+[\s>]", t)
                or re.search(r"<\?php", t)
                or re.search(r"<\?=", t)
                or re.search(r"\$\w+", t)
                or re.match(r"^\s*#(include|define|ifndef|ifdef|endif|else|pragma)", t)
                or re.search(r"\w+\s*=\s*[\[{\(]", t)
                or re.match(r"^\s*\w+\.\w+\s*=", t)
            )
            if is_real:
                real_code_lines += 1
        if real_code_lines == 0:
            continue
        cleaned.append(b)
    merged = cleaned

    fonts_detected = {
        "monospace": sorted({normalize_fontname(f) for f in font_stats if is_monospace_font(f)}),
        "prose": sorted({normalize_fontname(f) for f in font_stats if not is_monospace_font(f) and not any(p in normalize_fontname(f).lower() for p in MATH_FONT_PATTERNS)})[:10],
        "math": sorted({normalize_fontname(f) for f in font_stats if any(p in normalize_fontname(f).lower() for p in MATH_FONT_PATTERNS)}),
    }

    # HEURISTIC FALLBACK (sebelum OCR)
    # Kalau font-analysis return 0 blocks (PDF tanpa font monospace),
    # coba pakai pdftotext -layout + heuristic token-density.
    # Ini jauh lebih cepat dari OCR (detik vs 60+ detik).
    heuristic_used = False
    if len(merged) == 0:
        print("[pdf_extract] No font-based blocks found. Trying heuristic fallback...", file=sys.stderr)
        heuristic_blocks = heuristic_extract_blocks(pdf_path)
        if heuristic_blocks:
            merged = heuristic_blocks
            heuristic_used = True

    # OCR FALLBACK (terakhir, kalau heuristic juga gagal)
    ocr_used = False
    if len(merged) == 0 and HAS_OCR:
        print("[pdf_extract] Heuristic fallback also empty. Trying OCR fallback...", file=sys.stderr)
        ocr_blocks = ocr_extract_blocks(pdf_path)
        if ocr_blocks:
            merged = ocr_blocks
            ocr_used = True

    return {
        "blocks": merged,
        "fonts_detected": fonts_detected,
        "stats": {
            "total_chars": total_chars,
            "code_chars": code_chars_count,
            "code_ratio": code_chars_count / total_chars if total_chars > 0 else 0,
            "ocr_used": ocr_used,
            "heuristic_used": heuristic_used,
        },
    }


# ─── Heuristic fallback (pdftotext + token-density scoring) ───
def heuristic_extract_blocks(pdf_path: str) -> List[Dict[str, Any]]:
    """Fallback ketika font-analysis return 0 blocks.

    Pakai pdftotext -layout untuk extract text, lalu heuristic token-density
    untuk identifikasi baris kode. Sama dengan TXT extraction.

    Cocok untuk PDF text-based yang TIDAK pakai font monospace untuk kode
    (mis. modul praktikum yang dibuat di Word dengan font Times New Roman).
    """
    import subprocess

    # Extract text via pdftotext -layout (preserve whitespace)
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            return []
        text = result.stdout
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []

    if not text or not text.strip():
        return []

    # Pakai heuristic scoring yang sama dengan TXT
    lines = text.split("\n")

    def score_line(line: str) -> int:
        t = line.strip()
        if not t:
            return 0
        score = 0
        # Code keywords
        if re.search(r"\b(def|class|import|from|return|if|else|elif|for|while|"
                     r"function|var|let|const|public|private|static|void|int|float|"
                     r"library|require|print|echo|SELECT|FROM|WHERE|"
                     r"data\.frame|read\.csv|read\.table|read\.xlsx|"
                     r"summary|lm|glm|aov|t\.test|chisq\.test|cor\.test|"
                     r"ggplot|plot|abline|hist|boxplot|"
                     r"qt|qnorm|qf|qchisq|pt|pnorm|pf|pchisq|dt|dnorm|df|dchisq|"
                     r"sample|set\.seed|c\(|seq|rep|"
                     r"head|tail|str|names|colnames|rownames|nrow|ncol|"
                     r"mean|median|sd|var|sum|max|min|sqrt|abs|round|floor|ceiling|"
                     r"cbind|rbind|merge|subset|transform|"
                     r"mutate|filter|select|group_by|summarise|arrange|"
                     r"cat|paste|paste0|sprintf|format|"
                     r"install\.packages)\b", t):
            score += 3
        # Assignment operators (R-style)
        if re.search(r"\w+\s*<-", t):
            score += 3
        if re.search(r"<-|->|%>%|:=", t):
            score += 2
        # Function calls
        if re.search(r"\b\w+\s*\(", t):
            score += 1
        # Comments
        if re.match(r"^\s*#", t):
            score += 1
        # Code symbols
        if re.search(r"[(){}\[\];=<>+\-*/\\&|!?:,'\".]", t):
            score += 1
        # String literals
        if re.search(r'["\'].*["\']', t):
            score += 1
        # Penalty for prose (terlalu banyak kata biasa)
        # Indonesian + English prose words
        prose_words = re.findall(r"\b(?:dan|atau|yang|untuk|pada|dengan|dari|ke|di|ini|itu|"
                                r"adalah|akan|sebuah|seorang|mahasiswa|rata|selisih|"
                                r"proporsi|signifikan|berbeda|menggunakan|menghitung|"
                                r"the|and|or|for|with|from|to|in|of|a|an|is|are|was|were)\b",
                                t, re.IGNORECASE)
        if len(prose_words) >= 2:
            score -= 2
        # Reject pure math expressions (Rumus)
        # Unicode math symbols: U+1D400-1D7FF (Mathematical Alphanumeric Symbols),
        # U+1EE00-1EEFF (Arabic Mathematical Alphabetic Symbols),
        # U+2200-22FF (Mathematical Operators)
        if re.search("[\U0001D400-\U0001D7FF\U0001EE00-\U0001EEFF\u2200-\u22FF]", t):
            score = 0
        return score

    # Group adjacent kode-like lines jadi blocks
    # Strategi:
    # - Baris dengan score >= THRESHOLD dianggap kode
    # - Baris `##` (R output) dianggap "soft" — boleh ikut blok kalau ada kode
    #   sebelum/sesudahnya, tapi tidak boleh membentuk blok sendiri (hanya ##)
    # - Baris dengan `library(` atau `# Kasus N` di awal → mulai blok baru
    blocks = []
    current_block_lines = []
    THRESHOLD = 2

    def is_r_output(line):
        t = line.strip()
        return t.startswith("## ") or t.startswith("##\t") or t.startswith("[1] ")

    def is_block_start(line):
        """Baris yang menandakan mulai blok kode baru."""
        t = line.strip()
        # R library() call = sering awal blok
        if re.match(r"^\s*library\s*\(", t):
            return True
        # Data assignment ke data.frame (awal sesi baru)
        if re.search(r"<-\s*data\.frame\s*\(", t):
            return True
        # Komentar "# Kasus N" atau "# Soal N"
        if re.match(r"^\s*#\s*(kasus|soal|contoh|latihan)\s+\d", t, re.IGNORECASE):
            return True
        return False

    for line in lines:
        if score_line(line) >= THRESHOLD or is_r_output(line):
            # Kalau baris ini adalah "block start" dan kita sudah punya blok
            # berjalan, simpan blok sebelumnya lalu mulai baru
            if is_block_start(line) and current_block_lines:
                real_code_lines = [l for l in current_block_lines if not is_r_output(l)]
                if len(real_code_lines) >= 1:
                    code = "\n".join(current_block_lines).strip()
                    if len(code) >= 10:
                        blocks.append({
                            "code": code,
                            "page": 1,
                            "lines": code.count("\n") + 1,
                            "source": "heuristic",
                        })
                current_block_lines = []
            current_block_lines.append(line)
        else:
            # Baris non-kode → simpan blok kalau ada
            if len(current_block_lines) >= 2:
                real_code_lines = [l for l in current_block_lines if not is_r_output(l)]
                if real_code_lines:
                    code = "\n".join(current_block_lines).strip()
                    if len(code) >= 10:
                        blocks.append({
                            "code": code,
                            "page": 1,
                            "lines": code.count("\n") + 1,
                            "source": "heuristic",
                        })
            current_block_lines = []

    # Flush sisa
    if len(current_block_lines) >= 2:
        real_code_lines = [l for l in current_block_lines if not is_r_output(l)]
        if real_code_lines:
            code = "\n".join(current_block_lines).strip()
            if len(code) >= 10:
                blocks.append({
                    "code": code,
                    "page": 1,
                    "lines": code.count("\n") + 1,
                    "source": "heuristic",
                })

    # Post-process: pisah blok yang mengandung ## output di tengah
    # Strategi: kalau ada baris ## di tengah blok, pisah jadi:
    # - blok kode sebelum ##
    # - blok kode setelah ## (kalau ada)
    final_blocks = []
    for b in blocks:
        code_lines = b["code"].split("\n")
        # Cari posisi baris ## pertama yang BUKAN di akhir blok
        r_output_indices = [i for i, l in enumerate(code_lines) if is_r_output(l)]
        if not r_output_indices:
            final_blocks.append(b)
            continue

        # Pisah: kode sebelum ##, ## output (skip), kode setelah ##
        current_chunk = []
        for line in code_lines:
            if is_r_output(line):
                # Simpan chunk sebelumnya kalau ada
                if current_chunk:
                    code = "\n".join(current_chunk).strip()
                    if len(code) >= 10:
                        final_blocks.append({
                            "code": code,
                            "page": 1,
                            "lines": code.count("\n") + 1,
                            "source": "heuristic",
                        })
                    current_chunk = []
                # Skip R output
            else:
                current_chunk.append(line)
        # Flush sisa
        if current_chunk:
            code = "\n".join(current_chunk).strip()
            if len(code) >= 10:
                final_blocks.append({
                    "code": code,
                    "page": 1,
                    "lines": code.count("\n") + 1,
                    "source": "heuristic",
                })

    return final_blocks


# ─── OCR Fallback via Tesseract ───
def ocr_extract_blocks(pdf_path: str) -> List[Dict[str, Any]]:
    blocks = []
    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            subprocess.run(
                ["pdftoppm", "-png", "-r", "200", "-l", "20", pdf_path, f"{tmpdir}/page"],
                check=True, capture_output=True, timeout=120,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return []

        for img_file in sorted(os.listdir(tmpdir)):
            if not img_file.endswith(".png"):
                continue
            img_path = os.path.join(tmpdir, img_file)
            page_num = int(re.search(r"page-(\d+)", img_file).group(1)) if re.search(r"page-(\d+)", img_file) else 1

            try:
                result = subprocess.run(
                    ["tesseract", img_path, "-", "--psm", "6", "tsv"],
                    capture_output=True, text=True, timeout=60,
                )
                if result.returncode != 0:
                    continue
                lines = result.stdout.split("\n")
                if len(lines) < 2:
                    continue
                line_data = defaultdict(list)
                for line in lines[1:]:
                    parts = line.split("\t")
                    if len(parts) < 12:
                        continue
                    try:
                        block_num = int(parts[2])
                        par_num = int(parts[3])
                        line_num = int(parts[4])
                        top = int(parts[7])
                        text = parts[11]
                        if text.strip():
                            key = (block_num, par_num, line_num)
                            line_data[key].append((top, text))
                    except (ValueError, IndexError):
                        continue

                page_lines = []
                for key in sorted(line_data.keys()):
                    parts_list = sorted(line_data[key])
                    text = " ".join(t for _, t in parts_list).strip()
                    if text:
                        top = parts_list[0][0]
                        page_lines.append({"page": page_num - 1, "top": top, "text": text})

                candidate_lines = []
                for line in page_lines:
                    text = line["text"]
                    if not text.strip():
                        continue
                    if is_ascii_art(text):
                        continue
                    if looks_like_code_line(text):
                        candidate_lines.append(line)

                if candidate_lines:
                    current_block = [candidate_lines[0]]
                    for line in candidate_lines[1:]:
                        gap = line["top"] - current_block[-1]["top"]
                        if gap <= 35:
                            current_block.append(line)
                        else:
                            blocks.append(current_block)
                            current_block = [line]
                    blocks.append(current_block)

            except subprocess.TimeoutExpired:
                continue
            except Exception:
                continue

    output = []
    for block in blocks:
        if len(block) < 2:
            continue
        text = "\n".join(l["text"] for l in block)
        text = postprocess_block(text)
        if len(text) < 15:
            continue
        output.append({
            "code": text,
            "page": block[0]["page"] + 1,
            "lines": len(block),
            "source": "ocr",
        })
    return output


def looks_like_code_line(text: str) -> bool:
    t = text.strip()
    if not t:
        return False
    return bool(
        re.search(r"\w+\s*=\s*\S", t)
        or "<-" in t or "->" in t or ":=" in t or "+=" in t or "-=" in t
        or re.search(r"\.\w+\s*\(", t)
        or re.match(r"^\s*(def|class|function|func|fn|import|library|require|module|export|"
                    r"package|public|private|protected|static|void|int|float|double|long|"
                    r"string|var|let|const|return|if|else|elif|for|while|switch|case|break|"
                    r"continue|try|catch|finally|throw|raise|namespace|using|include|"
                    r"struct|enum|interface|extends|implements|new|async|await|yield|lambda)\b", t)
        or re.match(r"^\s*(#|//|--|/\*)", t)
        or re.search(r"\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|"
                     r"GROUP\s+BY|ORDER\s+BY|HAVING|UNION|VALUES|SET|TABLE|DATABASE)\b", t, re.IGNORECASE)
        or re.search(r"</?\w+[\s>]", t)
        or re.search(r"<\?php", t) or re.search(r"<\?=", t) or re.search(r"\$\w+", t)
        or re.match(r"^\s*#(include|define|ifndef|ifdef)", t)
        or re.search(r"\w+\([^)]*\)", t)
        or t.endswith("{") or t.endswith("}") or t.endswith(";")
    )


# ─── Post-processing ───
def postprocess_block(text: str) -> str:
    text = repair_line_wraps(text)
    text = strip_r_output(text)
    text = normalize_whitespace(text)
    return text


def repair_line_wraps(text: str) -> str:
    lines = text.split("\n")
    out: List[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        while i + 1 < len(lines) and _should_join(line, lines[i + 1]):
            i += 1
            line = line + lines[i].lstrip()
        out.append(line)
        i += 1
    return "\n".join(out)


def _should_join(cur: str, nxt: str) -> bool:
    cur_t = cur.rstrip()
    nxt_t = nxt.lstrip()
    if not cur_t or not nxt_t:
        return False
    if cur_t.endswith(";"):
        return False
    opens = cur.count("(") + cur.count("[") + cur.count("{")
    closes = cur.count(")") + cur.count("]") + cur.count("}")
    if opens > closes:
        return True
    if re.search(r"<-|->", nxt_t[:30]):
        return False
    if re.match(r"^[^=<>!]{1,20}=[^=]", nxt_t):
        return False
    if re.search(r"[.!?:]$", cur_t):
        return False
    if re.search(r"[)\]}]$", cur_t):
        return False
    if re.search(r"[\[\"'`]$", cur_t):
        return False
    code_kw = re.compile(
        r"^\s*(import|from|def|class|function|func|fn|return|if|else|elif|"
        r"for|while|switch|case|break|continue|public|private|protected|static|"
        r"void|int|float|double|long|string|var|let|const|print|printf|println|"
        r"cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP|"
        r"library|require|module|export|async|await|package|interface|struct|enum|"
        r"namespace|using|include|extends|implements|new|throw|try|catch|finally|"
        r"#|//|/\*|--)"
    )
    if code_kw.match(nxt_t):
        return False
    if re.match(r"^[A-Z][a-z]+\s+[a-z]", nxt_t) and not re.match(r"^\w+\s*\(", nxt_t):
        return False
    if re.search(r"[,+*/<>=&|({\[]$", cur_t):
        return True
    if cur_t.endswith("-") and re.match(r"^[A-Z]", nxt_t):
        return True
    if re.search(r"[a-z]$", cur_t) and nxt_t.startswith("_"):
        return True
    if re.search(r"[a-zA-Z0-9_]$", cur_t) and re.match(r"^[)\]}]", nxt_t):
        return True
    if re.search(r"[a-z]$", cur_t) and re.match(r"^[a-z]{1,8}$", nxt_t):
        if not re.search(r"<-=", cur_t) and not re.match(r"^.{0,40}=[^=]", cur_t):
            return True
    return False


def strip_r_output(text: str) -> str:
    lines = text.split("\n")
    kept = []
    for line in lines:
        t = line.strip()
        if t.startswith("## ") or t.startswith("##\t"):
            continue
        if re.match(r"^\[1\]\s", t):
            continue
        kept.append(line)
    return "\n".join(kept)


def normalize_whitespace(text: str) -> str:
    lines = text.split("\n")
    out = []
    for line in lines:
        line = line.replace("\r", "").rstrip()
        line = re.sub(r"[ \t]{2,}", " ", line).rstrip()
        out.append(line)
    filtered = []
    for line in out:
        t = line.strip()
        if t and re.match(r"^\d+$", t):
            continue
        is_simple_word_then_number = bool(re.match(r"^[a-z]+\s+\d+(\.\d+)?\s*$", t))
        is_short_fragment_then_number = bool(re.match(r"^[a-z]{1,4}\s+\d", t))
        is_code_keyword = bool(re.match(
            r"^(int|for|var|let|def|if|in|of|as|to|while|do|elif|else|try|except|finally|"
            r"return|raise|throw|import|from|class|function|func|fn|library|require|"
            r"module|export|async|await|package|interface|struct|enum|namespace|using|"
            r"include|extends|implements|new|switch|case|break|continue|public|private|"
            r"protected|static|void|float|double|long|string|const|print|printf|println|"
            r"cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP)\b",
            t
        ))
        if (is_simple_word_then_number or is_short_fragment_then_number) and not is_code_keyword:
            if filtered:
                prev_t = filtered[-1].rstrip()
                prev_has_hingga = bool(re.search(r"\b(hingga|sampai|to|until)\b", prev_t, re.IGNORECASE))
                prev_ends_complete = bool(re.search(r'[)"\']\s*$', prev_t))
                if prev_has_hingga and prev_ends_complete:
                    continue
                if prev_t and not prev_t.endswith((";", ":", ",", "(", "[", "{", "+", "-", "*", "/", "=", "<", ">", ")", "]", "}", '"', "'")):
                    continue
        filtered.append(line)
    return "\n".join(filtered).strip()


# ─── Main ───
def main():
    parser = argparse.ArgumentParser(description="CodeLooter PDF code extractor")
    parser.add_argument("pdf_path", help="Path to PDF file")
    args = parser.parse_args()

    if not os.path.exists(args.pdf_path):
        print(json.dumps({"error": f"File not found: {args.pdf_path}"}))
        sys.exit(1)

    try:
        result = detect_code_blocks(args.pdf_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({
            "error": str(e),
            "trace": traceback.format_exc(),
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
