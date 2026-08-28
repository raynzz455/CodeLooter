// Snippet duplicate:
//   POST /api/snippets/[id]/duplicate → clone an existing snippet
//
// Creates a NEW snippet record whose blocksJson, totalBlocks, fileSize,
// extractedLang and tags are copied from the source snippet. The
// originalFilename gets a " (copy)" suffix so the clone is visually
// distinct in the snippet list (a second duplicate of the same source
// still gets " (copy)" rather than " (copy 2)" — the user can rename via
// the inline editor if they want unique names).
//
// The source snippet is left untouched.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const src = await db.snippet.findUnique({ where: { id } });
  if (!src) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Append " (copy)" to the filename. If the source filename already ends
  // with " (copy)" (i.e. duplicating a duplicate) we don't stack another
  // suffix — keeps names reasonable.
  const baseName = src.originalFilename;
  const newName = baseName.endsWith(" (copy)")
    ? baseName
    : `${baseName} (copy)`;

  const created = await db.snippet.create({
    data: {
      originalFilename: newName,
      blocksJson: src.blocksJson,
      totalBlocks: src.totalBlocks,
      fileSize: src.fileSize,
      extractedLang: src.extractedLang,
      tags: src.tags,
    },
  });

  return NextResponse.json({
    id: created.id,
    totalBlocks: created.totalBlocks,
  });
}
