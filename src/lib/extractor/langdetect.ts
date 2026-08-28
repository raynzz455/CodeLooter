// CodeLooter — Language detection
// Detects the dominant programming language of a code block.
// Ported from CodeLooter backend/app/pattern_extract.py with refinements.

// R-specific signals — derived from analysis of Indonesian statistics modules.
export const R_SIGNALS: RegExp[] = [
  /<-/,
  /\blibrary\s*\(/,
  /\brequire\s*\(/,
  /\bcat\s*\(/,
  /\bqt\s*\(/,
  /\bqnorm\s*\(/,
  /\bqf\s*\(/,
  /\bqchisq\s*\(/,
  /\bpt\s*\(/,
  /\bpnorm\s*\(/,
  /\bsummary\s*\(/,
  /\blm\s*\(/,
  /\bglm\s*\(/,
  /\baov\s*\(/,
  /\bcor\.test\s*\(/,
  /\bchisq\.test\s*\(/,
  /\bt\.test\s*\(/,
  /\bdata\.frame\s*\(/,
  /\bread\.csv\s*\(/,
  /\bread\.table\s*\(/,
  /\bread\.xlsx\s*\(/,
  /\bset\.seed\s*\(/,
  /\bsample\s*\(/,
  /\bggplot\s*\(/,
  /%>%/,
  /\b\w+\$\w+/, // data$column
  /\bprint\s*\(/,
  /\bmean\s*\(/,
  /\bmedian\s*\(/,
  /\bsd\s*\(/,
  /\bvar\s*\(/,
  /\bsqrt\s*\(/,
  /\bcbind\s*\(/,
  /\brbind\s*\(/,
  /\bhead\s*\(/,
  /\bstr\s*\(/,
  /\bseq\s*\(/,
  /\brep\s*\(/,
  /\bc\s*\(/,
  /\bas\.matrix\s*\(/,
  /\btextConnection\s*\(/,
];

const PYTHON_SIGNALS: RegExp[] = [
  /\bdef\s+\w+\s*\(/,
  /\bimport\s+\w+/,
  /\bfrom\s+\w+\s+import/,
  /\bprint\s*\(/,
  /\bif\s+__name__/,
  /\bself\b/,
  /\bnp\./,
  /\bpd\./,
  /\bplt\./,
];

const SQL_SIGNALS: RegExp[] = [
  /\bSELECT\b/i,
  /\bFROM\b/i,
  /\bWHERE\b/i,
  /\bJOIN\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bCREATE\s+TABLE\b/i,
];

export function countMatches(code: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) if (p.test(code)) n++;
  return n;
}

export function detectLanguage(code: string): string {
  const rHits = countMatches(code, R_SIGNALS);
  const pyHits = countMatches(code, PYTHON_SIGNALS);
  const sqlHits = countMatches(code, SQL_SIGNALS);

  // R dominates for stats modules.
  if (rHits >= 2) return "r";
  if (/<-/.test(code) && rHits >= 1) return "r";
  if (/\blibrary\s*\(/.test(code)) return "r";

  if (pyHits >= 2) return "python";
  if (sqlHits >= 2) return "sql";

  if (/<-/.test(code)) return "r";
  return "unknown";
}

// List of supported languages for the UI selector.
export const SUPPORTED_LANGS: { value: string; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "r", label: "R" },
  { value: "python", label: "Python" },
  { value: "sql", label: "SQL" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "php", label: "PHP" },
  { value: "kotlin", label: "Kotlin" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "bash", label: "Bash" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
];
