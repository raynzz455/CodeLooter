// POST /api/extract?lang=r
// Accept a file upload (PDF, DOCX, MD, IPYNB, HTML, TXT, TEX) and return
// extracted code blocks.
//
// IMPORTANT: `lang` is REQUIRED — no auto-detect. The user MUST choose a
// programming language before extraction. This forces consistent output
// and avoids misclassification. The selected language is applied to ALL
// extracted blocks (force-override).

import { NextRequest, NextResponse } from "next/server";
import { extractFromFile, ALL_SUPPORTED_EXTS } from "@/lib/extractor";
import { getCacheStats, clearCache } from "@/lib/extractor/cache";

export const runtime = "nodejs";
export const maxDuration = 120;

// Supported languages — user must pick one.
const SUPPORTED_LANGS = new Set([
  "r", "python", "sql", "java", "cpp", "javascript",
  "typescript", "php", "kotlin", "go", "rust", "bash",
  "html", "css", "json",
]);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field in form data" },
      { status: 400 },
    );
  }
  const lang = (req.nextUrl.searchParams.get("lang") || "").toLowerCase();

  // Force language selection — no auto-detect allowed.
  if (!lang || !SUPPORTED_LANGS.has(lang)) {
    return NextResponse.json(
      { error: "Bahasa pemrograman wajib dipilih. Pilihan: " + Array.from(SUPPORTED_LANGS).sort().join(", ") },
      { status: 400 },
    );
  }

  const filename = file.name || "upload.txt";
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!ALL_SUPPORTED_EXTS.has(ext)) {
    return NextResponse.json(
      { error: `Format .${ext} tidak didukung. Format yang didukung: ${Array.from(ALL_SUPPORTED_EXTS).sort().join(", ")}` },
      { status: 400 },
    );
  }
  const content = Buffer.from(await file.arrayBuffer());
  const MAX_BYTES = 50 * 1024 * 1024;
  if (content.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `Ukuran file ${(content.length / 1024 / 1024).toFixed(1)}MB melebihi batas 50MB` },
      { status: 413 },
    );
  }

  try {
    const result = await extractFromFile({ filename, content, lang });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Ekstraksi gagal: ${err?.message ?? String(err)}` },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  // /api/extract?cache=stats | /api/extract?cache=clear
  const action = req.nextUrl.searchParams.get("cache");
  if (action === "stats") return NextResponse.json(getCacheStats());
  if (action === "clear") return NextResponse.json({ cleared: clearCache() });
  return NextResponse.json({
    ok: true,
    message: "POST a file to /api/extract?lang=r to extract code blocks.",
  });
}
