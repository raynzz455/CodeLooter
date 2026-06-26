import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/extract
 *
 * Accepts a multipart/form-data request with:
 *   - file: the uploaded document
 *   - lang: target language id (optional, for filtering)
 *
 * Returns:
 *   { blocks: { lang: string; code: string }[] }
 *
 * TODO: implement hybrid parsing
 *   1. Try client-side first (pdf.js / mammoth) — handled in frontend
 *   2. If file is too large (>10MB) or client fails, POST to this endpoint
 *   3. Server uses: pdfminer-six (PDF), python-docx (DOCX), python-pptx (PPTX)
 *      via a Python FastAPI microservice OR via edge-compatible WASM builds
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const lang = formData.get("lang") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Placeholder response — replace with real parser
    return NextResponse.json({
      blocks: [
        {
          lang: lang ?? "unknown",
          code: `# Server-side extraction result for: ${file.name}\n# TODO: implement real parser`,
          lines: 2,
        },
      ],
      filename: file.name,
      size: file.size,
    });
  } catch (err) {
    console.error("[/api/extract]", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}

// Increase body size limit to 50MB for large documents
export const config = {
  api: {
    bodyParser: false,
  },
};
