"""Pattern-based code extraction — UPGRADED (Task 21) to parity with TS version.

Multi-layer extraction:
1. Pre-processing: line-wrap repair, whitespace normalization, R-output stripping
2. findStartPositions with MARKER_DEDUP_GAP=2 (prevents standalone lang="unknown" headers)
3. Per-line classify (code / narrative / R-output) using strict prose filter
4. String context awareness — multi-line R string capture
5. SPLIT_PATTERN includes `## N.` section headers + title-case markdown headings
6. scan-fallback for code lines not yet captured
7. merge_fragmented_blocks with MAX_GAP=2 + structural continuation
8. strip_narrative() — removes leading/trailing narrative + markdown headings
9. is_markdown_heading() — title-case `#` lines detected as headings (not code comments)

Language detection now uses the upgraded `language_detection.detect_language`
(supports 15 languages with comprehensive signal arrays + custom priority chain).

Special handling for Indonesian modul praktikum preserved:
- "Kode Penyelesaian:" markers
- "Kasus N" / "Contoh N" / "Latihan N" without leading #
- R-style multi-line assignment: var = ( ... ")
- Indonesian narrative filtering (prose ratio with academic terms)
- R-output stripping (## lines) — fixed to NOT match markdown headings
"""
import re
import json
from typing import List, Dict, Any, Tuple

from .language_detection import (
    detect_language,
    R_SIGNALS,
    PYTHON_SIGNALS,
    SQL_SIGNALS,
    JAVA_SIGNALS,
    CPP_SIGNALS,
    JAVASCRIPT_SIGNALS,
    TYPESCRIPT_SIGNALS,
    PHP_SIGNALS,
    BASH_SIGNALS,
    GO_SIGNALS,
    RUST_SIGNALS,
    KOTLIN_SIGNALS,
    HTML_SIGNALS,
    CSS_SIGNALS,
    JSON_SIGNALS,
    MATLAB_SIGNALS,
)


def extract_text_from_pdf(pdf_path: str) -> str:
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


# ── Start markers ──
CODE_START_PATTERNS = [
    r"Kode\s+Penyelesaian\s*:?",
    r"Kode\s+penyelesaian\s*:?",
    r"Kode\s+penyelesaiain\s*:?",
    r"Kode\s*:",
    r"#\s*[Kk]asus\s+\d", r"#\s*[Kk]asus\s*:",
    r"#\s*[Ss]oal\s+\d", r"#\s*[Cc]ontoh\s+\d",
    r"#\s*Latihan\s+\d", r"#\s*Praktikum\s+\d", r"#\s*Tugas\s+\d",
    r"Solusi\s*:", r"Jawaban\s*:", r"Script\s*:", r"Syntax\s*:",
    r"^\s*Kasus\s+\d", r"^\s*Soal\s+\d", r"^\s*Contoh\s+\d",
    r"^\s*Latihan\s+\d", r"^\s*Praktikum\s+\d", r"^\s*Tugas\s+\d",
    # NEW: Section headers like "## 1. Title", "### 1.1 Subtitle"
    r"^#{1,4}\s+\d+\.\s+",
    r"^#{1,4}\s+\d+\.\d+\s+",
    # NEW: Shebang lines start code blocks
    r"^#!/",
    # NEW: PHP opening tag starts a code block
    r"^<\?php",
    r"^<\?=",
    # NEW: HTML doctype/html/head/body tags start HTML blocks
    r"^<!DOCTYPE\s",
    r"^<html\b",
    # NEW: JSON opening brace at line start (alone)
    r"^\{\s*$",
    # NEW: Java/C++/Go/Rust package declaration
    r"^\s*package\s+[\w.]+\s*;",
    r"^\s*package\s+(main|\w+)\s*$",
    # NEW: C/C++ #include
    r"^\s*#include\s+[<\"]",
]

CODE_END_PATTERNS = [
    r"Output\s+yang\s+dihasilkan\s*:?",
    r"Interpretasi\s+Hasil\s*:?", r"Interpretasi\s*:?",
    r"Penugasan\s*:?", r"Kode\s+Penyelesaian\s*:?",
    r"#\s*Kasus\s+\d", r"#\s*Soal\s+\d", r"#\s*Contoh\s+\d",
    r"#\s*Latihan\s+\d", r"#\s*Praktikum\s+\d", r"#\s*Tugas\s+\d",
    r"Solusi\s*:", r"Jawaban\s*:", r"^##\s",
    r"Hasil\s+Output\s*:?", r"Penjelasan\s*:?",
    r"Analisis\s*:?", r"Kesimpulan\s*:?",
]


PROSE_WORDS = {
    # Indonesian
    "dan", "atau", "yang", "untuk", "pada", "dengan", "dari", "ke", "di",
    "ini", "itu", "adalah", "akan", "sebuah", "seorang", "mahasiswa",
    "tersebut", "sebagai", "jika", "maka", "sehingga", "karena", "agar",
    "supaya", "selisih", "proporsi", "signifikan", "berbeda",
    "menggunakan", "menghitung", "menunjukkan", "bahwa", "hasil",
    "nilai", "tabel", "contoh", "soal", "kasus", "penyelesaian", "interpretasi",
    "output", "dihasilkan", "digunakan", "dapat", "tidak", "lebih", "besar",
    "kecil", "antara", "hingga", "serta", "namun", "tetapi", "sedangkan",
    "dalam", "luar", "atas", "bawah", "setiap", "beberapa", "banyak",
    "sedikit", "sama", "lain", "berikut", "misalnya", "seperti", "yaitu",
    "ialah", "merupakan", "yakni", "adapun",
    "selain", "kecuali", "maupun", "pula",
    "dilakukan", "diperoleh", "didapat", "ditemukan", "terlihat",
    "memperlihatkan", "menyatakan", "menjelaskan",
    "diperlukan", "dibutuhkan", "diharapkan",
    "modul", "praktikum", "latihan", "tugas", "jawaban", "pembahasan",
    "rumus", "formula", "persamaan", "metode", "analisis", "uji",
    "hipotesis", "nol", "alternatif", "tolak", "terima",
    "derajat", "bebas", "kebebasan", "distribusi", "normal",
    "ragam", "simpangan", "koefisien", "korelasi", "regresi",
    "variabel", "dependen", "independen", "residu", "prediksi",
    "peubah", "asosiasi", "penelitian", "sampel", "taraf",
    "artinya", "diterima", "ditolak",
    "rata", "dosen",
    # English
    "the", "and", "or", "for", "with", "from", "to", "in", "of", "a", "an",
    "is", "are", "was", "were", "this", "that", "these", "those", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "must", "can", "than",
    "then", "so", "such", "no", "not", "only", "own", "same", "other",
    "into", "through", "during", "before", "after", "above", "below",
    "about", "across", "against", "along", "among",
    "around", "at", "behind", "beneath", "beside",
    "between", "beyond", "by", "down", "except",
    "inside", "like", "near", "off", "on", "out",
    "outside", "over", "past", "since", "throughout",
    "toward", "under", "underneath", "until", "up", "upon",
    "within", "without",
}

PROSE_RATIO_THRESHOLD = 0.4

# Patterns that are DEFINITELY narrative, even if they contain = or ()
# IMPORTANT: single-word Indonesian terms use \b word boundaries so they don't
# match variable identifiers like `koefisien_variasi` or `signifikan_level`.
STATISTICAL_NARRATIVE_PATTERNS = [
    re.compile(r"menunjukkan\s+bahwa", re.IGNORECASE),
    re.compile(r"karena\s+p.?value", re.IGNORECASE),
    re.compile(r"\bH0\b.*diterima", re.IGNORECASE),
    re.compile(r"\bH0\b.*ditolak", re.IGNORECASE),
    re.compile(r"\bartinya\b", re.IGNORECASE),
    re.compile(r"\bR.?squared\b", re.IGNORECASE),
    re.compile(r"\bAdjusted\b", re.IGNORECASE),
    re.compile(r"\bsignifikan\b(?!_)", re.IGNORECASE),
    re.compile(r"\bkoefisien\b(?!_)", re.IGNORECASE),
    re.compile(r"hubungan\s+asosiasi", re.IGNORECASE),
    re.compile(r"\bpenyimpangan\b(?!_)", re.IGNORECASE),
    re.compile(r"\bdiperkirakan\b", re.IGNORECASE),
    re.compile(r"\bmeningkat\b", re.IGNORECASE),
    re.compile(r"\bberkontribusi\b", re.IGNORECASE),
    re.compile(r"\bmengindikasikan\b", re.IGNORECASE),
    re.compile(r"\bvariabilitas\b(?!_)", re.IGNORECASE),
    re.compile(r"\bdijelaskan\b", re.IGNORECASE),
]

