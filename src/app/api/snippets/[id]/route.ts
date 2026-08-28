// Snippet detail, update & delete:
//   GET    /api/snippets/[id]   → fetch one snippet (with parsed blocks)
//   PATCH  /api/snippets/[id]   → update existing snippet's blocks/lang/tags in-place
//   DELETE /api/snippets/[id]   → remove a snippet

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const snip = await db.snippet.findUnique({ where: { id } });
  if (!snip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: snip.id,
    filename: snip.originalFilename,
    blocks: JSON.parse(snip.blocksJson),
    totalBlocks: snip.totalBlocks,
    fileSize: snip.fileSize,
    extractedLang: snip.extractedLang,
    tags: snip.tags,
    createdAt: snip.createdAt,
  });
}

// Update an existing snippet's blocks / language / tags in-place.
// Body: { blocks: CodeBlock[], lang: string, tags?: string }
// The snippet's blocksJson, totalBlocks, extractedLang and tags fields are
// updated. originalFilename and fileSize are intentionally left untouched —
// the user is editing the extracted code, not re-uploading a new file.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.blocks)) {
    return NextResponse.json(
      { error: "Body must be { blocks, lang }" },
      { status: 400 },
    );
  }

  const blocks = body.blocks;
  const lang = String(body.lang || "auto");
  // Tags are optional on PATCH — only update the field when the client
  // explicitly sends a `tags` key (so callers that only want to update the
  // code don't accidentally wipe an existing tag set).
  const tagsProvided = Object.prototype.hasOwnProperty.call(body, "tags");
  const tags = tagsProvided ? String(body.tags ?? "") : undefined;

  try {
    const updated = await db.snippet.update({
      where: { id },
      data: {
        blocksJson: JSON.stringify(blocks),
        totalBlocks: blocks.length,
        extractedLang: lang,
        ...(tags !== undefined ? { tags } : {}),
      },
    });
    return NextResponse.json({
      id: updated.id,
      filename: updated.originalFilename,
      blocks: JSON.parse(updated.blocksJson),
      totalBlocks: updated.totalBlocks,
      fileSize: updated.fileSize,
      extractedLang: updated.extractedLang,
      tags: updated.tags,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch {
    // Prisma throws P2025 when the record is not found.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    await db.snippet.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
