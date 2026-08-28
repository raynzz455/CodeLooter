// CodeLooter — Line classification
// Decides whether a single line is code, R console output, or narrative.
//
// Phase 1 Fix #2 (stricter narrative filter) lives here:
//   If the share of "prose words" on a line exceeds PROSE_RATIO_THRESHOLD,
//   the line is treated as narrative even if it contains code-like tokens
//   (e.g. "X-squared = 2.2222 menunjukkan bahwa ...").

import { R_SIGNALS } from "./langdetect";

// Common Indonesian + English prose words. A line with a high ratio of these
// is narrative, not code.
const PROSE_WORDS = new Set<string>([
  // Indonesian — conjunctions, prepositions, articles, verbs
  "dan", "atau", "yang", "untuk", "pada", "dengan", "dari", "ke", "di",
  "ini", "itu", "adalah", "akan", "sebuah", "seorang", "mahasiswa",
  "tersebut", "sebagai", "jika", "maka", "sehingga", "karena", "agar",
  "supaya", "rata", "selisih", "proporsi", "signifikan", "berbeda",
  "menggunakan", "menghitung", "menunjukkan", "bahwa", "hasil",
  "nilai", "tabel", "contoh", "soal", "kasus", "penyelesaian", "interpretasi",
  "output", "dihasilkan", "digunakan", "dapat", "tidak", "lebih", "besar",
  "kecil", "antara", "hingga", "serta", "namun", "tetapi", "sedangkan",
  // Additional Indonesian academic terms
  "dalam", "luar", "atas", "bawah", "setiap", "beberapa", "banyak",
  "sedikit", "sama", "lain", "berikut", "misalnya", "seperti", "yaitu",
  "ialah", "merupakan", "yaitu", " Yakni", "adapun", "sedangkan",
  "selain", "kecuali", "serta", "maupun", "baik", "pula",
  "dilakukan", "diperoleh", "didapat", "ditemukan", "terlihat",
  "menunjukkan", "memperlihatkan", "menyatakan", "menjelaskan",
  "diperlukan", "digunakan", "dibutuhkan", "diharapkan",
  "modul", "praktikum", "latihan", "tugas", "jawaban", "pembahasan",
  "rumus", "formula", "persamaan", "metode", "analisis", "uji",
  "hipotesis", "nol", "alternatif", "tolak", "terima",
  "derajat", "bebas", "kebebasan", "distribusi", "normal",
  "rata", "ragam", "simpangan", "koefisien", "korelasi", "regresi",
  "variabel", "dependen", "independen", "residu", "prediksi",
  // English
  "the", "and", "or", "for", "with", "from", "to", "in", "of", "a", "an",
  "is", "are", "was", "were", "this", "that", "these", "those", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "must", "can", "than",
  "then", "so", "such", "no", "not", "only", "own", "same", "other",
  "into", "through", "during", "before", "after", "above", "below",
  "about", "above", "across", "after", "against", "along", "among",
  "around", "at", "before", "behind", "below", "beneath", "beside",
  "between", "beyond", "by", "down", "during", "except", "for", "from",
  "in", "inside", "into", "like", "near", "of", "off", "on", "out",
  "outside", "over", "past", "since", "through", "throughout", "to",
  "toward", "under", "underneath", "until", "up", "upon", "with",
  "within", "without",
]);

// Phase 1 Fix #2 — threshold. A line is narrative if > 40% of its words are prose.
export const PROSE_RATIO_THRESHOLD = 0.4;

// R console output prefixes.
const R_OUTPUT_PREFIXES = ["## ", "##\t", "[1] ", "[2] ", "[3] ", "[4] ",
  "[5] ", "[6] ", "[7] ", "[8] ", "[9] ", "[10] ", "[11] ", "[12] "];

export function isROutput(line: string): boolean {
  const t = line.trimStart();
  if (t.startsWith("## ") || t.startsWith("##\t")) return true;
  // [1] ... [12] ...
  if (/^\[\d+\]\s/.test(t)) return true;
  return false;
}

// Tokenise a line into lowercase word-ish tokens (letters/digits).
function tokenize(line: string): string[] {
  const m = line.toLowerCase().match(/[a-zà-ÿ]+/g);
  return m ? m : [];
}

// Returns prose word ratio in [0,1].
export function proseRatio(line: string): number {
  const tokens = tokenize(line);
  if (tokens.length === 0) return 0;
  let prose = 0;
  for (const t of tokens) if (PROSE_WORDS.has(t)) prose++;
  return prose / tokens.length;
}

