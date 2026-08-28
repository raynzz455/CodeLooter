// Snippet API: list & create.
//  GET  /api/snippets            → list all snippets (newest first)
//  POST /api/snippets            → save a new snippet
//
// Auth is intentionally omitted for this single-user sandbox deploy; the
// snippet store is shared (no user accounts in Phase 1).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const snippets = await db.snippet.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      originalFilename: true,
      totalBlocks: true,
      fileSize: true,
      extractedLang: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ snippets });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.blocks)) {
    return NextResponse.json(
      { error: "Body must be { filename, blocks, lang, size }" },
      { status: 400 },
    );
  }
  const blocks = body.blocks;
  const filename = String(body.filename || "snippet.txt");
  const lang = String(body.lang || "auto");
  const size = Number(body.size || 0);

  const created = await db.snippet.create({
    data: {
      originalFilename: filename,
      blocksJson: JSON.stringify(blocks),
      totalBlocks: blocks.length,
      fileSize: size,
      extractedLang: lang,
    },
  });
  return NextResponse.json({ id: created.id, totalBlocks: created.totalBlocks });
}
