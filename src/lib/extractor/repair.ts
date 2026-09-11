// CodeLooter — Line-wrap repair (Phase 1 Fix #3, enhanced)
//
// Ported from CodeLooter backend/scripts/pdf_extract.py `repair_line_wraps`
// and `_should_join` — the original Python implementation is significantly
// more sophisticated than the initial TypeScript port. This version brings
// the two to parity for better output quality.
//
// PDF text extraction often splits a long code line across two physical
// lines. Example:
//   biaya_promosi <- c(1500000, 1600000, 170
//   0000, 2200000)
// We detect continuation patterns and re-join the fragments.

import { isROutput } from "./line-classify";

// ─── Should-join heuristic (ported from Python _should_join) ───

// Code keywords that, if the NEXT line starts with them, signal a NEW
// statement — not a continuation of the current line.
const CODE_KEYWORD_RE = /^\s*(import|from|def|class|function|func|fn|return|if|else|elif|for|while|switch|case|break|continue|public|private|protected|static|void|int|float|double|long|string|var|let|const|print|printf|println|cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP|library|require|module|export|async|await|package|interface|struct|enum|namespace|using|include|extends|implements|new|throw|try|catch|finally|#|\/\/|\/\*|--)\b/;

// Does the current line end with a character that signals "statement ends
// here" (so we should NOT join with the next line)?
function endsComplete(t: string): boolean {
  if (/[.!?]$/.test(t)) return true;   // sentence ender
  if (/[;]$/.test(t)) return true;     // statement separator
  if (/[)\]}]$/.test(t)) return true;  // closed bracket → statement likely done
  if (/[\["'`]$/.test(t)) return true; // open string/bracket → but handled elsewhere
  return false;
}

// Does the next line look like a "Capitalized Word lowercase" sentence
// start? (e.g. "The data shows" → don't join)
function isSentenceStart(t: string): boolean {
  return /^[A-Z][a-z]+\s+[a-z]/.test(t) && !/^\w+\s*\(/.test(t);
}

// Does the current line end with an operator/bracket that signals "more to
// come" — a positive join signal?
function endsWithJoinSignal(t: string): boolean {
  if (/[,+*/<>=&|({\[]$/.test(t)) return true;
  if (/-$/.test(t) && true) return true; // trailing dash
  return false;
}

// Core: should we join `cur` and `nxt` into one logical line?
// Returns true if they should be joined.
function shouldJoin(cur: string, nxt: string): boolean {
  const curT = cur.replace(/\s+$/, ""); // rstrip
  const nxtT = nxt.replace(/^\s+/, "");  // lstrip

  if (!curT || !nxtT) return false;

  // Don't join if current ends with `;` (statement separator)
  if (/;$/.test(curT)) return false;

  // Join if there are unclosed brackets on the current line
  const opens = (curT.match(/[([{]/g) || []).length;
  const closes = (curT.match(/[)\]}]/g) || []).length;
  if (opens > closes) return true;

  // FIX #19: SQL continuation — if current line ends with a SQL clause keyword
  // (FROM, JOIN, WHERE, SET, INTO, VALUES, ON, AND, OR), the next line is the
  // continuation of the query. e.g. "SELECT * FROM\nusers WHERE x > 0".
  if (/\b(FROM|JOIN|INNER|OUTER|LEFT|RIGHT|WHERE|SET|INTO|VALUES|ON|AND|OR|GROUP|ORDER|HAVING|UNION|SELECT|INSERT|UPDATE|DELETE|CREATE|TABLE|ALTER|DROP)\s*$/i.test(curT)) {
    // But don't join if next starts a brand-new statement
    if (!CODE_KEYWORD_RE.test(nxtT) && !isSentenceStart(nxtT)) return true;
  }

  // Don't join if next starts with assignment arrow (new statement)
  if (/<-|->/.test(nxtT.slice(0, 30))) return false;

  // Don't join if next is `var = value` pattern (new assignment)
  if (/^[^=<>!]{1,20}=[^=]/.test(nxtT)) return false;

  // Don't join if current ends with sentence punctuation
  if (/[.!?]$/.test(curT)) return false;
  // Don't join if current ends with colon (but allow "::" R namespace)
  if (/:$/.test(curT) && !/::$/.test(curT)) return false;

  // Don't join if current ends with closing bracket
  if (/[)\]}]$/.test(curT)) return false;

  // Don't join if current ends with open bracket/string start (but allow
  // unclosed-bracket case above which returns true earlier)
  if (/[\["'`]$/.test(curT)) return false;

  // Don't join if next starts with a code keyword
  if (CODE_KEYWORD_RE.test(nxtT)) return false;

  // Don't join if next looks like a sentence start
  if (isSentenceStart(nxtT)) return false;

  // Positive join signals — current ends with operator/comma
  if (endsWithJoinSignal(curT)) return true;

  // Trailing dash + next starts uppercase
  if (/-$/.test(curT) && /^[A-Z]/.test(nxtT)) return true;

  // Lowercase + underscore start
  if (/[a-z]$/.test(curT) && /^_/.test(nxtT)) return true;

  // Alphanumeric end + closing bracket start (e.g. `foo\n)` → join)
  if (/[a-zA-Z0-9_]$/.test(curT) && /^[)\]}]/.test(nxtT)) return true;

  // Lowercase end + short lowercase continuation (e.g. `data\nframe`)
  if (/[a-z]$/.test(curT) && /^[a-z]{1,8}$/.test(nxtT)) {
    if (!/<-=$/.test(curT) && !/^.{0,40}=[^=]/.test(nxtT)) return true;
  }

  return false;
}

// Is this line a comment? (We must not merge comments into the previous line.)
function isComment(line: string): boolean {
  return /^\s*#/.test(line) && !/^#\s*(Kasus|Soal|Contoh)\s+\d/i.test(line);
}

export interface WrapRepairStats {
  repairedCount: number;
  lines: string[]; // the repaired line array
}

// Repair line-wraps in-place. Returns the new line array and the count of
// merges performed.
//
// Strategy (ported from Python repair_line_wraps):
//   Walk through lines. For each line, keep joining with the next line
//   while shouldJoin returns true. This handles multi-line continuations.
export function repairLineWraps(lines: string[]): WrapRepairStats {
  if (lines.length === 0) return { repairedCount: 0, lines };

  const out: string[] = [];
  let repaired = 0;
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // Keep joining while the next line should be joined.
    while (i + 1 < lines.length && shouldJoin(line, lines[i + 1])) {
      i++;
      line = line + lines[i].replace(/^\s+/, "");
      repaired++;
    }

    out.push(line);
    i++;
  }

  return { repairedCount: repaired, lines: out };
}

// ─── Whitespace normalization (ported from Python normalize_whitespace) ───
//
// Removes PDF extraction artifacts:
//   - Standalone page numbers (lines that are just digits)
//   - Short fragments like "halaman 42" that PDF extraction scatters
//   - Collapses 2+ spaces to 1

export function normalizeWhitespace(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Strip \r, collapse 2+ spaces/tabs to 1, rstrip
    line = line.replace(/\r/g, "");
    line = line.replace(/[ \t]{2,}/g, " ").replace(/\s+$/, "");

    const t = line.trim();

    // Remove standalone page numbers (lines that are just digits)
    if (t && /^\d+$/.test(t)) continue;

    // Remove short "word + number" patterns that are PDF page artifacts
    // e.g. "halaman 42", "hal 12", "hal. 5", "page 3"
    const isPageArtifact =
      /^(halaman|hal|hal\.|page|pg|p\.|p)\s*\.?\s*\d+/i.test(t) ||
      /^[a-z]{1,4}\s+\d+(\.\d+)?\s*$/i.test(t);
    const isCodeKeyword = /^(int|for|var|let|def|if|in|of|as|to|while|do|elif|else|try|except|finally|return|raise|throw|import|from|class|function|func|fn|library|require|module|export|async|await|package|interface|struct|enum|namespace|using|include|extends|implements|new|switch|case|break|continue|public|private|protected|static|void|float|double|long|string|const|print|printf|println|cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP)\b/.test(t);

    if (isPageArtifact && !isCodeKeyword) {
      continue;
    }

    out.push(line);
  }
  return out;
}

// ─── R-output stripping (pre-processing) ───
//
// Strips R console output lines (## ..., [1] ...) BEFORE extraction so they
// don't pollute the code blocks. This is a quality improvement over the
// previous approach which only stripped them after block formation.

export function stripROutputLines(lines: string[]): { lines: string[]; stripped: number } {
  const out: string[] = [];
  let stripped = 0;
  for (const line of lines) {
    if (isROutput(line)) {
      stripped++;
      continue;
    }
    out.push(line);
  }
  return { lines: out, stripped };
}
