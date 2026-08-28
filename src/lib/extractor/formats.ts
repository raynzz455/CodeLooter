// CodeLooter — Format-specific extractors
// Markdown (fenced), IPYNB, HTML, LaTeX, plain-text heuristic.

import type { RawBlock } from "./types";
import { detectLanguage } from "./langdetect";
import { isROutput } from "./line-classify";
import { extractViaDensity } from "./pattern-extract";

// ─── Markdown fenced code blocks ───
const FENCED_RE = /```(\w*)\n?([\s\S]*?)```|~~~(\w*)\n?([\s\S]*?)~~~/g;

export function extractMarkdown(text: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  let m: RegExpExecArray | null;
  FENCED_RE.lastIndex = 0;
  while ((m = FENCED_RE.exec(text)) !== null) {
    const hint = (m[1] || m[3] || "").toLowerCase().trim();
    let code = (m[2] || m[4] || "").trim();
    if (code.length < 10) continue;

    // Phase 1 Fix #4: Strip R console output lines (## ..., [1] ...) from
    // fenced code blocks. In academic modules, R output is often included
    // inside fenced blocks alongside the code — it should not be part of
    // the extracted code block.
    const codeLines = code.split("\n").filter((l) => !isROutput(l));
    code = codeLines.join("\n").trim();
    if (code.length < 10) continue;

    // Phase 1 Fix #3 (light): collapse runs of whitespace that were left
    // behind by removed R-output lines into a single blank line.
    code = code.replace(/\n{3,}/g, "\n\n").trim();

    blocks.push({
      code,
      lang: hint || detectLanguage(code),
      lines: code.split("\n").length,
      source: "fenced",
      page: 1,
    });
  }
  return blocks;
}

// ─── Jupyter Notebook (.ipynb) ───
export function extractIpynb(text: string): RawBlock[] {
  let nb: any;
  try {
    nb = JSON.parse(text);
  } catch {
    return [];
  }
  const blocks: RawBlock[] = [];
  for (const cell of nb?.cells || []) {
    if (cell?.cell_type !== "code") continue;
    let src = cell.source ?? "";
    if (Array.isArray(src)) src = src.join("");
    const code = String(src).trim();
    if (code.length < 10) continue;
    blocks.push({
      code,
      lang: detectLanguage(code) === "unknown" ? "python" : detectLanguage(code),
      lines: code.split("\n").length,
      source: "ipynb",
      page: 1,
    });
  }
  return blocks;
}

// ─── HTML <pre><code> extraction ───
const PRE_CODE_RE = /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;
const CODE_CLASS_RE = /<code[^>]*class=["']language-(\w+)["'][^>]*>([\s\S]*?)<\/code>/gi;

function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractHtml(text: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  let m: RegExpExecArray | null;
  CODE_CLASS_RE.lastIndex = 0;
  while ((m = CODE_CLASS_RE.exec(text)) !== null) {
    const hint = m[1].toLowerCase();
    const code = unescapeHtml(m[2]).trim();
    if (code.length < 10) continue;
    blocks.push({
      code, lang: hint || detectLanguage(code),
      lines: code.split("\n").length, source: "html", page: 1,
    });
  }
  PRE_CODE_RE.lastIndex = 0;
  while ((m = PRE_CODE_RE.exec(text)) !== null) {
    const code = unescapeHtml(m[1]).trim();
    if (code.length < 10) continue;
    blocks.push({
      code, lang: detectLanguage(code),
      lines: code.split("\n").length, source: "html", page: 1,
    });
  }
  return blocks;
}

// ─── LaTeX lstlisting / verbatim / minted ───
export function extractLatex(text: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  const lst = /\\begin\{lstlisting\}(?:\[language=([^\]]+)\])?([\s\S]*?)\\end\{lstlisting\}/g;
  let m: RegExpExecArray | null;
  while ((m = lst.exec(text)) !== null) {
    const hint = (m[1] || "").toLowerCase().trim();
    const code = (m[2] || "").trim();
    if (code.length < 10) continue;
    blocks.push({
      code, lang: hint || detectLanguage(code),
      lines: code.split("\n").length, source: "latex", page: 1,
    });
  }
  const verb = /\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g;
  while ((m = verb.exec(text)) !== null) {
    const code = (m[1] || "").trim();
    if (code.length < 10) continue;
    blocks.push({
      code, lang: detectLanguage(code),
      lines: code.split("\n").length, source: "latex", page: 1,
    });
  }
  const mint = /\\begin\{minted\}(?:\{?\s*(\w+)\s*\}?)?([\s\S]*?)\\end\{minted\}/g;
  while ((m = mint.exec(text)) !== null) {
    const hint = (m[1] || "").toLowerCase().trim();
    const code = (m[2] || "").trim();
    if (code.length < 10) continue;
    blocks.push({
      code, lang: hint || detectLanguage(code),
      lines: code.split("\n").length, source: "latex", page: 1,
    });
  }
  return blocks;
}

// ─── Plain text / .txt heuristic (delegates to density extractor) ───
export function extractTxt(text: string): RawBlock[] {
  return extractViaDensity(text).blocks;
}
