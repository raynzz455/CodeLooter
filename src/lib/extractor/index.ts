// CodeLooter — Extractor entrypoint
// Dispatches to the right format-specific extractor based on file extension,
// applies the user's language override, and returns the final result.
//
// Two-pass extraction:
// 1. Pattern matching (regex) — fast, catches ~80% of code
// 2. NLP enhancement (ONNX model) — catches ambiguous lines that regex missed
//
// The NLP model (all-MiniLM-L6-v2, ~22MB ONNX) runs via ONNX Runtime
// (NOT PyTorch). Total footprint: ~89MB — fits Render free tier (512MB).
// Runs ONLY on server (SSR side). Browser (CSR) never loads the model.

import type { CodeBlock, ExtractResult, ExtractStats, RawBlock } from "./types";
import { EXTRACTOR_VERSION } from "./types";
import { extractCodeBlocksFromText, type PatternExtractStats } from "./pattern-extract";
import {
  extractMarkdown, extractIpynb, extractHtml, extractLatex, extractTxt,
} from "./formats";
import { extractFromPdfBuffer } from "./pdf";
import { extractFromDocxBuffer } from "./docx";
import { getCache, setCache } from "./cache";
import { classifyLinesNLP, isNLPAvailable } from "./nlp-classifier";
import { isCodeLine, isROutput } from "./line-classify";
import { detectLanguage } from "./langdetect";

export const ALL_SUPPORTED_EXTS = new Set([
  "pdf", "docx", "md", "markdown", "ipynb", "html", "htm",
  "txt", "tex", "latex", "sty", "cls",
]);

interface ExtractOptions {
  filename: string;
  content: Buffer;
  lang: string; // forced language (no auto-detect — user must choose)
  useNLP?: boolean; // Enable NLP enhancement (ONNX model, default: false)
}

export async function extractFromFile(opts: ExtractOptions): Promise<ExtractResult> {
  const { filename, content, lang, useNLP } = opts;
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

  // ── NLP Enhancement Pass (ONNX Runtime, NOT PyTorch) ──
  // Only runs if useNLP=true. Scans for code lines that pattern matching
  // missed (ambiguous syntax, non-standard patterns). The ONNX model
  // (~22MB) runs on server via ONNX Runtime (~67MB binary). Total ~89MB.
  // Fits Render free tier (512MB) and Vercel free tier (1024MB).
  if (useNLP) {
    try {
      const nlpAvailable = await isNLPAvailable();
      if (nlpAvailable) {
        method = `${method}+nlp`;

        // Get raw text for NLP analysis.
        if (!rawText) {
          if (ext === "pdf") {
            const { extractPdfTextPureTs } = await import("./pdf-pure");
            rawText = extractPdfTextPureTs(content).text;
          } else if (ext === "docx") {
            // For DOCX, we already have the text from mammoth extraction
            // but didn't store it. Re-extract is cheap.
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({ buffer: content });
            rawText = result.value ?? "";
          } else {
            rawText = content.toString("utf-8");
          }
        }

        const lines = rawText.split(/\r?\n/);
        const alreadyCaptured = new Set<string>();
        for (const b of rawBlocks) {
          for (const l of b.code.split("\n")) alreadyCaptured.add(l.trim());
        }

        // Find ambiguous lines: not captured, not R-output, not already code,
        // but has some code-like tokens.
        const ambiguous: { index: number; line: string }[] = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.length < 5) continue;
          if (alreadyCaptured.has(line)) continue;
          if (isROutput(line)) continue;
          if (isCodeLine(line)) continue;
          if (/[()=<>{}]/.test(line) && !line.endsWith(".") && !line.endsWith(":")) {
            ambiguous.push({ index: i, line });
          }
        }

        // Limit to 50 ambiguous lines for performance.
        const sample = ambiguous.slice(0, 50);
        if (sample.length > 0) {
          const nlpResults = await classifyLinesNLP(sample.map((s) => s.line));
          const nlpCodeLines: string[] = [];
          for (let i = 0; i < sample.length; i++) {
            const result = nlpResults[i];
            if (result && result.isCode && result.confidence > 0.55) {
              nlpCodeLines.push(sample[i].line);
            }
          }

          // Group consecutive NLP-detected code lines into blocks.
          if (nlpCodeLines.length > 0) {
            const nlpBlocks: RawBlock[] = [];
            let current: string[] = [];
            for (const line of nlpCodeLines) {
              current.push(line);
              if (current.length >= 2) {
                const code = current.join("\n").trim();
                if (code.length >= 10 && !rawBlocks.some((b) => b.code.includes(code))) {
                  nlpBlocks.push({
                    code,
                    lang: detectLanguage(code),
                    lines: code.split("\n").length,
                    source: "nlp-onnx",
                    page: 1,
                  });
                }
                current = [];
              }
            }
            if (current.length >= 1) {
              const code = current.join("\n").trim();
              if (code.length >= 5 && !rawBlocks.some((b) => b.code.includes(code))) {
                nlpBlocks.push({
                  code,
                  lang: detectLanguage(code),
                  lines: code.split("\n").length,
                  source: "nlp-onnx",
                  page: 1,
                });
              }
            }
            rawBlocks.push(...nlpBlocks);
            stats.filteredNarasi += nlpCodeLines.length;
          }
        }
      }
    } catch (err) {
      console.error("[extractFromFile] NLP pass failed (falling back to pattern only):", err);
    }
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
