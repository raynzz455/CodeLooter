"""Pattern-based code extraction — enhanced version with improved accuracy.

Improvements over original:
1. Expanded R signals (~100+ patterns including dplyr, ggplot2, tidyr verbs)
2. Expanded prose words (Indonesian academic terms + English prepositions)
3. String assignment detection: var = "..."
4. Python control flow detection: while, if, return, elif, else, indented continuation
5. SQL signal detection: SELECT, INSERT, UPDATE, etc.
6. "Kasus N" markers without leading # (common in PDF-extracted text)
7. Pre-extraction whitespace normalization (remove page numbers)
8. Pre-extraction R-output stripping
9. Line-wrap repair integration
10. Better narrative detection (prose ratio threshold)
"""
import re
import json
from typing import List, Dict, Any, Tuple


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


CODE_START_PATTERNS = [
    r"Kode\s+Penyelesaian\s*:?",
    r"Kode\s+penyelesaian\s*:?",
    r"Kode\s+penyelesaiain\s*:?",
    r"Kode\s*:",
    r"#\s*[Kk]asus\s+\d",
    r"#\s*[Kk]asus\s*:",
    r"#\s*[Ss]oal\s+\d",
    r"#\s*[Cc]ontoh\s+\d",
    r"#\s*Latihan\s+\d",
    r"#\s*Praktikum\s+\d",
    r"#\s*Tugas\s+\d",
    r"Solusi\s*:",
    r"Jawaban\s*:",
    r"Script\s*:",
    r"Syntax\s*:",
    r"^\s*Kasus\s+\d",
    r"^\s*Soal\s+\d",
    r"^\s*Contoh\s+\d",
    r"^\s*Latihan\s+\d",
    r"^\s*Praktikum\s+\d",
    r"^\s*Tugas\s+\d",
]

CODE_END_PATTERNS = [
    r"Output\s+yang\s+dihasilkan\s*:?",
    r"Interpretasi\s+Hasil\s*:?",
    r"Interpretasi\s*:?",
    r"Penugasan\s*:?",
    r"Kode\s+Penyelesaian\s*:?",
    r"Kode\s+penyelesaian\s*:?",
    r"#\s*[Kk]asus\s+\d",
    r"#\s*[Ss]oal\s+\d",
    r"#\s*[Cc]ontoh\s+\d",
    r"#\s*Latihan\s+\d",
    r"#\s*Praktikum\s+\d",
    r"#\s*Tugas\s+\d",
    r"Solusi\s*:",
    r"Jawaban\s*:",
    r"^##\s",
    r"Hasil\s+Output\s*:?",
    r"Penjelasan\s*:?",
    r"Analisis\s*:?",
    r"Kesimpulan\s*:?",
]

