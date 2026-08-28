// CodeLooter — client-side API helpers

export interface CodeBlock {
  index: number;
  lang: string;
  code: string;
  lines: number;
  source: string;
}

export interface ExtractStats {
  extractorVersion: string;
  method: string;
  rawBlocks: number;
  mergedBlocks: number;
  strippedROutput: number;
  repairedWraps: number;
  filteredNarasi: number;
  durationMs: number;
  removedLines?: string[];
}

export interface ExtractResult {
  blocks: CodeBlock[];
  filename: string;
  size: number;
  total: number;
  stats: ExtractStats | null;
  cached?: boolean;
}

export interface SnippetMeta {
  id: string;
  originalFilename: string;
  totalBlocks: number;
  fileSize: number;
  extractedLang: string;
  // Comma-separated tags (e.g. "statistika, modul3") — empty string when
  // the snippet has no tags. Split on "," and trim each entry to recover
  // the individual tag list for display.
  tags?: string;
  createdAt: string;
}

export interface SnippetDetail extends SnippetMeta {
  blocks: CodeBlock[];
}

export async function extractFile(file: File, lang: string): Promise<ExtractResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/extract?lang=${encodeURIComponent(lang)}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface BatchResult {
  filename: string;
  blocks: CodeBlock[];
  total: number;
  size: number;
  stats: ExtractStats | null;
  error?: string;
}

export async function extractBatch(files: File[], lang: string): Promise<BatchResult[]> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const res = await fetch(`/api/extract/batch?lang=${encodeURIComponent(lang)}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.results;
}

export async function listSnippets(): Promise<SnippetMeta[]> {
  const res = await fetch("/api/snippets");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.snippets;
}

export async function saveSnippet(
  filename: string,
  blocks: CodeBlock[],
  lang: string,
  size: number,
  tags?: string,
): Promise<{ id: string }> {
  const res = await fetch("/api/snippets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, blocks, lang, size, tags }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getSnippet(id: string): Promise<SnippetDetail> {
  const res = await fetch(`/api/snippets/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Update an existing snippet's blocks and language in-place via PATCH
// /api/snippets/[id]. Used by the inline editor flow — the user edits a
// previously-saved snippet in the ResultPanel and clicks "Update" to
// persist the changes back to the same snippet record (rather than saving
// a brand-new snippet). Returns the updated snippet detail.
//
// `tags` is optional: when provided, the snippet's tag string is replaced;
// when omitted, the existing tags are left untouched on the server.
export async function updateSnippet(
  id: string,
  blocks: CodeBlock[],
  lang: string,
  tags?: string,
): Promise<SnippetDetail> {
  const payload: Record<string, unknown> = { blocks, lang };
  if (tags !== undefined) payload.tags = tags;
  const res = await fetch(`/api/snippets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteSnippet(id: string): Promise<void> {
  const res = await fetch(`/api/snippets/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function downloadSnippetUrl(id: string, block = -1): string {
  return `/api/snippets/${id}/download?block=${block}`;
}

// URL for downloading all blocks of a snippet packaged as a single ZIP archive
// (each block becomes a separate file: block_0.<ext>, block_1.<ext>, ...).
export function downloadSnippetZipUrl(id: string): string {
  return `/api/snippets/${id}/download?format=zip`;
}
