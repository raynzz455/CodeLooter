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
  /\bqt\s*\(/,
  /\bpt\s*\(/,
  /\bpnorm\s*\(/,
  /\bpf\s*\(/,
  /\bdnorm\s*\(/,
  /\bdchisq\s*\(/,
  /\bdt\s*\(/,
  /\bsummary\s*\(/,
  /\blm\s*\(/,
  /\bglm\s*\(/,
  /\baov\s*\(/,
  /\bcor\.test\s*\(/,
  /\bchisq\.test\s*\(/,
  /\bt\.test\s*\(/,
  /\bwilcox\.test\s*\(/,
  /\bmann\.whitney\s*\(/,
  /\bkruskal\.test\s*\(/,
  /\bshapiro\.test\s*\(/,
  /\bdata\.frame\s*\(/,
  /\bread\.csv\s*\(/,
  /\bread\.table\s*\(/,
  /\bread\.xlsx\s*\(/,
  /\bread\.delim\s*\(/,
  /\bset\.seed\s*\(/,
  /\bsample\s*\(/,
  /\bggplot\s*\(/,
  /\baes\s*\(/,
  /\bgeom_\w+\s*\(/,
  /\bfacet_\w+\s*\(/,
  /\btheme_\w+\s*\(/,
  /%>%/,
  /%[+\*]%/,
  /\b\w+\$\w+/, // data$column
  /\bprint\s*\(/,
  /\bmean\s*\(/,
  /\bmedian\s*\(/,
  /\bsd\s*\(/,
  /\bvar\s*\(/,
  /\bsqrt\s*\(/,
  /\babs\s*\(/,
  /\bround\s*\(/,
  /\bfloor\s*\(/,
  /\bceiling\s*\(/,
  /\bcbind\s*\(/,
  /\brbind\s*\(/,
  /\bhead\s*\(/,
  /\btail\s*\(/,
  /\bstr\s*\(/,
  /\bglimpse\s*\(/,
  /\bseq\s*\(/,
  /\brep\s*\(/,
  /\bc\s*\(/,
  /\bas\.matrix\s*\(/,
  /\bas\.data\.frame\s*\(/,
  /\bas\.numeric\s*\(/,
  /\bas\.character\s*\(/,
  /\btextConnection\s*\(/,
  /\bwrite\.csv\s*\(/,
  /\bwrite\.table\s*\(/,
  /\btable\s*\(/,
  /\bprop\.table\s*\(/,
  /\bmargin\.table\s*\(/,
  /\baddmargins\s*\(/,
  /\bfactor\s*\(/,
  /\blevels\s*\(/,
  /\bnames\s*\(/,
  /\bcolnames\s*\(/,
  /\brownames\s*\(/,
  /\bnrow\s*\(/,
  /\bncol\s*\(/,
  /\bdim\s*\(/,
  /\blength\s*\(/,
  /\bsort\s*\(/,
  /\border\s*\(/,
  /\bunique\s*\(/,
  /\bduplicated\s*\(/,
  /\bsubset\s*\(/,
  /\bfilter\s*\(/,
  /\bmutate\s*\(/,
  /\bselect\s*\(/,
  /\bgroup_by\s*\(/,
  /\bsummarise\s*\(/,
  /\bsummarize\s*\(/,
  /\barrange\s*\(/,
  /\bpaste\s*\(/,
  /\bpaste0\s*\(/,
  /\bsprintf\s*\(/,
  /\bnchar\s*\(/,
  /\btolower\s*\(/,
  /\btoupper\s*\(/,
  /\bsubstr\s*\(/,
  /\bgsub\s*\(/,
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
