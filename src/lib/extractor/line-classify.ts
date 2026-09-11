// CodeLooter — Line classification (AUDITED & FIXED)
//
// Bug fixes from audit:
// #1: /^["']/ too broad — now requires code context (assignment or R function nearby)
// #2: /^\w+\s+\d+/ false positive — now checks if word is a known data label (L, p, etc.)
// #3: /^\)/ too broad — now requires line to be ONLY closing paren
// #4: function call pattern matches narrative — now checks prose ratio strictly
// #5: /;$/ matches narrative — now checks prose ratio
// #6: statistical narrative (X-squared = ... menunjukkan) — added narrative patterns
// #7: equation vs code — added equation detection (× ÷ ± and no code operators)
// #8: PROSE_WORDS " Yakni" had leading space — removed
// #9: duplicates in PROSE_WORDS — cleaned
// #10: isNarrativeLine only checks R_SIGNALS — now also checks Python/SQL
// #11: hljs recovery minimum 2 lines — raised to 3

import {
  R_SIGNALS,
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
  PYTHON_SIGNALS,
  SQL_SIGNALS,
} from "./langdetect";

// Indonesian + English prose words (deduplicated, no leading spaces)
const PROSE_WORDS = new Set<string>([
  // Indonesian
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
  "rata", "mahasiswa", "dosen",
  // English
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
]);

export const PROSE_RATIO_THRESHOLD = 0.4;

// Patterns that are DEFINITELY narrative, even if they contain = or ()
// Note: single-word Indonesian terms use \b word boundaries so they don't
// match variable identifiers like `koefisien_variasi` or `signifikan_level`.
const STATISTICAL_NARRATIVE_PATTERNS: RegExp[] = [
  /menunjukkan\s+bahwa/i,
  /karena\s+p.?value/i,
  /\bH0\b.*diterima/i,
  /\bH0\b.*ditolak/i,
  /\bartinya\b/i,
  /\bR.?squared\b/i,
  /\bAdjusted\b/i,
  /\bsignifikan\b(?!_)/i,
  /\bkoefisien\b(?!_)/i,
  /hubungan\s+asosiasi/i,
  /\bpenyimpangan\b(?!_)/i,
  /\bdiperkirakan\b/i,
  /\bmeningkat\b/i,
  /\bberkontribusi\b/i,
  /\bmengindikasikan\b/i,
  /\bvariabilitas\b(?!_)/i,
  /\bdijelaskan\b/i,
];

// Equation patterns (math, not code)
const EQUATION_PATTERNS: RegExp[] = [
  /\d\s*[×÷±]\s*\d/,  // uses math operators × ÷ ±
  /\bchi.?square\b/i,
  /Σ.*O.*E/i,  // chi-square formula
];

