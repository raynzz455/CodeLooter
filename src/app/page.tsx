"use client";

import { useCallback, useState, useEffect } from "react";
import { FileSearch, Sparkles, Wand2, ShieldCheck, Zap, X, Keyboard, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Header } from "@/components/codelooter/header";
import { Footer } from "@/components/codelooter/footer";
import { UploadPanel } from "@/components/codelooter/upload-panel";
import { ResultPanel } from "@/components/codelooter/result-panel";
import { SnippetList } from "@/components/codelooter/snippet-list";
import { HistoryPanel } from "@/components/codelooter/history-panel";
import {
  extractFile,
  extractBatch,
  updateSnippet,
  type ExtractResult,
  type BatchResult,
  type SnippetDetail,
  type CodeBlock,
} from "@/lib/codelooter-api";
import { useHistory } from "@/lib/extraction-history";

// Built-in sample that demonstrates all four Phase 1 fixes:
//   - line-wrap (biaya_promosi vector split across lines)
//   - narrative false positive ("X-squared = 2.2222 menunjukkan bahwa…")
//   - R output (## blocks)
//   - fragmented blocks (cor.test after Interpretasi narrative)
const SAMPLE = `MODUL 3 — STATISTIKA NON-PARAMETRIK

# Kasus 1: Uji Chi-Square Kecocokan

Kode Penyelesaian:
data_ipk = "
ipk frekuensi
A 12
B 18
C 7
"
Tabel.kontingensi = as.matrix(read.table(textConnection(data_ipk),
                             header = TRUE, row.names = 1))
print(Tabel.kontingensi)
chisq.test(Tabel.kontingensi, correct = FALSE)

Output yang dihasilkan:
##
##  Chi-squared test
##
##  X-squared = 2.2222 menunjukkan bahwa penyimpangan antara data aktual
##  dan data yang diharapkan relatif kecil, dan Karena p-value = 0.136 > 0.05

# Kasus 2: Korelasi Pearson

data_penilaian <- data.frame(
  karyawan = 1:12,
  nilai_kepuasan = c(5.8, 8.1, 7.2, 9.0, 6.5, 7.8,
                     8.3, 6.9, 7.5, 8.8, 5.2, 9.3),
  kenaikan_gaji = c(3.3, 6.7, 4.2, 8.1, 3.9, 5.5,
                    7.2, 4.0, 5.9, 8.4, 3.1, 9.0))
print(data_penilaian)

Interpretasi: hasil di atas menunjukkan bahwa terdapat hubungan positif.

cor.test(data_penilaian$nilai_kepuasan, data_penilaian$kenaikan_gaji,
         method = c("pearson"), conf.level = 0.95)

# Kasus 3: Regresi Linier

library(lmtest)
tahun <- 2001:2010
biaya_promosi <- c(1500000, 1600000, 170
0000, 2200000)
volume_penjualan <- c(45000, 48000, 52000, 55000, 58000,
                      61000, 64000, 67000, 69000, 60000)
data_biaya <- data.frame(tahun, biaya_promosi, volume_penjualan)
vp <- lm(volume_penjualan ~ biaya_promosi, data = data_biaya)
summary(vp)
`;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // ID of the snippet currently loaded into the ResultPanel. When set, the
  // panel shows an extra "Update" button so the user can push edits back to
  // the same snippet record via PATCH /api/snippets/[id].
  const [currentSnippetId, setCurrentSnippetId] = useState<string | undefined>(undefined);
  // Comma-separated tags of the snippet currently loaded into the panel.
  // Mirrors `currentSnippetId` — set when a saved snippet is loaded, cleared
  // for fresh extractions / batch results / history entries. Forwarded to
  // the ResultPanel as `currentTags` so the tag input is pre-populated.
  const [currentTags, setCurrentTags] = useState<string | undefined>(undefined);

  const addHistoryEntry = useHistory((s) => s.addEntry);

  const handleExtract = useCallback(async (file: File, lang: string) => {
    setLoading(true);
    setResult(null);
    setBatchResults(null);
    // Fresh extraction has no associated snippet record — clear any stale id
    // so the ResultPanel no longer offers "Update" until the user saves.
    setCurrentSnippetId(undefined);
    // Fresh extraction also has no tags yet — clear the tag input.
    setCurrentTags(undefined);
    try {
      const r = await extractFile(file, lang);
      setResult(r);
      addHistoryEntry(r);
      if (r.total === 0) {
        toast.warning("Tidak ada blok kode terdeteksi");
      } else {
        toast.success(`${r.total} blok kode diekstrak${r.cached ? " (dari cache)" : ""}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengekstrak");
    } finally {
      setLoading(false);
    }
  }, [addHistoryEntry]);

  const handleBatchExtract = useCallback(async (files: File[], lang: string) => {
    setLoading(true);
    setResult(null);
    setBatchResults(null);
    setCurrentSnippetId(undefined);
    setCurrentTags(undefined);
    try {
      const results = await extractBatch(files, lang);
      setBatchResults(results);
      // Add each successful batch result to session history as a separate entry.
      for (const r of results) {
        if (r.error) continue;
        addHistoryEntry({
          blocks: r.blocks,
          filename: r.filename,
          size: r.size,
          total: r.total,
          stats: r.stats,
        });
      }
      const totalBlocks = results.reduce((sum, r) => sum + r.total, 0);
      const errors = results.filter((r) => r.error).length;
      if (errors > 0) {
        toast.warning(`${files.length} file · ${totalBlocks} blok · ${errors} error`);
      } else {
        toast.success(`${files.length} file · ${totalBlocks} blok diekstrak`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengekstrak batch");
    } finally {
      setLoading(false);
    }
  }, [addHistoryEntry]);

  const handleLoadSample = useCallback(async () => {
    const file = new File([SAMPLE], "modul3_sample.txt", { type: "text/plain" });
    await handleExtract(file, "r");
  }, [handleExtract]);

  const handleClear = useCallback(() => {
    setResult(null);
    setBatchResults(null);
    setCurrentSnippetId(undefined);
    setCurrentTags(undefined);
    toast.info("Hasil dibersihkan");
  }, []);

  const handleSelectHistory = useCallback((r: ExtractResult) => {
    setResult(r);
    setBatchResults(null);
    // History entries are session-scoped extraction results and carry no
    // snippet id, so the inline "Update" button is intentionally hidden here.
    setCurrentSnippetId(undefined);
    setCurrentTags(undefined);
  }, []);

  const handleSelectSnippet = useCallback((detail: SnippetDetail) => {
    const blocks: CodeBlock[] = detail.blocks.map((b: any, i: number) => ({
      index: b.index ?? i,
      lang: b.lang,
      code: b.code,
      lines: b.lines,
      source: b.source ?? "saved",
    }));
    setResult({
      blocks,
      filename: detail.originalFilename,
      size: detail.fileSize,
      total: detail.totalBlocks,
      stats: null,
      cached: true,
    });
    setBatchResults(null);
    // The loaded snippet has a known record id, so the ResultPanel can offer
    // "Update" to push edits back to this exact record.
    setCurrentSnippetId(detail.id);
    // Pre-populate the tag input with the snippet's existing tags so the
    // user can see / edit them before the next "Update".
    setCurrentTags(detail.tags);
    toast.success(`Snippet "${detail.originalFilename}" dimuat`);
  }, []);

  // Push the ResultPanel's current editable blocks back to the *existing*
  // snippet record identified by `id`. Uses the PATCH endpoint so the record
  // is updated in-place (no duplicate created). On success we refresh the
  // SnippetList so the new block count / updatedAt is visible.
  //
  // The optional `tags` parameter forwards the panel's tag input so the
  // PATCH can also update the snippet's tags in the same round-trip.
  const handleUpdateSnippet = useCallback(
    async (id: string, editedBlocks: CodeBlock[], tags?: string) => {
      // Use the blocks passed from the ResultPanel (which reflect in-panel
      // edits: merge, split, delete, duplicate, reorder, text edits) rather
      // than the stale `result.blocks` from the parent's state.
      const blocks = editedBlocks;
      const lang = blocks[0]?.lang ?? "unknown";
      try {
        const updated = await updateSnippet(id, blocks, lang, tags);
        // Adopt the (possibly re-indexed) blocks returned by the server so the
        // panel reflects the persisted state.
        setResult((prev) =>
          prev
            ? {
                ...prev,
                blocks: updated.blocks.map((b: any, i: number) => ({
                  index: b.index ?? i,
                  lang: b.lang,
                  code: b.code,
                  lines: b.lines,
                  source: b.source ?? prev.blocks[0]?.source ?? "saved",
                })),
                total: updated.totalBlocks,
              }
            : prev,
        );
        setCurrentSnippetId(updated.id);
        // Mirror the persisted tags back into `currentTags` so the panel's
        // tag input stays in sync with what's now stored server-side (the
        // server trims/normalizes nothing, but this keeps the source of
        // truth consistent if a future change does).
        setCurrentTags(updated.tags);
        setRefreshKey((k) => k + 1);
        toast.success(`Snippet diperbarui · ${updated.id.slice(0, 8)}`);
      } catch (e: any) {
        toast.error(e?.message ?? "Gagal memperbarui snippet");
      }
    },
    [],
  );

  // Keyboard shortcuts: ? show shortcuts, Esc clear/close, S load sample,
  // C copy all (when result exists), / focus search.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as Element | null;
      const inField = target?.matches?.("input,textarea,select") ?? false;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !inField) {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      }
      if (e.key === "Escape") {
        if (showShortcuts) setShowShortcuts(false);
      }
      // "S" loads sample (only when not typing in a field)
      if (e.key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey && !inField && !showShortcuts) {
        e.preventDefault();
        handleLoadSample();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showShortcuts, handleLoadSample]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Hero / intro band */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-emerald-500/5 via-background to-background">
        {/* Decorative grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                <Sparkles className="h-3 w-3" />
                Phase 1 · perbaikan ekstraksi
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="text-2xl font-bold tracking-tight sm:text-3xl"
              >
                Ekstrak kode dari modul praktikum, presisi per blok.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mt-2 text-sm text-muted-foreground sm:text-base"
              >
                Upload PDF / Markdown / IPYNB atau tempel teks, pilih bahasa,
                dapatkan setiap code block utuh — tanpa narasi ikut, tanpa R
                output <span className="font-mono">##</span>, tanpa line-wrap rusak.
              </motion.p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={handleLoadSample}
                className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                <Wand2 className="h-4 w-4" />
                Coba contoh modul R
              </button>
              <button
                onClick={() => setShowShortcuts((s) => !s)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Shortcut keyboard (?)"
              >
                <Keyboard className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Phase 1 feature pills */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FeaturePill
              icon={<FileSearch className="h-4 w-4" />}
              title="Merge blok terpotong"
              desc="Look-back/look-ahead: narasi 1–2 baris tidak memecah blok."
            />
            <FeaturePill
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Filter narasi ketat"
              desc="Rasio kata prosa > 40% → bukan kode."
            />
            <FeaturePill
              icon={<Zap className="h-4 w-4" />}
              title="Repair line-wrap"
              desc="Vektor panjang yang dipotong PDF digabung kembali."
            />
            <FeaturePill
              icon={<Sparkles className="h-4 w-4" />}
              title="Strip R-output"
              desc="Semua baris ## di-skip secara konsisten."
            />
          </div>
        </div>
      </section>

      {/* Main workspace */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          {/* Left column: upload + snippets */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Upload &amp; ekstrak</h2>
                {result && (
                  <button
                    onClick={handleClear}
                    className="inline-flex items-center gap-1 rounded text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                    title="Bersihkan hasil"
                  >
                    <X className="h-3 w-3" />
                    Bersihkan
                  </button>
                )}
              </div>
              <UploadPanel onExtract={handleExtract} onBatchExtract={handleBatchExtract} loading={loading} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <SnippetList refreshKey={refreshKey} onSelect={handleSelectSnippet} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <HistoryPanel onSelect={handleSelectHistory} />
            </motion.div>
          </aside>

          {/* Right column: results */}
          <section className="min-w-0">
            {batchResults ? (
              <BatchResultsView
                results={batchResults}
                onSelectResult={(r) => {
                  setResult({
                    blocks: r.blocks,
                    filename: r.filename,
                    size: r.size,
                    total: r.total,
                    stats: r.stats,
                  });
                  setBatchResults(null);
                  // A batch result row is not a saved snippet — clear the
                  // current id so "Update" is hidden until the user saves.
                  setCurrentSnippetId(undefined);
                  // Batch results carry no tags either — clear the tag input.
                  setCurrentTags(undefined);
                }}
              />
            ) : (
              <ResultPanel
                result={result}
                loading={loading}
                currentSnippetId={currentSnippetId}
                currentTags={currentTags}
                onUpdateSnippet={handleUpdateSnippet}
                onSaved={(snippetId, tags) => {
                  // New snippet created → adopt it as the current id so the
                  // next round of edits can use "Update" instead of saving
                  // another duplicate. Also adopt the tags that were just
                  // persisted so the panel's tag input stays in sync.
                  if (snippetId) setCurrentSnippetId(snippetId);
                  if (tags !== undefined) setCurrentTags(tags);
                  setRefreshKey((k) => k + 1);
                }}
              />
            )}
          </section>
        </div>
      </main>

      {/* Keyboard shortcuts modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">Shortcut keyboard</h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                <ShortcutRow keys={["?"]} desc="Buka/tutup jendela shortcut ini" />
                <ShortcutRow keys={["S"]} desc="Muat contoh modul R" />
                <ShortcutRow keys={["Esc"]} desc="Tutup jendela / bersihkan fokus" />
                <ShortcutRow keys={["Tab"]} desc="Navigasi antar elemen interaktif" />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Tips: klik &ldquo;Coba contoh modul R&rdquo; untuk melihat semua
                4 perbaikan Phase 1 beraksi.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

function FeaturePill({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/60 p-3 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{desc}</span>
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function BatchResultsView({
  results,
  onSelectResult,
}: {
  results: BatchResult[];
  onSelectResult: (r: BatchResult) => void;
}) {
  const totalBlocks = results.reduce((s, r) => s + r.total, 0);
  const totalLines = results.reduce(
    (s, r) => s + r.blocks.reduce((s2, b) => s2 + b.lines, 0),
    0,
  );
  const errorCount = results.filter((r) => r.error).length;

  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Batch extraction results</p>
            <p className="text-xs text-muted-foreground">
              {results.length} file · {totalBlocks} blok · {totalLines} baris total
              {errorCount > 0 && ` · ${errorCount} error`}
            </p>
          </div>
        </div>
      </motion.div>
      <div className="flex flex-col gap-2">
        {results.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.06 }}
          >
            <button
              onClick={() => onSelectResult(r)}
              className={`flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md ${
                r.error
                  ? "border-rose-500/30 hover:border-rose-500/50"
                  : "border-border hover:border-emerald-500/40 hover:bg-emerald-500/5"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-mono font-bold ${
                  r.error
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {r.error ? "!" : r.total}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium">{r.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {r.error
                    ? r.error
                    : `${r.total} blok · ${r.blocks.reduce((s, b) => s + b.lines, 0)} baris · ${(r.size / 1024).toFixed(1)} KB`}
                </p>
              </div>
              {r.stats && (
                <div className="hidden shrink-0 gap-1.5 sm:flex">
                  {r.stats.repairedWraps > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      {r.stats.repairedWraps} wraps
                    </span>
                  )}
                  {r.stats.filteredNarasi > 0 && (
                    <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                      {r.stats.filteredNarasi} filtered
                    </span>
                  )}
                </div>
              )}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