# Equation patterns (math, not code)
EQUATION_PATTERNS = [
    re.compile(r"\d\s*[×÷±]\s*\d"),  # uses math operators × ÷ ±
    re.compile(r"\bchi.?square\b", re.IGNORECASE),
    re.compile(r"Σ.*O.*E", re.IGNORECASE),  # chi-square formula
]


def normalize_whitespace(lines):
    """Normalize whitespace — removes PDF artifacts.

    UPGRADED (Task 21): adds line-number prefix stripping and Python REPL
    prompt stripping (`>>> ` and `... `).
    """
    out = []
    for line in lines:
        line = line.replace("\r", "")
        line = re.sub(r"[ \t]{2,}", " ", line).rstrip()
        t = line.strip()

        # Remove standalone page numbers (lines that are just digits)
        if t and re.match(r"^\d+$", t):
            continue

        # NEW: Strip line number prefixes — common in PDF/textbook code listings.
        # Pattern: "  1  def foo():" or "10 print('hi')" -> strip the leading number.
        # Only strip if: (a) line starts with digits followed by 2+ spaces, AND
        # (b) the rest of the line looks like code (has code-like characters).
        # This preserves lines like "year <- 2001" (no leading number+space gap).
        line_num_match = re.match(r"^(\d+)\s{2,}(.+)$", t)
        if line_num_match:
            rest = line_num_match.group(2)
            # Only strip if the rest looks like code (not a narrative sentence)
            if re.search(r"[(){}\[\];=<>&|!,]", rest) or \
               re.match(r"^\w+\s*=\s*", rest) or \
               re.match(r"^\s*(def|function|func|fn|class|if|for|while|return|import|from|public|private|var|let|const|val)\b", rest):
                line = re.sub(r"^\s*\d+\s{2,}", "", line)

        # NEW: Strip Python REPL prompts (>>> and ...) — common in textbook examples.
        # ">>> fruits = ['apple']" -> "fruits = ['apple']"
        # "... fruits.append('date')" -> "fruits.append('date')"
        repl_match = re.match(r"^(\s*)(>>>|\.\.\.)\s+(.+)$", line)
        if repl_match:
            line = repl_match.group(1) + repl_match.group(3)

        # Remove short "word + number" patterns that are PDF page artifacts
        if re.match(r"^(halaman|hal|hal\.|page|pg|p\.|p)\s*\.?\s*\d+", t, re.IGNORECASE):
            continue
        if re.match(r"^[a-z]{1,4}\s+\d+(\.\d+)?\s*$", t, re.IGNORECASE):
            if not re.match(
                r"^(int|for|var|let|def|if|in|of|as|to|while|do|elif|else|try|except|finally|"
                r"return|raise|throw|import|from|class|function|func|fn|library|require|"
                r"module|export|async|await|package|interface|struct|enum|namespace|using|"
                r"include|extends|implements|new|switch|case|break|continue|public|private|"
                r"protected|static|void|float|double|long|string|const|print|printf|println|"
                r"cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP)\b",
                t,
            ):
                continue
        out.append(line)
    return out


def strip_r_output_lines(lines):
    """Strip R console output lines (## ..., [1] ...) BEFORE extraction."""
    out = []
    stripped = 0
    for line in lines:
        if is_r_output(line):
            stripped += 1
            continue
        out.append(line)
    return out, stripped


def repair_line_wraps(lines):
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
    """Heuristic: should `cur` and `nxt` be joined into one logical line?

    UPGRADED (Task 21): adds opening-bracket protection (don't join when current
    is just `{` / `[` / `(` — JSON/data structures) and SQL clause continuation
    (FROM, JOIN, WHERE, etc.).
    """
    cur_t = cur.rstrip()
    nxt_t = nxt.lstrip()
    if not cur_t or not nxt_t:
        return False
    # Don't join if current ends with `;` (statement separator)
    if cur_t.endswith(";"):
        return False

    # NEW: Don't join if current line is JUST an opening bracket ({, [, ()
    # These are block openers (JSON objects, arrays, function calls), not
    # continuation signals. Joining them with the next line would break
    # JSON extraction and multi-line data structures.
    if re.match(r"^[({\[]\s*$", cur_t):
        return False

    # Join if there are unclosed brackets on the current line
    opens = cur_t.count("(") + cur_t.count("[") + cur_t.count("{")
    closes = cur_t.count(")") + cur_t.count("]") + cur_t.count("}")
    if opens > closes:
        return True

    # NEW: SQL continuation — if current line ends with a SQL clause keyword
    # (FROM, JOIN, WHERE, SET, INTO, VALUES, ON, AND, OR), the next line is the
    # continuation of the query. e.g. "SELECT * FROM\nusers WHERE x > 0".
    if re.search(
        r"\b(FROM|JOIN|INNER|OUTER|LEFT|RIGHT|WHERE|SET|INTO|VALUES|ON|AND|OR|"
        r"GROUP|ORDER|HAVING|UNION|SELECT|INSERT|UPDATE|DELETE|CREATE|TABLE|"
        r"ALTER|DROP)\s*$",
        cur_t,
        re.IGNORECASE,
    ):
        # But don't join if next starts a brand-new statement or looks like a sentence start
        code_kw = _CODE_KEYWORD_RE
        if not code_kw.match(nxt_t) and not _is_sentence_start(nxt_t):
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
    if _CODE_KEYWORD_RE.match(nxt_t):
        return False
    if _is_sentence_start(nxt_t):
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


# Code keywords that, if the NEXT line starts with them, signal a NEW statement.
_CODE_KEYWORD_RE = re.compile(
    r"^\s*(import|from|def|class|function|func|fn|return|if|else|elif|"
    r"for|while|switch|case|break|continue|public|private|protected|static|"
    r"void|int|float|double|long|string|var|let|const|print|printf|println|"
    r"cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP|"
    r"library|require|module|export|async|await|package|interface|struct|enum|"
    r"namespace|using|include|extends|implements|new|throw|try|catch|finally|"
    r"#|//|/\*|--)"
)


def _is_sentence_start(t):
    """Does `t` look like a "Capitalized Word lowercase" sentence start?"""
    return bool(re.match(r"^[A-Z][a-z]+\s+[a-z]", t)) and not re.match(r"^\w+\s*\(", t)


def detect_language_r(code):
    """Legacy alias — now delegates to the upgraded detect_language.

    Kept for backward compatibility with any callers that import this name.
    """
    return detect_language(code)


def prose_ratio(line):
    """Return the fraction of word tokens in `line` that are PROSE_WORDS."""
    tokens = re.findall(r"[a-zà-ÿ]+", line.lower())
    if not tokens:
        return 0.0
    return sum(1 for t in tokens if t in PROSE_WORDS) / len(tokens)


def is_r_output(line):
    """Detect R console output lines (## ..., [1] ...).

    UPGRADED (Task 21): excludes markdown headings — `## 1. Title` and
    `## TitleCase` are NOT R output. R output looks like `## X-squared = 2.22`;
    markdown headings look like `## 1. Query Data` or `### Subsection`.
    """
    t = line.lstrip()
    if t.startswith("## ") or t.startswith("##\t"):
        # Don't match markdown section headings like "## 1. Title" or "### Section"
        if re.match(r"^#{1,6}\s+\d+\.\s+", t):
            return False  # numbered heading
        if re.match(r"^#{1,6}\s+[A-Z][a-z]+(?:\s+\w+){0,5}\s*$", t):
            return False  # title-case heading
        return True
    if re.match(r"^\[\d+\]\s", t):
        return True
    return False


def _is_statistical_narrative(t):
    """Check if line matches statistical narrative patterns (definitely narrative)."""
    for p in STATISTICAL_NARRATIVE_PATTERNS:
        if p.search(t):
            return True
    return False


def _is_equation(t):
    """Check if line is a math equation (not code).

    Comments are NEVER equations — they're code (# Kasus 1: Uji Chi-Square).
    """
    if re.match(r"^\s*#", t):
        return False
    for p in EQUATION_PATTERNS:
        if p.search(t):
            return True
    # Pattern: var = number + number * var (equation, not assignment)
    if re.match(r"^\w+\s*=\s*\d+(\.\d+)?\s*[+]\s*\d", t) and "<-" not in t and not re.search(r"c\s*\(", t):
        return True
    # Pattern: var = expr = number (e.g. "df = n - 1 = 29", "χ² = Σ(O-E)²/E = 2.34")
    if re.match(r"^\w+\s*=\s*\S+.*=\s*\d", t) and "<-" not in t and "(" not in t:
        return True
    return False


