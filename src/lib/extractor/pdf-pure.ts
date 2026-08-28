// CodeLooter — Pure-TypeScript PDF text extractor
//
// Uses Node's built-in `zlib` to inflate FlateDecode streams and regex to
// extract text-showing operators (Tj, TJ, ', ", Td, Tm). This avoids every
// bundler-incompatible PDF library (pdfjs-dist, pdf2json all crash turbopack).
//
// Limitations: handles text-based PDFs with standard encodings and
// FlateDecode streams. CID-keyed fonts and custom encodings may yield garbage,
// but for academic module PDFs (the CodeLooter use-case) this is sufficient.

import { inflateSync } from "zlib";

interface PdfExtract {
  text: string;
  pages: number;
}

// Decode a PDF string literal — handles \( \) \\ \n \r \t \ddd octal.
function decodePdfString(s: string): string {
  return s
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

// Tokenize a content stream into text-showing events. We scan for:
//   ( ... ) Tj        → show string
//   [ ... ] TJ         → show array (strings + numbers for kerning)
//   ( ... ) '          → show string, next line
//   ( ... ) "          → show string, next line
//   x y Td / x y TD    → move text position (Y delta → newline heuristic)
//   a b c d e f Tm     → set text matrix
//   BT / ET            → begin/end text
// We reconstruct lines by tracking the Y component of Td/TD/Tm.
export function extractPdfTextPureTs(buf: Buffer): PdfExtract {
  // Quick page count: count /Type /Page (not /Pages).
  const pageMatches = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  const pages = pageMatches ? pageMatches.length : 0;

  // Find all stream...endstream blocks with their preceding dictionary.
  const latin = buf.toString("latin1");
  const outLines: string[] = [];
  let currentLine = "";
  let lastY: number | null = null;

  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(latin)) !== null) {
    const streamStart = m.index;
    // Look back ~300 chars for the dictionary to check the filter.
    const dictRegion = latin.slice(Math.max(0, streamStart - 300), streamStart);
    const isFlate = /\/Filter\s*\/FlateDecode|\/FlateDecode\s*\/Filter/.test(dictRegion) ||
                    /\/FlateDecode/.test(dictRegion);
    let raw: Buffer;
    try {
      raw = isFlate
        ? inflateSync(Buffer.from(m[1], "latin1"))
        : Buffer.from(m[1], "latin1");
    } catch {
      continue; // corrupt stream — skip
    }
    const content = raw.toString("latin1");

    // Tokenize the content stream. We walk through and react to operators.
    // A simple scanner: find string literals ( ... ) and arrays [ ... ],
    // then check the following operator.
    let i = 0;
    const n = content.length;
    const flushLine = () => {
      if (currentLine.trim()) outLines.push(currentLine);
      currentLine = "";
    };

    while (i < n) {
      const ch = content[i];
      // Skip whitespace.
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") { i++; continue; }
      // String literal: ( ... )
      if (ch === "(") {
        // Read until matching ) accounting for nesting and escapes.
        let depth = 1;
        let j = i + 1;
        let str = "";
        while (j < n && depth > 0) {
          const c = content[j];
          if (c === "\\") {
            str += content[j] + (content[j + 1] ?? "");
            j += 2;
            continue;
          }
          if (c === "(") depth++;
          else if (c === ")") { depth--; if (depth === 0) break; }
          str += c;
          j++;
        }
        // Peek at the next operator after the closing ).
        const rest = content.slice(j + 1, j + 12).trimStart();
        const op = rest.match(/^([A-Za-z'"]{1,2})/);
        const decoded = decodePdfString(str);
        if (op) {
          if (op[1] === "Tj" || op[1] === "'") {
            currentLine += decoded;
            if (op[1] === "'") { flushLine(); }
          } else if (op[1] === '"') {
            currentLine += decoded;
            flushLine();
          }
          // TJ handled below via array.
        } else {
          // Bare string — append defensively.
          currentLine += decoded;
        }
        i = j + 1;
        continue;
      }
      // Array literal: [ ... ] followed by TJ
      if (ch === "[") {
        let depth = 1;
        let j = i + 1;
        while (j < n && depth > 0) {
          if (content[j] === "[") depth++;
          else if (content[j] === "]") depth--;
          if (depth === 0) break;
          j++;
        }
        const arrContent = content.slice(i + 1, j);
        // Extract all ( ... ) strings from the array.
        const strs = arrContent.match(/\((?:\\.|[^\\()])*\)/g) || [];
        for (const s of strs) {
          currentLine += decodePdfString(s.slice(1, -1));
        }
        i = j + 1;
        continue;
      }
      // Positioning operators: numbers then Td/TD/Tm
      // Match "x y Td" or "x y TD" or "a b c d e f Tm"
      if (/[0-9-]/.test(ch)) {
        const rest = content.slice(i, i + 80);
        const tdMatch = rest.match(/^(-?[\d.]+)\s+(-?[\d.]+)\s+(Td|TD)\b/);
        const tmMatch = rest.match(/^(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm\b/);
        if (tdMatch) {
          const y = parseFloat(tdMatch[2]);
          // Negative Y delta (or any Td with a Y component) → new line.
          if (lastY !== null && Math.abs(y - lastY) > 0.5) {
            flushLine();
          }
          lastY = y;
          i += tdMatch[0].length;
          continue;
        }
        if (tmMatch) {
          const y = parseFloat(tmMatch[6]);
          if (lastY !== null && Math.abs(y - lastY) > 0.5) {
            flushLine();
          }
          lastY = y;
          i += tmMatch[0].length;
          continue;
        }
      }
      // BT — begin text; ET — end text.
      if (content.slice(i, i + 2) === "BT") { flushLine(); lastY = null; i += 2; continue; }
      if (content.slice(i, i + 2) === "ET") { flushLine(); i += 2; continue; }
      i++;
    }
    flushLine();
    // Page break between streams (rough heuristic).
    outLines.push("");
  }

  return { text: outLines.join("\n"), pages: Math.max(pages, 1) };
}
