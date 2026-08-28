// CodeLooter — Block merging (Phase 1 Fix #1)
//
// Problem: code that should be a single block gets split into 2-3 blocks
// because a short narrative line interrupts it.
//
// Fix: look-back / look-ahead. When two candidate code blocks are separated
// by <= MAX_GAP narrative lines AND neither side carries a hard boundary
// marker ("# Kasus N", "Kode Penyelesaian:", "Output yang dihasilkan:"),
// merge them back into a single block.
//
// We also apply a continuation heuristic: if block N ends with an unclosed
// bracket / trailing comma and block N+1 starts with a continuation token,
// merge unconditionally.

import type { RawBlock } from "./types";
import { isStartMarker, isEndMarker, isCodeLine, isROutput } from "./line-classify";

export const MAX_GAP = 2; // max narrative lines that may interrupt a single block

// Continuation signals: prev block ends here → next likely continues.
function endsWithContinuation(lastLine: string): boolean {
  const t = lastLine.trim();
  if (!t) return false;
  const last = t[t.length - 1];
  if (last === "," || last === "(" || last === "[" || last === "{" ||
      last === "+" || last === "-" || last === "*" || last === "/" ||
      last === "|" || last === "&" || last === "=" || last === "<" ||
      last === ">") return true;
  if (/<-$/.test(t) || /%>%$/.test(t)) return true;
  return false;
}

// Continuation start: first line of next block looks like a continuation.
function startsWithContinuation(firstLine: string): boolean {
  const t = firstLine.trimStart();
  if (!t) return false;
  if (/^[)\]}]/.test(t)) return true;
  if (/^\d/.test(t) && !/^\w+\s*<-/.test(t) && !/^\w+\s*=/.test(t)) return true;
  if (/^[,'""]/.test(t)) return true;
  return false;
}

// Hard boundary — never merge across one of these.
function isHardBoundary(line: string): boolean {
  return isStartMarker(line) || isEndMarker(line);
}

export interface MergeContext {
  sourceLines: string[]; // the full source line array (for look-back/look-ahead)
}

export interface MergeStats {
  mergedCount: number;
}

// Merge fragmented candidate blocks.
//
// `candidates` is an array of { block, startLine, endLine } where startLine
// and endLine are indices into sourceLines. We merge adjacent candidates if
// the gap between them is narrative-only and short, and no hard boundary is
// present in the gap.
export interface CandidateBlock extends RawBlock {
  startLine: number;
  endLine: number;
}

export function mergeFragmentedBlocks(
  candidates: CandidateBlock[],
  ctx: MergeContext,
): { blocks: RawBlock[]; stats: MergeStats } {
  if (candidates.length === 0) return { blocks: [], stats: { mergedCount: 0 } };

  const merged: CandidateBlock[] = [candidates[0]];
  let mergedCount = 0;

  for (let i = 1; i < candidates.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = candidates[i];

    // Gap lines between prev.endLine+1 .. curr.startLine-1
    const gapStart = prev.endLine + 1;
    const gapEnd = curr.startLine - 1;
    const gapLines: string[] = [];
    for (let j = gapStart; j <= gapEnd && j < ctx.sourceLines.length; j++) {
      gapLines.push(ctx.sourceLines[j]);
    }
    const gapLen = gapEnd - gapStart + 1;

    const prevLastLine = prev.code.split("\n").pop() || "";
    const currFirstLine = curr.code.split("\n")[0] || "";

    // Rule A: structural continuation — always merge.
    const structuralContinue =
      endsWithContinuation(prevLastLine) || startsWithContinuation(currFirstLine);

    // Rule B: short narrative gap with no hard boundary.
    const gapHasCode = gapLines.some((l) => isCodeLine(l));
    const gapHasHardBoundary = gapLines.some((l) => isHardBoundary(l));
    const gapHasROutput = gapLines.some((l) => isROutput(l));
    const shortGap = gapLen >= 0 && gapLen <= MAX_GAP;

    // Rule C: prev block does not itself end with a hard boundary marker line
    // (don't merge a "Kasus" block into the previous Kasus).
    const prevLastIsBoundary = isHardBoundary(prevLastLine);
    const currFirstIsBoundary = isStartMarker(currFirstLine);

    let shouldMerge = false;
    if (!currFirstIsBoundary && !prevLastIsBoundary && !gapHasHardBoundary) {
      if (structuralContinue) {
        shouldMerge = true;
      } else if (shortGap && !gapHasCode && !gapHasROutput) {
        // Short narrative gap — merge the two code regions into one block.
        shouldMerge = true;
      } else if (shortGap && gapHasROutput && !gapHasCode) {
        // R output inside a code region — keep the code together.
        shouldMerge = true;
      }
    }

    if (shouldMerge) {
      // Merge curr into prev. Preserve a single newline between the two
      // code regions (do NOT inject the narrative lines — Phase 1 goal is
      // clean code blocks without prose).
      prev.code = prev.code + "\n" + curr.code;
      prev.lines = prev.code.split("\n").length;
      prev.endLine = curr.endLine;
      prev.source = prev.source === curr.source ? prev.source : `${prev.source}+merge`;
      mergedCount++;
    } else {
      merged.push(curr);
    }
  }

  return { blocks: merged, stats: { mergedCount } };
}