def is_narrative_line(line):
    """Check if line is narrative (prose), not code."""
    t = line.strip()
    if not t:
        return False

    # Comments (# ...) are NEVER narrative — they're code
    if re.match(r"^\s*#\s", t):
        return False
    # Shebang (#!...) is NEVER narrative
    if t.startswith("#!"):
        return False
    # HTML comments (<!-- ... -->) are code
    if re.match(r"^\s*<!--", t):
        return False
    # CSS comments (/* ... */) are code
    if re.match(r"^\s*/\*", t):
        return False
    # C/C++/Java/JS single-line comments (// ...) are code
    if re.match(r"^\s*//", t):
        return False
    # MATLAB/Shell comments (% ...) for MATLAB
    if re.match(r"^\s*%\s", t):
        return False

    # Statistical narrative: "X-squared = 2.2222 menunjukkan bahwa..."
    if _is_statistical_narrative(t):
        return True

    ratio = prose_ratio(t)
    if ratio > PROSE_RATIO_THRESHOLD:
        # Override back to code if there's >=1 R signal
        for p in R_SIGNALS:
            if p.search(t):
                return False
        # Check Python/SQL/Java/C++/JS/TS/PHP/Bash/Go/Rust/Kotlin/MATLAB signals
        all_code_signals = (
            PYTHON_SIGNALS + SQL_SIGNALS + JAVA_SIGNALS +
            CPP_SIGNALS + JAVASCRIPT_SIGNALS + TYPESCRIPT_SIGNALS +
            PHP_SIGNALS + BASH_SIGNALS + GO_SIGNALS + RUST_SIGNALS +
            KOTLIN_SIGNALS + MATLAB_SIGNALS
        )
        for p in all_code_signals:
            if p.search(t):
                return False
        # Also check Python/SQL/Java keywords explicitly
        if re.match(
            r"^\s*(import|from|def|class|if|elif|else|while|for|return|raise|"
            r"break|continue|pass|with|try|except|finally|yield|lambda|async|"
            r"await|global|nonlocal)\b", t
        ):
            return False
        if re.match(
            r"^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|"
            r"JOIN|GROUP|ORDER|HAVING|UNION|SET|INTO|VALUES|TABLE|INDEX|VIEW)\b",
            t, re.IGNORECASE
        ):
            return False
        if re.match(
            r"^\s*(public|private|protected|static|final|abstract|class|interface|"
            r"enum|extends|implements|package|import|new|return|void|int|double|"
            r"float|long|boolean|char|byte|short)\b", t
        ):
            return False
        if re.match(
            r"^\s*(func|package|import|var|const|let|defer|go|chan|type|struct|"
            r"interface|map|range|select|case|default|break|continue|fallthrough)\b", t
        ):
            return False
        if re.match(
            r"^\s*(fn|let|mut|pub|use|mod|struct|enum|trait|impl|match|if|else|"
            r"while|for|loop|return|break|continue|move|ref|self|super|crate)\b", t
        ):
            return False
        if re.match(
            r"^\s*(val|var|fun|class|object|data|companion|override|private|"
            r"public|protected|internal|abstract|open|sealed|init|when|by|as|"
            r"in|is|out|vararg|reified|crossinline|noinline|tailrec|suspend|inline)\b", t
        ):
            return False
        return True
    return False