R_SIGNALS = [
    r"<-",
    r"\blibrary\s*\(",
    r"\brequire\s*\(",
    r"\bcat\s*\(",
    r"\bqt\s*\(",
    r"\bqnorm\s*\(",
    r"\bqf\s*\(",
    r"\bqchisq\s*\(",
    r"\bpt\s*\(",
    r"\bpnorm\s*\(",
    r"\bpf\s*\(",
    r"\bdnorm\s*\(",
    r"\bdchisq\s*\(",
    r"\bdt\s*\(",
    r"\bsummary\s*\(",
    r"\blm\s*\(",
    r"\bglm\s*\(",
    r"\baov\s*\(",
    r"\bcor\.test\s*\(",
    r"\bchisq\.test\s*\(",
    r"\bt\.test\s*\(",
    r"\bwilcox\.test\s*\(",
    r"\bkruskal\.test\s*\(",
    r"\bshapiro\.test\s*\(",
    r"\bdata\.frame\s*\(",
    r"\bread\.csv\s*\(",
    r"\bread\.table\s*\(",
    r"\bread\.xlsx\s*\(",
    r"\bread\.delim\s*\(",
    r"\bset\.seed\s*\(",
    r"\bsample\s*\(",
    r"\bggplot\s*\(",
    r"\baes\s*\(",
    r"\bgeom_\w+\s*\(",
    r"\bfacet_\w+\s*\(",
    r"\btheme_\w+\s*\(",
    r"%>%",
    r"%[+\*]%",
    r"\b\w+\$\w+",
    r"\bprint\s*\(",
    r"\bmean\s*\(",
    r"\bmedian\s*\(",
    r"\bsd\s*\(",
    r"\bvar\s*\(",
    r"\bsqrt\s*\(",
    r"\babs\s*\(",
    r"\bround\s*\(",
    r"\bfloor\s*\(",
    r"\bceiling\s*\(",
    r"\bcbind\s*\(",
    r"\brbind\s*\(",
    r"\bhead\s*\(",
    r"\btail\s*\(",
    r"\bstr\s*\(",
    r"\bglimpse\s*\(",
    r"\bseq\s*\(",
    r"\brep\s*\(",
    r"\bc\s*\(",
    r"\bas\.matrix\s*\(",
    r"\bas\.data\.frame\s*\(",
    r"\bas\.numeric\s*\(",
    r"\bas\.character\s*\(",
    r"\btextConnection\s*\(",
    r"\bwrite\.csv\s*\(",
    r"\bwrite\.table\s*\(",
    r"\btable\s*\(",
    r"\bprop\.table\s*\(",
    r"\bfactor\s*\(",
    r"\blevels\s*\(",
    r"\bnames\s*\(",
    r"\bcolnames\s*\(",
    r"\brownames\s*\(",
    r"\bnrow\s*\(",
    r"\bncol\s*\(",
    r"\bdim\s*\(",
    r"\blength\s*\(",
    r"\bsort\s*\(",
    r"\border\s*\(",
    r"\bunique\s*\(",
    r"\bsubset\s*\(",
    r"\bfilter\s*\(",
    r"\bmutate\s*\(",
    r"\bselect\s*\(",
    r"\bgroup_by\s*\(",
    r"\bsummarise\s*\(",
    r"\bsummarize\s*\(",
    r"\barrange\s*\(",
    r"\bpaste\s*\(",
    r"\bpaste0\s*\(",
    r"\bsprintf\s*\(",
    r"\bnchar\s*\(",
    r"\btolower\s*\(",
    r"\btoupper\s*\(",
    r"\bsubstr\s*\(",
    r"\bgsub\s*\(",
]

PROSE_WORDS = {
    "dan", "atau", "yang", "untuk", "pada", "dengan", "dari", "ke", "di",
    "ini", "itu", "adalah", "akan", "sebuah", "seorang", "mahasiswa",
    "tersebut", "sebagai", "jika", "maka", "sehingga", "karena", "agar",
    "supaya", "rata", "selisih", "proporsi", "signifikan", "berbeda",
    "menggunakan", "menghitung", "menunjukkan", "bahwa", "hasil",
    "nilai", "tabel", "contoh", "soal", "kasus", "penyelesaian", "interpretasi",
    "output", "dihasilkan", "digunakan", "dapat", "tidak", "lebih", "besar",
    "kecil", "antara", "hingga", "serta", "namun", "tetapi", "sedangkan",
    "dalam", "luar", "atas", "bawah", "setiap", "beberapa", "banyak",
    "sedikit", "sama", "lain", "berikut", "misalnya", "seperti", "yaitu",
    "ialah", "merupakan", "selain", "kecuali", "maupun", "pula",
    "dilakukan", "diperoleh", "didapat", "ditemukan", "terlihat",
    "memperlihatkan", "menyatakan", "menjelaskan",
    "diperlukan", "dibutuhkan", "diharapkan",
    "modul", "praktikum", "latihan", "tugas", "jawaban", "pembahasan",
    "rumus", "formula", "persamaan", "metode", "analisis", "uji",
    "hipotesis", "nol", "alternatif", "tolak", "terima",
    "derajat", "bebas", "kebebasan", "distribusi", "normal",
    "ragam", "simpangan", "koefisien", "korelasi", "regresi",
    "variabel", "dependen", "independen", "residu", "prediksi",
    "the", "and", "or", "for", "with", "from", "to", "in", "of", "a", "an",
    "is", "are", "was", "were", "this", "that", "these", "those", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "must", "can", "than",
    "then", "so", "such", "no", "not", "only", "own", "same", "other",
    "into", "through", "during", "before", "after", "above", "below",
}

PROSE_RATIO_THRESHOLD = 0.4