// Is the line a code-region boundary marker? (e.g. "# Kasus 1", "Kode Penyelesaian:")
// These should NOT be merged across — each marker begins a new logical block.
export const CODE_START_PATTERNS: RegExp[] = [
  /Kode\s+Penyelesaian\s*:?/i,
  /Kode\s+penyelesaian\s*:?/i,
  /Kode\s+penyelesaiain\s*:?/i, // typo in original module
  /Kode\s*:/i,
  /#\s*Kasus\s+\d/i,
  /#\s*Kasus\s*:/i,
  /#\s*Soal\s+\d/i,
  /#\s*Contoh\s+\d/i,
  /#\s*Latihan\s+\d/i, // additional: "Latihan N"
  /#\s*Praktikum\s+\d/i, // additional: "Praktikum N"
  /#\s*Tugas\s+\d/i, // additional: "Tugas N"
  /Solusi\s*:/i, // additional: "Solusi:"
  /Jawaban\s*:/i, // additional: "Jawaban:"
  /Script\s*:/i, // additional: "Script:"
  /Syntax\s*:/i, // additional: "Syntax:"
  // Without leading # — common in PDF-extracted text where the # was lost
  // or the module uses plain "Kasus N:" headers.
  /^\s*Kasus\s+\d/i,
  /^\s*Soal\s+\d/i,
  /^\s*Contoh\s+\d/i,
  /^\s*Latihan\s+\d/i,
  /^\s*Praktikum\s+\d/i,
  /^\s*Tugas\s+\d/i,
];

export const CODE_END_PATTERNS: RegExp[] = [
  /Output\s+yang\s+dihasilkan\s*:?/i,
  /Interpretasi\s+Hasil\s*:?/i,
  /Interpretasi\s*:?/i,
  /Penugasan\s*:?/i,
  /Kode\s+Penyelesaian\s*:?/i,
  /Kode\s+penyelesaian\s*:?/i,
  /#\s*Kasus\s+\d/i,
  /#\s*Soal\s+\d/i,
  /#\s*Contoh\s+\d/i,
  /#\s*Latihan\s+\d/i,
  /#\s*Praktikum\s+\d/i,
  /#\s*Tugas\s+\d/i,
  /Solusi\s*:/i,
  /Jawaban\s*:/i,
  /^##\s/,
  /Hasil\s+Output\s*:?/i,
  /Penjelasan\s*:?/i,
  /Analisis\s*:?/i,
  /Kesimpulan\s*:?/i,
];

export function isStartMarker(line: string): boolean {
  for (const p of CODE_START_PATTERNS) if (p.test(line)) return true;
  // "Contoh N:" without leading #
  if (/^\s*Contoh\s+\d\s*:/i.test(line)) return true;
  return false;
}

export function isEndMarker(line: string): boolean {
  for (const p of CODE_END_PATTERNS) if (p.test(line)) return true;
  return false;
}

// Phase 1 Fix #2 — strict prose check. A line is narrative if its prose word
// ratio exceeds the threshold AND it doesn't carry strong R/code signals.
export function isNarrativeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const ratio = proseRatio(t);
  if (ratio > PROSE_RATIO_THRESHOLD) {
    // Override back to code if the line has >= 1 strong R signal.
    // Even a single signal like `summary(` or `library(` is enough to
    // identify the line as code — don't let prose ratio override it.
    for (const p of R_SIGNALS) {
      if (p.test(t)) return false;
    }
    return true;
  }
  return false;
}

