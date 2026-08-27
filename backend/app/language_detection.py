"""Language detection via pygments + custom overrides.

Strategi:
1. Custom R detection (highlight.js/pygments sering salah deteksi R sbg Python/Kotlin)
2. Custom SQL detection (untuk SQL tanpa SELECT di awal, mis. CREATE TABLE)
3. pygments guess_lexer untuk bahasa lain
4. Fallback ke "unknown"
"""
import re
import json
from typing import Optional
from pygments.lexers import guess_lexer
from pygments.util import ClassNotFound


# Bahasa yang didukung CodeLooter (sesuai mapping ekstensi file di snippets.py)
SUPPORTED_LANGS = {
    "python", "r", "javascript", "typescript", "java", "cpp", "c",
    "sql", "kotlin", "php", "ruby", "go", "rust", "swift", "scala",
    "bash", "shell", "html", "css", "json", "yaml", "markdown",
}


# Pattern khas R (tidak bisa dideteksi pygments secara akurat)
R_PATTERNS = [
    re.compile(r"\b\w+\s*<-\s"),                  # x <- value
    re.compile(r"\bcat\s*\("),
    re.compile(r"\bqt\s*\("),
    re.compile(r"\bqnorm\s*\("),
    re.compile(r"\bqf\s*\("),
    re.compile(r"\bqchisq\s*\("),
    re.compile(r"\bqlnorm\s*\("),
    re.compile(r"\bqbeta\s*\("),
    re.compile(r"\blibrary\s*\("),
    re.compile(r"\brequire\s*\("),
    re.compile(r"\bread\.\w+\s*\("),              # read.csv(), read.table()
    re.compile(r"\bdata\.frame\s*\("),
    re.compile(r"\bggplot\s*\("),
    re.compile(r"\bsummary\s*\("),
    re.compile(r"\bhead\s*\("),
    re.compile(r"\bstr\s*\("),
    re.compile(r"\bsetwd\s*\("),
    re.compile(r"\bset\.seed\s*\("),
    re.compile(r"\bsample\s*\("),
    re.compile(r"\b\w+\$[\w.]+"),                 # data$col
    re.compile(r"%>%"),                            # pipe operator
    re.compile(r"%<-%"),                           # multi-assign
    re.compile(r"%<>%"),                           # compound assignment pipe
    re.compile(r"\bseq\s*\("),
    re.compile(r"\brep\s*\("),
    re.compile(r"\bsapply\s*\("),
    re.compile(r"\blapply\s*\("),
    re.compile(r"\bapply\s*\("),
    re.compile(r"\bmapply\s*\("),
    re.compile(r"\bvapply\s*\("),
    re.compile(r"\bstop\s*\("),
    re.compile(r"\bwarning\s*\("),
    re.compile(r"\bmessage\s*\("),
]


# Pattern khas SQL (untuk deteksi cepat sebelum pygments)
SQL_KEYWORDS = re.compile(
    r"\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|"
    r"GROUP\s+BY|ORDER\s+BY|HAVING|UNION|VALUES|SET|TABLE|DATABASE|INDEX|VIEW|"
    r"PROCEDURE|FUNCTION|TRIGGER|PRIMARY|FOREIGN|REFERENCES|CONSTRAINT|"
    r"DEFAULT|NOT\s+NULL|AUTO_INCREMENT|SERIAL|CASCADE)\b",
    re.IGNORECASE,
)


# Pattern khas PHP (pygments kadang salah)
PHP_PATTERNS = [
    re.compile(r"<\?php"),
    re.compile(r"<\?="),
    re.compile(r"\$\w+"),                          # $variable
    re.compile(r"\becho\s+\$"),
    re.compile(r"\bprint\s*\("),
    re.compile(r"\bfunction\s+\w+\s*\([^)]*\$"),
    re.compile(r"\bclass\s+\w+\s*\{?[^}]*\$this->"),
]


