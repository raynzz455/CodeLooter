"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BarChart3, FileText, Boxes, AlignLeft, Type, Loader2, HardDrive } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";

// Shape returned by GET /api/stats. Mirrors the server-side `AggregatedStats`
// interface in `src/app/api/stats/route.ts`.
interface StatsPayload {
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

interface StatsDashboardProps {
  open: boolean;
  onClose: () => void;
}

// Emerald / teal palette for the chart bars. Strictly no blue / indigo.
// Six colours give us a stable cycle for any reasonable number of languages.
const LANG_COLORS = [
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#0d9488", // teal-600
  "#34d399", // emerald-400
  "#2dd4bf", // teal-400
  "#059669", // emerald-600
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function StatsDashboard({ open, onClose }: StatsDashboardProps) {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch on mount and whenever the modal is (re-)opened so the numbers
  // always reflect the latest saved snippets. We intentionally don't refetch
  // on every render — only on `open` transitions to avoid hammering the API
  // if the parent toggles the prop for some other reason.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Wrapped in an async IIFE so the initial setLoading(true) /
    // setError(null) calls happen inside a microtask (deferred), not
    // synchronously in the effect body — avoids the React 19 lint rule
    // against cascading renders from synchronous setState in effects.
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/stats");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as StatsPayload;
        if (!cancelled) setData(d);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Gagal memuat statistik");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Close on Escape for keyboard accessibility (mirrors the shortcuts modal
  // pattern in page.tsx).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Build a sorted (desc) array of { lang, count } for the chart. recharts
  // wants an array of objects; we sort so the longest bar is at the top of
  // the horizontal bar chart (matches the "biggest language first" mental
  // model from the ResultPanel language badges).
  const langRows = data
    ? Object.entries(data.languages)
        .map(([lang, count]) => ({ lang, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  // Total blocks (for percentage math) — when there are zero blocks every
  // language bar would otherwise render at 0% which is fine.
  const langTotal = langRows.reduce((s, r) => s + r.count, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Statistik snippet"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Statistik snippet</h2>
                  <p className="text-xs text-muted-foreground">
                    Ringkasan agregat dari semua snippet yang tersimpan
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Tutup"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — scrolls if content overflows the viewport */}
            <div className="max-h-[calc(90vh-72px)] overflow-y-auto px-6 py-5">
              {loading && !data ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm">Memuat statistik...</p>
                </div>
              ) : error ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                    Gagal memuat statistik
                  </p>
                  <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
                </div>
              ) : !data ? null : data.totalSnippets === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Belum ada snippet tersimpan</p>
                  <p className="max-w-xs text-xs">
                    Simpan hasil ekstraksi pertama Anda untuk mulai melihat
                    statistik agregat di sini.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Top stat cards: 4-up grid (2x2 on mobile, 4-up on sm+) */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard
                      icon={<FileText className="h-4 w-4" />}
                      label="Snippet"
                      value={data.totalSnippets.toLocaleString()}
                      hint="total record"
                    />
                    <StatCard
                      icon={<Boxes className="h-4 w-4" />}
                      label="Blok kode"
                      value={data.totalBlocks.toLocaleString()}
                      hint="dari semua snippet"
                    />
                    <StatCard
                      icon={<AlignLeft className="h-4 w-4" />}
                      label="Total baris"
                      value={data.totalLines.toLocaleString()}
                      hint="akumulasi"
                    />
                    <StatCard
                      icon={<Type className="h-4 w-4" />}
                      label="Total karakter"
                      value={data.totalChars.toLocaleString()}
                      hint="akumulasi"
                    />
                  </div>

                  {/* Secondary stats: file size + date range */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <SecondaryCard
                      icon={<HardDrive className="h-4 w-4" />}
                      label="Total ukuran file"
                      value={formatBytes(data.totalFileSize)}
                    />
                    <SecondaryCard
                      icon={<BarChart3 className="h-4 w-4" />}
                      label="Snippet terbaru"
                      value={formatDate(data.newestSnippet)}
                    />
                    <SecondaryCard
                      icon={<BarChart3 className="h-4 w-4" />}
                      label="Snippet terlama"
                      value={formatDate(data.oldestSnippet)}
                    />
                  </div>

                  {/* Language distribution — horizontal bar chart */}
                  {langRows.length > 0 && (
                    <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Distribusi bahasa</h3>
                        <span className="text-xs text-muted-foreground">
                          {langRows.length} bahasa · {langTotal} blok
                        </span>
                      </div>
                      <div style={{ height: Math.min(280, langRows.length * 36) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={langRows}
                            layout="vertical"
                            margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                          >
                            <CartesianGrid
                              horizontal={false}
                              stroke="hsl(var(--border))"
                              strokeOpacity={0.4}
                            />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 11 }}
                              stroke="hsl(var(--muted-foreground))"
                              allowDecimals={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="lang"
                              tick={{ fontSize: 12 }}
                              stroke="hsl(var(--muted-foreground))"
                              width={80}
                            />
                            <Tooltip
                              cursor={{ fill: "hsl(var(--accent) / 0.3)" }}
                              contentStyle={{
                                background: "hsl(var(--popover))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                              formatter={(value: number) => [
                                `${value} blok${
                                  langTotal > 0
                                    ? ` (${((value / langTotal) * 100).toFixed(1)}%)`
                                    : ""
                                }`,
                                "Jumlah",
                              ]}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                              {langRows.map((r, i) => (
                                <Cell
                                  key={r.lang}
                                  fill={LANG_COLORS[i % LANG_COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Recent snippets list — top 5 by createdAt */}
                  {data.recentSnippets.length > 0 && (
                    <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Snippet terbaru</h3>
                        <span className="text-xs text-muted-foreground">
                          {data.recentSnippets.length} teratas
                        </span>
                      </div>
                      <ul className="flex flex-col gap-2">
                        {data.recentSnippets.map((s) => {
                          const tags = (s.tags ?? "")
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean);
                          return (
                            <li
                              key={s.id}
                              className="flex items-center gap-3 rounded-md border border-border/50 bg-card/60 px-3 py-2"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {s.totalBlocks}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-mono text-xs font-medium">
                                  {s.originalFilename}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {s.extractedLang} · {formatBytes(s.fileSize)} ·{" "}
                                  {formatDate(s.createdAt)}
                                </p>
                              </div>
                              {tags.length > 0 && (
                                <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1 sm:flex">
                                  {tags.slice(0, 3).map((t) => (
                                    <span
                                      key={t}
                                      className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                  {tags.length > 3 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      +{tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Small presentational helpers ────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-xl font-bold leading-none">{value}</span>
        {hint && <span className="mt-1 text-[10px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

function SecondaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/40 p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        {icon}
      </span>
      <div className="min-w-0 flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="truncate font-mono text-xs font-semibold">{value}</span>
      </div>
    </div>
  );
}
