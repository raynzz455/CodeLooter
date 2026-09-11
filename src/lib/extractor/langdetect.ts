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

  // R-specific function patterns (even without <-)
  if (/\b(hist|boxplot|qqnorm|qqline|par\s*\(|cat\s*\(|plot\s*\(|abline\s*\()/.test(code)) return "r";
  if (/\b(c\s*\(|mean\s*\(|median\s*\(|sd\s*\(|var\s*\(|table\s*\()/.test(code) && !/\bdef\s+/.test(code)) return "r";

  if (pyHits >= 2) return "python";
  if (sqlHits >= 2) return "sql";

  if (/<-/.test(code)) return "r";
  // Fallback: if there are R signals even just 1, assume R
  if (rHits >= 1) return "r";
  return "unknown";
}

// List of supported languages for the UI selector.
// IMPORTANT: "auto" is intentionally REMOVED — the user MUST choose a
// programming language before extraction. This is by design: forcing the
// language selection eliminates misclassification and ensures every block
// in the output uses the correct language. The left panel language selector
// acts as a force-override: ALL extracted blocks will use this language.
export const SUPPORTED_LANGS: { value: string; label: string; emoji: string }[] = [
  { value: "r", label: "R", emoji: "📊" },
  { value: "python", label: "Python", emoji: "🐍" },
  { value: "sql", label: "SQL", emoji: "🗃️" },
  { value: "java", label: "Java", emoji: "☕" },
  { value: "cpp", label: "C++", emoji: "⚙️" },
  { value: "javascript", label: "JavaScript", emoji: "⚡" },
  { value: "typescript", label: "TypeScript", emoji: "🔷" },
  { value: "php", label: "PHP", emoji: "🐘" },
  { value: "kotlin", label: "Kotlin", emoji: "🟣" },
  { value: "go", label: "Go", emoji: "🐹" },
  { value: "rust", label: "Rust", emoji: "🦀" },
  { value: "bash", label: "Bash", emoji: "🖥️" },
  { value: "html", label: "HTML", emoji: "🌐" },
  { value: "css", label: "CSS", emoji: "🎨" },
  { value: "json", label: "JSON", emoji: "📋" },
];