# Pattern khas Java (untuk distinguish dari C++)
JAVA_PATTERNS = [
    re.compile(r"\bpublic\s+class\s+\w+"),
    re.compile(r"\bpublic\s+static\s+void\s+main\s*\("),
    re.compile(r"\bSystem\.out\.print"),
    re.compile(r"\bimport\s+java\."),
    re.compile(r"\bprivate\s+\w+\s+\w+\s*[;=]"),
    re.compile(r"\bprotected\s+\w+\s+\w+\s*[;=]"),
    re.compile(r"\bextends\s+\w+"),
    re.compile(r"\bimplements\s+\w+"),
    re.compile(r"\bthrows\s+\w+"),
    re.compile(r"\bnew\s+\w+\s*\("),
]


def detect_r(code: str) -> bool:
    """Deteksi apakah kode adalah R. Override pygments yang sering salah."""
    hits = sum(1 for p in R_PATTERNS if p.search(code))
    # Bobot tinggi untuk pattern khas R
    strong_r = bool(re.search(
        r"\b(cat|qt|qnorm|qf|qchisq|qlnorm|qbeta|setwd|set\.seed|sapply|lapply|vapply|mapply)\s*\(",
        code
    ))
    assign_r = bool(R_PATTERNS[0].search(code))  # <-
    pipe_r = bool(re.search(r"%>%|%<>%|%<-%", code))
    lib_r = bool(re.search(r"\blibrary\s*\(", code))

    if (strong_r or pipe_r or lib_r) and assign_r:
        return True
    if assign_r and hits >= 3:
        return True
    if hits >= 4:
        return True
    return False


def detect_sql(code: str) -> bool:
    """Deteksi SQL secara cepat."""
    matches = SQL_KEYWORDS.findall(code)
    # Kalau ada >= 2 SQL keyword berbeda, kemungkinan SQL
    unique_keywords = set(m.upper() for m in matches)
    return len(unique_keywords) >= 2


def detect_bash(code: str) -> bool:
    """Deteksi Bash/Shell script."""
    if re.match(r"^#!\s*/(?:usr/)?bin/(?:bash|sh|zsh|ksh)", code):
        return True
    # Pattern bash umum
    bash_patterns = [
        re.compile(r"\b(if|then|fi|for|do|done|while|case|esac)\b"),
        re.compile(r"\$\{\w+\}"),       # ${var}
        re.compile(r"\$\(\([^)]+\)\)"), # $((expr))
        re.compile(r"^\s*(?:export|alias|source|chmod|chown|cd|mkdir|rm|cp|mv)\s", re.MULTILINE),
    ]
    hits = sum(1 for p in bash_patterns if p.search(code))
    return hits >= 2


def detect_php(code: str) -> bool:
    """Deteksi PHP. Tapi jangan salah anggap Bash sebagai PHP."""
    # Kalau ini bash script, skip PHP detection
    if detect_bash(code):
        return False
    php_hits = sum(1 for p in PHP_PATTERNS if p.search(code))
    return php_hits >= 2 or bool(PHP_PATTERNS[0].search(code))


def detect_java(code: str) -> bool:
    """Deteksi Java (bukan C++)."""
    java_hits = sum(1 for p in JAVA_PATTERNS if p.search(code))
    has_cpp_marker = bool(re.search(r"#include\s*[<\"]", code)) or "std::" in code
    return java_hits >= 2 and not has_cpp_marker


