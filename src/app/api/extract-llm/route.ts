// POST /api/extract-llm?lang=r
//
// Accepts a file upload (PDF, MD, IPYNB, HTML, TXT, TEX) and uses an LLM
// (z-ai-web-dev-sdk) to identify code blocks in the extracted text. Falls
// back to the pattern-based extractor if the LLM call fails or times out
// (30s soft timeout). The endpoint never throws because of the LLM — it
// always returns an ExtractResult, either from the LLM or from the
// pattern fallback.
//
// IMPORTANT: z-ai-web-dev-sdk is used ONLY in this server route. Never
// import it from client components — it would leak credentials and bundle
// server-only code into the client.

import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import {
  extractFromFile,
  ALL_SUPPORTED_EXTS,
} from "@/lib/extractor";
import { extractPdfTextPureTs } from "@/lib/extractor/pdf-pure";
import type { CodeBlock, ExtractResult, ExtractStats } from "@/lib/extractor/types";
import { EXTRACTOR_VERSION } from "@/lib/extractor/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Hard cap on the text we feed the LLM — keeps token usage sane and the
// request well under the 30s timeout. 30k chars ≈ 7-8k tokens.
const MAX_LLM_CHARS = 30_000;

// Allowed language IDs the LLM may emit in its JSON response. Anything
// outside this set is normalised to "unknown".
const ALLOWED_LANGS = new Set([
  "r", "python", "sql", "java", "cpp", "javascript", "typescript",
  "php", "kotlin", "go", "rust", "bash", "html", "css", "json",
]);

interface LlmBlock {
  lang: string;
  code: string;
  lines?: number;
}

// ─── Extract raw text (without going through the pattern extractor) ───
// We only need the textual content for the LLM — block extraction is the
// LLM's job. The fallback path still uses the full pattern pipeline via
// `extractFromFile`.
function extractRawText(filename: string, content: Buffer): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") {
    try {
      const r = extractPdfTextPureTs(content);
      return r.text;
    } catch {
      return "";
    }
  }
  // For everything else (md, ipynb, html, tex, txt) the raw bytes ARE the
  // text — the LLM can parse the structure itself.
  return content.toString("utf-8");
}

// ─── Call the LLM and parse the JSON array of blocks ───
async function extractWithLLM(text: string, hintLang: string): Promise<{
  blocks: LlmBlock[];
  ok: boolean;
  error?: string;
}> {
  if (!text.trim()) {
    return { blocks: [], ok: false, error: "empty text" };
  }
  const truncated = text.length > MAX_LLM_CHARS
    ? text.slice(0, MAX_LLM_CHARS) + "\n\n[... TRUNCATED ...]"
    : text;

  const systemPrompt =
    "You are a code extraction expert. Given the following text from a document, " +
    "identify ALL code blocks. Return a JSON array where each element has: " +
    "lang (r/python/sql/java/cpp/javascript/typescript/php/kotlin/go/rust/bash/html/css/json), " +
    "code (the code string), and lines (line count). " +
    "Only return the JSON array, no other text.";

  const userPrompt =
    (hintLang && hintLang !== "auto"
      ? `The user expects the code to be primarily in: ${hintLang}. ` +
        `If a block's language is ambiguous, prefer ${hintLang}.\n\n`
      : "") +
    `Document text:\n\n${truncated}`;

  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { blocks: [], ok: false, error: `ZAI.create() failed: ${msg}` };
  }

  let completion: { choices?: Array<{ message?: { content?: string } }> };
  try {
    completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { blocks: [], ok: false, error: `chat.completions.create failed: ${msg}` };
  }

  const rawContent: string = completion?.choices?.[0]?.message?.content ?? "";

  // Strip any ```json ... ``` fences the LLM may have wrapped the answer in.
  const stripped = rawContent
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { blocks: [], ok: false, error: `JSON.parse failed: ${msg}` };
  }

  if (!Array.isArray(parsed)) {
    return { blocks: [], ok: false, error: "LLM did not return a JSON array" };
  }

  // Validate + normalise each block.
  const blocks: LlmBlock[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const code = typeof obj.code === "string" ? obj.code : "";
    if (code.trim().length < 5) continue;
    const rawLang = String(obj.lang ?? "").toLowerCase().trim();
    const lang = ALLOWED_LANGS.has(rawLang) ? rawLang : "unknown";
    const lines =
      typeof obj.lines === "number" && obj.lines > 0
        ? obj.lines
        : code.split("\n").length;
    blocks.push({ lang, code: code.replace(/\r\n/g, "\n").trimEnd(), lines });
  }

  return { blocks, ok: true };
}

