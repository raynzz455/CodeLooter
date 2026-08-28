// CodeLooter — Extractor entrypoint
// Dispatches to the right format-specific extractor based on file extension,
// applies the user's language override, and returns the final result.
//
// Enhancement: After pattern extraction, an optional NLP pass uses a
// HuggingFace transformers.js model (all-MiniLM-L6-v2, ~22MB ONNX) to
// re-classify lines that the pattern matcher was unsure about. This catches
// code blocks that don't match any known regex pattern (e.g., unusual
// variable names, non-English code comments, multi-line continuations).

import type { CodeBlock, ExtractResult, ExtractStats, RawBlock } from "./types";
import { EXTRACTOR_VERSION } from "./types";
import { extractCodeBlocksFromText, type PatternExtractStats } from "./pattern-extract";
import {
  extractMarkdown, extractIpynb, extractHtml, extractLatex, extractTxt,
} from "./formats";
import { extractFromPdfBuffer } from "./pdf";
import { getCache, setCache } from "./cache";
import { classifyLinesNLP, isNLPAvailable } from "./nlp-classifier";
import { isCodeLine, isROutput } from "./line-classify";
import { detectLanguage } from "./langdetect";

export const ALL_SUPPORTED_EXTS = new Set([
  "pdf", "md", "markdown", "ipynb", "html", "htm",
  "txt", "tex", "latex", "sty", "cls",
]);

interface ExtractOptions {
  filename: string;
  content: Buffer;
  lang: string; // "auto" or a forced language
  useNLP?: boolean; // Enable NLP-based re-classification (default: false)
}

export async function extractFromFile(opts: ExtractOptions): Promise<ExtractResult> {
  const { filename, content, lang, useNLP } = opts;
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const start = Date.now();

  // Cache check — keyed on content hash + extractor version.
  const cached = getCache(content);
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
  } else if (ext === "md" || ext === "markdown") {
    rawText = content.toString("utf-8");
    rawBlocks = extractMarkdown(rawText);
    method = "markdown-fenced";
    // If no fenced blocks found, fall back to pattern extraction on the whole text.
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
    // Unsupported — return empty.
    rawBlocks = [];
    method = "unsupported";
  }

  // ── NLP Enhancement Pass ──
  // If NLP is enabled and the model is available, scan for code lines that
  // the pattern matcher missed. This catches lines that look like code to
  // a human but don't match any regex (e.g., unusual syntax, non-English
  // comments, continuation lines without clear signals).
  if (useNLP && pages === 0 || (useNLP && ext === "pdf")) {
    try {
      const nlpAvailable = await isNLPAvailable();
      if (nlpAvailable) {
        method = method.includes("+nlp") ? method : `${method}+nlp`;

        // Get the raw text for NLP analysis.
        if (ext === "pdf") {
          const { extractPdfTextPureTs } = await import("./pdf-pure");
          const pdfResult = extractPdfTextPureTs(content);
          rawText = pdfResult.text;
        } else if (!rawText) {
          rawText = content.toString("utf-8");
        }

        // Find lines that the pattern matcher classified as non-code but
        // that might actually be code (have some code-like tokens).
        const lines = rawText.split(/\r?\n/);
        const ambiguous: { index: number; line: string }[] = [];
        const alreadyCaptured = new Set<string>();
        for (const b of rawBlocks) {
          for (const l of b.code.split("\n")) alreadyCaptured.add(l.trim());
        }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.length < 5) continue;
          if (alreadyCaptured.has(line)) continue;
          if (isROutput(line)) continue;
          if (isCodeLine(line)) continue; // Already classified as code
          // Only send ambiguous lines to NLP (those with some code-like tokens)
          if (/[()=<>{}]/.test(line) && !line.endsWith(".") && !line.endsWith(":")) {
            ambiguous.push({ index: i, line });
          }
        }

        // Limit to 50 ambiguous lines to keep inference fast.
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
                    source: "nlp",
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
                  source: "nlp",
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
      console.error("[extractFromFile] NLP pass failed:", err);
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

  // Apply language override.
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

  setCache(content, result);
  return result;
}
