// Snippet detail & delete: GET /api/snippets/[id], DELETE /api/snippets/[id]

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
    createdAt: snip.createdAt,
  });
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