def normalize_whitespace(lines):
    """Remove PDF artifacts: page numbers, 'halaman N', collapse spaces."""
    out = []
    for line in lines:
        line = line.replace("\r", "")
        line = re.sub(r"[ \t]{2,}", " ", line).rstrip()
        t = line.strip()
        if t and re.match(r"^\d+$", t):
            continue
        if re.match(r"^(halaman|hal|hal\.|page|pg|p\.|p)\s*\.?\s*\d+", t, re.IGNORECASE):
            continue
        if re.match(r"^[a-z]{1,4}\s+\d+(\.\d+)?\s*$", t, re.IGNORECASE):
            if not re.match(r"^(int|for|var|let|def|if|in|of|as|to|while|do|elif|else|try|return|import|from|class|function|library|require|module|export|async|await|package|interface|struct|enum|namespace|using|include|extends|implements|new|switch|case|break|continue|public|private|protected|static|void|float|double|long|string|const|print|printf|println|cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP)\b", t):
                continue
        out.append(line)
    return out


def strip_r_output_lines(lines):
    """Strip R console output BEFORE extraction. Returns (lines, count)."""
    out = []
    stripped = 0
    for line in lines:
        t = line.strip()
        if t.startswith("## ") or t.startswith("##\t") or re.match(r"^\[\d+\]\s", t):
            stripped += 1
            continue
        out.append(line)
    return out, stripped


def repair_line_wraps(lines):
    """Repair PDF line-wraps. Returns (lines, repaired_count)."""
    out = []
    i = 0
    repaired = 0
    while i < len(lines):
        line = lines[i]
        while i + 1 < len(lines) and _should_join(line, lines[i + 1]):
            i += 1
            line = line + lines[i].lstrip()
            repaired += 1
        out.append(line)
        i += 1
    return out, repaired


def _should_join(cur, nxt):
    cur_t = cur.rstrip()
    nxt_t = nxt.lstrip()
    if not cur_t or not nxt_t:
        return False
    if cur_t.endswith(";"):
        return False
    opens = cur_t.count("(") + cur_t.count("[") + cur_t.count("{")
    closes = cur_t.count(")") + cur_t.count("]") + cur_t.count("}")
    if opens > closes:
        return True
    if re.search(r"<-|->", nxt_t[:30]):
        return False
    if re.match(r"^[^=<>!]{1,20}=[^=]", nxt_t):
        return False
    if re.search(r"[.!?]$", cur_t):
        return False
    if re.search(r":$", cur_t) and not re.search(r"::$", cur_t):
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
        if not re.search(r"<-=", cur_t) and not re.match(r"^.{0,40}=[^=]", nxt_t):
            return True
    return False


def detect_language_r(code):
    r_hits = sum(1 for p in R_SIGNALS if re.search(p, code))
    if r_hits >= 2:
        return "r"
    if "<-" in code and r_hits >= 1:
        return "r"
    if "library(" in code:
        return "r"
    if "<-" in code:
        return "r"
    if re.search(r"\bdef\s+\w+\s*\(", code) or re.search(r"\bimport\s+\w+", code):
        return "python"
    if re.search(r"\bSELECT\b|\bFROM\b|\bWHERE\b|\bINSERT\s+INTO\b", code, re.IGNORECASE):
        return "sql"
    return "unknown"


def prose_ratio(line):
    tokens = re.findall(r"[a-zà-ÿ]+", line.lower())
    if not tokens:
        return 0.0
    return sum(1 for t in tokens if t in PROSE_WORDS) / len(tokens)


