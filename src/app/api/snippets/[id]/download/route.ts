// Download snippet:
//   GET /api/snippets/[id]/download?block=-1
//     block=-1 (default) → download ALL blocks joined into one text file
//     block=N            → download only block N
//   GET /api/snippets/[id]/download?format=zip
//     → download ALL blocks as separate files inside a single ZIP archive
//       (block_0.<ext>, block_1.<ext>, ...).
//
// File extension is chosen from the language of each block (zip) or the
// dominant language of the snippet (text).

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function extForLang(lang: string): string {
  switch (lang) {
    case "r": return "R";
    case "python": return "py";
    case "sql": return "sql";
    case "java": return "java";
    case "cpp": return "cpp";
    case "javascript": return "js";
    case "typescript": return "ts";
    case "php": return "php";
    case "kotlin": return "kt";
    case "go": return "go";
    case "rust": return "rs";
    case "bash": return "sh";
    case "html": return "html";
    case "css": return "css";
    case "json": return "json";
    default: return "txt";
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const blockParam = req.nextUrl.searchParams.get("block") ?? "-1";
  const formatParam = req.nextUrl.searchParams.get("format");
  const blockIdx = parseInt(blockParam, 10);

  const snip = await db.snippet.findUnique({ where: { id } });
  if (!snip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks: { index: number; lang: string; code: string; lines: number }[] =
    JSON.parse(snip.blocksJson);

  const base = snip.originalFilename.replace(/\.[^.]+$/, "") || "codelooter";

  // ===== ZIP format =====
  // Each block becomes a separate file inside the archive.
  if (formatParam === "zip") {
    const zip = new JSZip();
    const used = new Map<string, number>(); // guard against duplicate filenames
    for (const b of blocks) {
      const ext = extForLang(b.lang);
      let name = `block_${b.index}.${ext}`;
      // De-duplicate in the rare case two blocks produce the same name.
      if (used.has(name)) {
        const n = used.get(name)! + 1;
        used.set(name, n);
        name = `block_${b.index}_${n}.${ext}`;
      } else {
        used.set(name, 0);
      }
      zip.file(name, b.code);
    }
    const zipBlob = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const filename = `${base}_blocks.zip`;
    return new NextResponse(zipBlob as Uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ===== Plain text format =====
  let body = "";
  if (blockIdx === -1) {
    // All blocks, joined with a comment separator between them.
    const sep = "#".repeat(60);
    body = blocks
      .map((b) => {
        const header = `# Block #${b.index} | ${b.lang} | ${b.lines} lines`;
        return `${sep}\n${header}\n${sep}\n${b.code}`;
      })
      .join("\n\n");
  } else {
    const b = blocks.find((x) => x.index === blockIdx);
    if (!b) return NextResponse.json({ error: "Block not found" }, { status: 404 });
    body = b.code;
  }

  const dominantLang = snip.extractedLang !== "auto"
    ? snip.extractedLang
    : (blocks[0]?.lang || "unknown");
  const ext = extForLang(dominantLang);
  const filename = `${base}.${ext}`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
