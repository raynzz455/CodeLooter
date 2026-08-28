// Snippet statistics API:
//   GET /api/stats  → aggregate counts across all stored snippets
//
// Aggregates: total snippets, total blocks, total lines, total chars,
// total file size, per-language block counts, the 5 most-recent snippets
// (by createdAt), and the oldest / newest snippet timestamps. Used by the
// in-app StatsDashboard modal (opened from the header).
//
// Auth is intentionally omitted for this single-user sandbox deploy; the
// snippet store is shared (no user accounts in Phase 1).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Shape of a single block stored inside `Snippet.blocksJson`. We only
// touch the three fields we need for aggregation — `lang`, `code`, and
// `lines` — and tolerate missing / wrong-typed values so a single
// malformed record never breaks the whole dashboard.
interface StoredBlock {
  lang?: unknown;
  code?: unknown;
  lines?: unknown;
}

interface AggregatedStats {
  totalSnippets: number;
  totalBlocks: number;
  totalLines: number;
  totalChars: number;
  totalFileSize: number;
  languages: Record<string, number>;
  recentSnippets: Array<{
    id: string;
    originalFilename: string;
    totalBlocks: number;
    fileSize: number;
    extractedLang: string;
    tags: string;
    createdAt: string;
  }>;
  oldestSnippet: string | null;
  newestSnippet: string | null;
}

export async function GET() {
  // Pull all snippets (newest-first so `recentSnippets` is just the first 5).
  // We deliberately fetch the raw `blocksJson` column because every aggregate
  // (block count, language counts, total lines, total chars) needs to inspect
  // the per-block payload, not just the denormalized `totalBlocks` counter.
  const snippets = await db.snippet.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalFilename: true,
      totalBlocks: true,
      fileSize: true,
      extractedLang: true,
      tags: true,
      createdAt: true,
      blocksJson: true,
    },
  });

  const stats: AggregatedStats = {
    totalSnippets: snippets.length,
    totalBlocks: 0,
    totalLines: 0,
    totalChars: 0,
    totalFileSize: 0,
    languages: {},
    recentSnippets: [],
    oldestSnippet: null,
    newestSnippet: null,
  };

  // `snippets` is newest-first, so the first iteration is the newest and the
  // last is the oldest. Track an index so we can also build the recent-5 list
  // without a second pass.
  for (let i = 0; i < snippets.length; i++) {
    const s = snippets[i];
    stats.totalFileSize += s.fileSize;
    if (i === 0) stats.newestSnippet = s.createdAt.toISOString();
    stats.oldestSnippet = s.createdAt.toISOString();

    // Parse the blocks JSON defensively — a single corrupt record must never
    // take down the whole dashboard. We log nothing and just skip aggregates
    // for malformed payloads (the snippet's own row still counts toward
    // totalSnippets and totalFileSize).
    let blocks: StoredBlock[] = [];
    try {
      const parsed = JSON.parse(s.blocksJson);
      if (Array.isArray(parsed)) blocks = parsed as StoredBlock[];
    } catch {
      blocks = [];
    }

    stats.totalBlocks += blocks.length;

    for (const b of blocks) {
      // Language counts are keyed by the block's `lang` string. Unknown /
      // missing values collapse into the "unknown" bucket so the chart still
      // renders a sensible bar.
      const lang = typeof b.lang === "string" && b.lang !== "" ? b.lang : "unknown";
      stats.languages[lang] = (stats.languages[lang] || 0) + 1;

      // Total lines: prefer the stored `lines` field, fall back to a manual
      // count of the code string, fall back to 0.
      if (typeof b.lines === "number" && Number.isFinite(b.lines)) {
        stats.totalLines += b.lines;
      } else if (typeof b.code === "string") {
        stats.totalLines += b.code.split("\n").length;
      }

      // Total chars: only count the code string length when present.
      if (typeof b.code === "string") stats.totalChars += b.code.length;
    }

    // Top 5 most recent snippets (already newest-first from the query).
    if (stats.recentSnippets.length < 5) {
      stats.recentSnippets.push({
        id: s.id,
        originalFilename: s.originalFilename,
        totalBlocks: s.totalBlocks,
        fileSize: s.fileSize,
        extractedLang: s.extractedLang,
        tags: s.tags,
        createdAt: s.createdAt.toISOString(),
      });
    }
  }

  // `newestSnippet` is only null when there are zero snippets. Keep
  // `oldestSnippet` consistent: when there's only one snippet, oldest and
  // newest are the same timestamp (which is what we'd want).
  if (snippets.length === 0) {
    stats.oldestSnippet = null;
    stats.newestSnippet = null;
  }

  return NextResponse.json(stats);
}