def is_code_line(line):
    """Classify a single line as code or not.

    UPGRADED (Task 21): 380+ patterns covering 15 languages
    (R/Python/SQL/Java/C++/JS/TS/PHP/Bash/Go/Rust/Kotlin/HTML/CSS/JSON/MATLAB).

    Order of checks:
    1. Empty / R-output / narrative / equation → False
    2. R signals (legacy R_SIGNALS array)
    3. Assignment patterns (R/Python/JS array/dict literal, method chains)
    4. Python signals (def/import/class/print/...)
    5. Markdown heading detection in `#` lines (title-case → heading, NOT code)
    6. SQL signals
    7. Multi-language patterns (Java/C++/JS/TS/PHP/Bash/Go/Rust/Kotlin/HTML/CSS/JSON/MATLAB)
    8. General code patterns (semicolon, function call with code operators)
    """
    t = line.strip()
    if not t:
        return False
    if is_r_output(t):
        return False
    if is_narrative_line(t):
        return False

    # Equation detection — math formulas are NOT code
    if _is_equation(t):
        return False

    # R signals
    for p in R_SIGNALS:
        if p.search(t):
            return True
    # assignment patterns
    if re.search(r"\w+\s*<-\s", t):
        return True
    if re.search(r"\w+\s*<-\s*$", t):
        return True
    if re.search(r"\w+\s*=\s*c\s*\(", t):
        return True
    if re.search(r"\w+\s*=\s*\d", t) and not re.match(r"^\s*(if|while|for)\s", t):
        return True
    if re.match(r"^\w+\s*=\s*[\"']", t):
        return True
    # R-style multi-line assignment: var = ( or var <- (
    if re.match(r"^\w+\s*=\s*\(\s*$", t):
        return True
    if re.match(r"^\w+\s*<-\s*\(\s*$", t):
        return True
    # String content inside R assignment — must start with quote AND ≤80 chars
    # AND no sentence ender. Allow longer quoted strings if they contain data.
    if re.match(r"^[\"']", t) and len(t) <= 80 and not re.search(r"[.!?]$", t):
        words = t.split()
        has_data = bool(re.search(r"\d", t))
        if len(words) <= 4 and prose_ratio(t) <= 0.4:
            return True
        # Quoted string with numeric data (e.g. "A 12 B 18 C 7") — single letters
        # like "A", "B", "C" are data labels, not prose.
        if has_data and len(words) <= 8 and prose_ratio(t) <= 0.4:
            return True
    # Data rows like "L 55 25" — only if word is 1-3 chars (code label, not narrative)
    if re.match(r"^[A-Za-z]\w{0,2}\s+\d+(\s+\d+)*\s*$", t) and prose_ratio(t) == 0:
        return True
    # Closing paren(s) only — line is just `)` / `]` / `}`
    if re.match(r"^[)\]}]+\s*$", t):
        return True
    # Multi-variable assignment (Python tuple unpacking)
    if re.match(r"^\w+\s*(,\s*\w+)+\s*=", t):
        return True
    # Index/bracket assignment
    if re.match(r"^\w+\s*=\s*\w+\[", t):
        return True
    # Array literal assignment (Python/JS: var = [...])
    if re.match(r"^\w+\s*=\s*\[", t):
        return True
    # Dict/object literal assignment (Python/JS: var = {...})
    if re.match(r"^\w+\s*=\s*\{", t):
        return True
    # Array destructuring (Python/JS: [a, b] = ...)
    if re.match(r"^\[.*\]\s*=", t):
        return True
    # Variable = function call (e.g., filtered = filtfilt(b, a, signal))
    if re.match(r"^\w+\s*=\s*\w+\s*\(", t) and prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    # Method call chain (e.g., plt.figure(...), fruits.append(...), df.head())
    if re.match(r"^\w+\.\w+\s*\(", t) and prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    # Attribute access assignment (e.g., self.items = [])
    if re.match(r"^\w+\.\w+\s*=", t) and prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    # Chain access assignment
    if re.match(r"^\w+\s*=\s*\w+\.\w+", t):
        return True
    # Continuation: word = value ending with comma/closing paren
    if re.match(r"^\w+\s*=", t) and re.search(r"[,)]\s*$", t) and \
       prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    # R $ accessor
    if re.search(r"\$\w+", t) and re.search(r"[()]", t):
        return True

    # Python signals
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
        # Don't treat markdown headings (title-case # Title) as code comments.
        # A code comment like `# load data` is lowercase; a heading like
        # `# Membuat Aplikasi Android` is title-case.
        # But `# Kasus 1: Uji Chi-Square` IS a code comment (has `:` and number).
        content = re.sub(r"^\s*#\s+", "", t)
        # If the comment contains a colon, comma, or equals — it's likely a code comment
        if re.search(r"[:=,]", content):
            return True
        words = [w for w in content.split() if re.match(r"^[A-Za-z]", w)]
        if len(words) >= 2:
            capitalized = sum(1 for w in words if re.match(r"^[A-Z]", w))
            # If >60% of words are capitalized AND no numbers → markdown heading
            if capitalized / len(words) >= 0.6 and not re.search(r"\d", content):
                return False
        return True
    if re.match(r"^\s{4,}\w+", t) and re.search(r"[()=<>+\-*/]", t) and \
       not t.endswith(".") and not t.endswith(":"):
        if prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
            return True
    if re.match(r"^\s*if\s+\w+.*[<>=!]", t) and not t.endswith("."):
        return True
    if re.match(r"^\s*while\s+.+[:<>=!]", t):
        return True
    if re.match(r"^\s*\w+\s*=\s*\w+.*[+\-*/]", t) and prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    if re.match(r"^\s*\w+\s*=\s*[\(\d]", t) and re.search(r"[+\-*/]", t) and \
       prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    if re.search(r"\w+\s*//", t):
        return True
    if re.match(r"^\s*\w+\[\w+\]", t):
        return True

    # SQL signals
    if re.match(
        r"^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|"
        r"GROUP\s+BY|ORDER\s+BY|HAVING|UNION|SET|INTO|VALUES|TABLE|INDEX|VIEW|"
        r"PRIMARY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|UNIQUE|NOT\s+NULL|"
        r"AUTO_INCREMENT|INNER|LEFT|RIGHT|OUTER|FULL|CROSS)\b", t, re.IGNORECASE
    ):
        return True
    if re.match(r"^\s*(VARCHAR|INT|INTEGER|DECIMAL|FLOAT|DOUBLE|BOOLEAN|DATE|DATETIME|TIMESTAMP|TEXT|BLOB|CHAR)\b", t, re.IGNORECASE) and \
       re.search(r"[\s,)]", t):
        return True
    if re.search(r"--\s", t) and prose_ratio(t) == 0:
        return True  # SQL comment

    # ── Multi-language code patterns (NEW in Task 21) ──

    # SHEBANG (#!/bin/bash, #!/usr/bin/env python) — always code
    if re.match(r"^#!\/", t):
        return True

    # JAVA patterns
    if re.match(r"^\s*(public|private|protected)\s+(static\s+)?(final\s+)?(class|interface|enum|void|int|String|double|boolean|long|float|char|byte|short)\b", t):
        return True
    if re.match(r"^\s*(public|private|protected)\s+(static\s+)?\w+(?:\[\])?\s+\w+\s*[=;(]", t):
        return True
    if re.match(r"^\s*(final|abstract|synchronized|native|transient|volatile)\s+", t):
        return True
    if re.match(r"^\s*class\s+\w+", t):
        return True
    if re.match(r"^\s*interface\s+\w+", t):
        return True
    if re.match(r"^\s*enum\s+\w+", t):
        return True
    if re.match(r"^\s*import\s+java\.", t):
        return True
    if re.match(r"^\s*import\s+(static\s+)?[\w.]+\s*;", t):
        return True
    if re.match(r"^\s*package\s+[\w.]+\s*;", t):
        return True
    if re.match(r"^\s*throws\s+", t):
        return True
    if re.match(r"^\s*new\s+\w+\s*\(", t):
        return True
    if re.match(r"^\s*new\s+\w+\s*\[", t):
        return True
    if re.match(r"^\s*this\.\w+", t):
        return True
    if re.match(r"^\s*super\.\w+", t):
        return True
    if re.match(r"^\s*System\.(out|err)\.", t):
        return True
    if re.match(r"^\s*@\w+", t):  # annotations
        return True
    if re.match(r"^\s*@\w+\.\w+", t):
        return True
    if re.match(r"^\s*@\w+\s*\(", t):
        return True
    if re.match(r"^\s*return\s+(new\s+)?\w+", t):
        return True
    if re.match(r"^\s*extends\s+\w+", t):
        return True
    if re.match(r"^\s*implements\s+\w+", t):
        return True
    if re.match(r"^\s*instanceof\s+\w+", t):
        return True
    if re.match(r"^\s*(int|double|float|long|short|byte|char|boolean|String)\s*\[\s*\]", t):
        return True
    if re.match(r"^\s*(int|double|float|long|short|byte|char|boolean|String)\s+\w+\s*=", t):
        return True
    if re.match(r"^\s*(int|double|float|long|short|byte|char|boolean|String)\s+\w+\s*;", t):
        return True
    if re.match(r"^\s*void\s+\w+\s*\(", t):
        return True
    if re.search(r"\btry\s*\{", t):
        return True
    if re.search(r"\bcatch\s*\(", t):
        return True
    if re.search(r"\bfinally\s*\{", t):
        return True
    if re.search(r"\bthrow\s+new\s+", t):
        return True

    # C++ patterns
    if re.match(r"^\s*#include\s+[<\"]", t):
        return True
    if re.match(r"^\s*#define\s+\w+", t):
        return True
    if re.match(r"^\s*#ifndef\s+\w+", t):
        return True
    if re.match(r"^\s*#ifdef\s+\w+", t):
        return True
    if re.match(r"^\s*#pragma\s+", t):
        return True
    if re.match(r"^\s*#endif", t):
        return True
    if re.match(r"^\s*using\s+namespace\s+", t):
        return True
    if re.match(r"^\s*template\s*<", t):
        return True
    if re.match(r"^\s*namespace\s+\w+", t):
        return True
    if re.match(r"^\s*std::", t):
        return True
    if re.match(r"^\s*cout\s*<<", t):
        return True
    if re.match(r"^\s*cin\s*>>", t):
        return True
    if re.match(r"^\s*cerr\s*<<", t):
        return True
    if re.match(r"^\s*int\s+main\s*\(", t):
        return True
    if re.match(r"^\s*return\s+\d+\s*;", t):
        return True
    if re.search(r"->\w+", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"::\w+", t) and prose_ratio(t) == 0:
        return True
    if re.match(r"^\s*delete\s+\w+", t):
        return True
    if re.match(r"^\s*delete\[\]\s+\w+", t):
        return True
    if re.match(r"^\s*new\s+\w+", t):
        return True
    if re.match(r"^\s*nullptr\b", t):
        return True
    if re.match(r"^\s*endl\b", t):
        return True
    if re.match(r"^\s*(const|auto|static|extern|inline|virtual|explicit|mutable|constexpr|thread_local)\s+", t):
        return True
    if re.match(r"^\s*(unsigned|signed)\s+(int|long|short|char)", t):
        return True
    if re.match(r"^\s*struct\s+\w+", t):
        return True
    if re.match(r"^\s*class\s+\w+\s*[:{]", t):
        return True
    if re.match(r"^\s*enum\s+(class\s+)?\w+", t):
        return True
    if re.match(r"^\s*union\s+\w+", t):
        return True
    if re.match(r"^\s*typedef\s+", t):
        return True
    if re.match(r"^\s*typename\s+", t):
        return True
    if re.match(r"^\s*operator\s*[+\-*/=<>!]+", t):
        return True

    # JavaScript / TypeScript patterns
    if re.match(r"^\s*(const|let|var)\s+\w+", t):
        return True
    if re.match(r"^\s*function\s+\w+\s*\(", t):
        return True
    if re.match(r"^\s*function\s*\*", t):  # generator
        return True
    if re.match(r"^\s*async\s+function\s+", t):
        return True
    if re.match(r"^\s*export\s+(default\s+)?(const|let|var|function|class|interface|type|enum)\s+", t):
        return True
    if re.match(r"^\s*import\s+.*from\s+['\"]", t):
        return True
    if re.match(r"^\s*import\s+['\"]", t):
        return True
    if re.match(r"^\s*require\s*\(\s*['\"]", t):
        return True
    if re.match(r"^\s*module\.exports\s*=", t):
        return True
    if re.match(r"^\s*console\.(log|error|warn|info|debug)\s*\(", t):
        return True
    if re.match(r"^\s*document\.\w+", t):
        return True
    if re.match(r"^\s*window\.\w+", t):
        return True
    if re.match(r"^\s*throw\s+new\s+", t):
        return True
    if re.match(r"^\s*typeof\s+", t):
        return True
    if re.match(r"^\s*instanceof\s+", t):
        return True
    if re.match(r"^\s*await\s+", t):
        return True
    if re.match(r"^\s*return\s+", t) and prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    if re.match(r"^\s*interface\s+\w+", t):
        return True
    if re.match(r"^\s*type\s+\w+\s*=", t):
        return True
    if re.match(r"^\s*enum\s+\w+", t):
        return True
    if re.match(r"^\s*as\s+\w+", t):
        return True
    if re.match(r"^\s*readonly\s+", t):
        return True
    if re.search(r"=>\s*[{(]", t) and prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    if re.search(r"\.then\s*\(", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"\.catch\s*\(", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"\.map\s*\(", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"\.filter\s*\(", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"\.reduce\s*\(", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"JSON\.(parse|stringify)\s*\(", t):
        return True
    if re.search(r"Promise\s*\(", t):
        return True
    if re.search(r"new\s+Promise\s*\(", t):
        return True

    # PHP patterns
    if re.match(r"^\s*<\?php", t):
        return True
    if re.match(r"^\s*<\?=", t):
        return True
    if re.match(r"^\s*\?>", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*\$\w+\s*=", t):
        return True
    if re.match(r"^\s*\$\w+\s*->", t):
        return True
    if re.match(r"^\s*\$\w+\s*\[", t):
        return True
    if re.match(r"^\s*\$\w+\s*;", t):
        return True
    if re.match(r"^\s*echo\s+", t):
        return True
    if re.match(r"^\s*print\s*\(", t):
        return True
    if re.match(r"^\s*function\s+\w+\s*\(", t):
        return True
    if re.match(r"^\s*public\s+function\s+", t):
        return True
    if re.match(r"^\s*private\s+function\s+", t):
        return True
    if re.match(r"^\s*protected\s+function\s+", t):
        return True
    if re.match(r"^\s*static\s+function\s+", t):
        return True
    if re.match(r"^\s*class\s+\w+", t):
        return True
    if re.match(r"^\s*namespace\s+[\w\\]+", t):
        return True
    if re.match(r"^\s*use\s+\\?[\w\\]+", t):
        return True
    if re.match(r"^\s*foreach\s*\(", t):
        return True
    if re.match(r"^\s*array\s*\(", t):
        return True
    if re.match(r"^\s*\$\w+\s*\(\s*\)", t):
        return True
    if re.match(r"^\s*this->\w+", t):
        return True
    if re.match(r"^\s*self::", t):
        return True
    if re.match(r"^\s*parent::", t):
        return True
    if re.match(r"^\s*PDO::", t):
        return True
    if re.search(r"json_encode\s*\(", t):
        return True
    if re.search(r"json_decode\s*\(", t):
        return True
    if re.search(r"header\s*\(\s*['\"]", t):
        return True
    if re.search(r"->\w+\s*\(", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"::\w+\s*\(", t) and prose_ratio(t) == 0:
        return True

    # Bash / Shell patterns
    if re.match(r"^#!\/(bin|usr)\/(bash|sh|zsh|env)", t):
        return True
    if re.match(r"^\s*set\s+-[euo]", t):
        return True
    if re.match(r"^\s*echo\s+", t):
        return True
    if re.match(r"^\s*echo\s+[\"-]", t):
        return True
    if re.match(r"^\s*printf\s+", t):
        return True
    if re.match(r"^\s*if\s*\[", t):
        return True
    if re.match(r"^\s*if\s+\[\s", t):
        return True
    if re.match(r"^\s*elif\s*\[", t):
        return True
    if re.match(r"^\s*else\s*$", t):
        return True
    if re.match(r"^\s*fi\s*$", t):
        return True
    if re.match(r"^\s*for\s+\w+\s+in\s+", t):
        return True
    if re.match(r"^\s*while\s+\[", t):
        return True
    if re.match(r"^\s*while\s+read\s+", t):
        return True
    if re.match(r"^\s*do\s*$", t):
        return True
    if re.match(r"^\s*done\s*$", t):
        return True
    if re.match(r"^\s*case\s+.*\s+in\s*$", t):
        return True
    if re.match(r"^\s*esac\s*$", t):
        return True
    if re.match(r"^\s*export\s+\w+=", t):
        return True
    if re.match(r"^\s*local\s+\w+=", t):
        return True
    if re.match(r"^\s*readonly\s+\w+", t):
        return True
    if re.match(r"^\s*return\s+\d+", t):
        return True
    if re.match(r"^\s*cd\s+", t):
        return True
    if re.match(r"^\s*tar\s+-", t):
        return True
    if re.match(r"^\s*git\s+(pull|push|clone|commit|add|checkout|branch|merge|status|log)\b", t):
        return True
    if re.match(r"^\s*npm\s+(install|run|ci|test|build|start|init)\b", t):
        return True
    if re.match(r"^\s*systemctl\s+(start|stop|restart|status|enable|disable)\b", t):
        return True
    if re.match(r"^\s*docker\s+(run|build|pull|push|compose|ps|stop|rm)\b", t):
        return True
    if re.match(r"^\s*mkdir\s+", t):
        return True
    if re.match(r"^\s*rm\s+-", t):
        return True
    if re.match(r"^\s*cp\s+", t):
        return True
    if re.match(r"^\s*mv\s+", t):
        return True
    if re.match(r"^\s*chmod\s+", t):
        return True
    if re.match(r"^\s*chown\s+", t):
        return True
    if re.match(r"^\s*grep\s+", t):
        return True
    if re.match(r"^\s*sed\s+-", t):
        return True
    if re.match(r"^\s*awk\s+", t):
        return True
    if re.match(r"^\s*curl\s+-", t):
        return True
    if re.match(r"^\s*wget\s+", t):
        return True
    if re.match(r"^\s*cat\s+", t):
        return True
    if re.match(r"^\s*head\s+-", t):
        return True
    if re.match(r"^\s*tail\s+-", t):
        return True
    if re.match(r"^\s*wc\s+-", t):
        return True
    if re.match(r"^\s*ps\s+", t):
        return True
    if re.match(r"^\s*kill\s+-", t):
        return True
    if re.match(r"^\s*source\s+", t):
        return True
    if re.match(r"^\s*\.\s+\/.*", t):  # . ./script.sh
        return True
    if re.match(r"^\s*\$\{?\w+\}?", t) and re.search(r"[\/\s]", t) and \
       prose_ratio(t) <= PROSE_RATIO_THRESHOLD:
        return True
    if re.search(r"\$\([^)]+\)", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"\|\s*(grep|sed|awk|wc|sort|head|tail|cat)\b", t):
        return True

    # Go patterns
    if re.match(r"^\s*package\s+\w+", t):
        return True
    if re.match(r"^\s*import\s*\(", t):
        return True
    if re.match(r"^\s*import\s+['\"]", t):
        return True
    if re.match(r"^\s*func\s+\w+\s*\(", t):
        return True
    if re.match(r"^\s*func\s*\(", t):  # method receiver
        return True
    if re.match(r"^\s*type\s+\w+\s+(struct|interface)", t):
        return True
    if re.match(r"^\s*struct\s*\{", t):
        return True
    if re.match(r"^\s*interface\s*\{", t):
        return True
    if re.match(r"^\s*map\[\w+\]\w+", t):
        return True
    if re.match(r"^\s*chan\s+\w+", t):
        return True
    if re.match(r"^\s*defer\s+", t):
        return True
    if re.match(r"^\s*go\s+\w+", t):
        return True
    if re.match(r"^\s*select\s*\{", t):
        return True
    if re.match(r"^\s*switch\s+", t):
        return True
    if re.match(r"^\s*case\s+", t):
        return True
    if re.match(r"^\s*default\s*:", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*fallthrough\s*$", t):
        return True
    if re.match(r"^\s*break\s*$", t):
        return True
    if re.match(r"^\s*continue\s*$", t):
        return True
    if re.match(r"^\s*return\s+", t):
        return True
    if re.match(r"^\s*return\s+nil\s*$", t):
        return True
    if re.match(r"^\s*nil\b", t):
        return True
    if re.match(r"^\s*var\s+\w+\s+\w+", t):
        return True
    if re.match(r"^\s*const\s+\w+\s*=", t):
        return True
    if re.match(r"^\s*range\s+", t):
        return True
    if re.match(r"^\s*fmt\.", t):
        return True
    if re.match(r"^\s*log\.", t):
        return True
    if re.match(r"^\s*http\.", t):
        return True
    if re.match(r"^\s*os\.", t):
        return True
    if re.match(r"^\s*strings\.", t):
        return True
    if re.match(r"^\s*strconv\.", t):
        return True
    if re.match(r"^\s*json\.", t):
        return True
    if re.match(r"^\s*err\s*!=\s*nil", t):
        return True
    if re.match(r"^\s*err\s*==\s*nil", t):
        return True
    if ":=" in t and prose_ratio(t) == 0:
        return True
    if re.match(r"^\s*append\s*\(", t):
        return True
    if re.match(r"^\s*make\s*\(", t):
        return True
    if re.match(r"^\s*panic\s*\(", t):
        return True
    if re.match(r"^\s*recover\s*\(\s*\)", t):
        return True

    # Rust patterns
    if re.match(r"^\s*use\s+", t):
        return True
    if re.match(r"^\s*fn\s+\w+", t):
        return True
    if re.match(r"^\s*let\s+(mut\s+)?\w+", t):
        return True
    if re.match(r"^\s*let\s+mut\s+", t):
        return True
    if re.match(r"^\s*pub\s+(fn|struct|enum|trait|use|mod|const)\s+", t):
        return True
    if re.match(r"^\s*mod\s+\w+", t):
        return True
    if re.match(r"^\s*struct\s+\w+", t):
        return True
    if re.match(r"^\s*enum\s+\w+", t):
        return True
    if re.match(r"^\s*trait\s+\w+", t):
        return True
    if re.match(r"^\s*impl\s+", t):
        return True
    if re.match(r"^\s*match\s+", t):
        return True
    if re.match(r"^\s*println!\s*\(", t):
        return True
    if re.match(r"^\s*eprintln!\s*\(", t):
        return True
    if re.match(r"^\s*format!\s*\(", t):
        return True
    if re.match(r"^\s*vec!\s*\[", t):
        return True
    if re.match(r"^\s*process::exit\s*\(", t):
        return True
    if re.match(r"^\s*self::", t):
        return True
    if re.match(r"^\s*super::", t):
        return True
    if re.match(r"^\s*crate::", t):
        return True
    if re.match(r"^\s*mut\s+", t):
        return True
    if re.match(r"^\s*ref\s+", t):
        return True
    if re.match(r"^\s*move\s+", t):
        return True
    if re.match(r"^\s*unsafe\s*\{", t):
        return True
    if re.match(r"^\s*loop\s*\{", t):
        return True
    if re.match(r"^\s*async\s+fn\s+", t):
        return True
    if re.match(r"^\s*await\s+", t):
        return True
    if re.match(r"^\s*Some\s*\(", t):
        return True
    if re.match(r"^\s*None\b", t):
        return True
    if re.match(r"^\s*Ok\s*\(", t):
        return True
    if re.match(r"^\s*Err\s*\(", t):
        return True
    if re.search(r"\.unwrap\s*\(\s*\)", t):
        return True
    if re.search(r"\.expect\s*\(", t):
        return True
    if re.search(r"\.collect\s*\(\s*\)", t):
        return True
    if re.search(r"->\s*\w+", t) and prose_ratio(t) == 0:
        return True

    # Kotlin patterns
    if re.match(r"^\s*package\s+[\w.]+\s*$", t):
        return True
    if re.match(r"^\s*import\s+[\w.]+\s*$", t):
        return True
    if re.match(r"^\s*fun\s+\w+\s*\(", t):
        return True
    if re.match(r"^\s*override\s+fun\s+", t):
        return True
    if re.match(r"^\s*private\s+fun\s+", t):
        return True
    if re.match(r"^\s*public\s+fun\s+", t):
        return True
    if re.match(r"^\s*protected\s+fun\s+", t):
        return True
    if re.match(r"^\s*internal\s+fun\s+", t):
        return True
    if re.match(r"^\s*class\s+\w+", t):
        return True
    if re.match(r"^\s*data\s+class\s+", t):
        return True
    if re.match(r"^\s*object\s+\w+", t):
        return True
    if re.match(r"^\s*companion\s+object", t):
        return True
    if re.match(r"^\s*interface\s+\w+", t):
        return True
    if re.match(r"^\s*enum\s+class\s+", t):
        return True
    if re.match(r"^\s*sealed\s+class\s+", t):
        return True
    if re.match(r"^\s*abstract\s+class\s+", t):
        return True
    if re.match(r"^\s*open\s+class\s+", t):
        return True
    if re.match(r"^\s*val\s+\w+", t):
        return True
    if re.match(r"^\s*var\s+\w+", t):
        return True
    if re.match(r"^\s*lateinit\s+var\s+", t):
        return True
    if re.match(r"^\s*const\s+val\s+", t):
        return True
    if re.match(r"^\s*when\s*[\({]", t):
        return True
    if re.match(r"^\s*init\s*\{", t):
        return True
    if re.match(r"^\s*by\s+(lazy|delegate)", t):
        return True
    if re.match(r"^\s*return\s+", t):
        return True
    if re.match(r"^\s*throw\s+", t):
        return True
    if re.match(r"^\s*try\s*\{", t):
        return True
    if re.match(r"^\s*catch\s*\(", t):
        return True
    if re.match(r"^\s*finally\s*\{", t):
        return True
    if re.search(r"!!\s*$", t):
        return True
    if re.search(r"\?\.", t) and prose_ratio(t) == 0:
        return True
    if re.match(r"^\s*@Composable", t):
        return True
    if re.match(r"^\s*@Override", t):
        return True
    if re.search(r"setContentView\s*\(", t):
        return True
    if re.search(r"findViewById\s*\(", t):
        return True
    if re.search(r"setOnClickListener\s*\{", t):
        return True

    # HTML patterns
    if re.match(r"^\s*<!DOCTYPE\s+html", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<!--", t):
        return True
    if re.match(r"^\s*</?\w+[^>]*>", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<html", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<head", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<body", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<div", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<script", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<style", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<link", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<meta", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<title", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<p>", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<h[1-6]", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<ul", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<ol", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<li", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<table", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<form", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<input", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<button", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<a\s+href", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*<img", t, re.IGNORECASE):
        return True
    if re.match(r"^\s*</\w+>\s*$", t, re.IGNORECASE):
        return True

    # CSS patterns
    if re.match(r"^\s*\.[a-zA-Z][\w-]*\s*\{", t):
        return True
    if re.match(r"^\s*#[a-zA-Z][\w-]*\s*\{", t):
        return True
    if re.match(r"^\s*@\w+", t):
        return True
    if re.search(r"[a-zA-Z-]+\s*:\s*[^;{}]+;", t) and prose_ratio(t) == 0:
        return True
    if re.match(
        r"^\s*(color|background|margin|padding|border|font|display|position|"
        r"width|height|top|left|right|bottom|float|clear|overflow|z-index|"
        r"opacity|text-align|line-height|letter-spacing)\s*:", t, re.IGNORECASE
    ):
        return True
    if re.search(r"!important", t) and prose_ratio(t) == 0:
        return True
    if re.search(r"linear-gradient\s*\(", t) and prose_ratio(t) == 0:
        return True

    # JSON patterns
    if re.match(r"^\s*\{\s*$", t):
        return True
    if re.match(r"^\s*\}\s*,?\s*$", t):
        return True
    if re.match(r"^\s*\[\s*$", t):
        return True
    if re.match(r"^\s*\]\s*,?\s*$", t):
        return True
    if re.match(r"^\s*\"[^\"]+\"\s*:", t):
        return True
    if re.match(r"^\s*\"[^\"]+\"\s*:\s*(true|false|null)\s*,?\s*$", t):
        return True
    if re.match(r"^\s*\"[^\"]+\"\s*:\s*-?\d", t):
        return True
    if re.match(r"^\s*\"[^\"]+\"\s*:\s*\"", t):
        return True
    if re.match(r"^\s*\"[^\"]+\"\s*,?\s*$", t):
        return True

    # MATLAB patterns
    if re.match(r"^\s*%\s", t):  # MATLAB comment
        return True
    if re.match(r"^\s*figure\s*;", t):
        return True
    if re.match(r"^\s*figure\s*\(", t):
        return True
    if re.match(r"^\s*subplot\s*\(", t):
        return True
    if re.match(r"^\s*plot\s*\(", t):
        return True
    if re.match(r"^\s*xlabel\s*\(", t):
        return True
    if re.match(r"^\s*ylabel\s*\(", t):
        return True
    if re.match(r"^\s*title\s*\(", t):
        return True
    if re.match(r"^\s*legend\s*\(", t):
        return True
    if re.match(r"^\s*disp\s*\(", t):
        return True
    if re.match(r"^\s*fprintf\s*\(", t):
        return True
    if re.match(r"^\s*sprintf\s*\(", t):
        return True
    if re.match(r"^\s*function\s+", t):
        return True
    if re.match(r"^\s*end\s*$", t):
        return True
    if re.match(r"^\s*grid\s+(on|off)", t):
        return True
    if re.match(r"^\s*hold\s+(on|off)", t):
        return True
    if re.match(r"^\s*zeros\s*\(", t):
        return True
    if re.match(r"^\s*ones\s*\(", t):
        return True
    if re.match(r"^\s*rand\s*\(", t):
        return True
    if re.match(r"^\s*randn\s*\(", t):
        return True
    if re.match(r"^\s*butter\s*\(", t):
        return True
    if re.match(r"^\s*filtfilt\s*\(", t):
        return True
    if re.match(r"^\s*fft\s*\(", t):
        return True
    if re.match(r"^\s*ifft\s*\(", t):
        return True

    # General code patterns
    # FIX: Semicolon — only if prose ratio is 0 AND no citation pattern
    if re.search(r";\s*$", t) and not re.search(r"[.!?]$", t) and prose_ratio(t) == 0:
        # Don't match citations like "Smith (2017);" or "see Author (2020);"
        if not re.search(r"[A-Z][a-z]+\s*\(\d{4}\)", t):
            return True
    # FIX: Function call — only if NO prose AND no citation AND has code operators
    if re.search(r"\b\w+\s*\([^)]*\)", t) and not t.endswith(":") and not t.endswith("."):
        # Must have at least one code-specific operator to be code
        has_code_op = bool(re.search(r"<-|->|\$|::|%>%|#|;\s*$", t))
        # hasAssignment also matches =( and =[" and =[
        has_assignment = bool(re.search(r"\w+\s*=\s*[\w([\"']", t))
        # method call (e.g., plt.figure(...), fruits.append(...))
        has_method_call = bool(re.search(r"\w+\.\w+\s*\(", t))
        if prose_ratio(t) == 0 and \
           not re.search(r"[A-Z][a-z]+\s*\(\d{4}\)", t) and \
           (has_code_op or has_assignment or has_method_call):
            return True
    return False


def is_start_marker(line):
    """Check if a line is a code block start marker."""
    for pattern in CODE_START_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    if re.match(r"^\s*Contoh\s+\d\s*:", line, re.IGNORECASE):
        return True
    return False


def is_end_marker(line):
    """Check if a line is a code block end marker."""
    for pattern in CODE_END_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    return False


def is_markdown_heading(line):
    """Detect if a `#`-prefixed line is a markdown heading (NOT a code comment).

    Title-case detection: if >60% of words start with uppercase AND no digits,
    OR the line has high prose ratio, treat as a markdown heading.
    """
    t = line.strip()
    # Must start with 1-6 # followed by space
    if not re.match(r"^#{1,6}\s+", t):
        return False
    # Remove the # prefix
    content = re.sub(r"^#{1,6}\s+", "", t)
    words = content.split()
    if not words:
        return False
    # Check if most words are capitalized (title case) — indicates heading
    total = 0
    capitalized = 0
    for w in words:
        if re.match(r"^[A-Za-z]", w):
            total += 1
            if re.match(r"^[A-Z]", w):
                capitalized += 1
    if total >= 2 and capitalized / total >= 0.6:
        return True
    # Also check prose ratio — headings often have prose words
    if prose_ratio(content) > 0.3:
        return True
    return False


def strip_narrative(code):
    """Strip leading/trailing narrative lines AND markdown headings from a code block.

    A line is considered "narrative" (to be stripped) if it is NOT a code line
    AND NOT an R-output line, OR if it is a markdown heading (## Title).
    """
    lines = code.split("\n")
    # Strip leading narrative AND markdown headings
    while lines:
        first = lines[0]
        if not first.strip():
            lines.pop(0)
            continue
        if is_markdown_heading(first):
            lines.pop(0)
            continue
        if not is_code_line(first) and not is_r_output(first):
            lines.pop(0)
            continue
        break
    # Strip trailing narrative AND markdown headings
    while lines:
        last = lines[-1]
        if not last.strip():
            lines.pop()
            continue
        if is_markdown_heading(last):
            lines.pop()
            continue
        if not is_code_line(last) and not is_r_output(last):
            lines.pop()
            continue
        break
    return "\n".join(lines).strip()


def strip_r_output(code):
    """Strip R-output from head/tail/interior of a code block."""
    lines = code.split("\n")
    stripped = 0
    # head
    while lines and is_r_output(lines[0]):
        lines.pop(0)
        stripped += 1
    # tail
    while lines and is_r_output(lines[-1]):
        lines.pop()
        stripped += 1
    # interior — remove any R-output line
    kept = []
    for l in lines:
        if is_r_output(l):
            stripped += 1
            continue
        kept.append(l)
    # collapse 2+ blank lines into 1
    out = []
    blank = 0
    for l in kept:
        if l.strip() == "":
            blank += 1
            if blank <= 1:
                out.append(l)
        else:
            blank = 0
            out.append(l)
    return "\n".join(out).strip(), stripped


# ── findStartPositions with MARKER_DEDUP_GAP=2 ──
MARKER_DEDUP_GAP = 2


def find_start_positions(lines):
    """Find all start-marker line indices.

    UPGRADED (Task 21): deduplicate start markers within MARKER_DEDUP_GAP=2
    lines of each other. e.g. "# Kasus 1:" on line 0 and "Kode Penyelesaian:"
    on line 2 represent the SAME logical block start — keep only the FIRST.
    Without this dedup, the first range would contain only 1 code line and
    get skipped, causing the header comment to leak out as a standalone
    lang="unknown" block.
    """
    positions = []
    for i, line in enumerate(lines):
        if is_start_marker(line):
            positions.append(i)
            continue
        if re.match(r"^\s*Contoh\s+\d\s*:", line, re.IGNORECASE):
            positions.append(i)
            continue

    # Deduplicate
    deduped = []
    for p in positions:
        if not deduped or p - deduped[-1] > MARKER_DEDUP_GAP:
            deduped.append(p)

    # Fallback: if no marker at all, seed with the first code line.
    if not deduped:
        for i, line in enumerate(lines):
            if is_code_line(line):
                deduped.append(i)
                break

    deduped.sort()
    return deduped


# Split on "# Kasus N" / "# Contoh N" markers + `## N.` section headers
SPLIT_PATTERN = re.compile(
    r"(?:^[ \t]*#[Kk]asus\s+\d|^[ \t]*#[Cc]ontoh\s+\d|"
    r"^[ \t]*#[Kk]orelasi\s+[Pp]earson\s+contoh|^[ \t]*#korelasi\s+pearson\s+contoh\s*\d|"
    r"^[ \t]*data_\w+\s*<-?\s*data\.frame|^[ \t]*data_\w+\s*=\s*data\.frame|"
    r"^[ \t]*Kasus\s+\d|^[ \t]*Contoh\s+\d|^[ \t]*Soal\s+\d|"
    r"^[ \t]*Latihan\s+\d|^[ \t]*Praktikum\s+\d|^[ \t]*Tugas\s+\d|"
    r"^[ \t]*#{1,4}\s+\d+\.\s+|^[ \t]*#{1,4}\s+\d+\.\d+\s+|"
    r"^[ \t]*#{1,4}\s+[A-Z][a-z]+(?:\s+\w+){0,3}\s*$)",
    re.MULTILINE,
)


def split_on_markers(block):
    """Split a block on SPLIT_PATTERN markers (e.g. # Kasus N, ## N. Title)."""
    code = block["code"]
    markers = list(SPLIT_PATTERN.finditer(code))
    if len(markers) <= 1:
        return [block]

    out = []
    prev_pos = 0
    for m in markers[1:]:
        chunk = code[prev_pos:m.start()].strip()
        if len(chunk) >= 10:
            out.append({
                "code": chunk,
                "lang": detect_language(chunk),
                "lines": chunk.count("\n") + 1,
                "source": "pattern-split",
                "page": block.get("page", 1),
            })
        prev_pos = m.start()
    chunk = code[prev_pos:].strip()
    if len(chunk) >= 10:
        out.append({
            "code": chunk,
            "lang": detect_language(chunk),
            "lines": chunk.count("\n") + 1,
            "source": "pattern-split",
            "page": block.get("page", 1),
        })
    return out


# ── Merge fragmented blocks (MAX_GAP=2 + structural continuation) ──
MAX_GAP = 2


def _ends_with_continuation(last_line):
    """Check if last line of a block ends with a continuation signal."""
    t = last_line.strip()
    if not t:
        return False
    last = t[-1]
    if last in ",([{+-*/|&=<>":
        return True
    if t.endswith("<-") or t.endswith("%>%"):
        return True
    return False


def _starts_with_continuation(first_line):
    """Check if first line of a block starts with a continuation token."""
    t = first_line.lstrip()
    if not t:
        return False
    if re.match(r"^[)\]}]", t):
        return True
    # digit start (but not assignment)
    if re.match(r"^\d", t) and not re.match(r"^\w+\s*<-", t) and not re.match(r"^\w+\s*=", t):
        return True
    if re.match(r"^[,'\"]", t):
        return True
    return False


def _merge_fragmented_blocks(candidates, source_lines):
    """Merge fragmented candidate blocks separated by short narrative gaps.

    Heuristic:
    - Rule A: structural continuation (unclosed bracket / trailing comma + continuation
      token) — always merge.
    - Rule B: short narrative gap (≤ MAX_GAP lines) with no code, no hard boundary,
      no R-output — merge.
    - Rule B': short gap with R-output but no code — merge (keep code together).
    - Hard boundary (start/end marker) — never merge.
    """
    if not candidates:
        return []

    merged = [dict(candidates[0])]
    merged_count = 0

    for i in range(1, len(candidates)):
        prev = merged[-1]
        curr = candidates[i]

        # Compute gap lines (between prev.end_line+1 and curr.start_line-1)
        gap_start = prev.get("end_line", 0) + 1
        gap_end = curr.get("start_line", 0) - 1
        gap_lines = []
        for j in range(gap_start, gap_end + 1):
            if 0 <= j < len(source_lines):
                gap_lines.append(source_lines[j])
        gap_len = gap_end - gap_start + 1

        prev_last_line = prev["code"].split("\n")[-1] if prev["code"] else ""
        curr_first_line = curr["code"].split("\n")[0] if curr["code"] else ""

        # Rule A: structural continuation — always merge.
        structural_continue = _ends_with_continuation(prev_last_line) or \
                              _starts_with_continuation(curr_first_line)

        # Rule B: short narrative gap with no hard boundary.
        gap_has_code = any(is_code_line(l) for l in gap_lines)
        gap_has_hard_boundary = any(is_start_marker(l) or is_end_marker(l) for l in gap_lines)
        gap_has_r_output = any(is_r_output(l) for l in gap_lines)
        short_gap = 0 <= gap_len <= MAX_GAP

        # Rule C: prev block does not itself end with a hard boundary marker line.
        prev_last_is_boundary = is_start_marker(prev_last_line) or is_end_marker(prev_last_line)
        curr_first_is_boundary = is_start_marker(curr_first_line)

        should_merge = False
        if not curr_first_is_boundary and not prev_last_is_boundary and not gap_has_hard_boundary:
            if structural_continue:
                should_merge = True
            elif short_gap and not gap_has_code and not gap_has_r_output:
                should_merge = True
            elif short_gap and gap_has_r_output and not gap_has_code:
                should_merge = True

        if should_merge:
            # Merge curr into prev. Preserve a single newline between the two
            # code regions (do NOT inject the narrative lines).
            prev["code"] = prev["code"] + "\n" + curr["code"]
            prev["lines"] = prev["code"].count("\n") + 1
            prev["end_line"] = curr.get("end_line", prev.get("end_line", 0))
            if prev.get("source") != curr.get("source"):
                prev["source"] = f"{prev.get('source', 'pattern')}+merge"
            merged_count += 1
        else:
            merged.append(dict(curr))

    return merged


def extract_code_blocks(text):
    """Main extraction entry point. Returns list of code block dicts.

    Each block: {"code": str, "lang": str, "lines": int, "source": str, "page": int}
    """
    if not text or not text.strip():
        return []

    # ── Pre-processing pipeline ──
    lines = text.split("\n")
    lines, _ = repair_line_wraps(lines)
    lines = normalize_whitespace(lines)
    lines, _ = strip_r_output_lines(lines)

    # ── Strategy 1: marker-anchored extraction ──
    start_positions = find_start_positions(lines)
    candidates = []

    for idx, start in enumerate(start_positions):
        end = len(lines)
        if idx + 1 < len(start_positions):
            end = start_positions[idx + 1]

        code_lines = []
        inside_string = False
        for j in range(start, end):
            line = lines[j].rstrip()
            if not line.strip():
                continue
            t = line.strip()

            # Skip standalone label lines
            if re.match(r"^\s*(Kode\s+[Pp]enyelesaian|Kode\s*:)\s*:?\s*$", t, re.IGNORECASE):
                continue

            # String context
            if inside_string:
                code_lines.append(line)
                quote_count = len(re.findall(r'"', t))
                has_close_paren = bool(re.search(r"\)\s*$", t))
                if quote_count % 2 == 1 or has_close_paren:
                    inside_string = False
                continue

            quote_count = len(re.findall(r'"', t))
            is_code = is_code_line(line) or is_r_output(line)
            is_r_assign = bool(re.match(r"^\w+\s*=\s*\(\s*$", t) or
                                re.match(r"^\w+\s*<-\s*\(\s*$", t))
            if is_code or is_r_assign:
                code_lines.append(line)
                if quote_count % 2 == 1 and re.search(r'=\s*"', t):
                    inside_string = True
                if is_r_assign:
                    inside_string = True

        if len(code_lines) >= 2:
            # Strip leading/trailing R-output
            while code_lines and is_r_output(code_lines[-1]):
                code_lines.pop()
            while code_lines and is_r_output(code_lines[0]):
                code_lines.pop(0)
            if len(code_lines) >= 2:
                code = "\n".join(code_lines).strip()
                if len(code) >= 10:
                    # Compute actual first/last code line positions for merge gap calc.
                    actual_start = start
                    actual_end = end - 1
                    for j in range(start, end):
                        if is_code_line(lines[j]) or is_r_output(lines[j]):
                            actual_start = j
                            break
                    for j in range(end - 1, start - 1, -1):
                        if is_code_line(lines[j]) or is_r_output(lines[j]):
                            actual_end = j
                            break
                    candidates.append({
                        "code": code,
                        "lang": detect_language(code),
                        "lines": code.count("\n") + 1,
                        "source": "pattern",
                        "page": 1,
                        "start_line": actual_start,
                        "end_line": actual_end,
                    })

    # ── Strategy 1b: split blocks that contain multiple split markers ──
    split_blocks = []
    for c in candidates:
        pieces = split_on_markers(c)
        line_cursor = c.get("start_line", 0)
        for p in pieces:
            n_lines = p["code"].count("\n") + 1
            p["start_line"] = line_cursor
            p["end_line"] = line_cursor + n_lines - 1
            split_blocks.append(p)
            line_cursor += n_lines

    # ── Strategy 2: scan-fallback for code lines not yet captured ──
    captured_lines = set()
    for b in split_blocks:
        for l in b["code"].split("\n"):
            captured_lines.add(l.strip())

    uncoded = []
    current = []
    current_start = -1
    for i, line in enumerate(lines):
        t = line.strip()
        if is_code_line(line) and t not in captured_lines:
            if not current:
                current_start = i
            current.append(line.rstrip())
        else:
            if len(current) >= 1:
                code = "\n".join(current).strip()
                if len(code) >= 5 and not any(code in b["code"] for b in split_blocks):
                    uncoded.append({
                        "code": code,
                        "lang": detect_language(code),
                        "lines": code.count("\n") + 1,
                        "source": "scan-fallback",
                        "page": 1,
                        "start_line": current_start,
                        "end_line": i - 1,
                    })
            current = []
    if len(current) >= 1:
        code = "\n".join(current).strip()
        if len(code) >= 5 and not any(code in b["code"] for b in split_blocks):
            uncoded.append({
                "code": code,
                "lang": detect_language(code),
                "lines": code.count("\n") + 1,
                "source": "scan-fallback",
                "page": 1,
                "start_line": current_start,
                "end_line": len(lines) - 1,
            })

    all_candidates = sorted(split_blocks + uncoded, key=lambda b: b.get("start_line", 0))

    # ── Phase 1 Fix #1: merge fragmented blocks ──
    merged = _merge_fragmented_blocks(all_candidates, lines)

    # ── Phase 1 Fix #4: strip_narrative + strip_r_output + structural bypass ──
    final_blocks = []
    for b in merged:
        no_narrative = strip_narrative(b["code"])
        no_r, _ = strip_r_output(no_narrative)
        if len(no_r) >= 10 and no_r.count("\n") + 1 >= 1:
            detected_lang = detect_language(no_r)
            # Structural language bypass — these languages don't need hljs validation
            # (we don't use hljs here, but keep the logic consistent with the TS version)
            if detected_lang in ("json", "html", "css", "sql", "php", "bash"):
                final_blocks.append({
                    "code": no_r,
                    "lang": detected_lang,
                    "lines": no_r.count("\n") + 1,
                    "source": b.get("source", "pattern"),
                    "page": b.get("page", 1),
                })
            else:
                # For non-structural, additional sanity check via signal counting
                r_hits = no_r.count("<-") + \
                         len(re.findall(r"library\s*\(", no_r)) + \
                         len(re.findall(r"\bprint\s*\(", no_r))
                py_hits = len(re.findall(r"\bdef\s+\w+", no_r)) + \
                          len(re.findall(r"\bimport\s+\w+", no_r)) + \
                          len(re.findall(r"\bself\.\w+", no_r))
                js_hits = len(re.findall(r"\b(const|let|var)\s+\w+", no_r)) + \
                          len(re.findall(r"function\s+\w+", no_r)) + \
                          len(re.findall(r"console\.\w+", no_r))
                # Accept the block if it has strong code signals or it's not classified unknown
                if detected_lang != "unknown" or r_hits >= 2 or py_hits >= 2 or js_hits >= 2:
                    final_blocks.append({
                        "code": no_r,
                        "lang": detected_lang,
                        "lines": no_r.count("\n") + 1,
                        "source": b.get("source", "pattern"),
                        "page": b.get("page", 1),
                    })

    return final_blocks


def _extract_via_line_density(lines):
    """Fallback: density-based extraction (no markers present)."""
    candidates = []
    current = []
    start = -1
    for i, line in enumerate(lines):
        if is_code_line(line):
            if not current:
                start = i
            current.append(line.rstrip())
        else:
            if len(current) >= 2:
                code = "\n".join(current).strip()
                if len(code) >= 10:
                    candidates.append({
                        "code": code,
                        "lang": detect_language(code),
                        "lines": code.count("\n") + 1,
                        "source": "density",
                        "page": 1,
                        "start_line": start,
                        "end_line": i - 1,
                    })
            current = []
    if len(current) >= 2:
        code = "\n".join(current).strip()
        if len(code) >= 10:
            candidates.append({
                "code": code,
                "lang": detect_language(code),
                "lines": code.count("\n") + 1,
                "source": "density",
                "page": 1,
                "start_line": start,
                "end_line": len(lines) - 1,
            })

    merged = _merge_fragmented_blocks(candidates, lines)
    final_blocks = []
    for b in merged:
        no_narrative = strip_narrative(b["code"])
        no_r, _ = strip_r_output(no_narrative)
        if len(no_r) >= 10:
            final_blocks.append({
                "code": no_r,
                "lang": detect_language(no_r),
                "lines": no_r.count("\n") + 1,
                "source": b.get("source", "density"),
                "page": b.get("page", 1),
            })
    return final_blocks


def extract_from_pdf(pdf_path):
    text = extract_text_from_pdf(pdf_path)
    if not text:
        return []
    return extract_code_blocks(text)


def extract_from_text(text):
    return extract_code_blocks(text)
