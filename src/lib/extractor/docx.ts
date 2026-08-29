// CodeLooter — DOCX text extraction using mammoth
//
// mammoth converts .docx files to plain text by walking the document's
// XML and extracting paragraph text. This preserves the reading order
// (important for modul praktikum where code blocks are interspersed
// with narrative paragraphs).
//
// After extracting text, we feed it into the pattern extractor to find
// code blocks — same as we do for .txt files.

import type { RawBlock } from "./types";
import { extractCodeBlocksFromText, type PatternExtractStats } from "./pattern-extract";

export interface DocxExtractResult {
  blocks: RawBlock[];
  stats: PatternExtractStats;
  textLength: number;
}

export async function extractFromDocxBuffer(buf: Buffer): Promise<DocxExtractResult> {
  let text = "";
  try {
    // mammoth is CommonJS; dynamic import to avoid bundler issues.
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    text = result?.value ?? "";
  } catch (err: any) {
    console.error("[extractFromDocxBuffer] mammoth failed:", err?.message ?? err);
    return { blocks: [], stats: emptyStats(), textLength: 0 };
  }

  const { blocks, stats } = extractCodeBlocksFromText(text);
  return { blocks, stats, textLength: text.length };
}

function emptyStats(): PatternExtractStats {
  return {
    rawBlocks: 0, mergedBlocks: 0,
    strippedROutput: 0, repairedWraps: 0, filteredNarasi: 0,
    removedLines: [],
  };
}
