// CodeLooter — Pattern-based extraction (Phase 1)
//
// Ported from CodeLooter backend/app/pattern_extract.py with the four
// Phase 1 improvements:
//   1. Merge fragmented blocks (look-back/look-ahead) — see merge.ts
//   2. Stricter narrative filter (prose ratio > 40%) — see line-classify.ts
//   3. Repair line-wraps — see repair.ts
//   4. Consistent R-output stripping — applied at block finalisation.
//
// Pipeline:
//   raw text
//   → repair line-wraps (fix #3)
//   → find marker-anchored regions
//   → per-line classify (code / narrative / R-output) using strict prose filter (fix #2)
//   → form candidate blocks
//   → merge fragmented blocks via look-back/look-ahead (fix #1)
//   → strip R-output from each block's head/tail and interior R-output gaps (fix #4)
//   → re-index

import type { RawBlock } from "./types";
import {
  isCodeLine,
  isROutput,
  isStartMarker,
} from "./line-classify";
import { detectLanguage } from "./langdetect";
import { repairLineWraps } from "./repair";
import { mergeFragmentedBlocks, type CandidateBlock } from "./merge";

export interface PatternExtractStats {
  rawBlocks: number;
  mergedBlocks: number;
  strippedROutput: number;
  repairedWraps: number;
  filteredNarasi: number;
  removedLines: string[];
}

export interface PatternExtractResult {
  blocks: RawBlock[];
  stats: PatternExtractStats;
}

// Find all start-marker line indices.
function findStartPositions(lines: string[]): number[] {
  const positions: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isStartMarker(line)) {
      positions.push(i);
      continue;
    }
    if (/^\s*Contoh\s+\d\s*:/i.test(line)) {
      positions.push(i);
      continue;
    }
  }
  // Fallback: if no marker at all, seed with the first code line.
  if (positions.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (isCodeLine(lines[i])) {
        positions.push(i);
        break;
      }
    }
  }
  positions.sort((a, b) => a - b);
  return positions;
}

// Strip R-output lines from head and tail; collapse interior R-output gaps
// into a single newline (do NOT keep them in the block).
function stripROutput(code: string): { code: string; stripped: number } {
  let lines = code.split("\n");
  let stripped = 0;
  // head
  while (lines.length > 0 && isROutput(lines[0])) {
    lines.shift();
    stripped++;
  }
  // tail
  while (lines.length > 0 && isROutput(lines[lines.length - 1])) {
    lines.pop();
    stripped++;
  }
  // interior — remove any R-output line, then collapse double blanks.
  lines = lines.filter((l) => {
    if (isROutput(l)) {
      stripped++;
      return false;
    }
    return true;
  });
  // collapse 2+ blank lines into 1
  const out: string[] = [];
  let blank = 0;
  for (const l of lines) {
    if (l.trim() === "") {
      blank++;
      if (blank <= 1) out.push(l);
    } else {
      blank = 0;
      out.push(l);
    }
  }
  return { code: out.join("\n").trim(), stripped };
}

