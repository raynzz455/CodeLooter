"use client";

import { Loader2 } from "lucide-react";

interface UploadPanelProps {
  // Phase 1 stats badges, shown after an extraction.
  stats: {
    repairedWraps: number;
    mergedBlocks: number;
    strippedROutput: number;
    filteredNarasi: number;
    method: string;
    durationMs: number;
    cached?: boolean;
  } | null;
}

export function StatsBar({ stats }: UploadPanelProps) {
  if (!stats) return null;
  const items: { label: string; value: string; tone: string }[] = [
    {
      label: "Method",
      value: stats.method,
      tone: "text-foreground",
    },
    {
      label: "Line-wraps repaired",
      value: String(stats.repairedWraps),
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Blocks merged",
      value: String(stats.mergedBlocks),
      tone: "text-teal-600 dark:text-teal-400",
    },
    {
      label: "R-output stripped",
      value: String(stats.strippedROutput),
      tone: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Narrative filtered",
      value: String(stats.filteredNarasi),
      tone: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Duration",
      value: `${stats.durationMs} ms`,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
      {stats.cached && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Loader2 className="h-3 w-3 animate-spin" />
          from cache
        </span>
      )}
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-1.5 rounded-md bg-background/70 px-2.5 py-1 text-xs"
        >
          <span className="text-muted-foreground">{it.label}</span>
          <span className={`font-mono font-semibold ${it.tone}`}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}
