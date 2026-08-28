"use client";

import { useState, useEffect } from "react";
import { Code2, Download, Save, Loader2, FileText, Boxes, Copy, Check, FileArchive, GitCompare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ExtractResult, CodeBlock } from "@/lib/codelooter-api";
import { saveSnippet } from "@/lib/codelooter-api";
import { CodeBlockCard } from "./code-block-card";
import { StatsBar } from "./stats-bar";
import { StatsChart } from "./stats-chart";
import { LoadingSkeleton } from "./loading-skeleton";
import { ComparisonView } from "./comparison-view";

interface ResultPanelProps {
  result: ExtractResult | null;
  loading: boolean;
  onSaved: () => void;
}

export function ResultPanel({ result, loading, onSaved }: ResultPanelProps) {
  const [blocks, setBlocks] = useState<CodeBlock[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [viewMode, setViewMode] = useState<"extracted" | "comparison">("extracted");

  // File extension per language, mirroring the server-side extForLang helper.
  const extForLang = (lang: string): string =>
    ({
      r: "R",
      python: "py",
      sql: "sql",
      java: "java",
      cpp: "cpp",
      javascript: "js",
      typescript: "ts",
      php: "php",
      kotlin: "kt",
      go: "go",
      rust: "rs",
      bash: "sh",
    }[lang] ?? "txt");

  // BUGFIX: Reset local editable blocks whenever a new result arrives.
  // Previously, editing a block then extracting a new file would show the
  // old edited blocks instead of the fresh extraction result.
  useEffect(() => {
    setBlocks(null);
    setViewMode("extracted");
  }, [result]);

  // Sync local editable blocks whenever a new result arrives.
  const effectiveBlocks = blocks ?? result?.blocks ?? [];

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const saved = await saveSnippet(
        result.filename,
        effectiveBlocks,
        effectiveBlocks[0]?.lang ?? "unknown",
        result.size,
      );
      toast.success(`Snippet disimpan · ${saved.id.slice(0, 8)}`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadAll = () => {
    if (!result) return;
    // Download all blocks as a single text blob (client-side, no snippet needed).
    const dominant = effectiveBlocks[0]?.lang ?? "unknown";
    const ext =
      { r: "R", python: "py", sql: "sql", java: "java", cpp: "cpp", javascript: "js", typescript: "ts" }[dominant] ?? "txt";
    const sep = "#".repeat(60);
    const body = effectiveBlocks
      .map((b, i) => `${sep}\n# Block #${b.index} | ${b.lang} | ${b.lines} lines\n${sep}\n${b.code}`)
      .join("\n\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.filename.replace(/\.[^.]+$/, "") || "codelooter"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File kode diunduh");
  };

  const handleDownloadZip = async () => {
    if (!result || effectiveBlocks.length === 0) return;
    setZipping(true);
    try {
      // Dynamic import keeps jszip out of the initial client bundle.
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Map<string, number>();
      for (const b of effectiveBlocks) {
        const ext = extForLang(b.lang);
        let name = `block_${b.index}.${ext}`;
        if (used.has(name)) {
          const n = used.get(name)! + 1;
          used.set(name, n);
          name = `block_${b.index}_${n}.${ext}`;
        } else {
          used.set(name, 0);
        }
        zip.file(name, b.code);
      }
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = result.filename.replace(/\.[^.]+$/, "") || "codelooter";
      a.download = `${base}_blocks.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP dengan ${effectiveBlocks.length} file dibuat`);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat ZIP");
    } finally {
      setZipping(false);
    }
  };

  const handleBlockDownload = (index: number) => {
    const b = effectiveBlocks.find((x) => x.index === index);
    if (!b) return;
    const ext =
      { r: "R", python: "py", sql: "sql", java: "java", cpp: "cpp", javascript: "js", typescript: "ts" }[b.lang] ?? "txt";
    const blob = new Blob([b.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `block_${index}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBlockChange = (index: number, code: string) => {
    setBlocks((prev) => {
      const base = prev ?? result?.blocks ?? [];
      return base.map((b) => (b.index === index ? { ...b, code, lines: code.split("\n").length } : b));
    });
  };

  const handleCopyAll = async () => {
    const body = effectiveBlocks.map((b) => b.code).join("\n\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
      toast.success(`${effectiveBlocks.length} blok disalin ke clipboard`);
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  // Language distribution for the summary bar.
  const langDist = effectiveBlocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.lang] = (acc[b.lang] || 0) + 1;
    return acc;
  }, {});
  const totalLines = effectiveBlocks.reduce((sum, b) => sum + b.lines, 0);
  const totalChars = effectiveBlocks.reduce((sum, b) => sum + b.code.length, 0);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!result) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Code2 className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium">Hasil ekstraksi akan muncul di sini</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Upload file praktikum / paper, pilih bahasa, lalu klik{" "}
          <span className="font-mono text-emerald-600 dark:text-emerald-400">Ekstrak kode</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* File header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-semibold">{result.filename}</p>
            <p className="text-xs text-muted-foreground">
              {(result.size / 1024).toFixed(1)} KB · {result.total} blok kode · {totalLines} baris · {totalChars.toLocaleString()} karakter
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyAll}
              disabled={effectiveBlocks.length === 0}
              title="Salin semua blok"
            >
              {copiedAll ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span className="hidden sm:inline">Salin semua</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadAll}
              disabled={effectiveBlocks.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadZip}
              disabled={effectiveBlocks.length === 0 || zipping}
              title="Download semua blok sebagai file ZIP terpisah"
            >
              {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
              <span className="hidden sm:inline">{zipping ? "Zipping…" : "ZIP"}</span>
            </Button>
            {/* Comparison view toggle — only show if removedLines exist */}
            {result.stats?.removedLines && result.stats.removedLines.length > 0 && (
              <Button
                size="sm"
                variant={viewMode === "comparison" ? "default" : "outline"}
                onClick={() => setViewMode((v) => v === "comparison" ? "extracted" : "comparison")}
                title="Bandingkan kode yang diekstrak vs baris yang dihapus"
                className={viewMode === "comparison" ? "bg-rose-600 hover:bg-rose-700" : ""}
              >
                <GitCompare className="h-4 w-4" />
                <span className="hidden sm:inline">Bandingkan</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || effectiveBlocks.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">Simpan</span>
            </Button>
          </div>
        </div>
        {/* Language distribution badges */}
        {effectiveBlocks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2">
            <span className="text-[11px] text-muted-foreground">Bahasa:</span>
            {Object.entries(langDist).map(([lang, count]) => (
              <span
                key={lang}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
              >
                {lang} ×{count}
              </span>
            ))}
          </div>
        )}
        {result.stats && <StatsBar stats={result.stats} />}
        {result.stats && <StatsChart stats={result.stats} />}
      </motion.div>

      {/* Blocks or Comparison view */}
      {viewMode === "comparison" && result.stats?.removedLines ? (
        <ComparisonView blocks={effectiveBlocks} removedLines={result.stats.removedLines} />
      ) : effectiveBlocks.length === 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <Boxes className="mx-auto mb-2 h-8 w-8 text-amber-600" />
          <p className="text-sm font-medium">Tidak ada blok kode terdeteksi</p>
          <p className="mt-1 text-xs text-muted-foreground">
            File mungkin berbasis gambar (perlu OCR) atau tidak memiliki marker kode.
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {effectiveBlocks.map((b) => (
            <motion.div
              key={`${result.filename}-${b.index}`}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, delay: b.index * 0.04 }}
            >
              <CodeBlockCard
                block={b}
                onDownload={handleBlockDownload}
                onChange={handleBlockChange}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
