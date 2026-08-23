#!/usr/bin/env python3
"""
CodeLooter PDF Extractor — Font-based Code Block Detection
============================================================

Strategi baru: gunakan informasi font dari PDF (via pdfplumber) untuk
mendeteksi "code block" berdasarkan region monospace vs region prose.

Pendekatan ini JAUH lebih presisi daripada heuristic token-density
karena PDF secara visual sudah membedakan kode (Courier/Consolas/dll)
dengan narasi (Times/Calibri/Arial).

Pipeline:
1. pdfplumber ekstrak semua char dengan font info
2. Identifikasi font monospace yang dipakai di dokumen ini
3. Group char monospace menjadi "code spans" per baris
4. Merge code spans adjacent menjadi code blocks
5. Apply post-processing: repair line wraps, strip R output (##)
6. Deteksi bahasa via heuristic (highlight.js di sisi TS)

Output JSON ke stdout:
{
  "blocks": [
    { "code": "...", "page": 1, "y0": 100.0, "y1": 200.0, "lines": 10 },
    ...
  ],
  "fonts_detected": { "monospace": [...], "prose": [...] },
  "stats": { "total_chars": N, "code_chars": M, "prose_chars": K }
}
"""
import sys
import json
import argparse
import re
import os
from typing import List, Dict, Any, Tuple, Set
from collections import defaultdict, Counter

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}))
    sys.exit(1)


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

# Math font indicators (CambriaMath, STIX, etc.) — NOT code, even if monospace-looking
MATH_FONT_PATTERNS = [
    "cambria math", "stix", "latin modern math", "tex gyre termes math",
    "asana math", "xits math", "lucida bright math", "mathjax",
]


def normalize_fontname(fontname: str) -> str:
    """Strip subset prefix (e.g., 'BCEBEE+Consolas' → 'Consolas')."""
    if "+" in fontname:
        return fontname.split("+", 1)[1]
    return fontname


def is_monospace_font(fontname: str) -> bool:
    """Deteksi apakah font adalah monospace berdasarkan nama."""
    fn = normalize_fontname(fontname).lower()
    # Reject math fonts first
    if any(p in fn for p in MATH_FONT_PATTERNS):
        return False
    return any(p in fn for p in MONOSPACE_PATTERNS)


# ─── Char grouping ───
def group_chars_by_line(chars: List[Dict]) -> List[List[Dict]]:
    """Group chars by line (top coordinate, with tolerance)."""
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
    """Convert a line of chars to text, inserting spaces based on x-gaps."""
    if not line:
        return ""
    parts = []
    prev_x1 = None
    for c in line:
        if prev_x1 is not None:
            gap = c["x0"] - prev_x1
            # If gap > 1.5pt, insert space(s)
            # Use the average char width in this line as the unit
            if gap > 1.5:
                # Estimate char width from line
                char_widths = [c2["x1"] - c2["x0"] for c2 in line if c2["x1"] > c2["x0"]]
                avg_w = sum(char_widths) / len(char_widths) if char_widths else 6.0
                n_spaces = max(1, round(gap / avg_w))
                parts.append(" " * n_spaces)
        parts.append(c["text"])
        prev_x1 = c["x1"]
    return "".join(parts)


def get_line_indent(line: List[Dict]) -> float:
    """Get left-most x position (indent level)."""
    if not line:
        return 0
    return min(c["x0"] for c in line)