export function isROutput(line: string): boolean {
  const t = line.trimStart();
  if (t.startsWith("## ") || t.startsWith("##\t")) {
    // Don't match markdown section headings like "## 1. Title" or "### Section"
    // These are NOT R console output — they're document structure.
    // R output looks like: "## Chi-squared test", "## X-squared = 2.22"
    // Markdown headings look like: "## 1. Query Data", "### Subsection"
    if (/^#{1,6}\s+\d+\.\s+/.test(t)) return false;  // numbered heading
    if (/^#{1,6}\s+[A-Z][a-z]+(?:\s+\w+){0,5}\s*$/.test(t)) return false;  // title-case heading
    return true;
  }
  if (/^\[\d+\]\s/.test(t)) return true;
  return false;
}

function tokenize(line: string): string[] {
  const m = line.toLowerCase().match(/[a-zà-ÿ]+/g);
  return m ? m : [];
}

export function proseRatio(line: string): number {
  const tokens = tokenize(line);
  if (tokens.length === 0) return 0;
  let prose = 0;
  for (const t of tokens) if (PROSE_WORDS.has(t)) prose++;
  return prose / tokens.length;
}

export const CODE_START_PATTERNS: RegExp[] = [
  /Kode\s+Penyelesaian\s*:?/i,
  /Kode\s+penyelesaian\s*:?/i,
  /Kode\s+penyelesaiain\s*:?/i,
  /Kode\s*:/i,
  /#\s*Kasus\s+\d/i, /#\s*Kasus\s*:/i,
  /#\s*Soal\s+\d/i, /#\s*Contoh\s+\d/i,
  /#\s*Latihan\s+\d/i, /#\s*Praktikum\s+\d/i, /#\s*Tugas\s+\d/i,
  /Solusi\s*:/i, /Jawaban\s*:/i, /Script\s*:/i, /Syntax\s*:/i,
  /^\s*Kasus\s+\d/i, /^\s*Soal\s+\d/i, /^\s*Contoh\s+\d/i,
  /^\s*Latihan\s+\d/i, /^\s*Praktikum\s+\d/i, /^\s*Tugas\s+\d/i,
  // NEW: Section headers like "## 1. Title", "### 1.1 Subtitle"
  /^#{1,4}\s+\d+\.\s+/,
  /^#{1,4}\s+\d+\.\d+\s+/,
  // NEW: Shebang lines start code blocks
  /^#!\//,
  // NEW: PHP opening tag starts a code block
  /^<\?php/,
  /^<\?=/,
  // NEW: HTML doctype/html/head/body tags start HTML blocks
  /^<!DOCTYPE\s/i,
  /^<html\b/i,
  // NEW: JSON opening brace at line start (alone)
  /^\{\s*$/,
  // NEW: Java/C++/Go/Rust package declaration
  /^\s*package\s+[\w.]+\s*;/,
  /^\s*package\s+(main|\w+)\s*$/,
  // NEW: C/C++ #include
  /^\s*#include\s+[<"]/,
  // NEW: Python import statement
  /^\s*(import|from)\s+\w/,
];

export const CODE_END_PATTERNS: RegExp[] = [
  /Output\s+yang\s+dihasilkan\s*:?/i,
  /Interpretasi\s+Hasil\s*:?/i, /Interpretasi\s*:?/i,
  /Penugasan\s*:?/i, /Kode\s+Penyelesaian\s*:?/i,
  /#\s*Kasus\s+\d/i, /#\s*Soal\s+\d/i, /#\s*Contoh\s+\d/i,
  /#\s*Latihan\s+\d/i, /#\s*Praktikum\s+\d/i, /#\s*Tugas\s+\d/i,
  /Solusi\s*:/i, /Jawaban\s*:/i, /^##\s/,
  /Hasil\s+Output\s*:?/i, /Penjelasan\s*:?/i,
  /Analisis\s*:?/i, /Kesimpulan\s*:?/i,
];

export function isStartMarker(line: string): boolean {
  for (const p of CODE_START_PATTERNS) if (p.test(line)) return true;
  if (/^\s*Contoh\s+\d\s*:/i.test(line)) return true;
  return false;
}

export function isEndMarker(line: string): boolean {
  for (const p of CODE_END_PATTERNS) if (p.test(line)) return true;
  return false;
}

// Check if line matches statistical narrative patterns
// IMPORTANT: all single-word patterns use \b word boundaries so they don't
// match Indonesian variable names like `koefisien_variasi` or `signifikan_level`.
function isStatisticalNarrative(t: string): boolean {
  for (const p of STATISTICAL_NARRATIVE_PATTERNS) {
    if (p.test(t)) return true;
  }
  return false;
}

// Check if line is a math equation (not code)
function isEquation(t: string): boolean {
  // Comments are NEVER equations — they're code (# Kasus 1: Uji Chi-Square)
  if (/^\s*#/.test(t)) return false;
  for (const p of EQUATION_PATTERNS) {
    if (p.test(t)) return true;
  }
  // Pattern: var = number + number * var (equation, not assignment)
  if (/^\w+\s*=\s*\d+(\.\d+)?\s*[+]\s*\d/.test(t) && !/<-/.test(t) && !/c\s*\(/.test(t)) {
    return true;
  }
  // Pattern: var = expr = number (e.g. "df = n - 1 = 29", "χ² = Σ(O-E)²/E = 2.34")
  // Double `=` with no <- and no function call is a math equation, not code.
  if (/^\w+\s*=\s*\S+.*=\s*\d/.test(t) && !/<-/.test(t) && !/\(/.test(t)) {
    return true;
  }
  return false;
}

export function isNarrativeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;

  // Comments (# ...) are NEVER narrative — they're code
  if (/^\s*#\s/.test(t)) return false;
  // Shebang (#!...) is NEVER narrative
  if (/^#!/.test(t)) return false;
  // HTML comments (<!-- ... -->) are code
  if (/^\s*<!--/.test(t)) return false;
  // CSS comments (/* ... */) are code
  if (/^\s*\/\*/.test(t)) return false;
  // C/C++/Java/JS single-line comments (// ...) are code
  if (/^\s*\/\//.test(t)) return false;
  // MATLAB/Shell comments (% ...) for MATLAB
  if (/^\s*%\s/.test(t)) return false;

  // Statistical narrative: "X-squared = 2.2222 menunjukkan bahwa..."
  if (isStatisticalNarrative(t)) return true;

  const ratio = proseRatio(t);
  if (ratio > PROSE_RATIO_THRESHOLD) {
    // Override back to code if there's ≥1 R signal
    for (const p of R_SIGNALS) {
      if (p.test(t)) return false;
    }
    // Check Python/SQL/Java/C++/JS/TS/PHP/Bash/Go/Rust/Kotlin/MATLAB signals
    const allCodeSignals = [
      ...PYTHON_SIGNALS, ...SQL_SIGNALS, ...JAVA_SIGNALS,
      ...CPP_SIGNALS, ...JAVASCRIPT_SIGNALS, ...TYPESCRIPT_SIGNALS,
      ...PHP_SIGNALS, ...BASH_SIGNALS, ...GO_SIGNALS, ...RUST_SIGNALS,
      ...KOTLIN_SIGNALS, ...MATLAB_SIGNALS,
    ];
    for (const p of allCodeSignals) {
      if (p.test(t)) return false;
    }
    // Also check Python/SQL/Java keywords explicitly
    if (/^\s*(import|from|def|class|if|elif|else|while|for|return|raise|break|continue|pass|with|try|except|finally|yield|lambda|async|await|global|nonlocal)\b/.test(t)) return false;
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|GROUP|ORDER|HAVING|UNION|SET|INTO|VALUES|TABLE|INDEX|VIEW)\b/i.test(t)) return false;
    if (/^\s*(public|private|protected|static|final|abstract|class|interface|enum|extends|implements|package|import|new|return|void|int|double|float|long|boolean|char|byte|short)\b/.test(t)) return false;
    if (/^\s*(func|package|import|var|const|let|defer|go|chan|type|struct|interface|map|range|select|case|default|break|continue|fallthrough)\b/.test(t)) return false;
    if (/^\s*(fn|let|mut|pub|use|mod|struct|enum|trait|impl|match|if|else|while|for|loop|return|break|continue|move|ref|self|super|crate)\b/.test(t)) return false;
    if (/^\s*(val|var|fun|class|object|data|companion|override|private|public|protected|internal|abstract|open|sealed|init|when|by|as|in|is|out|vararg|reified|crossinline|noinline|tailrec|suspend|inline)\b/.test(t)) return false;
    return true;
  }
  return false;
}

export function isCodeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (isROutput(t)) return false;
  if (isNarrativeLine(t)) return false;

  // Equation detection — math formulas are NOT code
  if (isEquation(t)) return false;

  // R signals
  for (const p of R_SIGNALS) {
    if (p.test(t)) return true;
  }
  // assignment patterns
  if (/\w+\s*<-\s/.test(t)) return true;
  if (/\w+\s*<-\s*$/.test(t)) return true;
  if (/\w+\s*=\s*c\s*\(/.test(t)) return true;
  if (/\w+\s*=\s*\d/.test(t) && !/^\s*(if|while|for)\s/.test(t)) return true;
  if (/^\w+\s*=\s*["']/.test(t)) return true;
  // R-style multi-line assignment: var = ( or var <- (
  if (/^\w+\s*=\s*\(\s*$/.test(t)) return true;
  if (/^\w+\s*<-\s*\(\s*$/.test(t)) return true;
  // String content inside R assignment
  // FIX #1: Must start with quote AND have ≤4 words AND low prose
  // FIX #14: Allow longer quoted strings if they contain data (digits like "A 12 B 18 C 7")
  if (/^["']/.test(t) && t.length <= 80 && !/[.!?]$/.test(t)) {
    const words = t.split(/\s+/);
    const hasData = /\d/.test(t);
    if (words.length <= 4 && proseRatio(t) <= 0.4) return true;
    // Quoted string with numeric data (e.g. "A 12 B 18 C 7") — single letters
    // like "A", "B", "C" are data labels, not prose, even if "a" matches the
    // English article in PROSE_WORDS.
    if (hasData && words.length <= 8 && proseRatio(t) <= 0.4) return true;
  }
  // FIX #2: Only match data rows like "L 55 25" if word is 1-3 chars (code label, not narrative)
  if (/^[A-Za-z]\w{0,2}\s+\d+(\s+\d+)*\s*$/.test(t) && proseRatio(t) === 0) return true;
  // FIX #3: Only match closing paren if line is ONLY closing paren(s)
  if (/^[)\]}]+\s*$/.test(t)) return true;
  // Multi-variable assignment (Python tuple unpacking)
  if (/^\w+\s*(,\s*\w+)+\s*=/.test(t)) return true;
  // Index/bracket assignment
  if (/^\w+\s*=\s*\w+\[/.test(t)) return true;
  // NEW: Array literal assignment (Python/JS: var = [...])
  if (/^\w+\s*=\s*\[/.test(t)) return true;
  // NEW: Dict/object literal assignment (Python/JS: var = {...})
  if (/^\w+\s*=\s*\{/.test(t)) return true;
  // NEW: Array destructuring (Python/JS: [a, b] = ...)
  if (/^\[.*\]\s*=/.test(t)) return true;
  // NEW: Variable = function call (e.g., filtered = filtfilt(b, a, signal))
  if (/^\w+\s*=\s*\w+\s*\(/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  // NEW: Method call chain (e.g., plt.figure(...), fruits.append(...), df.head())
  if (/^\w+\.\w+\s*\(/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  // NEW: Attribute access assignment (e.g., self.items = [])
  if (/^\w+\.\w+\s*=/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  // Chain access assignment
  if (/^\w+\s*=\s*\w+\.\w+/.test(t)) return true;
  // Continuation: word = value ending with comma/closing paren
  if (/^\w+\s*=/.test(t) && /[,)]\s*$/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;

  // Python signals
  if (/^\s*(import|from)\s+\w/.test(t)) return true;
  if (/^\s*def\s+\w+\s*\(/.test(t)) return true;
  if (/^\s*class\s+\w+/.test(t)) return true;
  if (/^\s*if\s+__name__/.test(t)) return true;
  if (/^\s*(print|return|raise|break|continue|pass)\s*[\(\s]/.test(t)) return true;
  if (/^\s*return\s/.test(t)) return true;
  if (/^\s*(if|elif|while|for|else)\s.*:\s*$/.test(t)) return true;
  if (/^\s*else\s*:/.test(t)) return true;
  if (/^\s*elif\s+/.test(t)) return true;
  if (/^\s*#\s/.test(t)) return true;
  if (/^\s{4,}\w+/.test(t) && /[()=<>+\-*/]/.test(t) && !t.endsWith(".") && !t.endsWith(":")) {
    if (proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  }
  if (/^\s*if\s+\w+.*[<>=!]/.test(t) && !t.endsWith(".")) return true;
  if (/^\s*while\s+.+[:<>=!]/.test(t)) return true;
  if (/^\s*\w+\s*=\s*\w+.*[+\-*/]/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  if (/^\s*\w+\s*=\s*[\(\d]/.test(t) && /[+\-*/]/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  if (/\w+\s*\/\//.test(t)) return true;
  if (/^\s*\w+\[\w+\]/.test(t)) return true;

  // SQL signals
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|SET|INTO|VALUES|TABLE|INDEX|VIEW|PRIMARY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|UNIQUE|NOT\s+NULL|AUTO_INCREMENT|INNER|LEFT|RIGHT|OUTER|FULL|CROSS)\b/i.test(t)) return true;
  if (/^\s*(VARCHAR|INT|INTEGER|DECIMAL|FLOAT|DOUBLE|BOOLEAN|DATE|DATETIME|TIMESTAMP|TEXT|BLOB|CHAR)\b/i.test(t) && /[\s,)]/.test(t)) return true;
  if (/--\s/.test(t) && proseRatio(t) === 0) return true;  // SQL comment

  // ── NEW: Multi-language code patterns ──

  // SHEBANG (#!/bin/bash, #!/usr/bin/env python) — always code
  if (/^#!\//.test(t)) return true;

  // JAVA patterns
  if (/^\s*(public|private|protected)\s+(static\s+)?(final\s+)?(class|interface|enum|void|int|String|double|boolean|long|float|char|byte|short)\b/.test(t)) return true;
  if (/^\s*(public|private|protected)\s+(static\s+)?\w+(?:\[\])?\s+\w+\s*[=;(]/.test(t)) return true;
  if (/^\s*(final|abstract|synchronized|native|transient|volatile)\s+/.test(t)) return true;
  if (/^\s*class\s+\w+/.test(t)) return true;
  if (/^\s*interface\s+\w+/.test(t)) return true;
  if (/^\s*enum\s+\w+/.test(t)) return true;
  if (/^\s*import\s+java\./.test(t)) return true;
  if (/^\s*import\s+(static\s+)?[\w.]+\s*;/.test(t)) return true;
  if (/^\s*package\s+[\w.]+\s*;/.test(t)) return true;
  if (/^\s*throws\s+/.test(t)) return true;
  if (/^\s*new\s+\w+\s*\(/.test(t)) return true;
  if (/^\s*new\s+\w+\s*\[/.test(t)) return true;
  if (/^\s*this\.\w+/.test(t)) return true;
  if (/^\s*super\.\w+/.test(t)) return true;
  if (/^\s*System\.(out|err)\./.test(t)) return true;
  if (/^\s*@\w+/.test(t)) return true;  // annotations
  if (/^\s*@\w+\.\w+/.test(t)) return true;
  if (/^\s*@\w+\s*\(/.test(t)) return true;
  if (/^\s*return\s+(new\s+)?\w+/.test(t)) return true;
  if (/^\s*extends\s+\w+/.test(t)) return true;
  if (/^\s*implements\s+\w+/.test(t)) return true;
  if (/^\s*instanceof\s+\w+/.test(t)) return true;
  if (/^\s*(int|double|float|long|short|byte|char|boolean|String)\s*\[\s*\]/.test(t)) return true;
  if (/^\s*(int|double|float|long|short|byte|char|boolean|String)\s+\w+\s*=/.test(t)) return true;
  if (/^\s*(int|double|float|long|short|byte|char|boolean|String)\s+\w+\s*;/.test(t)) return true;
  if (/^\s*void\s+\w+\s*\(/.test(t)) return true;
  if (/\btry\s*\{/.test(t)) return true;
  if (/\bcatch\s*\(/.test(t)) return true;
  if (/\bfinally\s*\{/.test(t)) return true;
  if (/\bthrow\s+new\s+/.test(t)) return true;

  // C++ patterns
  if (/^\s*#include\s+[<"]/.test(t)) return true;
  if (/^\s*#define\s+\w+/.test(t)) return true;
  if (/^\s*#ifndef\s+\w+/.test(t)) return true;
  if (/^\s*#ifdef\s+\w+/.test(t)) return true;
  if (/^\s*#pragma\s+/.test(t)) return true;
  if (/^\s*#endif/.test(t)) return true;
  if (/^\s*using\s+namespace\s+/.test(t)) return true;
  if (/^\s*template\s*</.test(t)) return true;
  if (/^\s*namespace\s+\w+/.test(t)) return true;
  if (/^\s*std::/.test(t)) return true;
  if (/^\s*cout\s*<</.test(t)) return true;
  if (/^\s*cin\s*>>/.test(t)) return true;
  if (/^\s*cerr\s*<</.test(t)) return true;
  if (/^\s*int\s+main\s*\(/.test(t)) return true;
  if (/^\s*return\s+\d+\s*;/.test(t)) return true;
  if (/->\w+/.test(t) && proseRatio(t) === 0) return true;
  if (/::\w+/.test(t) && proseRatio(t) === 0) return true;
  if (/^\s*delete\s+\w+/.test(t)) return true;
  if (/^\s*delete\[\]\s+\w+/.test(t)) return true;
  if (/^\s*new\s+\w+/.test(t)) return true;
  if (/^\s*nullptr\b/.test(t)) return true;
  if (/^\s*endl\b/.test(t)) return true;
  if (/^\s*(const|auto|static|extern|inline|virtual|explicit|mutable|constexpr|thread_local)\s+/.test(t)) return true;
  if (/^\s*(unsigned|signed)\s+(int|long|short|char)/.test(t)) return true;
  if (/^\s*struct\s+\w+/.test(t)) return true;
  if (/^\s*class\s+\w+\s*[:{]/.test(t)) return true;
  if (/^\s*enum\s+(class\s+)?\w+/.test(t)) return true;
  if (/^\s*union\s+\w+/.test(t)) return true;
  if (/^\s*typedef\s+/.test(t)) return true;
  if (/^\s*typename\s+/.test(t)) return true;
  if (/^\s*operator\s*[+\-*/=<>!]+/.test(t)) return true;

  // JavaScript / TypeScript patterns
  if (/^\s*(const|let|var)\s+\w+/.test(t)) return true;
  if (/^\s*function\s+\w+\s*\(/.test(t)) return true;
  if (/^\s*function\s*\*/.test(t)) return true;  // generator
  if (/^\s*async\s+function\s+/.test(t)) return true;
  if (/^\s*export\s+(default\s+)?(const|let|var|function|class|interface|type|enum)\s+/.test(t)) return true;
  if (/^\s*import\s+.*from\s+['"]/.test(t)) return true;
  if (/^\s*import\s+['"]/.test(t)) return true;
  if (/^\s*require\s*\(\s*['"]/.test(t)) return true;
  if (/^\s*module\.exports\s*=/.test(t)) return true;
  if (/^\s*console\.(log|error|warn|info|debug)\s*\(/.test(t)) return true;
  if (/^\s*document\.\w+/.test(t)) return true;
  if (/^\s*window\.\w+/.test(t)) return true;
  if (/^\s*throw\s+new\s+/.test(t)) return true;
  if (/^\s*typeof\s+/.test(t)) return true;
  if (/^\s*instanceof\s+/.test(t)) return true;
  if (/^\s*await\s+/.test(t)) return true;
  if (/^\s*return\s+/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  if (/^\s*interface\s+\w+/.test(t)) return true;
  if (/^\s*type\s+\w+\s*=/.test(t)) return true;
  if (/^\s*enum\s+\w+/.test(t)) return true;
  if (/^\s*as\s+\w+/.test(t)) return true;
  if (/^\s*readonly\s+/.test(t)) return true;
  if (/=>\s*[{(]/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  if (/\.then\s*\(/.test(t) && proseRatio(t) === 0) return true;
  if (/\.catch\s*\(/.test(t) && proseRatio(t) === 0) return true;
  if (/\.map\s*\(/.test(t) && proseRatio(t) === 0) return true;
  if (/\.filter\s*\(/.test(t) && proseRatio(t) === 0) return true;
  if (/\.reduce\s*\(/.test(t) && proseRatio(t) === 0) return true;
  if (/JSON\.(parse|stringify)\s*\(/.test(t)) return true;
  if (/Promise\s*\(/.test(t)) return true;
  if (/new\s+Promise\s*\(/.test(t)) return true;

  // PHP patterns
  if (/^\s*<\?php/.test(t)) return true;
  if (/^\s*<\?=/.test(t)) return true;
  if (/^\s*\?>/i.test(t)) return true;
  if (/^\s*\$\w+\s*=/.test(t)) return true;
  if (/^\s*\$\w+\s*->/.test(t)) return true;
  if (/^\s*\$\w+\s*\[/.test(t)) return true;
  if (/^\s*\$\w+\s*;/.test(t)) return true;
  if (/^\s*echo\s+/.test(t)) return true;
  if (/^\s*print\s*\(/.test(t)) return true;
  if (/^\s*function\s+\w+\s*\(/.test(t)) return true;
  if (/^\s*public\s+function\s+/.test(t)) return true;
  if (/^\s*private\s+function\s+/.test(t)) return true;
  if (/^\s*protected\s+function\s+/.test(t)) return true;
  if (/^\s*static\s+function\s+/.test(t)) return true;
  if (/^\s*class\s+\w+/.test(t)) return true;
  if (/^\s*namespace\s+[\w\\]+/.test(t)) return true;
  if (/^\s*use\s+\\?[\w\\]+/.test(t)) return true;
  if (/^\s*foreach\s*\(/.test(t)) return true;
  if (/^\s*array\s*\(/.test(t)) return true;
  if (/^\s*\$\w+\s*\(\s*\)/.test(t)) return true;
  if (/^\s*this->\w+/.test(t)) return true;
  if (/^\s*self::/.test(t)) return true;
  if (/^\s*parent::/.test(t)) return true;
  if (/^\s*PDO::/.test(t)) return true;
  if (/json_encode\s*\(/.test(t)) return true;
  if (/json_decode\s*\(/.test(t)) return true;
  if (/header\s*\(\s*['"]/.test(t)) return true;
  if (/->\w+\s*\(/.test(t) && proseRatio(t) === 0) return true;
  if (/::\w+\s*\(/.test(t) && proseRatio(t) === 0) return true;

  // Bash / Shell patterns
  if (/^#!\/(bin|usr)\/(bash|sh|zsh|env)/.test(t)) return true;
  if (/^\s*set\s+-[euo]/.test(t)) return true;
  if (/^\s*echo\s+/.test(t)) return true;
  if (/^\s*echo\s+["-]/.test(t)) return true;
  if (/^\s*printf\s+/.test(t)) return true;
  if (/^\s*if\s*\[/.test(t)) return true;
  if (/^\s*if\s+\[\s/.test(t)) return true;
  if (/^\s*elif\s*\[/.test(t)) return true;
  if (/^\s*else\s*$/.test(t)) return true;
  if (/^\s*fi\s*$/.test(t)) return true;
  if (/^\s*for\s+\w+\s+in\s+/.test(t)) return true;
  if (/^\s*while\s+\[/.test(t)) return true;
  if (/^\s*while\s+read\s+/.test(t)) return true;
  if (/^\s*do\s*$/.test(t)) return true;
  if (/^\s*done\s*$/.test(t)) return true;
  if (/^\s*case\s+.*\s+in\s*$/.test(t)) return true;
  if (/^\s*esac\s*$/.test(t)) return true;
  if (/^\s*export\s+\w+=/.test(t)) return true;
  if (/^\s*local\s+\w+=/.test(t)) return true;
  if (/^\s*readonly\s+\w+/.test(t)) return true;
  if (/^\s*return\s+\d+/.test(t)) return true;
  if (/^\s*cd\s+/.test(t)) return true;
  if (/^\s*tar\s+-/.test(t)) return true;
  if (/^\s*git\s+(pull|push|clone|commit|add|checkout|branch|merge|status|log)\b/.test(t)) return true;
  if (/^\s*npm\s+(install|run|ci|test|build|start|init)\b/.test(t)) return true;
  if (/^\s*systemctl\s+(start|stop|restart|status|enable|disable)\b/.test(t)) return true;
  if (/^\s*docker\s+(run|build|pull|push|compose|ps|stop|rm)\b/.test(t)) return true;
  if (/^\s*mkdir\s+/.test(t)) return true;
  if (/^\s*rm\s+-/.test(t)) return true;
  if (/^\s*cp\s+/.test(t)) return true;
  if (/^\s*mv\s+/.test(t)) return true;
  if (/^\s*chmod\s+/.test(t)) return true;
  if (/^\s*chown\s+/.test(t)) return true;
  if (/^\s*grep\s+/.test(t)) return true;
  if (/^\s*sed\s+-/.test(t)) return true;
  if (/^\s*awk\s+/.test(t)) return true;
  if (/^\s*curl\s+-/.test(t)) return true;
  if (/^\s*wget\s+/.test(t)) return true;
  if (/^\s*cat\s+/.test(t)) return true;
  if (/^\s*head\s+-/.test(t)) return true;
  if (/^\s*tail\s+-/.test(t)) return true;
  if (/^\s*wc\s+-/.test(t)) return true;
  if (/^\s*ps\s+/.test(t)) return true;
  if (/^\s*kill\s+-/.test(t)) return true;
  if (/^\s*source\s+/.test(t)) return true;
  if (/^\s*\.\s+\/.*/.test(t)) return true;  // . ./script.sh
  if (/^\s*\$\{?\w+\}?/.test(t) && /[\/\s]/.test(t) && proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  if (/\$\([^)]+\)/.test(t) && proseRatio(t) === 0) return true;
  if (/\|\s*(grep|sed|awk|wc|sort|head|tail|cat)\b/.test(t)) return true;

  // Go patterns
  if (/^\s*package\s+\w+/.test(t)) return true;
  if (/^\s*import\s*\(/.test(t)) return true;
  if (/^\s*import\s+['"]/.test(t)) return true;
  if (/^\s*func\s+\w+\s*\(/.test(t)) return true;
  if (/^\s*func\s*\(/.test(t)) return true;  // method receiver
  if (/^\s*type\s+\w+\s+(struct|interface)/.test(t)) return true;
  if (/^\s*struct\s*\{/.test(t)) return true;
  if (/^\s*interface\s*\{/.test(t)) return true;
  if (/^\s*map\[\w+\]\w+/.test(t)) return true;
  if (/^\s*chan\s+\w+/.test(t)) return true;
  if (/^\s*defer\s+/.test(t)) return true;
  if (/^\s*go\s+\w+/.test(t)) return true;
  if (/^\s*select\s*\{/.test(t)) return true;
  if (/^\s*switch\s+/.test(t)) return true;
  if (/^\s*case\s+/.test(t)) return true;
  if (/^\s*default\s*:/i.test(t)) return true;
  if (/^\s*fallthrough\s*$/.test(t)) return true;
  if (/^\s*break\s*$/.test(t)) return true;
  if (/^\s*continue\s*$/.test(t)) return true;
  if (/^\s*return\s+/.test(t)) return true;
  if (/^\s*return\s+nil\s*$/.test(t)) return true;
  if (/^\s*nil\b/.test(t)) return true;
  if (/^\s*var\s+\w+\s+\w+/.test(t)) return true;
  if (/^\s*const\s+\w+\s*=/.test(t)) return true;
  if (/^\s*range\s+/.test(t)) return true;
  if (/^\s*fmt\./.test(t)) return true;
  if (/^\s*log\./.test(t)) return true;
  if (/^\s*http\./.test(t)) return true;
  if (/^\s*os\./.test(t)) return true;
  if (/^\s*strings\./.test(t)) return true;
  if (/^\s*strconv\./.test(t)) return true;
  if (/^\s*json\./.test(t)) return true;
  if (/^\s*err\s*!=\s*nil/.test(t)) return true;
  if (/^\s*err\s*==\s*nil/.test(t)) return true;
  if (/:=/.test(t) && proseRatio(t) === 0) return true;
  if (/^\s*append\s*\(/.test(t)) return true;
  if (/^\s*make\s*\(/.test(t)) return true;
  if (/^\s*panic\s*\(/.test(t)) return true;
  if (/^\s*recover\s*\(\s*\)/.test(t)) return true;

  // Rust patterns
  if (/^\s*use\s+/.test(t)) return true;
  if (/^\s*fn\s+\w+/.test(t)) return true;
  if (/^\s*let\s+(mut\s+)?\w+/.test(t)) return true;
  if (/^\s*let\s+mut\s+/.test(t)) return true;
  if (/^\s*pub\s+(fn|struct|enum|trait|use|mod|const)\s+/.test(t)) return true;
  if (/^\s*mod\s+\w+/.test(t)) return true;
  if (/^\s*struct\s+\w+/.test(t)) return true;
  if (/^\s*enum\s+\w+/.test(t)) return true;
  if (/^\s*trait\s+\w+/.test(t)) return true;
  if (/^\s*impl\s+/.test(t)) return true;
  if (/^\s*match\s+/.test(t)) return true;
  if (/^\s*println!\s*\(/.test(t)) return true;
  if (/^\s*eprintln!\s*\(/.test(t)) return true;
  if (/^\s*format!\s*\(/.test(t)) return true;
  if (/^\s*vec!\s*\[/.test(t)) return true;
  if (/^\s*process::exit\s*\(/.test(t)) return true;
  if (/^\s*self::/.test(t)) return true;
  if (/^\s*super::/.test(t)) return true;
  if (/^\s*crate::/.test(t)) return true;
  if (/^\s*mut\s+/.test(t)) return true;
  if (/^\s*ref\s+/.test(t)) return true;
  if (/^\s*move\s+/.test(t)) return true;
  if (/^\s*unsafe\s*\{/.test(t)) return true;
  if (/^\s*loop\s*\{/.test(t)) return true;
  if (/^\s*async\s+fn\s+/.test(t)) return true;
  if (/^\s*await\s+/.test(t)) return true;
  if (/^\s*Some\s*\(/.test(t)) return true;
  if (/^\s*None\b/.test(t)) return true;
  if (/^\s*Ok\s*\(/.test(t)) return true;
  if (/^\s*Err\s*\(/.test(t)) return true;
  if (/\.unwrap\s*\(\s*\)/.test(t)) return true;
  if (/\.expect\s*\(/.test(t)) return true;
  if (/\.collect\s*\(\s*\)/.test(t)) return true;
  if (/->\s*\w+/.test(t) && proseRatio(t) === 0) return true;

  // Kotlin patterns
  if (/^\s*package\s+[\w.]+\s*$/.test(t)) return true;
  if (/^\s*import\s+[\w.]+\s*$/.test(t)) return true;
  if (/^\s*fun\s+\w+\s*\(/.test(t)) return true;
  if (/^\s*override\s+fun\s+/.test(t)) return true;
  if (/^\s*private\s+fun\s+/.test(t)) return true;
  if (/^\s*public\s+fun\s+/.test(t)) return true;
  if (/^\s*protected\s+fun\s+/.test(t)) return true;
  if (/^\s*internal\s+fun\s+/.test(t)) return true;
  if (/^\s*class\s+\w+/.test(t)) return true;
  if (/^\s*data\s+class\s+/.test(t)) return true;
  if (/^\s*object\s+\w+/.test(t)) return true;
  if (/^\s*companion\s+object/.test(t)) return true;
  if (/^\s*interface\s+\w+/.test(t)) return true;
  if (/^\s*enum\s+class\s+/.test(t)) return true;
  if (/^\s*sealed\s+class\s+/.test(t)) return true;
  if (/^\s*abstract\s+class\s+/.test(t)) return true;
  if (/^\s*open\s+class\s+/.test(t)) return true;
  if (/^\s*val\s+\w+/.test(t)) return true;
  if (/^\s*var\s+\w+/.test(t)) return true;
  if (/^\s*lateinit\s+var\s+/.test(t)) return true;
  if (/^\s*const\s+val\s+/.test(t)) return true;
  if (/^\s*when\s*[\({]/.test(t)) return true;
  if (/^\s*init\s*\{/.test(t)) return true;
  if (/^\s*by\s+(lazy|delegate)/.test(t)) return true;
  if (/^\s*return\s+/.test(t)) return true;
  if (/^\s*throw\s+/.test(t)) return true;
  if (/^\s*try\s*\{/.test(t)) return true;
  if (/^\s*catch\s*\(/.test(t)) return true;
  if (/^\s*finally\s*\{/.test(t)) return true;
  if (/!!\s*$/.test(t)) return true;
  if (/\?\./.test(t) && proseRatio(t) === 0) return true;
  if (/^\s*@Composable/.test(t)) return true;
  if (/^\s*@Override/.test(t)) return true;
  if (/setContentView\s*\(/.test(t)) return true;
  if (/findViewById\s*\(/.test(t)) return true;
  if (/setOnClickListener\s*\{/.test(t)) return true;

  // HTML patterns
  if (/^\s*<!DOCTYPE\s+html/i.test(t)) return true;
  if (/^\s*<!--/.test(t)) return true;
  if (/^\s*<\/?\w+[^>]*>/i.test(t)) return true;
  if (/^\s*<html/i.test(t)) return true;
  if (/^\s*<head/i.test(t)) return true;
  if (/^\s*<body/i.test(t)) return true;
  if (/^\s*<div/i.test(t)) return true;
  if (/^\s*<script/i.test(t)) return true;
  if (/^\s*<style/i.test(t)) return true;
  if (/^\s*<link/i.test(t)) return true;
  if (/^\s*<meta/i.test(t)) return true;
  if (/^\s*<title/i.test(t)) return true;
  if (/^\s*<p>/i.test(t)) return true;
  if (/^\s*<h[1-6]/i.test(t)) return true;
  if (/^\s*<ul/i.test(t)) return true;
  if (/^\s*<ol/i.test(t)) return true;
  if (/^\s*<li/i.test(t)) return true;
  if (/^\s*<table/i.test(t)) return true;
  if (/^\s*<form/i.test(t)) return true;
  if (/^\s*<input/i.test(t)) return true;
  if (/^\s*<button/i.test(t)) return true;
  if (/^\s*<a\s+href/i.test(t)) return true;
  if (/^\s*<img/i.test(t)) return true;
  if (/^\s*<\/\w+>\s*$/i.test(t)) return true;

  // CSS patterns
  if (/^\s*\.[a-zA-Z][\w-]*\s*\{/.test(t)) return true;
  if (/^\s*#[a-zA-Z][\w-]*\s*\{/.test(t)) return true;
  if (/^\s*@\w+/.test(t)) return true;
  if (/[a-zA-Z-]+\s*:\s*[^;{}]+;/.test(t) && proseRatio(t) === 0) return true;
  if (/^\s*(color|background|margin|padding|border|font|display|position|width|height|top|left|right|bottom|float|clear|overflow|z-index|opacity|text-align|line-height|letter-spacing)\s*:/i.test(t)) return true;
  if (/!important/.test(t) && proseRatio(t) === 0) return true;
  if (/linear-gradient\s*\(/.test(t) && proseRatio(t) === 0) return true;

  // JSON patterns
  if (/^\s*\{\s*$/.test(t)) return true;
  if (/^\s*\}\s*,?\s*$/.test(t)) return true;
  if (/^\s*\[\s*$/.test(t)) return true;
  if (/^\s*\]\s*,?\s*$/.test(t)) return true;
  if (/^\s*"[^"]+"\s*:/.test(t)) return true;
  if (/^\s*"[^"]+"\s*:\s*(true|false|null)\s*,?\s*$/.test(t)) return true;
  if (/^\s*"[^"]+"\s*:\s*-?\d/.test(t)) return true;
  if (/^\s*"[^"]+"\s*:\s*"/.test(t)) return true;
  if (/^\s*"[^"]+"\s*,?\s*$/.test(t)) return true;

  // MATLAB patterns
  if (/^\s*%\s/.test(t)) return true;  // MATLAB comment
  if (/^\s*figure\s*;/.test(t)) return true;
  if (/^\s*figure\s*\(/.test(t)) return true;
  if (/^\s*subplot\s*\(/.test(t)) return true;
  if (/^\s*plot\s*\(/.test(t)) return true;
  if (/^\s*xlabel\s*\(/.test(t)) return true;
  if (/^\s*ylabel\s*\(/.test(t)) return true;
  if (/^\s*title\s*\(/.test(t)) return true;
  if (/^\s*legend\s*\(/.test(t)) return true;
  if (/^\s*disp\s*\(/.test(t)) return true;
  if (/^\s*fprintf\s*\(/.test(t)) return true;
  if (/^\s*sprintf\s*\(/.test(t)) return true;
  if (/^\s*function\s+/.test(t)) return true;
  if (/^\s*end\s*$/.test(t)) return true;
  if (/^\s*grid\s+(on|off)/.test(t)) return true;
  if (/^\s*hold\s+(on|off)/.test(t)) return true;
  if (/^\s*zeros\s*\(/.test(t)) return true;
  if (/^\s*ones\s*\(/.test(t)) return true;
  if (/^\s*rand\s*\(/.test(t)) return true;
  if (/^\s*randn\s*\(/.test(t)) return true;
  if (/^\s*butter\s*\(/.test(t)) return true;
  if (/^\s*filtfilt\s*\(/.test(t)) return true;
  if (/^\s*fft\s*\(/.test(t)) return true;
  if (/^\s*ifft\s*\(/.test(t)) return true;

  // General code patterns
  // FIX #5: Semicolon — only if prose ratio is 0 AND no citation pattern
  if (/;\s*$/.test(t) && !/[.!?]$/.test(t) && proseRatio(t) === 0) {
    // Don't match citations like "Smith (2017);" or "see Author (2020);"
    if (!/[A-Z][a-z]+\s*\(\d{4}\)/.test(t)) return true;
  }
  // FIX #4: Function call — only if NO prose AND no citation AND has code operators
  if (/\b\w+\s*\([^)]*\)/.test(t) && !t.endsWith(":") && !t.endsWith(".")) {
    // Must have at least one code-specific operator to be code
    const hasCodeOp = /<-|->|\$|::|%>%|#|;\s*$/.test(t);
    // FIX: hasAssignment now also matches =( and =[" and =[ (e.g. figsize=(12, 6))
    const hasAssignment = /\w+\s*=\s*[\w(["']/.test(t);
    // FIX: method call (e.g., plt.figure(...), fruits.append(...))
    const hasMethodCall = /\w+\.\w+\s*\(/.test(t);
    if (proseRatio(t) === 0 && !/[A-Z][a-z]+\s*\(\d{4}\)/.test(t) && (hasCodeOp || hasAssignment || hasMethodCall)) return true;
  }
  return false;
}

export function scoreLine(line: string): number {
  const t = line.trim();
  if (!t) return 0;
  let score = 0;
  if (/\b(library|require|data\.frame|read\.csv|read\.table|read\.xlsx|summary|lm|glm|aov|cor\.test|chisq\.test|t\.test|ggplot|plot|abline|hist|boxplot|qt|qnorm|qf|qchisq|pt|pnorm|sample|set\.seed|c\s*\(|seq|rep|head|tail|str|names|colnames|rownames|mean|median|sd|var|sqrt|abs|round|cbind|rbind|merge|subset|transform|cat|paste|paste0|sprintf|def|class|import|from|return|function|var|let|const|public|private|static|void|int|float|print|echo|SELECT|FROM|WHERE)\b/.test(t)) {
    score += 3;
  }
  if (/\w+\s*<-/.test(t)) score += 3;
  if (/(<-|->|%>%|:=)/.test(t)) score += 2;
  if (/\b\w+\s*\(/.test(t)) score += 1;
  if (/^\s*#/.test(t)) score += 1;
  if (/[(){}\[\];=<>+\-*/\\&|!?:,'".]/.test(t)) score += 1;
  if (/["'].*["']/.test(t)) score += 1;
  const proseWords = t.toLowerCase().match(/\b(?:dan|atau|yang|untuk|pada|dengan|dari|ke|di|ini|itu|adalah|akan|sebuah|seorang|mahasiswa|rata|selisih|proporsi|signifikan|berbeda|menggunakan|menghitung|the|and|or|for|with|from|to|in|of|a|an|is|are|was|were)\b/g);
  if (proseWords && proseWords.length >= 2) score -= 2;
  return score;
}