// Split a block on "# Kasus N" / "# Contoh N" markers so each numbered case
// becomes its own block (mirrors the original SPLIT_PATTERN logic).
const SPLIT_PATTERN = /(?:^[ \t]*#[Kk]asus\s+\d|^[ \t]*#[Cc]ontoh\s+\d|^[ \t]*#[Kk]orelasi\s+[Pp]earson\s+contoh|^[ \t]*#korelasi\s+pearson\s+contoh\s*\d|^[ \t]*data_\w+\s*<-?\s*data\.frame|^[ \t]*data_\w+\s*=\s*data\.frame)/m;

function splitOnMarkers(block: RawBlock): RawBlock[] {
  const code = block.code;
  // Find all split-marker matches.
  const markers: { index: number }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SPLIT_PATTERN.source, "gm");
  while ((m = re.exec(code)) !== null) {
    markers.push({ index: m.index });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  if (markers.length <= 1) return [block];

  const out: RawBlock[] = [];
  let prev = 0;
  for (let i = 1; i < markers.length; i++) {
    const chunk = code.slice(prev, markers[i].index).trim();
    if (chunk.length >= 10) {
      out.push({
        code: chunk,
        lang: detectLanguage(chunk),
        lines: chunk.split("\n").length,
        source: "pattern-split",
        page: block.page,
      });
    }
    prev = markers[i].index;
  }
  const tail = code.slice(prev).trim();
  if (tail.length >= 10) {
    out.push({
      code: tail,
      lang: detectLanguage(tail),
      lines: tail.split("\n").length,
      source: "pattern-split",
      page: block.page,
    });
  }
  return out;
}

export function extractCodeBlocksFromText(
  rawText: string,
): PatternExtractResult {
  const stats: PatternExtractStats = {
    rawBlocks: 0,
    mergedBlocks: 0,
    strippedROutput: 0,
    repairedWraps: 0,
    filteredNarasi: 0,
    removedLines: [],
  };

  if (!rawText || !rawText.trim()) {
    return { blocks: [], stats };
  }

  // ── Phase 1 Fix #3: repair line-wraps first ──
  const originalLines = rawText.split(/\r?\n/);
  const { lines, repairedCount } = repairLineWraps(originalLines);
  stats.repairedWraps = repairedCount;

  // Collect removed lines (narrative + R-output) for the before/after view.
  // We scan all lines after repair and classify each: code, R-output, or
  // narrative. Only non-code lines are added to removedLines (capped at 200
  // to keep the response small).
  const REMOVED_CAP = 200;
  for (const l of lines) {
    if (stats.removedLines.length >= REMOVED_CAP) break;
    const t = l.trim();
    if (!t) continue;
    if (isROutput(l)) {
      stats.removedLines.push(t);
      stats.strippedROutput++;
    } else if (!isCodeLine(l)) {
      // Narrative line (prose ratio > 40% or no code signals).
      if (/[=(]/.test(t) || /\b(dan|yang|untuk|menunjukkan|bahwa|karena|sehingga|the|and|for|with)\b/i.test(t)) {
        stats.filteredNarasi++;
      }
      stats.removedLines.push(t);
    }
  }

  // ── Phase 1 Fix #2 is applied implicitly via isCodeLine (prose ratio) ──
  // ── Strategy 1: marker-anchored extraction ──
  const startPositions = findStartPositions(lines);
  const candidates: CandidateBlock[] = [];

  for (let s = 0; s < startPositions.length; s++) {
    const start = startPositions[s];
    // Phase 1 Fix #1: a block's region extends to the NEXT start marker.
    // Soft end markers (Interpretasi:, Output yang dihasilkan:, ##) are NOT
    // hard boundaries — they are narrative / R-output lines that get filtered
    // out by isCodeLine(). This prevents a 1-line narrative from splitting a
    // single code block into two.
    let end = lines.length;
    if (s + 1 < startPositions.length) end = startPositions[s + 1];

    // Collect code lines from [start, end).
    const codeLines: string[] = [];
    for (let j = start; j < end; j++) {
      const line = lines[j].replace(/\s+$/, "");
      if (!line.trim()) continue;
      const t = line.trim();
      // Skip a standalone "Kode Penyelesaian:" / "Kode:" label line.
      if (/^\s*(Kode\s+[Pp]enyelesaian|Kode\s*:)\s*:?\s*$/i.test(t)) continue;
      if (isCodeLine(line) || isROutput(line)) {
        codeLines.push(line);
      }
    }

    if (codeLines.length >= 2) {
      const code = codeLines.join("\n").trim();
      if (code.length >= 10) {
        candidates.push({
          code,
          lang: detectLanguage(code),
          lines: code.split("\n").length,
          source: "pattern",
          page: 1,
          startLine: start,
          endLine: end - 1,
        });
      }
    }
  }

  // ── Strategy 1b: split blocks that contain multiple "# Kasus N" markers ──
  const splitBlocks: CandidateBlock[] = [];
  for (const c of candidates) {
    const pieces = splitOnMarkers(c);
    let lineCursor = c.startLine;
    for (const p of pieces) {
      const nLines = p.code.split("\n").length;
      splitBlocks.push({
        ...p,
        startLine: lineCursor,
        endLine: lineCursor + nLines - 1,
      });
      lineCursor += nLines;
    }
  }
  stats.rawBlocks = splitBlocks.length;

  // ── Strategy 2: scan-fallback for code lines not yet captured ──
  const captured = new Set<string>();
  for (const b of splitBlocks) {
    for (const l of b.code.split("\n")) captured.add(l.trim());
  }

  const uncoded: CandidateBlock[] = [];
  let current: string[] = [];
  let currentStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (isCodeLine(line) && !captured.has(t)) {
      if (current.length === 0) currentStart = i;
      current.push(line.replace(/\s+$/, ""));
    } else {
      if (current.length >= 2) {
        const code = current.join("\n").trim();
        if (code.length >= 10 && !splitBlocks.some((b) => b.code.includes(code))) {
          uncoded.push({
            code,
            lang: detectLanguage(code),
            lines: code.split("\n").length,
            source: "scan-fallback",
            page: 1,
            startLine: currentStart,
            endLine: i - 1,
          });
        }
      }
      current = [];
    }
  }
  if (current.length >= 2) {
    const code = current.join("\n").trim();
    if (code.length >= 10 && !splitBlocks.some((b) => b.code.includes(code))) {
      uncoded.push({
        code,
        lang: detectLanguage(code),
        lines: code.split("\n").length,
        source: "scan-fallback",
        page: 1,
        startLine: currentStart,
        endLine: lines.length - 1,
      });
    }
  }

  const allCandidates = [...splitBlocks, ...uncoded].sort((a, b) => a.startLine - b.startLine);

  // ── Phase 1 Fix #1: merge fragmented blocks (look-back/look-ahead) ──
  const { blocks: merged, stats: mergeStats } = mergeFragmentedBlocks(allCandidates, {
    sourceLines: lines,
  });
  stats.mergedBlocks = mergeStats.mergedCount;

  // ── Phase 1 Fix #4: consistent R-output stripping ──
  const finalBlocks: RawBlock[] = [];
  for (const b of merged) {
    const { code, stripped } = stripROutput(b.code);
    stats.strippedROutput += stripped;
    if (code.length >= 10 && code.split("\n").length >= 1) {
      finalBlocks.push({
        code,
        lang: detectLanguage(code),
        lines: code.split("\n").length,
        source: b.source,
        page: b.page,
      });
    }
  }

  return { blocks: finalBlocks, stats };
}

// Fallback: density-based extraction (no markers present).
export function extractViaDensity(rawText: string): PatternExtractResult {
  const stats: PatternExtractStats = {
    rawBlocks: 0, mergedBlocks: 0, strippedROutput: 0, repairedWraps: 0, filteredNarasi: 0, removedLines: [],
  };
  if (!rawText || !rawText.trim()) return { blocks: [], stats };

  const originalLines = rawText.split(/\r?\n/);
  const { lines, repairedCount } = repairLineWraps(originalLines);
  stats.repairedWraps = repairedCount;

  const candidates: CandidateBlock[] = [];
  let current: string[] = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isCodeLine(lines[i])) {
      if (current.length === 0) start = i;
      current.push(lines[i].replace(/\s+$/, ""));
    } else {
      if (current.length >= 2) {
        const code = current.join("\n").trim();
        if (code.length >= 10) {
          candidates.push({
            code, lang: detectLanguage(code),
            lines: code.split("\n").length,
            source: "density", page: 1,
            startLine: start, endLine: i - 1,
          });
        }
      }
      current = [];
    }
  }
  if (current.length >= 2) {
    const code = current.join("\n").trim();
    if (code.length >= 10) {
      candidates.push({
        code, lang: detectLanguage(code),
        lines: code.split("\n").length,
        source: "density", page: 1,
        startLine: start, endLine: lines.length - 1,
      });
    }
  }

  stats.rawBlocks = candidates.length;
  const { blocks: merged, stats: ms } = mergeFragmentedBlocks(candidates, { sourceLines: lines });
  stats.mergedBlocks = ms.mergedCount;

  const finalBlocks: RawBlock[] = [];
  for (const b of merged) {
    const { code, stripped } = stripROutput(b.code);
    stats.strippedROutput += stripped;
    if (code.length >= 10) {
      finalBlocks.push({
        code, lang: detectLanguage(code),
        lines: code.split("\n").length,
        source: b.source, page: b.page,
      });
    }
  }
  return { blocks: finalBlocks, stats };
}
