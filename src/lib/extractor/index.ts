// CodeLooter — Extractor entrypoint
// Dispatches to the right format-specific extractor based on file extension,
// applies the user's language override, and returns the final result.
//
// Extraction is 100% pattern-based (regex) — NO LLM, NO PyTorch,
// NO TensorFlow, NO external model. All logic runs locally in Node.js
// with zero additional dependencies. Compatible with Render free tier.

import type { CodeBlock, ExtractResult, ExtractStats, RawBlock } from "./types";
import { EXTRACTOR_VERSION } from "./types";
import { extractCodeBlocksFromText, type PatternExtractStats } from "./pattern-extract";
import {
  extractMarkdown, extractIpynb, extractHtml, extractLatex, extractTxt,
} from "./formats";
import { extractFromPdfBuffer } from "./pdf";
import { extractFromDocxBuffer } from "./docx";
import { getCache, setCache } from "./cache";

export const ALL_SUPPORTED_EXTS = new Set([
  "pdf", "docx", "md", "markdown", "ipynb", "html", "htm",
  "txt", "tex", "latex", "sty", "cls",
]);

interface ExtractOptions {
  filename: string;
  content: Buffer;
  lang: string; // forced language (no auto-detect — user must choose)
}

export async function extractFromFile(opts: ExtractOptions): Promise<ExtractResult> {
  const { filename, content, lang } = opts;
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const start = Date.now();

  // Cache check — keyed on content hash + extractor version + forced language.
  const cached = getCache(content, lang);
  if (cached && cached.blocks.length > 0) {
    return { ...cached, filename, cached: true };
  }

  let rawBlocks: RawBlock[] = [];
  let method = "pattern";
  let stats: PatternExtractStats = {
    rawBlocks: 0, mergedBlocks: 0,
    strippedROutput: 0, repairedWraps: 0, filteredNarasi: 0,
    removedLines: [],
  };
  let pages = 0;
  let rawText = "";

  if (ext === "pdf") {
    const r = await extractFromPdfBuffer(content);
    rawBlocks = r.blocks;
    stats = r.stats;
    pages = r.pages;
    method = pages > 0 ? `pdf-text (${pages}p)` : "pdf-text";
  } else if (ext === "docx") {
    const r = await extractFromDocxBuffer(content);
    rawBlocks = r.blocks;
    stats = r.stats;
    method = "docx-text";
  } else if (ext === "md" || ext === "markdown") {
    rawText = content.toString("utf-8");
    rawBlocks = extractMarkdown(rawText);
    method = "markdown-fenced";
    if (rawBlocks.length === 0) {
      const r = extractCodeBlocksFromText(rawText);
      rawBlocks = r.blocks; stats = r.stats; method = "pattern";
    }
  } else if (ext === "ipynb") {
    rawBlocks = extractIpynb(content.toString("utf-8"));
    method = "ipynb";
  } else if (ext === "html" || ext === "htm") {
    rawBlocks = extractHtml(content.toString("utf-8"));
    method = "html";
  } else if (ext === "tex" || ext === "latex" || ext === "sty" || ext === "cls") {
    rawBlocks = extractLatex(content.toString("utf-8"));
    method = "latex";
  } else if (ext === "txt") {
    rawText = content.toString("utf-8");
    const r = extractCodeBlocksFromText(rawText);
    rawBlocks = r.blocks; stats = r.stats; method = "txt-pattern";
  } else {
    rawBlocks = [];
    method = "unsupported";
  }

  // Build final blocks with index.
  let blocks: CodeBlock[] = rawBlocks.map((b, i) => ({
    index: i,
    lang: b.lang,
    code: b.code,
    lines: b.lines,
    source: b.source,
  }));

  // Apply language override — force ALL blocks to the user-selected language.
  if (lang && lang !== "auto") {
    blocks = blocks.map((b) => ({ ...b, lang }));
  }

  const extractStats: ExtractStats = {
    extractorVersion: EXTRACTOR_VERSION,
    method,
    rawBlocks: stats.rawBlocks,
    mergedBlocks: stats.mergedBlocks,
    strippedROutput: stats.strippedROutput,
    repairedWraps: stats.repairedWraps,
    filteredNarasi: stats.filteredNarasi,
    durationMs: Date.now() - start,
    removedLines: stats.removedLines,
  };

  const result: ExtractResult = {
    blocks,
    filename,
    size: content.length,
    total: blocks.length,
    stats: extractStats,
  };

  setCache(content, result, lang);
  return result;
}
