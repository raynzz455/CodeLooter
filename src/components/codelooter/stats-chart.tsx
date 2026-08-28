"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import type { ExtractStats } from "@/lib/codelooter-api";

interface StatsChartProps {
  stats: ExtractStats;
}

const COLORS: Record<string, string> = {
  "Line-wraps repaired": "#10b981", // emerald
  "Blocks merged": "#14b8a6", // teal
  "R-output stripped": "#f59e0b", // amber
  "Narrative filtered": "#f43f5e", // rose
};

export function StatsChart({ stats }: StatsChartProps) {
  const data = [
    { name: "Line-wraps", label: "Line-wraps repaired", value: stats.repairedWraps },
    { name: "Merged", label: "Blocks merged", value: stats.mergedBlocks },
    { name: "R-output", label: "R-output stripped", value: stats.strippedROutput },
    { name: "Narrative", label: "Narrative filtered", value: stats.filteredNarasi },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return null; // Don't show chart if all values are 0
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-semibold text-muted-foreground">
          Visualisasi perbaikan Phase 1
        </span>
      </div>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: "currentColor" }}
              width={70}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "11px",
                color: "var(--popover-foreground)",
              }}
              formatter={(value: number, _name, item) => [`${value} baris`, item.payload.label]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
              {data.map((entry, i) => (
                <Cell key={i} fill={COLORS[entry.label] || "#10b981"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
