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
): Promise<{ id: string }> {
  const res = await fetch("/api/snippets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, blocks, lang, size }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getSnippet(id: string): Promise<SnippetDetail> {
  const res = await fetch(`/api/snippets/${id}`);
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
