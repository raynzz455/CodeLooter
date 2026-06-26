import { NextRequest, NextResponse } from "next/server";

/* ─── Type ─── */
export interface CodeBlock {
  lang: string;
  code: string;
  lines: number;
}

/* ─── Language detection heuristics ─── */
const LANG_PATTERNS: { lang: string; patterns: RegExp[] }[] = [
  {
    lang: "python",
    patterns: [
      /^import\s+\w+/m,
      /^from\s+\w+\s+import/m,
      /def\s+\w+\s*\(/m,
      /^class\s+\w+[:(]/m,
      /print\s*\(/m,
      /pandas|numpy|matplotlib|sklearn|tensorflow|torch/,
    ],
  },
  {
    lang: "r",
    patterns: [
      /^library\s*\(/m,
      /^require\s*\(/m,
      /<-\s/,
      /\%>\%/,
      /ggplot\s*\(/m,
      /data\.frame\s*\(/m,
      /^#.*R$/m,
      /tidyverse|dplyr|ggplot2|readxl|lubridate/,
    ],
  },
  {
    lang: "sql",
    patterns: [
      /\bSELECT\b.+\bFROM\b/is,
      /\bCREATE\s+TABLE\b/i,
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\b.+\bSET\b/is,
      /\bDROP\s+TABLE\b/i,
      /\bJOIN\b.+\bON\b/is,
      /\bGROUP\s+BY\b/i,
      /\bORDER\s+BY\b/i,
    ],
  },
  {
    lang: "javascript",
    patterns: [
      /\bconst\b|\blet\b|\bvar\b/,
      /=>\s*\{/,
      /function\s+\w+\s*\(/m,
      /console\.log\s*\(/,
      /document\.|window\.|require\(|module\.exports/,
      /\.then\s*\(|async\s+function|await\s+/,
    ],
  },
  {
    lang: "typescript",
    patterns: [
      /:\s*(string|number|boolean|void|any|never|unknown)\b/,
      /interface\s+\w+\s*\{/m,
      /type\s+\w+\s*=/m,
      /<\w+(\[\])?>/,
      /as\s+(string|number|boolean|any)\b/,
    ],
  },
  {
    lang: "java",
    patterns: [
      /public\s+(static\s+)?void\s+main/m,
      /System\.out\.print/m,
      /import\s+java\./m,
      /public\s+class\s+\w+/m,
      /new\s+\w+\s*\(/,
    ],
  },
  {
    lang: "cpp",
    patterns: [
      /#include\s*<\w+>/m,
      /std::/,
      /cout\s*<</,
      /int\s+main\s*\(/m,
      /void\s+\w+\s*\(.*\)\s*\{/m,
    ],
  },
  {
    lang: "kotlin",
    patterns: [
      /fun\s+\w+\s*\(/m,
      /val\s+\w+\s*=/m,
      /var\s+\w+\s*:/m,
      /data\s+class\s+\w+/m,
      /runBlocking\s*\{/m,
      /import\s+kotlinx\./m,
    ],
  },
];

function detectLang(code: string): string {
  // TypeScript check first (subset of JS, needs priority)
  const tsScore = LANG_PATTERNS.find((p) => p.lang === "typescript")!
    .patterns.filter((r) => r.test(code)).length;
  const jsScore = LANG_PATTERNS.find((p) => p.lang === "javascript")!
    .patterns.filter((r) => r.test(code)).length;

  if (tsScore >= 2) return "typescript";

  let best = "unknown";
  let bestScore = 0;

  for (const { lang, patterns } of LANG_PATTERNS) {
    if (lang === "typescript") continue;
    const score = patterns.filter((r) => r.test(code)).length;
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }

  // JS fallback: if JS beats others but TS is also present
  if (best === "javascript" && jsScore > 0 && tsScore > 0) return "typescript";

  return bestScore >= 1 ? best : "unknown";
}

/* ─── Code block extractor ─── */

function extractFromText(rawText: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];

  // Strategy 1: anchor-based — dokumen akademik selalu punya label eksplisit
  const ANCHOR_START = /kode\s+\w+[\w\s]*\s*:|syntax\s*:|script\s*:|program\s*:/gi;
  const ANCHOR_END = /output yang dihasilkan|interpretasi\s|contoh\s+\d|penugasan|##\s/i;

  let match: RegExpExecArray | null;
  ANCHOR_START.lastIndex = 0;

  while ((match = ANCHOR_START.exec(rawText)) !== null) {
    const start = match.index + match[0].length;
    const rest = rawText.slice(start);
    const endMatch = ANCHOR_END.exec(rest);
    const end = endMatch ? endMatch.index : Math.min(rest.length, 1500);

    const candidate = rest.slice(0, end).trim();
    if (candidate.length < 10) continue;

    // Buang baris ## (output R, bukan kode)
    const cleaned = candidate
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("##"))
      .join("\n")
      .trim();

    if (cleaned.length < 10) continue;

    const lang = detectLang(cleaned);
    if (lang !== "unknown") {
      blocks.push({ lang, code: cleaned, lines: cleaned.split("\n").length });
    }
  }

  if (blocks.length > 0) return mergeByLang(blocks);

  // Strategy 2: fenced code blocks (MD/DOCX)
  const FENCED = /```(\w*)\n?([\s\S]*?)```|~~~(\w*)\n?([\s\S]*?)~~~/g;
  let fm: RegExpExecArray | null;
  while ((fm = FENCED.exec(rawText)) !== null) {
    const hint = (fm[1] || fm[3] || "").toLowerCase().trim();
    const code = (fm[2] || fm[4] || "").trim();
    if (code.length < 10) continue;
    const lang = hint || detectLang(code);
    blocks.push({ lang, code, lines: code.split("\n").length });
  }

  return mergeByLang(blocks);
}

// Merge blocks of same language into one
function mergeByLang(blocks: CodeBlock[]): CodeBlock[] {
  const map = new Map<string, string[]>();
  for (const b of blocks) {
    const existing = map.get(b.lang) ?? [];
    existing.push(b.code);
    map.set(b.lang, existing);
  }
  return Array.from(map.entries()).map(([lang, codes]) => {
    const code = codes.join("\n\n/* ── next block ── */\n\n");
    return { lang, code, lines: code.split("\n").length };
  });
}

/* ─── Format parsers ─── */
async function parsePdf(buffer: Buffer): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Kelompokkan token berdasarkan koordinat Y (baris)
    const rows = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const transform = item.transform as number[];
      const x = Math.round(transform[4]);
      const y = Math.round(transform[5]);

      // Toleransi Y ±3px — token di baris yang sama digabung
      let rowKey = y;
      for (const key of rows.keys()) {
        if (Math.abs(key - y) <= 3) { rowKey = key; break; }
      }

      if (!rows.has(rowKey)) rows.set(rowKey, []);
      rows.get(rowKey)!.push({ x, str: item.str });
    }

    // Sort baris dari atas ke bawah (Y besar = atas di PDF)
    const sortedRows = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, tokens]) =>
        tokens
          .sort((a, b) => a.x - b.x)
          .map((t) => t.str)
          .join("")
      );

    pages.push(sortedRows.join("\n"));
  }

  return pages.join("\n");
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  // Extract raw text (preserves code blocks better than HTML)
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function parsePlainText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/* ─── Route handler ─── */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Tidak ada file yang dikirim" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name = file.name.toLowerCase();

    let rawText = "";

    if (name.endsWith(".pdf")) {
      rawText = await parsePdf(buffer);
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      rawText = await parseDocx(buffer);
    } else if (
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".html") ||
      name.endsWith(".tex") ||
      name.endsWith(".ipynb")
    ) {
      rawText = parsePlainText(buffer);
    } else {
      // Fallback: try plain text
      rawText = parsePlainText(buffer);
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: "File kosong atau tidak dapat dibaca" }, { status: 422 });
    }

    const blocks = extractFromText(rawText);

    if (blocks.length === 0) {
      return NextResponse.json(
        { error: "Tidak ditemukan kode dalam dokumen ini" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      blocks,
      filename: file.name,
      size: file.size,
      total: blocks.length,
    });
  } catch (err) {
    console.error("[/api/extract]", err);
    const message = err instanceof Error ? err.message : "Gagal memproses file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