export function isCodeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // R output is never code.
  if (isROutput(t)) return false;
  // Narrative lines (prose-heavy) are never code — Phase 1 Fix #2.
  if (isNarrativeLine(t)) return false;

  // R signals
  for (const p of R_SIGNALS) {
    if (p.test(t)) return true;
  }
  // assignment patterns
  if (/\w+\s*<-\s/.test(t)) return true;
  if (/\w+\s*<-\s*$/.test(t)) return true; // dangling assignment (multi-line)
  if (/\w+\s*=\s*c\s*\(/.test(t)) return true;
  if (/\w+\s*=\s*\d/.test(t) && !/^\s*(if|while|for)\s/.test(t)) return true;
  // String assignment: var = "..." or var = '...' (R/Python/JS)
  if (/^\w+\s*=\s*["']/.test(t)) return true;
  // Multi-line string continuation (indented continuation of a string)
  if (/^\s+["']/.test(t) && line.length > line.trimStart().length) return true;
  // R function call with $ accessor: data$column
  if (/\$\w+/.test(t) && /[()]/.test(t)) return true;
  // Continuation lines (indented, ending with comma/operator) — these are
  // part of a multi-line function call.
  if (/^\s+\w+\s*=/.test(t) && /[,)]\s*$/.test(t)) return true;
  if (/^\s+["'].*["']/.test(t)) return true; // indented string content

  // Python signals
  if (/^\s*(import|from)\s+\w/.test(t)) return true;
  if (/^\s*def\s+\w+\s*\(/.test(t)) return true;
  if (/^\s*class\s+\w+/.test(t)) return true;
  if (/^\s*if\s+__name__/.test(t)) return true;
  if (/^\s*(print|return|raise|break|continue|pass)\s*[\(\s]/.test(t)) return true;
  if (/^\s*return\s/.test(t)) return true; // `return -1` or `return value`
  if (/^\s*(if|elif|while|for|else)\s.*:\s*$/.test(t)) return true; // control flow with colon
  if (/^\s*else\s*:/.test(t)) return true;
  if (/^\s*elif\s+/.test(t)) return true;
  if (/^\s*#\s/.test(t)) return true; // Python/R comment
  // Indented continuation (Python block body) — starts with 4+ spaces and has code tokens
  if (/^\s{4,}\w+/.test(t) && /[()=<>+\-*/]/.test(t) && !t.endsWith(".") && !t.endsWith(":")) {
    if (proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  }
  // `if condition:` pattern (with or without trailing colon)
  if (/^\s*if\s+\w+.*[<>=!]/.test(t) && !t.endsWith(".")) return true;
  // `while condition:` pattern
  if (/^\s*while\s+.+[:<>=!]/.test(t)) return true;
  // Variable assignment with comparison: `low = mid + 1`, `high = mid - 1`
  if (/^\s*\w+\s*=\s*\w+.*[+\-*/]/.test(t)) return true;
  // Variable assignment with expression: `mid = (low + high) // 2`
  if (/^\s*\w+\s*=\s*[\(\d]/.test(t) && /[+\-*/]/.test(t)) return true;
  // Floor division operator (Python): `//`
  if (/\w+\s*\/\//.test(t)) return true;
  // Array access: `arr[mid]`
  if (/^\s*\w+\[\w+\]/.test(t)) return true;

  // SQL signals — case-insensitive
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|UNION)\b/i.test(t)) return true;

  // General code patterns
  // Semicolons at end (common in SQL, C, Java)
  if (/;\s*$/.test(t) && !/[.!?]$/.test(t)) return true;
  // Function call, but ensure not ending with : or . (likely narrative)
  if (/\b\w+\s*\([^)]*\)/.test(t) && !t.endsWith(":") && !t.endsWith(".")) {
    // Re-check prose ratio defensively.
    if (proseRatio(t) <= PROSE_RATIO_THRESHOLD) return true;
  }
  return false;
}

// Score a line 0..N — higher means more code-like. Used by the heuristic
// fallback (for TXT / DOCX-derived text) when no markers are present.
export function scoreLine(line: string): number {
  const t = line.trim();
  if (!t) return 0;
  let score = 0;

  // R keywords
  if (/\b(library|require|data\.frame|read\.csv|read\.table|read\.xlsx|summary|lm|glm|aov|cor\.test|chisq\.test|t\.test|ggplot|plot|abline|hist|boxplot|qt|qnorm|qf|qchisq|pt|pnorm|sample|set\.seed|c\s*\(|seq|rep|head|tail|str|names|colnames|rownames|mean|median|sd|var|sqrt|abs|round|cbind|rbind|merge|subset|transform|cat|paste|paste0|sprintf|def|class|import|from|return|function|var|let|const|public|private|static|void|int|float|print|echo|SELECT|FROM|WHERE)\b/.test(t)) {
    score += 3;
  }
  if (/\w+\s*<-/.test(t)) score += 3;
  if (/(<-|->|%>%|:=)/.test(t)) score += 2;
  if (/\b\w+\s*\(/.test(t)) score += 1;
  if (/^\s*#/.test(t)) score += 1;
  if (/[(){}\[\];=<>+\-*/\\&|!?:,'".]/.test(t)) score += 1;
  if (/["'].*["']/.test(t)) score += 1;

  // Prose penalty
  const proseWords = t.toLowerCase().match(/\b(?:dan|atau|yang|untuk|pada|dengan|dari|ke|di|ini|itu|adalah|akan|sebuah|seorang|mahasiswa|rata|selisih|proporsi|signifikan|berbeda|menggunakan|menghitung|the|and|or|for|with|from|to|in|of|a|an|is|are|was|were)\b/g);
  if (proseWords && proseWords.length >= 2) score -= 2;

  return score;
}