// ─── Timeout helper ───
function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// ─── Build an ExtractResult from raw LLM blocks ───
function buildResult(
  blocks: LlmBlock[],
  filename: string,
  size: number,
  lang: string,
  method: string,
  durationMs: number,
  fallback?: ExtractResult,
): ExtractResult {
  const finalBlocks: CodeBlock[] = blocks.map((b, i) => ({
    index: i,
    lang: lang && lang !== "auto" ? lang : b.lang,
    code: b.code,
    lines: b.lines ?? b.code.split("\n").length,
    source: "llm",
  }));

  const stats: ExtractStats = {
    extractorVersion: EXTRACTOR_VERSION,
    method,
    rawBlocks: blocks.length,
    mergedBlocks: 0,
    strippedROutput: 0,
    repairedWraps: 0,
    filteredNarasi: 0,
    durationMs,
    removedLines: [],
  };

  // If the LLM produced zero blocks but the pattern fallback found some,
  // surface the fallback blocks instead of an empty array — better UX.
  if (finalBlocks.length === 0 && fallback && fallback.blocks.length > 0) {
    return {
      ...fallback,
      stats: { ...fallback.stats, method: `${fallback.stats?.method ?? "pattern"}+llm-empty` },
      cached: false,
    };
  }

  return {
    blocks: finalBlocks,
    filename,
    size,
    total: finalBlocks.length,
    stats,
    cached: false,
  };
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field in form data" },
      { status: 400 },
    );
  }

  const lang = (req.nextUrl.searchParams.get("lang") || "auto").toLowerCase();
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

  const start = Date.now();

  // Step 1: extract raw text from the file (PDF needs the pure-TS parser,
  // other formats are just utf-8 bytes).
  const rawText = extractRawText(filename, content);

  // Step 2: ask the LLM to identify code blocks, with a 30s soft timeout.
  let llmResult: { blocks: LlmBlock[]; ok: boolean; error?: string } | null = null;
  try {
    llmResult = await withTimeout(
      extractWithLLM(rawText, lang),
      30_000,
      "LLM extraction",
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    llmResult = { blocks: [], ok: false, error: msg };
  }

  // Step 3a: if the LLM succeeded and produced blocks, build the result.
  if (llmResult && llmResult.ok && llmResult.blocks.length > 0) {
    const result = buildResult(
      llmResult.blocks,
      filename,
      content.length,
      lang,
      "llm",
      Date.now() - start,
    );
    return NextResponse.json(result);
  }

  // Step 3b: fallback to the pattern extractor. We always do this if the
  // LLM failed OR returned zero blocks — that way the user always gets
  // SOMETHING back. (The buildResult() helper handles the zero-block case
  // by surfacing the pattern blocks when the LLM had nothing.)
  let patternResult: ExtractResult;
  try {
    patternResult = await extractFromFile({ filename, content, lang });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Ekstraksi gagal: ${msg}` },
      { status: 500 },
    );
  }

  const method = llmResult?.ok
    ? `pattern-fallback (llm-empty: ${llmResult.error ?? "no blocks"})`
    : `pattern-fallback (llm-error: ${llmResult?.error ?? "unknown"})`;

  return NextResponse.json(
    buildResult(
      [],
      filename,
      content.length,
      lang,
      method,
      Date.now() - start,
      patternResult,
    ),
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "POST a file to /api/extract-llm?lang=r to extract code blocks via LLM (with pattern fallback).",
  });
}