# ─── Block detection ───
def detect_code_blocks(pdf_path: str) -> Dict[str, Any]:
    """Detect code blocks in PDF via font analysis."""
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

            # Group adjacent candidate lines into blocks
            # Strategy: lines belong to the same block if:
            # - Same page AND vertical gap <= MAX_BLOCK_GAP (allows 1-2 blank lines)
            # - OR same page AND both have similar indent (±5pt)
            MAX_BLOCK_GAP = 35.0  # ~2.5x typical line height — allows blank lines

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

    # Convert blocks to output format
    output_blocks = []
    for block in blocks:
        if len(block) < 2:
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
            # Keep metadata for merging
            "_page0": block[0]["page"],
            "_top_start": block[0]["top"],
            "_top_end": block[-1]["top"],
        })

    # ─── Post-merge: combine adjacent blocks on same page with small gap ───
    # Setelah post-processing, kadang blok terpisah padahal sebenarnya satu kesatuan
    # (mis. komentar di tengah blok yang font-nya berbeda singgah).
    # Merge blok A dan B jika:
    # - Sama-sama di halaman yang sama DAN gap <= MAX_MERGE_GAP
    # - ATAU beda halaman tapi consecutive (B.page = A.page + 1) DAN
    #   A ada di akhir halaman (top > 0.85 * page_height) DAN
    #   B ada di awal halaman (top < 0.15 * page_height)
    # - Total baris gabungan <= 100 (jangan merge blok super besar)
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
            prev["_page0"] = b["_page0"]  # update for next potential merge
            prev["page"] = b["page"]      # show last page where block ends
        else:
            merged.append(b)

    # Strip metadata keys from output
    for b in merged:
        for k in ("_page0", "_top_start", "_top_end"):
            b.pop(k, None)

    # ─── Post-split: split blocks that contain multiple "# Kasus N" markers ───
    # Kadang satu blok besar berisi beberapa kasus terpisah (mis. Kasus 3+4+5).
    # Kita split pada marker "# Kasus N" atau "#Kasus N" (dengan/tanpa spasi) di awal baris.
    final_blocks = []
    # Pattern: # di awal baris (opsional whitespace), lalu "Kasus" (case-insensitive), lalu whitespace, lalu digit
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

    # ─── Final filter: drop blocks that are pure fragments ───
    # (single line "hingga 1.771651" atau artifact PDF lain)
    cleaned = []
    for b in merged:
        code = b["code"].strip()
        # Skip blocks that are just one short fragment line
        if "\n" not in code and len(code) < 30:
            continue
        # Skip blocks where ALL lines look like fragments (no real code)
        real_code_lines = 0
        for line in code.split("\n"):
            t = line.strip()
            if not t:
                continue
            # Real code line: has assignment, fn call, keyword, or comment
            if re.search(r"<-|->|=\s*\w|\.\w+\s*\(|^\s*#\s*\w+|^def |^class |^function |^import |^library |^require ", t):
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

    return {
        "blocks": merged,
        "fonts_detected": fonts_detected,
        "stats": {
            "total_chars": total_chars,
            "code_chars": code_chars_count,
            "code_ratio": code_chars_count / total_chars if total_chars > 0 else 0,
        },
    }


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
    if re.search(r'[\[\]"\'`]$', cur_t):
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
    if re.search(r"[,+*/<>=&|({[]$", cur_t):
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
        # Filter PDF extraction artifacts: fragment lines that are clearly
        # NOT code. These appear when PDF splits a word mid-character due to
        # font color/size variation. Examples:
        #   "gga 0.005333174"     — tail of "hingga 0.005333174"
        #   "hingga 1.771651"     — tail of "hingga 1.771651" from previous line
        # Heuristic: line is a fragment if it has ALL these properties:
        # 1. Consists only of [a-z]+ + space + number (no operators, no parens, no quotes)
        # 2. Does NOT start with a code keyword
        # 3. Previous line ends with non-terminator char (so this could be continuation)
        # OR: line starts with lowercase partial word (1-4 chars) followed by space + number
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
            # Filter fragment lines: trailing artifact from PDF word-split.
            # A line like "hingga 1.771651" appearing AFTER a line that ends with
            # `upper_bound)` is clearly the tail of "...hingga 1.771651" that got
            # separated by PDF extraction. The tell-tale sign is:
            # - This line is just [word] + space + [number]
            # - The previous line already had a complete statement (ended with `)` or `"`)
            # - The previous line ALSO had a "hingga" or similar word inside it
            if filtered:
                prev_t = filtered[-1].rstrip()
                # Check if previous line had "hingga" or similar connective word
                # AND ended with what looks like a complete expression
                prev_has_hingga = bool(re.search(r"\b(hingga|sampai|to|until)\b", prev_t, re.IGNORECASE))
                prev_ends_complete = bool(re.search(r'[)"\']\s*$', prev_t))
                if prev_has_hingga and prev_ends_complete:
                    continue
                # Or: previous line ends with non-terminator char (so this could be continuation)
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
