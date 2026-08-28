// CodeLooter — Extractor types
// Shared types for the extraction pipeline.

export type CodeLang =
  | "r"
  | "python"
  | "sql"
  | "java"
  | "cpp"
  | "javascript"
  | "typescript"
  | "php"
  | "kotlin"
  | "go"
  | "rust"
  | "bash"
  | "html"
  | "css"
  | "json"
  | "unknown";

export interface RawBlock {
  code: string;
  lang: string;
  lines: number;
  source: string; // "pattern" | "pattern-split" | "scan-fallback" | "density" | "fenced" | "html" | "ipynb" | "latex" | "heuristic"
  page?: number;
}

export interface CodeBlock {
  index: number;
  lang: string;
  code: string;
  lines: number;
  source: string;
}

export interface ExtractStats {
  extractorVersion: string;
  method: string;
  rawBlocks: number;
  mergedBlocks: number;
  strippedROutput: number;
  repairedWraps: number;
  filteredNarasi: number;
  durationMs: number;
  // Lines that were classified as narrative or R-output during extraction.
  // Used by the before/after comparison view to show what was removed.
  removedLines: string[];
}

export interface ExtractResult {
  blocks: CodeBlock[];
  filename: string;
  size: number;
  total: number;
  stats: ExtractStats | null;
  cached?: boolean;
}

// Bumped whenever the extraction algorithm changes — cache entries with a
// stale version are treated as misses (Phase 3 item #10 in the PRD, applied
// proactively here).
export const EXTRACTOR_VERSION = "phase1-v1.2.0";
