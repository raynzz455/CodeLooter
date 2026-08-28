"use client";

import { useState } from "react";
import { Code2, Download, Save, Loader2, FileText, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ExtractResult, CodeBlock } from "@/lib/codelooter-api";
import { saveSnippet } from "@/lib/codelooter-api";
import { CodeBlockCard } from "./code-block-card";
import { StatsBar } from "./stats-bar";

interface ResultPanelProps {
  result: ExtractResult | null;
  loading: boolean;
  onSaved: () => void;
}

export function ResultPanel({ result, loading, onSaved }: ResultPanelProps) {
  const [blocks, setBlocks] = useState<CodeBlock[] | null>(null);
  const [saving, setSaving] = useState(false);

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

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium">Sedang mengekstrak kode…</p>
        <p className="text-xs text-muted-foreground">
          Menganalisis pola marker, memperbaiki line-wrap, dan menggabung blok
        </p>
      </div>
    );
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
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-semibold">{result.filename}</p>
            <p className="text-xs text-muted-foreground">
              {(result.size / 1024).toFixed(1)} KB · {result.total} blok kode
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadAll}
              disabled={effectiveBlocks.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download semua</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || effectiveBlocks.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">Simpan snippet</span>
            </Button>
          </div>
        </div>
        {result.stats && <StatsBar stats={result.stats} />}
      </div>

      {/* Blocks */}
      {effectiveBlocks.length === 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <Boxes className="mx-auto mb-2 h-8 w-8 text-amber-600" />
          <p className="text-sm font-medium">Tidak ada blok kode terdeteksi</p>
          <p className="mt-1 text-xs text-muted-foreground">
            File mungkin berbasis gambar (perlu OCR) atau tidak memiliki marker kode.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {effectiveBlocks.map((b) => (
            <CodeBlockCard
              key={b.index}
              block={b}
              onDownload={handleBlockDownload}
              onChange={handleBlockChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
