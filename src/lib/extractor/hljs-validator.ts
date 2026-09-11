// CodeLooter — Multi-layer code validation using highlight.js
//
// highlight.js is a syntax highlighter with built-in language auto-detection.
// It assigns a "relevance" score to each text snippet — higher = more likely
// to be valid code in some language.
//
// We use it as a SCREENING LAYER:
// 1. Pattern matching extracts candidate code blocks (fast, regex)
// 2. highlight.js validates each block — is it really code? (syntax-aware)
// 3. If relevance >= threshold → keep as code. If < threshold → likely narrative.
//
// This catches false positives (narrative that looks like code) and false
// negatives (code that doesn't match regex but IS valid syntax).
//
// Size: highlight.js ~9MB (npm), zero dependencies, pure JavaScript.
// Fits Render free tier (512MB) and Vercel free tier (1024MB).

import hljs from "highlight.js";

// Relevance threshold for multi-line blocks.
// From testing: real code blocks score 8-30+, narrative scores 0-5.
// We use 6 as threshold — narrative rarely exceeds 5, code rarely below 8.
const BLOCK_RELEVANCE_THRESHOLD = 6;

// For single lines, highlight.js is unreliable (too many false positives).
// We use a HIGHER threshold and additional filters to reduce false positives.
const LINE_RELEVANCE_THRESHOLD = 5;

// Lines starting with these patterns are NOT code, even if hljs thinks so.
const NARRATIVE_PATTERNS = [
  /^\s*-\s/,              // bullet points: "- Author (Year). Title"
  /^\s*\d+\.\s/,          // numbered lists: "1. Lakukan analisis"
  /^\s*Referensi\s*:/i,   // "Referensi:"
  /^\s*Penugasan\s*:/i,   // "Penugasan:"
  /^\s*Interpretasi\s*:/i,// "Interpretasi:"
  /^\s*Interpretasi\s+Hasil/i, // "Interpretasi Hasil"
  /^\s*Output\s+yang\s+dihasilkan/i,
  /^\s*Output\s+yang\s+dihasilkan\s*:/i,
  /^\s*Penjelasan\s*:/i,
  /^\s*Analisis\s*:/i,
  /^\s*Kesimpulan\s*:/i,
  /^\s*Kasus\s+\d/i,      // "Kasus 1:" header
  /^\s*Contoh\s+\d/i,    // "Contoh 1:" header
  /^\s*Latihan\s+\d/i,    // "Latihan 1:" header
  /^\s*Kode\s+[Pp]enyelesaian/i, // "Kode Penyelesaian:"
  /^\s*Kode\s+penyelesaiain/i,    // typo variant
  /^\s*Kode\s*:/i,
  // Narrative with statistical terms (false positive prone)
  /menunjukkan\s+bahwa/i,  // "menunjukkan bahwa..."
  /karena\s+p.?value/i,   // "karena p-value..."
  /diterima/i,             // "H0 diterima"
  /ditolak/i,              // "H0 ditolak"
  /Artinya/i,              // "Artinya, ..."
  /R.?squared/i,           // "R-squared = 0.667"
  /Adjusted/i,             // "Adjusted R-squared"
  /signifikan/i,           // "signifikan secara statistik"
  /koefisien/i,            // "koefisien..."
  /variabel/i,             // "variabel..."
  /peubah/i,               // "peubah..."
  /hipotesis/i,            // "hipotesis..."
  /taraf/i,                // "taraf nyata 5%"
  /sampel/i,               // "sampel data..."
  /penelitian/i,           // "penelitian..."
  /mahasiswa/i,            // "mahasiswa..."
  /dosen/i,                // "dosen..."
  /university/i,
  /hubungan\s+asosiasi/i, // "hubungan asosiasi"
];

export interface ValidationResult {
  isCode: boolean;
  relevance: number;
  language: string | null;
  secondBestLanguage: string | null;
  secondBestRelevance: number;
}

// Validate whether a text block is code or narrative using syntax highlighting.
// Works best with multi-line blocks (more context = better detection).
export function validateCodeBlock(code: string): ValidationResult {
  const result = hljs.highlightAuto(code);
  const relevance = result.relevance || 0;
  const language = result.language || null;
  const secondBestLanguage = result.secondBest?.language || null;
  const secondBestRelevance = result.secondBest?.relevance || 0;

  // Use higher threshold for blocks (more context available)
  const threshold = code.split("\n").length > 3
    ? BLOCK_RELEVANCE_THRESHOLD
    : LINE_RELEVANCE_THRESHOLD;

  return {
    isCode: relevance >= threshold,
    relevance,
    language,
    secondBestLanguage,
    secondBestRelevance,
  };
}

// Validate a single line — useful for ambiguous lines that pattern matching
// couldn't classify. Returns relevance score.
export function validateLine(line: string): ValidationResult {
  const t = line.trim();

  // Pre-filter: narrative patterns are never code, regardless of hljs score.
  for (const pattern of NARRATIVE_PATTERNS) {
    if (pattern.test(t)) {
      return {
        isCode: false,
        relevance: 0,
        language: null,
        secondBestLanguage: null,
        secondBestRelevance: 0,
      };
    }
  }

  const result = hljs.highlightAuto(line);
  return {
    isCode: (result.relevance || 0) >= LINE_RELEVANCE_THRESHOLD,
    relevance: result.relevance || 0,
    language: result.language || null,
    secondBestLanguage: result.secondBest?.language || null,
    secondBestRelevance: result.secondBest?.relevance || 0,
  };
}

// Get the detected language for a code block.
// Returns null if highlight.js can't determine the language.
export function detectLanguageHLJS(code: string): string | null {
  const result = hljs.highlightAuto(code);
  return result.language || null;
}
