// CodeLooter — PDF text extraction (pure TypeScript, bundler-safe)
//
// Uses a self-contained TS PDF text extractor (Node built-in `zlib` only) so
// it bundles cleanly under turbopack with no external PDF library. The
// extracted text feeds into the pattern extractor.

import type { RawBlock } from "./types";
import { extractCodeBlocksFromText, type PatternExtractStats } from "./pattern-extract";
import { extractPdfTextPureTs } from "./pdf-pure";

export interface PdfExtractResult {
  blocks: RawBlock[];
  stats: PatternExtractStats;
  pages: number;
}

export async function extractFromPdfBuffer(buf: Buffer): Promise<PdfExtractResult> {
  let text = "";
  let pages = 0;
  try {
    const r = extractPdfTextPureTs(buf);
    text = r.text;
    pages = r.pages;
  } catch (err: any) {
    // Image-based PDFs may yield no text — surface as empty.
    console.error("[extractFromPdfBuffer] pure-TS parse failed:", err?.message ?? err);
    return { blocks: [], stats: emptyStats(), pages: 0 };
  }
  const { blocks, stats } = extractCodeBlocksFromText(text);
  return { blocks, stats, pages };
}

function emptyStats(): PatternExtractStats {
  return {
    rawBlocks: 0, mergedBlocks: 0,
    strippedROutput: 0, repairedWraps: 0, filteredNarasi: 0,
  };
}
