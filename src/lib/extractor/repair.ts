// CodeLooter — Line-wrap repair (Phase 1 Fix #3)
//
// PDF text extraction often splits a long code line across two physical
// lines. Example:
//   biaya_promosi <- c(1500000, 1600000, 170
//   0000, 2200000)
// We detect continuation patterns and re-join the fragments.

// Does the line END in a way that signals continuation?
//   - trailing comma
//   - trailing binary operator (+ - * / < > = | & %)
//   - unclosed brackets/parens (counted)
//   - trailing assignment arrow "<-"
function isContinuationEnd(line: string): boolean {
  const t = line.trimEnd();
  if (!t) return false;
  const last = t[t.length - 1];
  if (last === "," || last === "+" || last === "-" || last === "*" ||
      last === "/" || last === "|" || last === "&" || last === "=" ||
      last === "<" || last === ">") return true;
  // trailing assignment / pipe
  if (/<-\s*$/.test(t) || /%>%\s*$/.test(t)) return true;
  return false;
}

// Count unclosed openers on the line.
function unclosedBrackets(line: string): number {
  let depth = 0;
  for (const ch of line) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
  }
  return depth;
}

// Does the line START in a way that signals continuation of the previous?
//   - starts with a number that has no preceding identifier (likely split number)
//   - starts with closing bracket
//   - starts with identifier/continuation
function isContinuationStart(line: string): boolean {
  const t = line.trimStart();
  if (!t) return false;
  // starts with closing bracket
  if (/^[)\]}]/.test(t)) return true;
  // starts with digits (continuation of a numeric vector like "..., 170\n0000, ...")
  if (/^\d/.test(t) && !/^\w+\s*<-/.test(t) && !/^\w+\s*=/.test(t)) return true;
  // starts with string literal continuation
  if (/^[,'""]/.test(t)) return true;
  // starts with identifier that looks like a vector element (no assignment)
  if (/^\w[\w.]*\s*[,)]/.test(t)) return true;
  return false;
}

// Is this line a comment? (We must not merge comments into the previous line.)
function isComment(line: string): boolean {
  return /^\s*#/.test(line) && !/^#\s*(Kasus|Soal|Contoh)\s+\d/i.test(line);
}

// Is this line R console output?
function isROutput(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("## ") || t.startsWith("##\t") || /^\[\d+\]\s/.test(t);
}

export interface WrapRepairStats {
  repairedCount: number;
  lines: string[]; // the repaired line array
}

// Repair line-wraps in-place. Returns the new line array and the count of
// merges performed.
//
// Strategy: walk through lines. Maintain an "accumulator" — the current
// logical line we are building. Decide whether to append the next physical
// line to the accumulator based on:
//   - the accumulator ends with a continuation signal (comma, operator,
//     unclosed bracket), OR
//   - the next line is a continuation start (digit, closing bracket, vector
//     element) AND is not itself a comment / R output / blank.
export function repairLineWraps(lines: string[]): WrapRepairStats {
  if (lines.length === 0) return { repairedCount: 0, lines };

  const out: string[] = [];
  let repaired = 0;
  let acc: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, ""); // trim trailing whitespace

    if (line.trim() === "") {
      // blank line — flush accumulator
      if (acc !== null) { out.push(acc); acc = null; }
      out.push("");
      continue;
    }
    // comments and R output flush the accumulator and stand alone
    if (isComment(line) || isROutput(line)) {
      if (acc !== null) { out.push(acc); acc = null; }
      out.push(line);
      continue;
    }

    if (acc === null) {
      acc = line;
      // If this line itself signals continuation (unclosed brackets / trailing
      // comma), keep accumulating; otherwise flush.
      if (!shouldContinue(acc, line, null)) {
        out.push(acc);
        acc = null;
      }
      continue;
    }

    // We have an accumulator. Decide whether to extend it.
    const next = line;
    const endsWithContinue = isContinuationEnd(acc);
    const unclosed = unclosedBrackets(acc) > 0;
    const startsContinue = isContinuationStart(next);

    if (unclosed || endsWithContinue || startsContinue) {
      // Determine separator: if the previous accumulator ends with an
      // operator/comma, join with a single space (avoid gluing tokens).
      // If the next line starts with a digit that's a continuation of a
      // number (like "170" + "0000"), join WITHOUT a space to reconstruct
      // the number.
      let sep = " ";
      const prevLast = acc[acc.length - 1];
      const nextFirst = next.trimStart()[0];
      // Number continuation: prev ends with digit, next starts with digit,
      // and prev's last token is a number that was cut (odd length heuristic).
      if (/\d$/.test(acc) && /^\d/.test(next.trimStart())) {
        // Heuristic: if the previous number "looks cut" (e.g. ends in 0/5 and
        // next continues with 000), glue without space. We check that the
        // accumulator ends with a partial numeric literal by scanning back.
        const tail = acc.match(/(\d[\d.]*)$/);
        if (tail) {
          // If the tail length is not a "round" typical number and next is
          // all-digits-with-comma, glue.
          if (/^\d+[,)\]\s]/.test(next.trimStart())) {
            sep = ""; // glue digits
          }
        }
      }
      // If prev ends with "(" and next starts with identifier, no space needed,
      // but a space is harmless — keep space for safety.
      if (prevLast === "(" && /[a-zA-Z0-9_]/.test(nextFirst)) sep = "";
      acc = acc + sep + next.trim();
      repaired++;
      // After extending, check if the accumulator still signals continuation.
      if (!shouldContinue(acc, acc, null)) {
        out.push(acc);
        acc = null;
      }
      continue;
    }

    // Not a continuation — flush accumulator, start new one.
    out.push(acc);
    acc = line;
    if (!shouldContinue(acc, line, null)) {
      out.push(acc);
      acc = null;
    }
  }
  if (acc !== null) out.push(acc);

  return { repairedCount: repaired, lines: out };
}

// Should we keep accumulating after `acc`?
function shouldContinue(acc: string, _line: string, _next: string | null): boolean {
  return isContinuationEnd(acc) || unclosedBrackets(acc) > 0;
}
