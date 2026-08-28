// Download snippet: GET /api/snippets/[id]/download?block=-1
//   block=-1 (default) → download ALL blocks joined into one file
//   block=N            → download only block N
//
// File extension is chosen from the dominant language of the snippet.

import { NextRequest, NextResponse } from "next/server";
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
  const blockIdx = parseInt(blockParam, 10);

  const snip = await db.snippet.findUnique({ where: { id } });
  if (!snip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks: { index: number; lang: string; code: string; lines: number }[] =
    JSON.parse(snip.blocksJson);

  let body = "";
  if (blockIdx === -1) {
    // All blocks, joined with a comment separator between them.
    const sep = "#".repeat(60);
    body = blocks
      .map((b, i) => {
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
  const base = snip.originalFilename.replace(/\.[^.]+$/, "");
  const filename = `${base || "codelooter"}.${ext}`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