def detect_language(code: str) -> str:
    """Deteksi bahasa dari string kode.

    Strategi: pakai custom detection dulu (lebih reliable untuk short snippet),
    pygments sebagai last resort.

    Returns:
        string bahasa (lowercase): "python", "r", "javascript", "typescript",
        "java", "cpp", "c", "sql", "kotlin", "php", "ruby", "go", "rust",
        "swift", "scala", "bash", "shell", "html", "css", "json", "yaml",
        "markdown", atau "unknown"
    """
    if not code or len(code.strip()) < 10:
        return "unknown"

    # 1. Custom detection (prioritas tinggi — fix pygments mistake)
    if detect_r(code):
        return "r"
    if detect_sql(code):
        return "sql"
    if detect_bash(code):
        return "bash"
    if detect_php(code):
        return "php"
    if detect_java(code):
        return "java"

    # 2. Heuristic keyword-based detection (lebih reliable dari pygments untuk short snippet)
    # Cek paling spesifik dulu, baru generic

    # Go — pakai "package main" dan "func"
    if re.search(r"^\s*package\s+\w+\s*$", code, re.MULTILINE):
        return "go"
    if re.search(r"\bfunc\s+\w+\s*\(", code) and re.search(r"\bpackage\s+\w+", code):
        return "go"

    # Rust — pakai "fn" dan "let mut" atau "println!"
    if re.search(r"\bfn\s+\w+\s*\(", code) and re.search(r"\blet\s+mut\s+\w+|println!", code):
        return "rust"
    if "println!" in code or "pub fn " in code:
        return "rust"

    # Kotlin — pakai "fun", "val + listOf", "when", atau "println" (Kotlin style)
    if re.search(r"\bfun\s+\w+\s*\(", code):
        return "kotlin"
    # val x = listOf(...) atau val x: Type = ...
    if re.search(r"\bval\s+\w+\s*[=:]", code) and re.search(r"\blistOf\(|\barrayOf\(|\bmutableListOf\(|\bsetOf\(|\bmapOf\(", code):
        return "kotlin"
    # println(it) — pattern khas Kotlin lambda
    if re.search(r"\bprintln\s*\(\s*it\s*\)", code):
        return "kotlin"
    # when (x) { ... }
    if re.search(r"\bwhen\s*\(", code):
        return "kotlin"

    # Ruby — def...end (Python tidak pakai end)
    if re.match(r"^\s*def\s+\w+", code, re.MULTILINE) and re.search(r"^\s*end\s*$", code, re.MULTILINE):
        return "ruby"
    if re.search(r"\bputs\s+", code) and re.search(r"\#\{\w+\}", code):
        return "ruby"

    # JSON — strict: harus parse sebagai JSON dan tidak punya statement
    code_stripped = code.strip()
    if (code_stripped.startswith("{") and code_stripped.endswith("}")) or \
       (code_stripped.startswith("[") and code_stripped.endswith("]")):
        try:
            parsed = json.loads(code_stripped)
            # Pastikan bukan Python dict (Python juga pakai {} tapi bukan valid JSON)
            if isinstance(parsed, (dict, list)):
                return "json"
        except Exception:
            pass

    # CSS — selector { property: value; }
    if re.search(r"[\w\-\.#\[\]>+~:]+\s*\{[^}]*[\w\-]+\s*:\s*[^;}]+[;}]?", code, re.DOTALL):
        if "color:" in code or "background:" in code or "margin:" in code or "padding:" in code:
            return "css"

    # HTML — tag pertama
    if re.match(r"^\s*</?(html|head|body|div|span|p|a|img|table|tr|td|ul|ol|li|h[1-6]|form|input|button|nav|header|footer|section|article)\b", code, re.IGNORECASE):
        return "html"
    if re.match(r"^\s*</?\w+[\s>]", code) and re.search(r"</\w+>", code):
        return "html"

    # C++ — #include atau std::
    if re.search(r"#include\s*[<\"]", code) or "std::" in code:
        return "cpp"
    if re.search(r"\bcout\s*<<|\bcin\s*>>", code):
        return "cpp"

    # C — int main() tanpa std::
    if re.search(r"\bint\s+main\s*\([^)]*\)\s*\{", code) and "std::" not in code and "#include" not in code:
        return "c"

    # TypeScript — CEK SEBELUM JavaScript (karena TS juga punya function, const, dll)
    # TypeScript-specific: type annotations, interface, generics
    if re.search(r":\s*(string|number|boolean|any|void|never|unknown)\b", code):
        return "typescript"
    if re.search(r"\binterface\s+\w+\s*\{", code):
        return "typescript"
    if re.search(r"\btype\s+\w+\s*=", code) and re.search(r"\b(string|number|boolean|any)\b", code):
        return "typescript"
    if re.search(r"<\w+>", code) and re.search(r":\s*\w+", code):  # generics + type annotation
        return "typescript"
    # function dengan return type annotation
    if re.search(r"function\s+\w+\s*\([^)]*\)\s*:\s*\w+", code):
        return "typescript"
    # const dengan type annotation
    if re.search(r"const\s+\w+\s*:\s*\w+\s*=", code):
        return "typescript"

    # Python — def, import, from, class dengan colon
    if re.search(r"^\s*def\s+\w+\s*\([^)]*\)\s*:", code, re.MULTILINE):
        return "python"
    if re.search(r"^\s*(import\s+\w+|from\s+\w+\s+import\s+)", code, re.MULTILINE):
        return "python"
    if re.search(r"\bprint\s*\(", code) and not re.search(r"\bSystem\.out|\bconsole\.log|\bcout\s*<<", code):
        # Tapi pastikan bukan R (R pakai print() tapi juga punya <- atau cat())
        if not re.search(r"<-|library\(", code):
            return "python"

    # JavaScript — const, let, var, function, console.log
    if re.search(r"\bconsole\.log\s*\(", code):
        return "javascript"
    if re.search(r"^\s*(?:const|let|var)\s+\w+\s*=", code, re.MULTILINE):
        return "javascript"
    if re.search(r"^\s*function\s+\w+\s*\(", code, re.MULTILINE):
        return "javascript"
    if re.search(r"=>\s*[\({\w]", code):  # arrow function
        return "javascript"

    # 3. pygments as last resort (unreliable for short snippets, but might catch some)
    try:
        lexer = guess_lexer(code)
        aliases = getattr(lexer, "aliases", [])
        alias_to_lang = {
            "python": "python", "python2": "python", "python3": "python",
            "py": "python",
            "r": "r", "rconsole": "r",
            "javascript": "javascript", "js": "javascript",
            "typescript": "typescript", "ts": "typescript",
            "cpp": "cpp", "c++": "cpp", "cxx": "cpp",
            "c": "c",
            "java": "java",
            "kotlin": "kotlin",
            "sql": "sql", "mysql": "sql", "postgresql": "sql",
            "php": "php",
            "ruby": "ruby", "rb": "ruby",
            "go": "go", "golang": "go",
            "rust": "rust",
            "swift": "swift",
            "scala": "scala",
            "bash": "bash", "sh": "bash", "shell": "bash",
            "html": "html",
            "css": "css",
            "json": "json",
            "yaml": "yaml",
            "markdown": "markdown",
            "arduino": "cpp",  # treat as cpp
            "text": "unknown", "plaintext": "unknown",
        }
        for alias in aliases:
            if alias.lower() in alias_to_lang:
                lang = alias_to_lang[alias.lower()]
                if lang != "unknown":
                    return lang
    except Exception:
        pass

    # 4. Final fallback
    return "unknown"


def detect_languages_for_blocks(blocks: list[dict]) -> list[dict]:
    """Deteksi bahasa untuk list of code blocks (in-place).

    Args:
        blocks: list of dict dengan key "code" (string)

    Returns:
        list of dict dengan key "lang" ditambahkan/updated
    """
    for block in blocks:
        if "code" not in block:
            continue
        # Kalau sudah ada lang dan bukan "unknown", pertahankan
        if block.get("lang") and block["lang"] != "unknown":
            continue
        block["lang"] = detect_language(block["code"])
    return blocks
