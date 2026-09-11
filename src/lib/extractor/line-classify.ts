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

import { R_SIGNALS } from "./langdetect";

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
  if (t.startsWith("## ") || t.startsWith("##\t")) return true;
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

  // Statistical narrative: "X-squared = 2.2222 menunjukkan bahwa..."
  if (isStatisticalNarrative(t)) return true;

  const ratio = proseRatio(t);
  if (ratio > PROSE_RATIO_THRESHOLD) {
    // Override back to code if there's ≥1 R signal
    for (const p of R_SIGNALS) {
      if (p.test(t)) return false;
    }
    // Also check Python/SQL signals
    if (/^\s*(import|from|def|class|if|elif|else|while|for|return|raise|break|continue|pass)\b/.test(t)) return false;
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(t)) return false;
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
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|UNION)\b/i.test(t)) return true;

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
    const hasAssignment = /\w+\s*=\s*\w/.test(t);
    if (proseRatio(t) === 0 && !/[A-Z][a-z]+\s*\(\d{4}\)/.test(t) && (hasCodeOp || hasAssignment)) return true;
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
