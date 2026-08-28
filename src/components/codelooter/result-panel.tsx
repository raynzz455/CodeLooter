"use client";

import { useState, useEffect } from "react";
import { Code2, Download, Save, Loader2, FileText, Boxes, Copy, Check, FileArchive, GitCompare, ClipboardCopy, GripVertical, ArrowUpDown, FileCode2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ExtractResult, CodeBlock } from "@/lib/codelooter-api";
import { saveSnippet } from "@/lib/codelooter-api";
import { CodeBlockCard, highlight, TOKEN_CLASS } from "./code-block-card";
import { StatsBar } from "./stats-bar";
import { StatsChart } from "./stats-chart";
import { LoadingSkeleton } from "./loading-skeleton";
import { ComparisonView } from "./comparison-view";
import { SortableBlockList } from "./sortable-block-list";

interface ResultPanelProps {
  result: ExtractResult | null;
  loading: boolean;
  /**
   * Called after a snippet is saved as a NEW record (existing behaviour).
   * Receives the freshly-created snippet id so the parent can adopt it as
   * the new `currentSnippetId` (allowing subsequent edits to update the
   * same record in-place).
   */
  onSaved: (snippetId?: string) => void;
  /**
   * ID of the snippet currently loaded into the panel. When set, an extra
   * "Update" button is rendered next to "Simpan" so the user can push
   * their edits back to the same snippet record instead of creating a
   * duplicate.
   */
  currentSnippetId?: string;
  /**
   * Invoked when the user clicks "Update". The parent performs the actual
   * PATCH /api/snippets/[id] call, shows a toast, and refreshes the list.
   */
  onUpdateSnippet?: (id: string) => Promise<void> | void;
}

