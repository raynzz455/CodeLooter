// POST /api/extract/batch?lang=r
// Accept multiple files via FormData (field "files", multiple values) and
// return extraction results for each file. Files are processed sequentially
// to avoid memory spikes.
//
// Response:
//   { results: [{ filename, blocks, total, size, stats, error? }] }

import { NextRequest, NextResponse } from "next/server";
import { extractFromFile, ALL_SUPPORTED_EXTS } from "@/lib/extractor";
import type { CodeBlock, ExtractStats } from "@/lib/extractor/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface BatchResultItem {
  filename: string;
  blocks: CodeBlock[];
  total: number;
  size: number;
  stats: ExtractStats | null;
  error?: string;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f) => f instanceof File) as File[];
  const lang = (req.nextUrl.searchParams.get("lang") || "auto").toLowerCase();

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Missing 'files' field(s) in form data" },
      { status: 400 },
    );
  }
  if (files.length > 10) {
    return NextResponse.json(
      { error: "Maksimal 10 file per batch" },
      { status: 400 },
    );
  }

  const results: BatchResultItem[] = [];
  const MAX_BYTES = 50 * 1024 * 1024;

  for (const file of files) {
    const filename = file.name || "upload.txt";
    const ext = (filename.split(".").pop() || "").toLowerCase();
    if (!ALL_SUPPORTED_EXTS.has(ext)) {
      results.push({
        filename,
        blocks: [],
        total: 0,
        size: file.size,
        stats: null,
        error: `Format .${ext} tidak didukung`,
      });
      continue;
    }
    const content = Buffer.from(await file.arrayBuffer());
    if (content.length > MAX_BYTES) {
      results.push({
        filename,
        blocks: [],
        total: 0,
        size: content.length,
        stats: null,
        error: `File terlalu besar (${(content.length / 1024 / 1024).toFixed(1)}MB > 50MB)`,
      });
      continue;
    }
    try {
      const result = await extractFromFile({ filename, content, lang });
      results.push({
        filename,
        blocks: result.blocks,
        total: result.total,
        size: result.size,
        stats: result.stats,
      });
    } catch (err: any) {
      results.push({
        filename,
        blocks: [],
        total: 0,
        size: content.length,
        stats: null,
        error: err?.message ?? String(err),
      });
    }
  }

  return NextResponse.json({ results });
}
