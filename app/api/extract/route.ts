import { NextRequest, NextResponse } from "next/server";
import hljs from "highlight.js/lib/core";
import r from "highlight.js/lib/languages/r";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import kotlin from "highlight.js/lib/languages/kotlin";

hljs.registerLanguage("r", r);
hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("kotlin", kotlin);

/* ─── Types ─── */
export interface CodeBlock {
  index: number ; 
  lang: string;
  code: string;
  lines: number;
}

/* ─── Language detection via highlight.js ─── */

// officeparser kadang sisipkan spasi antar token — normalisasi dulu
function normalizeCode(raw: string): string {
  return raw
    .split("\n")
    .map((line) =>
      line
        .replace(/\s*<\s*-\s*/g, " <- ")   // < - → <-
        .replace(/\s*\$\s*/g, "$")          // data $ col → data$col
        .replace(/[ \t]{2,}/g, " ")         // multiple spaces → single (horizontal only)
        .trim()
    )
    .filter((line) => {
      const t = line.trim();
      // Buang baris yang hanya angka (nomor halaman)
      if (/^\d+$/.test(t)) return false;
      // Buang baris ## (output R)
      if (t.startsWith("##")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function detectLang(code: string): string {
  if (code.trim().length < 10) return "unknown";
  const result = hljs.highlightAuto(normalizeCode(code));
  if (!result.language || (result.relevance ?? 0) < 5) return "unknown";
  return result.language;
}

/* ─── Code block extractor ─── */
function extractFromText(rawText: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];

  // Strategy 1: anchor-based — label eksplisit di dokumen akademik Indonesia
  const ANCHOR_START = /kode\s+[\w\s]*\s*:|syntax\s*:|script\s*:|program\s*:/gi;
  const ANCHOR_END = /output\s+yang\s+dihasilkan|interpretasi\s|^contoh\s+\d|penugasan/im;

  let match: RegExpExecArray | null;
  ANCHOR_START.lastIndex = 0;

  while ((match = ANCHOR_START.exec(rawText)) !== null) {
    const start = match.index + match[0].length;
    const rest = rawText.slice(start);
    const endMatch = ANCHOR_END.exec(rest);
    const end = endMatch ? endMatch.index : Math.min(rest.length, 2000);

    const candidate = rest.slice(0, end).trim();
    if (candidate.length < 10) continue;

    // Buang baris ## (output R, bukan kode)
    const cleaned = candidate
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("##"))
      .join("\n")
      .trim();

    if (cleaned.length < 10) continue;
    const normalized = normalizeCode(cleaned);
    const lang = detectLang(normalized);
    if (lang !== "unknown") {
      blocks.push({ index: 0, lang, code: normalized, lines: normalized.split("\n").length });
    }
  }

  if (blocks.length > 0) return indexBlocks(blocks);

  // Strategy 2: fenced code blocks (MD/DOCX/IPYNB)
  const FENCED = /```(\w*)\n?([\s\S]*?)```|~~~(\w*)\n?([\s\S]*?)~~~/g;
  let fm: RegExpExecArray | null;
  while ((fm = FENCED.exec(rawText)) !== null) {
    const hint = (fm[1] || fm[3] || "").toLowerCase().trim();
    const code = (fm[2] || fm[4] || "").trim();
    if (code.length < 10) continue;
    const lang = hint && hljs.getLanguage(hint) ? hint : detectLang(code);
    blocks.push({ index: 0, lang, code, lines: code.split("\n").length });
  }

  if (blocks.length > 0) return indexBlocks(blocks);

  // Strategy 3: IPYNB source cells
  if (rawText.includes('"source"') && rawText.includes('"cell_type"')) {
    try {
      const nb = JSON.parse(rawText);
      for (const cell of nb.cells ?? []) {
        if (cell.cell_type !== "code") continue;
        const code = (cell.source as string[]).join("").trim();
        if (code.length < 10) continue;
        const lang = detectLang(code);
        if (lang !== "unknown") {
          blocks.push({ index: 0, lang, code, lines: code.split("\n").length });
        }
      }
    } catch { /* not valid JSON */ }
  }

  return indexBlocks(blocks);
}

function indexBlocks(blocks: CodeBlock[]): CodeBlock[] {
  return blocks.map((b, i) => ({ ...b, index: i }));
}

/* ─── Document parser via officeparser ─── */
async function parseDocument(buffer: Buffer, filename: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const officeparser = require("officeparser");
  const ext = filename.split(".").pop()?.toLowerCase() ?? "pdf";
  const ast = await officeparser.parseOffice(buffer, { fileType: ext });
  return ast.toText();
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

    // IPYNB — handle as plain JSON, strategy 3 in extractFromText
    let rawText = "";
    if (file.name.toLowerCase().endsWith(".ipynb")) {
      rawText = buffer.toString("utf-8");
    } else {
      rawText = await parseDocument(buffer, file.name);
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: "File kosong atau tidak dapat dibaca" }, { status: 422 });
    }

    const blocks = extractFromText(rawText);
console.log("=== RAW 3000-6000 ===");
console.log(rawText.slice(3000, 6000));
console.log("=== END ===");
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