export function ResultPanel({ result, loading, onSaved, currentSnippetId, onUpdateSnippet }: ResultPanelProps) {
  const [blocks, setBlocks] = useState<CodeBlock[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [viewMode, setViewMode] = useState<"extracted" | "comparison">("extracted");
  const [reorderMode, setReorderMode] = useState(false);

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
    setReorderMode(false);
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
      // Adopt the freshly-created snippet as the current one so subsequent
      // edits can be pushed back via "Update" rather than re-saving a copy.
      onSaved(saved.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  // Push the current editable blocks back to the *existing* snippet record
  // (identified by `currentSnippetId`). The parent owns the actual API call
  // (so it can also refresh the snippet list + show a toast) — this handler
  // just toggles the loading state on the button and forwards the id.
  const handleUpdate = async () => {
    if (!currentSnippetId || !onUpdateSnippet) return;
    if (effectiveBlocks.length === 0) return;
    setUpdating(true);
    try {
      await onUpdateSnippet(currentSnippetId);
    } finally {
      setUpdating(false);
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

  // Build a self-contained, syntax-highlighted HTML file with all extracted
  // code blocks. Reuses the lightweight `highlight()` tokenizer from
  // code-block-card so the exported colours match the in-app dark-mode view.
  // No external CSS / JS — every style is inlined so the file works offline.
  const handleDownloadHtml = () => {
    if (!result || effectiveBlocks.length === 0) return;
    setExportingHtml(true);
    try {
      // HTML-escape every text node before it lands inside <code>.
      const escapeHtml = (s: string): string =>
        s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      // Inline-style palette mirroring TOKEN_CLASS dark-mode colours.
      // Typed against `keyof typeof TOKEN_CLASS` so this stays in sync if a
      // new token category is added upstream. Strictly emerald / teal / amber
      // / rose / slate — no blue or indigo.
      const HTML_COLOR: Record<keyof typeof TOKEN_CLASS, { color: string; extra?: string }> = {
        comment: { color: "#94a3b8", extra: "font-style: italic;" }, // slate-400
        string:  { color: "#34d399" },                              // emerald-400
        number:  { color: "#fbbf24" },                              // amber-400
        keyword: { color: "#fb7185", extra: "font-weight: 600;" },  // rose-400
        func:    { color: "#2dd4bf" },                              // teal-400
        ident:   { color: "#e2e8f0" },                              // slate-200
        op:      { color: "#94a3b8" },                              // slate-400
        nl:      { color: "inherit" },
      };

      // Render a single block's code to highlighted, escaped HTML spans.
      const renderCode = (b: CodeBlock): string => {
        const toks = highlight(b.code, b.lang);
        return toks
          .map((tk) => {
            const esc = escapeHtml(tk.t);
            const cfg = HTML_COLOR[tk.c] ?? HTML_COLOR.ident;
            if (tk.c === "nl") return esc;
            const style = cfg.extra
              ? `color:${cfg.color};${cfg.extra}`
              : `color:${cfg.color}`;
            return `<span style="${style}">${esc}</span>`;
          })
          .join("");
      };

      const baseName = result.filename.replace(/\.[^.]+$/, "") || "codelooter";
      const today = new Date().toISOString().slice(0, 10);

      const sections = effectiveBlocks
        .map((b) => {
          const langLabel = (b.lang || "text").toUpperCase();
          return `    <section class="block">
      <header class="block-head">
        <span class="idx">#${b.index}</span>
        <span class="lang">${escapeHtml(langLabel)}</span>
        <span class="meta">${b.lines} lines</span>
      </header>
      <pre><code>${renderCode(b)}</code></pre>
    </section>`;
        })
        .join("\n");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(baseName)} — CodeLooter Export</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #0f172a;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 1.5rem 1rem 3rem;
      line-height: 1.5;
    }
    .container { max-width: 960px; margin: 0 auto; }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 .25rem;
      color: #f8fafc;
      word-break: break-all;
    }
    .subtitle {
      color: #94a3b8;
      font-size: .875rem;
      margin: 0 0 1.5rem;
    }
    .block {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: .6rem;
      margin: 0 0 1rem;
      overflow: hidden;
    }
    .block-head {
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .6rem .9rem;
      background: #0f172a;
      border-bottom: 1px solid #334155;
      font-size: .8rem;
    }
    .block-head .idx {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #94a3b8;
      font-weight: 600;
    }
    .block-head .lang {
      background: rgba(16,185,129,.15);
      color: #6ee7b7;
      padding: .15rem .5rem;
      border-radius: 999px;
      font-size: .7rem;
      font-weight: 600;
      letter-spacing: .03em;
    }
    .block-head .meta {
      color: #64748b;
      font-size: .75rem;
    }
    pre {
      margin: 0;
      padding: 1rem;
      overflow-x: auto;
      background: #0f172a;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .82rem;
      line-height: 1.6;
      color: #e2e8f0;
      white-space: pre;
    }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #334155;
      color: #64748b;
      font-size: .75rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(result.filename)}</h1>
    <p class="subtitle">${effectiveBlocks.length} blok kode · ${totalLines} baris · dihasilkan oleh CodeLooter</p>
${sections}
    <div class="footer">Diekspor dari CodeLooter — ${today}</div>
  </div>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}_blocks.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`HTML dengan ${effectiveBlocks.length} blok dibuat`);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat HTML");
    } finally {
      setExportingHtml(false);
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

  // Reorder blocks via drag-and-drop. The new order is committed to local
  // state and block indices are renumbered to match the new positions.
  const handleReorder = (reordered: CodeBlock[]) => {
    setBlocks(reordered.map((b, i) => ({ ...b, index: i })));
    toast.info("Urutan blok diperbarui");
  };

  // Merge block at `index` with the next block. The two blocks' code is
  // concatenated with a newline, and indices are renumbered.
  const handleMergeWithNext = (index: number) => {
    setBlocks((prev) => {
      const base = prev ?? result?.blocks ?? [];
      const idx = base.findIndex((b) => b.index === index);
      if (idx < 0 || idx >= base.length - 1) return base;
      const merged = {
        ...base[idx],
        code: base[idx].code + "\n" + base[idx + 1].code,
        lines: base[idx].lines + base[idx + 1].lines,
        source: base[idx].source === base[idx + 1].source
          ? base[idx].source
          : `${base[idx].source}+merge`,
      };
      const next = [...base.slice(0, idx), merged, ...base.slice(idx + 2)];
      return next.map((b, i) => ({ ...b, index: i }));
    });
  };

  // Split block at `index` into two blocks at line `atLine`. Lines 1..atLine-1
  // stay in the first block, lines atLine..end go to a new second block.
  const handleSplit = (index: number, atLine: number) => {
    setBlocks((prev) => {
      const base = prev ?? result?.blocks ?? [];
      const idx = base.findIndex((b) => b.index === index);
      if (idx < 0) return base;
      const lines = base[idx].code.split("\n");
      if (atLine < 2 || atLine >= lines.length) return base;
      const firstCode = lines.slice(0, atLine).join("\n");
      const secondCode = lines.slice(atLine).join("\n");
      const first = { ...base[idx], code: firstCode, lines: firstCode.split("\n").length };
      const second = { ...base[idx], code: secondCode, lines: secondCode.split("\n").length, source: "split" };
      const next = [...base.slice(0, idx), first, second, ...base.slice(idx + 1)];
      return next.map((b, i) => ({ ...b, index: i }));
    });
  };

  // Delete block at `index`. Indices are renumbered.
  const handleDelete = (index: number) => {
    setBlocks((prev) => {
      const base = prev ?? result?.blocks ?? [];
      const next = base.filter((b) => b.index !== index);
      return next.map((b, i) => ({ ...b, index: i }));
    });
  };

  // Duplicate block at `index`. The copy is inserted right after the original.
  const handleDuplicate = (index: number) => {
    setBlocks((prev) => {
      const base = prev ?? result?.blocks ?? [];
      const idx = base.findIndex((b) => b.index === index);
      if (idx < 0) return base;
      const copy = { ...base[idx], source: "duplicate" };
      const next = [...base.slice(0, idx + 1), copy, ...base.slice(idx + 1)];
      return next.map((b, i) => ({ ...b, index: i }));
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

  // Copy all blocks to clipboard as Markdown fenced code blocks,
  // each preceded by an HTML comment header with index / language / line count.
  // Example output:
  //   <!-- Block #0 | r | 5 lines -->
  //   ```r
  //   library(ggplot2)
  //   ```
  const handleCopyMarkdown = async () => {
    const body = effectiveBlocks
      .map(
        (b) =>
          `<!-- Block #${b.index} | ${b.lang} | ${b.lines} lines -->\n\`\`\`${b.lang}\n${b.code}\n\`\`\``,
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 1500);
      toast.success(`${effectiveBlocks.length} blok disalin sebagai Markdown`);
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
              variant="ghost"
              onClick={handleCopyMarkdown}
              disabled={effectiveBlocks.length === 0}
              title="Salin semua blok sebagai Markdown"
            >
              {copiedMd ? <Check className="h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="h-4 w-4" />}
              <span className="hidden sm:inline">Markdown</span>
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadHtml}
              disabled={effectiveBlocks.length === 0 || exportingHtml}
              title="Download semua blok sebagai file HTML syntax-highlighted"
            >
              {exportingHtml ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{exportingHtml ? "Membuat…" : "HTML"}</span>
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
            {/* Reorder toggle — only in extracted view */}
            {viewMode === "extracted" && effectiveBlocks.length > 1 && (
              <Button
                size="sm"
                variant={reorderMode ? "default" : "outline"}
                onClick={() => setReorderMode((r) => !r)}
                title={reorderMode ? "Selesai mengurutkan" : "Urutkan ulang blok (drag & drop)"}
                className={reorderMode ? "bg-teal-600 hover:bg-teal-700" : ""}
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">{reorderMode ? "Selesai" : "Urutkan"}</span>
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
            {currentSnippetId && onUpdateSnippet && (
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={updating || effectiveBlocks.length === 0}
                className="bg-amber-600 hover:bg-amber-700"
                title={`Perbarui snippet ini (${currentSnippetId.slice(0, 8)}) di tempat`}
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="hidden sm:inline">{updating ? "Memperbarui…" : "Update"}</span>
              </Button>
            )}
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
      ) : reorderMode ? (
        <SortableBlockList
          blocks={effectiveBlocks}
          onReorder={handleReorder}
          onDownload={handleBlockDownload}
          onChange={handleBlockChange}
          onMergeWithNext={handleMergeWithNext}
          onSplit={handleSplit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          {effectiveBlocks.map((b, i) => (
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
                onMergeWithNext={handleMergeWithNext}
                onSplit={handleSplit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                isLast={i === effectiveBlocks.length - 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
