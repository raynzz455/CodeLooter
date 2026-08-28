// CodeLooter — In-memory extraction cache
// Keyed on file-content hash + extractor version + forced language.
// The language is part of the key because different language selections
// produce different output (force-override changes all block.lang fields).

import type { ExtractResult } from "./types";
import { EXTRACTOR_VERSION } from "./types";
import { createHash } from "crypto";

interface CacheEntry {
  version: string;
  result: ExtractResult;
  hits: number;
  createdAt: number;
}

const store = new Map<string, CacheEntry>();
const MAX_ENTRIES = 200;

export function hashContent(content: Buffer, lang?: string): string {
  const h = createHash("sha256").update(content).digest("hex");
  return lang ? `${h}:${lang}` : h;
}

export function getCache(content: Buffer, lang?: string): ExtractResult | null {
  const key = hashContent(content, lang);
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.version !== EXTRACTOR_VERSION) {
    // Stale — invalidate.
    store.delete(key);
    return null;
  }
  entry.hits++;
  return entry.result;
}

export function setCache(content: Buffer, result: ExtractResult, lang?: string): void {
  const key = hashContent(content, lang);
  if (store.size >= MAX_ENTRIES) {
    // Evict the oldest entry.
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(key, {
    version: EXTRACTOR_VERSION,
    result,
    hits: 0,
    createdAt: Date.now(),
  });
}

export function clearCache(): number {
  const n = store.size;
  store.clear();
  return n;
}

export function getCacheStats(): { entries: number; version: string; topHits: { key: string; hits: number }[] } {
  const top = Array.from(store.entries())
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 5)
    .map(([k, v]) => ({ key: k.slice(0, 12), hits: v.hits }));
  return { entries: store.size, version: EXTRACTOR_VERSION, topHits: top };
}
