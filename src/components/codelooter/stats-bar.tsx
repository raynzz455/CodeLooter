"use client";

import { Database, Zap, GitMerge, Eraser, Filter, Clock } from "lucide-react";

interface StatsBarProps {
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

export function StatsBar({ stats }: StatsBarProps) {
  if (!stats) return null;
  const items: { label: string; value: string; tone: string; icon: React.ReactNode }[] = [
    {
      label: "Method",
      value: stats.method,
      tone: "text-foreground",
      icon: <Zap className="h-3 w-3" />,
    },
    {
      label: "Line-wraps repaired",
      value: String(stats.repairedWraps),
      tone: "text-emerald-600 dark:text-emerald-400",
      icon: <Zap className="h-3 w-3" />,
    },
    {
      label: "Blocks merged",
      value: String(stats.mergedBlocks),
      tone: "text-teal-600 dark:text-teal-400",
      icon: <GitMerge className="h-3 w-3" />,
    },
    {
      label: "R-output stripped",
      value: String(stats.strippedROutput),
      tone: "text-amber-600 dark:text-amber-400",
      icon: <Eraser className="h-3 w-3" />,
    },
    {
      label: "Narrative filtered",
      value: String(stats.filteredNarasi),
      tone: "text-rose-600 dark:text-rose-400",
      icon: <Filter className="h-3 w-3" />,
    },
    {
      label: "Duration",
      value: `${stats.durationMs} ms`,
      tone: "text-muted-foreground",
      icon: <Clock className="h-3 w-3" />,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
      {stats.cached && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Database className="h-3 w-3" />
          from cache
        </span>
      )}
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-1.5 rounded-md bg-background/70 px-2.5 py-1 text-xs transition-colors hover:bg-background"
          title={it.label}
        >
          <span className="text-muted-foreground">{it.icon}</span>
          <span className="text-muted-foreground">{it.label}</span>
          <span className={`font-mono font-semibold ${it.tone}`}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}
