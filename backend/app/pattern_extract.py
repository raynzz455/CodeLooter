"""Pattern-based code extraction — pattern dari analisis modul asli.

Strategi:
1. Extract full text dari PDF
2. Cari code region berdasarkan marker yang SUDAH ADA di modul:
   - "Kode Penyelesaian:" / "Kode penyelesaian:" / "Kode:" → mulai code
   - "Output yang dihasilkan:" / "Interpretasi:" → akhir code
   - "# Kasus N" / "#Kasus N" / "# Contoh N" → mulai blok baru
3. Ambil semua baris di antara marker start dan end
4. Strip baris ## (R output) yang bercampur
5. Deteksi bahasa: kalau ada <-, library(), summary(), qt(), qnorm() → R
   (berdasarkan analisis: SEMUA modul Anda pakai R)
"""
import re
import json
from typing import List, Dict, Any


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract full text dari PDF via PyMuPDF."""
    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        all_text = []
        for page in doc:
            text = page.get_text("text")
            if text.strip():
                all_text.append(text)
        doc.close()
        return "\n".join(all_text)
    except Exception:
        return ""


# ─── Markers dari analisis modul asli ───
# Modul 1: "# kasus 1", "# Kasus 2", "#Kasus 3"
# Modul 3: "Kode Penyelesaian:", "Kode penyelesaian:", "Kode penyelesaiain:"
# End markers: "Output yang dihasilkan:", "Interpretasi", "##" (R output block)

CODE_START_PATTERNS = [
    r"Kode\s+Penyelesaian\s*:?",
    r"Kode\s+penyelesaian\s*:?",
    r"Kode\s+penyelesaiain\s*:?",  # typo di modul asli
    r"Kode\s*:",
    r"#\s*[Kk]asus\s+\d",
    r"#\s*[Kk]asus\s*:",
    r"#\s*[Ss]oal\s+\d",
    r"#\s*[Cc]ontoh\s+\d",
]

CODE_END_PATTERNS = [
    r"Output\s+yang\s+dihasilkan\s*:?",
    r"Interpretasi\s+Hasil\s*:?",
    r"Interpretasi\s+:?",
    r"Penugasan\s*:?",
    r"Kode\s+Penyelesaian\s*:?",  # next code block = end of current
    r"Kode\s+penyelesaian\s*:?",
    r"#\s*[Kk]asus\s+\d",  # next Kasus = end of current
    r"#\s*[Ss]oal\s+\d",
    r"^##\s",  # R output start (first ## after code)
]

# R-specific patterns untuk language detection (dari analisis modul asli)
R_SIGNALS = [
    r"<-",
    r"\blibrary\s*\(",
    r"\bcat\s*\(",
    r"\bqt\s*\(",
    r"\bqnorm\s*\(",
    r"\bqf\s*\(",
    r"\bqchisq\s*\(",
    r"\bsummary\s*\(",
    r"\blm\s*\(",
    r"\bcor\.test\s*\(",
    r"\bchisq\.test\s*\(",
    r"\bt\.test\s*\(",
    r"\bdata\.frame\s*\(",
    r"\bread\.csv\s*\(",
    r"\bread\.table\s*\(",
    r"\bset\.seed\s*\(",
    r"\bsample\s*\(",
    r"\bggplot\s*\(",
    r"%>%",
    r"\b\w+\$\w+",  # data$column
    r"\bprint\s*\(",
    r"\bmean\s*\(",
    r"\bsd\s*\(",
    r"\bvar\s*\(",
    r"\bsqrt\s*\(",
    r"\bcbind\s*\(",
    r"\brbind\s*\(",
    r"\bhead\s*\(",
    r"\bstr\s*\(",
    r"\bseq\s*\(",
    r"\brep\s*\(",
    r"\bc\s*\(",
    r"\bas\.matrix\s*\(",
    r"\btextConnection\s*\(",
]


def detect_language_r(code: str) -> str:
    """Deteksi bahasa berdasarkan R signals.

    Dari analisis: SEMUA modul user pakai R.
    Kalau ada >= 2 R signals → R.
    Kalau ada 1 R signal tapi assignment <- → R.
    """
    r_hits = sum(1 for p in R_SIGNALS if re.search(p, code))
    if r_hits >= 2:
        return "r"
    if "<-" in code and r_hits >= 1:
        return "r"
    if "library(" in code:
        return "r"
    # Fallback: kalau ada assignment <- saja
    if "<-" in code:
        return "r"
    return "unknown"


def is_code_line(line: str) -> bool:
    """Cek apakah baris adalah kode (bukan narasi/output).

    Kode = punya assignment, function call, atau keyword.
    Narasi = kalimat biasa.
    R output = baris yang dimulai dengan ##.
    """
    t = line.strip()
    if not t:
        return False
    # R output
    if t.startswith("## ") or t.startswith("##\t") or t.startswith("[1] "):
        return False
    # Check R signals
    for p in R_SIGNALS:
        if re.search(p, t):
            return True
    # Check assignment patterns
    if re.search(r"\w+\s*<-\s", t):
        return True
    if re.search(r"\w+\s*=\s*c\s*\(", t):
        return True
    if re.search(r"\w+\s*=\s*\d", t) and not re.search(r"^\s*(if|while|for)\s", t):
        return True
    # Check function call pattern (word followed by ()
    if re.search(r"\b\w+\s*\([^)]*\)", t) and not t.endswith(":") and not t.endswith("."):
        # Tapi pastikan bukan kalimat narasi (tidak ada kata prose)
        prose_count = len(re.findall(
            r"\b(?:dan|atau|yang|untuk|pada|dengan|dari|ke|di|ini|itu|"
            r"adalah|akan|sebuah|seorang|mahasiswa|tersebut|sebagai|"
            r"jika|maka|sehingga|karena|agar|supaya|"
            r"the|and|or|for|with|from|to|in|of|a|an|is|are|was|were)\b",
            t, re.IGNORECASE
        ))
        if prose_count == 0:
            return True
    return False


def is_r_output(line: str) -> bool:
    """Cek apakah baris adalah R console output."""
    t = line.strip()
    return t.startswith("## ") or t.startswith("##\t") or t.startswith("[1] ")


def extract_code_blocks(text: str) -> List[Dict[str, Any]]:
    """Extract code blocks dari text berdasarkan pattern dari modul asli.

    Strategi:
    1. Cari semua code start markers
    2. Untuk setiap start, cari end marker terdekat
    3. Ambil baris di antara start dan end
    4. Filter: hanya baris yang is_code_line() atau is_r_output()
    5. Gabung baris kode adjacent
    6. Strip ## R output dari hasil akhir (opsional)
    """
    lines = text.split("\n")
    blocks = []

    # Strategy 1: Marker-based extraction
    # Cari semua posisi start marker
    start_positions = []
    for i, line in enumerate(lines):
        for pattern in CODE_START_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                start_positions.append(i)
                break

    # Strategy 1b: Juga cari "Contoh N:" sebagai marker (tidak ada # di depan)
    for i, line in enumerate(lines):
        if re.match(r"^\s*Contoh\s+\d\s*:", line, re.IGNORECASE):
            if i not in start_positions:
                start_positions.append(i)

    # Strategy 1c: Cari baris yang jelas kode (assignment <- di awal) sebagai fallback
    # Kalau tidak ada marker sebelumnya, kode yang langsung muncul juga harus ditangkap
    if not start_positions:
        for i, line in enumerate(lines):
            if is_code_line(line):
                start_positions.append(i)
                break

    start_positions.sort()

    # Untuk setiap start, cari end (next marker atau ## block)
    for idx, start in enumerate(start_positions):
        # End = next start marker, atau cari "Output yang dihasilkan:", atau EOF
        end = len(lines)
        if idx + 1 < len(start_positions):
            end = start_positions[idx + 1]

        # Cari end marker lebih awal kalau ada
        for j in range(start + 1, end):
            for pattern in CODE_END_PATTERNS:
                if re.search(pattern, lines[j], re.IGNORECASE):
                    end = j
                    break
            else:
                continue
            break

        # Ambil baris dari start+1 sampai end
        # Skip baris marker itu sendiri kalau berupa label (bukan kode)
        code_lines = []
        for j in range(start, end):
            line = lines[j].rstrip()
            if not line.strip():
                continue
            # Skip start marker kalau bukan kode
            t = line.strip()
            if re.match(r"^\s*(Kode\s+[Pp]enyelesaian|Kode\s*:)\s*:?\s*$", t, re.IGNORECASE):
                continue
            if is_code_line(line) or is_r_output(line):
                code_lines.append(line)

        if len(code_lines) >= 2:
            # Strip trailing R output
            while code_lines and is_r_output(code_lines[-1]):
                code_lines.pop()

            # Strip leading R output
            while code_lines and is_r_output(code_lines[0]):
                code_lines.pop(0)

            if len(code_lines) >= 2:
                code = "\n".join(code_lines).strip()
                if len(code) >= 10:
                    lang = detect_language_r(code)
                    blocks.append({
                        "code": code,
                        "lang": lang,
                        "lines": code.count("\n") + 1,
                        "source": "pattern",
                        "page": 1,
                    })

    # Strategy 2: Kalau marker-based return 0 blocks, pakai line-based
    # (untuk dokumen tanpa marker eksplisit)
    if not blocks:
        blocks = _extract_via_line_density(lines)

    # Post-process: SPLIT blocks yang mengandung multiple markers
    final_blocks = []
    SPLIT_PATTERN = re.compile(
        r"^\s*#[Kk]asus\s+\d|"
        r"^\s*#[Cc]ontoh\s+\d|"
        r"^\s*#[Kk]orelasi\s+[Pp]earson\s+contoh|"
        r"^\s*#korelasi\s+pearson\s+contoh|"
        r"^\s*#korelasi\s+pearson\s+contoh\s*\d|"
        r"^\s*data_\w+\s*<-?\s*data\.frame|"
        r"^\s*data_\w+\s*=\s*data\.frame",
        re.MULTILINE
    )

    for b in blocks:
        code = b["code"]
        markers = list(SPLIT_PATTERN.finditer(code))
        if len(markers) <= 1:
            final_blocks.append(b)
        else:
            prev_pos = 0
            for m in markers[1:]:
                chunk = code[prev_pos:m.start()].strip()
                if len(chunk) >= 10:
                    final_blocks.append({
                        "code": chunk,
                        "lang": detect_language_r(chunk),
                        "lines": chunk.count("\n") + 1,
                        "source": "pattern-split",
                        "page": 1,
                    })
                prev_pos = m.start()
            chunk = code[prev_pos:].strip()
            if len(chunk) >= 10:
                final_blocks.append({
                    "code": chunk,
                    "lang": detect_language_r(chunk),
                    "lines": chunk.count("\n") + 1,
                    "source": "pattern-split",
                    "page": 1,
                })

    # Post-process 2: Scan ulang — cari baris kode yang belum tertangkap
    # (cor.test, library, lm, summary, data.frame yang terlewat)
    # Cari baris kode yang TIDAK ada di final_blocks
    captured_lines = set()
    for b in final_blocks:
        for line in b["code"].split("\n"):
            captured_lines.add(line.strip())

    # Cari baris kode yang belum tertangkap
    uncoded_blocks = []
    current = []
    for i, line in enumerate(lines):
        t = line.strip()
        if is_code_line(line) and t not in captured_lines:
            current.append(line)
        else:
            if len(current) >= 2:
                code = "\n".join(current).strip()
                # Cek apakah sudah ada di final_blocks
                already = any(code in b["code"] for b in final_blocks)
                if not already and len(code) >= 10:
                    lang = detect_language_r(code)
                    uncoded_blocks.append({
                        "code": code,
                        "lang": lang,
                        "lines": code.count("\n") + 1,
                        "source": "scan-fallback",
                        "page": 1,
                    })
            current = []

    if len(current) >= 2:
        code = "\n".join(current).strip()
        already = any(code in b["code"] for b in final_blocks)
        if not already and len(code) >= 10:
            lang = detect_language_r(code)
            uncoded_blocks.append({
                "code": code,
                "lang": lang,
                "lines": code.count("\n") + 1,
                "source": "scan-fallback",
                "page": 1,
            })

    # Gabung uncoded blocks ke final_blocks
    final_blocks.extend(uncoded_blocks)

    # Post-process 3: Merge blocks yang seharusnya 1 kesatuan
    # (cor.test setelah data.frame, summary setelah lm, dll.)
    i = 1
    while i < len(final_blocks):
        prev = final_blocks[i - 1]
        curr = final_blocks[i]
        curr_first = curr["code"].split("\n")[0].strip()
        prev_last = prev["code"].split("\n")[-1].strip()

        # Merge kalau curr dimulai dengan cor.test/lm/summary dan
        # prev berakhir dengan ) atau print() atau assignment
        if re.match(r"^(cor\.test|lm\(|library\(|vp\s|summary)", curr_first):
            if prev_last.endswith(")") or prev_last.endswith("\"") or "<-" in prev_last:
                prev["code"] = prev["code"] + "\n" + curr["code"]
                prev["lines"] = prev["code"].count("\n") + 1
                final_blocks.pop(i)
                continue
        i += 1

    return final_blocks


def _extract_via_line_density(lines: List[str]) -> List[Dict[str, Any]]:
    """Fallback: extract berdasarkan density kode per baris.

    Kalau ada >= 3 baris kode adjacent, gabung jadi block.
    """
    blocks = []
    current = []
    start_line = 0

    for i, line in enumerate(lines):
        if is_code_line(line):
            if not current:
                start_line = i
            current.append(line)
        else:
            if len(current) >= 2:
                code = "\n".join(current).strip()
                if len(code) >= 10:
                    lang = detect_language_r(code)
                    blocks.append({
                        "code": code,
                        "lang": lang,
                        "lines": code.count("\n") + 1,
                        "source": "density",
                        "page": 1,
                    })
            current = []

    if len(current) >= 2:
        code = "\n".join(current).strip()
        if len(code) >= 10:
            lang = detect_language_r(code)
            blocks.append({
                "code": code,
                "lang": lang,
                "lines": code.count("\n") + 1,
                "source": "density",
                "page": 1,
            })

    return blocks


def _merge_adjacent_blocks(blocks: List[Dict], lines: List[str]) -> List[Dict]:
    """Merge blocks yang dipisah < 3 baris narasi.

    PENTING: JANGAN merge kalau salah satu blok punya marker "# Kasus N"
    atau "# Contoh N" — itu penanda blok terpisah.
    """
    if len(blocks) <= 1:
        return blocks

    merged = [blocks[0]]
    for b in blocks[1:]:
        prev = merged[-1]
        prev_code = prev["code"]
        curr_code = b["code"]

        prev_last = prev_code.split("\n")[-1].strip()
        curr_first = curr_code.split("\n")[0].strip()

        # JANGAN merge kalau current block punya # Kasus / # Contoh marker
        if re.match(r"^\s*#\s*[Kk]asus\s+\d", curr_first) or \
           re.match(r"^\s*#\s*[Cc]ontoh\s+\d", curr_first):
            merged.append(b)
            continue

        # JANGAN merge kalau prev block punya # Kasus marker
        # (setiap Kasus = blok terpisah)
        if re.search(r"^\s*#\s*[Kk]asus\s+\d", prev_code, re.MULTILINE):
            merged.append(b)
            continue

        should_merge = False
        if (prev_last.endswith(")") or prev_last.endswith(",") or
            "<-" in prev_last or "<-" in curr_first):
            should_merge = True

        if should_merge:
            prev["code"] = prev["code"] + "\n" + curr_code
            prev["lines"] = prev["code"].count("\n") + 1
        else:
            merged.append(b)

    return merged


# ─── Main entry ───
def extract_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """Main: extract code blocks dari PDF."""
    text = extract_text_from_pdf(pdf_path)
    if not text:
        return []
    return extract_code_blocks(text)


def extract_from_text(text: str) -> List[Dict[str, Any]]:
    """Extract code blocks dari plain text."""
    return extract_code_blocks(text)