def is_code_line(line):
    t = line.strip()
    if not t:
        return False
    if t.startswith("## ") or t.startswith("##\t") or t.startswith("[1] "):
        return False
    ratio = prose_ratio(t)
    if ratio > PROSE_RATIO_THRESHOLD:
        has_signal = False
        for p in R_SIGNALS:
            if re.search(p, t):
                has_signal = True
                break
        if not has_signal:
            return False
    for p in R_SIGNALS:
        if re.search(p, t):
            return True
    if re.search(r"\w+\s*<-\s", t):
        return True
    if re.search(r"\w+\s*<-\s*$", t):
        return True
    if re.search(r"\w+\s*=\s*c\s*\(", t):
        return True
    if re.search(r"\w+\s*=\s*\d", t) and not re.search(r"^\s*(if|while|for)\s", t):
        return True
    if re.match(r"^\w+\s*=\s*[\"']", t):
        return True
    if re.match(r"^\s+[\"']", t) and len(line) > len(line.lstrip()):
        return True
    if re.search(r"\$\w+", t) and re.search(r"[()]", t):
        return True
    if re.match(r"^\s+\w+\s*=", t) and re.search(r"[,)]\s*$", t):
        return True
    if re.match(r"^\s+[\"'].*[\"']", t):
        return True
    if re.match(r"^\s*(import|from)\s+\w", t):
        return True
    if re.match(r"^\s*def\s+\w+\s*\(", t):
        return True
    if re.match(r"^\s*class\s+\w+", t):
        return True
    if re.match(r"^\s*if\s+__name__", t):
        return True
    if re.match(r"^\s*(print|return|raise|break|continue|pass)\s*[\(\s]", t):
        return True
    if re.match(r"^\s*return\s", t):
        return True
    if re.match(r"^\s*(if|elif|while|for|else)\s.*:\s*$", t):
        return True
    if re.match(r"^\s*else\s*:", t):
        return True
    if re.match(r"^\s*elif\s+", t):
        return True
    if re.match(r"^\s*#\s", t):
        return True
    if re.match(r"^\s{4,}\w+", t) and re.search(r"[()=<>+\-*/]", t) and not t.endswith(".") and not t.endswith(":"):
        if prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
            return True
    if re.match(r"^\s*if\s+\w+.*[<>=!]", t) and not t.endswith("."):
        return True
    if re.match(r"^\s*while\s+.+[:<>=!]", t):
        return True
    if re.match(r"^\s*\w+\s*=\s*[\(\d]", t) and re.search(r"[+\-*/]", t):
        return True
    if re.search(r"\w+\s*//", t):
        return True
    if re.match(r"^\s*\w+\[\w+\]", t):
        return True
    if re.match(r"^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|UNION)\b", t, re.IGNORECASE):
        return True
    if re.search(r";\s*$", t) and not re.search(r"[.!?]$", t):
        return True
    if re.search(r"\b\w+\s*\([^)]*\)", t) and not t.endswith(":") and not t.endswith("."):
        if prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
            return True
    return False


def is_r_output(line):
    t = line.strip()
    return t.startswith("## ") or t.startswith("##\t") or t.startswith("[1] ")


def extract_code_blocks(text):
    if not text or not text.strip():
        return []
    lines = text.split("\n")
    lines, _ = repair_line_wraps(lines)
    lines = normalize_whitespace(lines)
    lines, _ = strip_r_output_lines(lines)

    start_positions = []
    for i, line in enumerate(lines):
        for pattern in CODE_START_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                start_positions.append(i)
                break
    for i, line in enumerate(lines):
        if re.match(r"^\s*Contoh\s+\d\s*:", line, re.IGNORECASE):
            if i not in start_positions:
                start_positions.append(i)
    if not start_positions:
        for i, line in enumerate(lines):
            if is_code_line(line):
                start_positions.append(i)
                break
    start_positions.sort()

    blocks = []
    for idx, start in enumerate(start_positions):
        end = len(lines)
        if idx + 1 < len(start_positions):
            end = start_positions[idx + 1]
        code_lines = []
        for j in range(start, end):
            line = lines[j].rstrip()
            if not line.strip():
                continue
            t = line.strip()
            if re.match(r"^\s*(Kode\s+[Pp]enyelesaian|Kode\s*:)\s*:?\s*$", t, re.IGNORECASE):
                continue
            if is_code_line(line) or is_r_output(line):
                code_lines.append(line)
        if len(code_lines) >= 2:
            while code_lines and is_r_output(code_lines[-1]):
                code_lines.pop()
            while code_lines and is_r_output(code_lines[0]):
                code_lines.pop(0)
            if len(code_lines) >= 2:
                code = "\n".join(code_lines).strip()
                if len(code) >= 10:
                    blocks.append({
                        "code": code,
                        "lang": detect_language_r(code),
                        "lines": code.count("\n") + 1,
                        "source": "pattern",
                        "page": 1,
                    })

    if not blocks:
        blocks = _extract_via_line_density(lines)

    final_blocks = []
    SPLIT_PATTERN = re.compile(
        r"(?:^[ \t]*#[Kk]asus\s+\d|^[ \t]*#[Cc]ontoh\s+\d|"
        r"^[ \t]*data_\w+\s*<-?\s*data\.frame|^[ \t]*data_\w+\s*=\s*data\.frame|"
        r"^[ \t]*Kasus\s+\d|^[ \t]*Contoh\s+\d|^[ \t]*Soal\s+\d|"
        r"^[ \t]*Latihan\s+\d|^[ \t]*Praktikum\s+\d|^[ \t]*Tugas\s+\d)",
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

    captured_lines = set()
    for b in final_blocks:
        for line in b["code"].split("\n"):
            captured_lines.add(line.strip())
    uncoded_blocks = []
    current = []
    for i, line in enumerate(lines):
        t = line.strip()
        if is_code_line(line) and t not in captured_lines:
            current.append(line)
        else:
            if len(current) >= 1:
                code = "\n".join(current).strip()
                already = any(code in b["code"] for b in final_blocks)
                if not already and len(code) >= 5:
                    uncoded_blocks.append({
                        "code": code,
                        "lang": detect_language_r(code),
                        "lines": code.count("\n") + 1,
                        "source": "scan-fallback",
                        "page": 1,
                    })
            current = []
    if len(current) >= 1:
        code = "\n".join(current).strip()
        already = any(code in b["code"] for b in final_blocks)
        if not already and len(code) >= 5:
            uncoded_blocks.append({
                "code": code,
                "lang": detect_language_r(code),
                "lines": code.count("\n") + 1,
                "source": "scan-fallback",
                "page": 1,
            })
    final_blocks.extend(uncoded_blocks)

    i = 1
    while i < len(final_blocks):
        prev = final_blocks[i - 1]
        curr = final_blocks[i]
        curr_first = curr["code"].split("\n")[0].strip()
        prev_last = prev["code"].split("\n")[-1].strip()
        if re.match(r"^(cor\.test|lm\(|library\(|vp\s|summary)", curr_first):
            if prev_last.endswith(")") or prev_last.endswith('"') or "<-" in prev_last:
                prev["code"] = prev["code"] + "\n" + curr["code"]
                prev["lines"] = prev["code"].count("\n") + 1
                final_blocks.pop(i)
                continue
        i += 1
    return final_blocks


def _extract_via_line_density(lines):
    blocks = []
    current = []
    for i, line in enumerate(lines):
        if is_code_line(line):
            current.append(line)
        else:
            if len(current) >= 1:
                code = "\n".join(current).strip()
                if len(code) >= 5:
                    blocks.append({
                        "code": code,
                        "lang": detect_language_r(code),
                        "lines": code.count("\n") + 1,
                        "source": "density",
                        "page": 1,
                    })
            current = []
    if len(current) >= 1:
        code = "\n".join(current).strip()
        if len(code) >= 5:
            blocks.append({
                "code": code,
                "lang": detect_language_r(code),
                "lines": code.count("\n") + 1,
                "source": "density",
                "page": 1,
            })
    return blocks


def _merge_adjacent_blocks(blocks, lines):
    if len(blocks) <= 1:
        return blocks
    merged = [blocks[0]]
    for b in blocks[1:]:
        prev = merged[-1]
        prev_last = prev["code"].split("\n")[-1].strip()
        curr_first = b["code"].split("\n")[0].strip()
        if re.match(r"^\s*#\s*[Kk]asus\s+\d", curr_first) or re.match(r"^\s*#\s*[Cc]ontoh\s+\d", curr_first):
            merged.append(b)
            continue
        if re.search(r"^\s*#\s*[Kk]asus\s+\d", prev["code"], re.MULTILINE):
            merged.append(b)
            continue
        should_merge = False
        if (prev_last.endswith(")") or prev_last.endswith(",") or "<-" in prev_last or "<-" in curr_first):
            should_merge = True
        if should_merge:
            prev["code"] = prev["code"] + "\n" + b["code"]
            prev["lines"] = prev["code"].count("\n") + 1
        else:
            merged.append(b)
    return merged


def extract_from_pdf(pdf_path):
    text = extract_text_from_pdf(pdf_path)
    if not text:
        return []
    return extract_code_blocks(text)


def extract_from_text(text):
    return extract_code_blocks(text)
