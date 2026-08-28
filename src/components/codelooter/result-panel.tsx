"use client";

import { useState, useEffect } from "react";
import { Code2, Download, Save, Loader2, FileText, Boxes, Copy, Check, FileArchive, GitCompare, ClipboardCopy, GripVertical, ArrowUpDown, FileCode2, RefreshCw, CheckSquare, Square, Trash2, X, Search, Braces, Star } from "lucide-react";
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
import { TagInput } from "./tag-input";
import { useTagHistory } from "@/lib/tag-history";

interface ResultPanelProps {
  result: ExtractResult | null;
  loading: boolean;
  /**
   * Called after a snippet is saved as a NEW record (existing behaviour).
   * Receives the freshly-created snippet id (and the tags that were sent
   * with the save) so the parent can adopt them as the new
   * `currentSnippetId` / `currentTags` (allowing subsequent edits to
   * update the same record in-place).
   */
  onSaved: (snippetId?: string, tags?: string) => void;
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
   * Receives the panel's current (possibly edited) blocks so the PATCH
   * payload reflects in-panel edits (merge, split, delete, duplicate,
   * reorder, text edits) — not the stale `result.blocks` from the parent.
   * The optional `tags` parameter forwards the panel's current tag input
   * so the PATCH can also update the snippet's tags in the same round-trip.
   */
  onUpdateSnippet?: (id: string, blocks: CodeBlock[], tags?: string) => Promise<void> | void;
  /**
   * Comma-separated tags of the snippet currently loaded into the panel
   * (mirrors `currentSnippetId`). When a saved snippet is selected from
   * the list, the parent forwards its `tags` here so the tag input can be
   * pre-populated. `undefined` for a fresh extraction (no associated
   * snippet) → the input is cleared.
   */
  currentTags?: string;
}

export function ResultPanel({ result, loading, onSaved, currentSnippetId, onUpdateSnippet, currentTags }: ResultPanelProps) {
  const [blocks, setBlocks] = useState<CodeBlock[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [viewMode, setViewMode] = useState<"extracted" | "comparison">("extracted");
  const [reorderMode, setReorderMode] = useState(false);
  // Tag input value (comma-separated). Synced from `currentTags` whenever
  // the parent loads a new snippet (or clears the panel); the user can then
  // freely edit the value, which is forwarded to saveSnippet / updateSnippet.
  const [tagInput, setTagInput] = useState("");

  // In-block search & language filter state. The search input lives below
  // the file header card and narrows the visible blocks list (the header
  // stats still reflect ALL blocks). Both are reset whenever a new result
  // arrives so a stale query from a previous file doesn't bleed over.
  const [searchQuery, setSearchQuery] = useState("");
  const [langFilter, setLangFilter] = useState("all");
  // Bookmark-only filter toggle. When true the visible blocks list is
  // narrowed to blocks whose `bookmarked` field is `true`. Lives next to
  // the language filter dropdown so the two filters can be combined
  // (e.g. "show me only my starred R blocks"). Reset on new result so a
  // stale filter from a previous file doesn't bleed over.
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  // Multi-select state for bulk operations (copy / delete / ZIP). The set
  // holds block `index` values — the same key used by every per-block
  // handler above. We reset it whenever the underlying result changes so
  // stale selections from a previous file don't bleed into the new one.
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  // Tracks the bulk-delete confirmation flow (mirrors the per-block pattern
  // in CodeBlockCard: first click arms, second click within 3s commits).
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkZipping, setBulkZipping] = useState(false);
  const [bulkCopied, setBulkCopied] = useState(false);

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
    // Reset the in-block search & language filter so a query from the
    // previous file doesn't bleed into the newly-loaded result.
    setSearchQuery("");
    setLangFilter("all");
    // Reset the bookmark-only filter for the same reason.
    setBookmarkedOnly(false);
    // Clear any active multi-select so stale selections don't bleed into
    // the newly-loaded result.
    setSelectedIndices(new Set());
    setConfirmBulkDelete(false);
    // A fresh extraction has no associated snippet → clear the tag input so
    // tags from a previously-loaded snippet don't bleed into the new save.
    // The dedicated `currentTags` sync effect below will overwrite this
    // immediately when a saved snippet is loaded instead.
    setTagInput("");
  }, [result]);

  // Sync the tag input from the parent's `currentTags` prop. This fires
  // whenever the user selects a saved snippet (parent forwards its tags) or
  // when the parent clears the panel (currentTags becomes undefined). The
  // effect is intentionally keyed on `currentTags` only — not `result` — so
  // an in-progress tag edit isn't wiped when a fresh extraction of a
  // different file replaces `result` (the reset-on-result effect above
  // already handles the clear-on-new-extraction case).
  useEffect(() => {
    setTagInput(currentTags ?? "");
  }, [currentTags]);

  // Sync local editable blocks whenever a new result arrives.
  const effectiveBlocks = blocks ?? result?.blocks ?? [];

  // ── In-block search & language filter ─────────────────────────────────
  // Text match is a case-insensitive substring search over `b.code`. The
  // language match is exact-equality against the dropdown value (or "all"
  // to disable the language filter). The bookmark filter is a boolean AND
  // on `b.bookmarked === true`. All three conditions are AND-combined so
  // a user searching "ggplot2" with the language set to "r" and the
  // bookmark filter on sees only starred R blocks whose code contains
  // "ggplot2".
  //
  // NOTE: the file header card (total count, language distribution, line
  // totals, copy/zip/save buttons) still uses `effectiveBlocks` — those
  // reflect the FULL extraction, not the filtered subset. Only the visible
  // blocks list renders `filteredBlocks`.
  const uniqueLangs = Array.from(new Set(effectiveBlocks.map((b) => b.lang)));
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredBlocks = effectiveBlocks.filter((b) => {
    const matchesText = trimmedQuery === "" || b.code.toLowerCase().includes(trimmedQuery);
    const matchesLang = langFilter === "all" || b.lang === langFilter;
    const matchesBookmark = !bookmarkedOnly || b.bookmarked === true;
    return matchesText && matchesLang && matchesBookmark;
  });
  const isFiltering = trimmedQuery !== "" || langFilter !== "all" || bookmarkedOnly;

  // Toggle the `bookmarked` flag on the block identified by `index`. Uses
  // the same local-state mutation pattern as `handleBlockChange` — only
  // the matching block is replaced (with `bookmarked` flipped), the rest
  // of the array is preserved. The bookmark state persists with the
  // snippet when saved because `saveSnippet` / `updateSnippet` send the
  // full `effectiveBlocks` array (including `bookmarked`) as JSON, and the
  // API routes round-trip the blocks JSON verbatim.
  //
  // The toast message reads from the block's *new* state — so we look it
  // up *after* the flip is computed. `bookmarked` is treated as `false`
  // when undefined, so toggling a block that has never been bookmarked
  // sets it to `true`.
  const handleToggleBookmark = (index: number) => {
    setBlocks((prev) => {
      const base = prev ?? result?.blocks ?? [];
      return base.map((b) =>
        b.index === index ? { ...b, bookmarked: !b.bookmarked } : b,
      );
    });
    // Look up the current (pre-flip) state for the toast — `effectiveBlocks`
    // reflects the current render and `!b.bookmarked` matches the new state.
    const current = effectiveBlocks.find((b) => b.index === index);
    toast.info(current && !current.bookmarked ? "Blok ditandai" : "Bookmark dihapus");
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const saved = await saveSnippet(
        result.filename,
        effectiveBlocks,
        effectiveBlocks[0]?.lang ?? "unknown",
        result.size,
        // Forward the tag input so the new snippet is created with the
        // user's tags (comma-separated). Empty string is a no-op on the
        // server (default is "").
        tagInput.trim(),
      );
      // Record the tags into the in-memory recently-used history so the
      // TagInput's autocomplete row offers them on the next save.
      useTagHistory.getState().addTag(tagInput);
      toast.success(`Snippet disimpan · ${saved.id.slice(0, 8)}`);
      // Adopt the freshly-created snippet as the current one so subsequent
      // edits can be pushed back via "Update" rather than re-saving a copy.
      // Also forward the tags that were sent so the parent's `currentTags`
      // state matches what was persisted (otherwise the [currentTags] sync
      // effect could later overwrite an in-progress tag edit).
      onSaved(saved.id, tagInput.trim());
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
      // Pass the panel's effective (possibly edited) blocks so the parent's
      // PATCH payload reflects in-panel edits — not stale result.blocks.
      // Also forward the current tagInput so the snippet's tags can be
      // updated alongside the code (the parent's PATCH handler accepts an
      // optional `tags` parameter).
      await onUpdateSnippet(currentSnippetId, effectiveBlocks, tagInput.trim());
      // Record the tags into the in-memory recently-used history so the
      // TagInput's autocomplete row offers them on the next edit.
      useTagHistory.getState().addTag(tagInput);
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

  // Build a structured JSON export containing the filename, file size, total
  // block count, an ISO timestamp of the export moment, the extraction
  // stats (when available) and the full per-block payload (index, language,
  // raw code, line count and the source/origin tag). The file is downloaded
  // client-side as a Blob (no round-trip to the server) and named
  // `${base}_export.json` so it doesn't collide with the txt/zip/html exports.
  // Loading state is kept symmetrical with the other export buttons even
  // though JSON serialization is effectively instant.
  const handleDownloadJson = () => {
    if (!result || effectiveBlocks.length === 0) return;
    setExportingJson(true);
    try {
      const payload = {
        filename: result.filename,
        fileSize: result.size,
        totalBlocks: effectiveBlocks.length,
        extractedAt: new Date().toISOString(),
        stats: result.stats ?? null,
        blocks: effectiveBlocks.map((b) => ({
          index: b.index,
          lang: b.lang,
          code: b.code,
          lines: b.lines,
          source: b.source,
        })),
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = result.filename.replace(/\.[^.]+$/, "") || "codelooter";
      a.download = `${base}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`JSON dengan ${effectiveBlocks.length} blok dibuat`);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat JSON");
    } finally {
      setExportingJson(false);
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

  // Override the auto-detected language of a single block. Same local-state
  // pattern as `handleBlockChange`: only the matching block's `lang` field
  // is replaced, the rest of the array is preserved. The new language is
  // reflected immediately in the header badge, the syntax highlighter, and
  // the per-block download extension.
  const handleBlockLangChange = (index: number, lang: string) => {
    setBlocks((prev) => {
      const base = prev ?? result?.blocks ?? [];
      return base.map((b) => (b.index === index ? { ...b, lang } : b));
    });
    toast.success(`Bahasa blok #${index} diubah ke ${lang}`);
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

  // ── Multi-select handlers ───────────────────────────────────────────────
  // Selected blocks are keyed by their `index` field (the same key every
  // other per-block handler uses). When blocks are merged/split/deleted we
  // renumber indices — to keep the selection in sync we rebuild the set
  // from the surviving block identities in those handlers (see handleBulkDelete
  // below; merge/split/duplicate intentionally leave the selection alone
  // because the underlying indices shift and the user can simply re-pick).
  const toggleSelect = (index: number) =>
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });

  const selectAll = () =>
    setSelectedIndices(new Set(effectiveBlocks.map((b) => b.index)));

  const deselectAll = () => {
    setSelectedIndices(new Set());
    setConfirmBulkDelete(false);
  };

  // When every effective block is selected the toggle button offers
  // "Kosongkan" (clear); otherwise it offers "Pilih semua" (select all).
  const allSelected =
    effectiveBlocks.length > 0 && selectedIndices.size === effectiveBlocks.length;

  // Copy the code of every selected block to the clipboard, separated by
  // a blank line so blocks stay visually distinct when pasted into an editor.
  const handleBulkCopy = async () => {
    const selected = effectiveBlocks.filter((b) => selectedIndices.has(b.index));
    if (selected.length === 0) return;
    const body = selected.map((b) => b.code).join("\n\n");
    try {
      await navigator.clipboard.writeText(body);
      setBulkCopied(true);
      setTimeout(() => setBulkCopied(false), 1500);
      toast.success(`${selected.length} blok disalin ke clipboard`);
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  // Bulk delete — two-click confirm pattern (mirrors CodeBlockCard). The
  // first click arms the button (rose tint + "Konfirmasi?" label); a
  // second click within 3s commits the delete. After the delete we clear
  // the selection set entirely because all referenced indices are gone.
  const handleBulkDeleteClick = () => {
    if (confirmBulkDelete) {
      const count = selectedIndices.size;
      setBlocks((prev) => {
        const base = prev ?? result?.blocks ?? [];
        const next = base.filter((b) => !selectedIndices.has(b.index));
        return next.map((b, i) => ({ ...b, index: i }));
      });
      setSelectedIndices(new Set());
      setConfirmBulkDelete(false);
      toast.success(`${count} blok dihapus`);
    } else {
      setConfirmBulkDelete(true);
      setTimeout(() => setConfirmBulkDelete(false), 3000);
    }
  };

  // Build a ZIP containing only the selected blocks. Mirrors handleDownloadZip
  // but filters `effectiveBlocks` by `selectedIndices` first and writes the
  // archive as `{base}_selected.zip` to distinguish it from the all-blocks ZIP.
  const handleBulkZip = async () => {
    if (!result) return;
    const selected = effectiveBlocks.filter((b) => selectedIndices.has(b.index));
    if (selected.length === 0) return;
    setBulkZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Map<string, number>();
      for (const b of selected) {
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
      a.download = `${base}_selected.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP dengan ${selected.length} file dibuat`);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat ZIP");
    } finally {
      setBulkZipping(false);
    }
  };

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
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadJson}
              disabled={effectiveBlocks.length === 0 || exportingJson}
              title="Download semua blok + metadata sebagai file JSON terstruktur"
            >
              {exportingJson ? <Loader2 className="h-4 w-4 animate-spin" /> : <Braces className="h-4 w-4" />}
              <span className="hidden sm:inline">{exportingJson ? "Membuat…" : "JSON"}</span>
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
        {/* Tag input — comma-separated tags attached to the snippet on
            save / update. Uses the TagInput component which renders a
            row of recently-used tags below the input for one-click
            autocomplete. The Tag icon uses the emerald palette to match
            the rest of the header accents. */}
        <TagInput
          value={tagInput}
          onChange={setTagInput}
          onCommit={() => useTagHistory.getState().addTag(tagInput)}
        />
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

      {/* In-block search & language filter — sits between the file header
          card (which still reflects ALL blocks) and the blocks list. Only
          shown in the normal extracted view (not comparison, not reorder,
          not when there are zero blocks). The visible blocks list below
          renders `filteredBlocks` instead of `effectiveBlocks`, but every
          header stat / copy / zip / save action still operates on the full
          `effectiveBlocks` set. */}
      {viewMode === "extracted" && !reorderMode && effectiveBlocks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
        >
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari dalam blok kode..."
              aria-label="Cari dalam blok kode"
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Bersihkan pencarian"
                title="Bersihkan pencarian"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            aria-label="Filter berdasarkan bahasa"
            title="Filter berdasarkan bahasa"
            className="h-8 shrink-0 rounded-md border border-border bg-background px-2 text-xs outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
          >
            <option value="all">Semua bahasa</option>
            {uniqueLangs.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          {/* Bookmark-only filter toggle — sits next to the language filter.
              When active the button uses an emerald background (mirrors the
              reorder / comparison toggle styling) and only blocks with
              `bookmarked === true` are shown. Uses the Star icon so the
              filter's meaning matches the per-block star toggle visually. */}
          <button
            type="button"
            onClick={() => setBookmarkedOnly((v) => !v)}
            aria-pressed={bookmarkedOnly}
            aria-label={bookmarkedOnly ? "Tampilkan semua blok" : "Hanya blok di-bookmark"}
            title={bookmarkedOnly ? "Tampilkan semua blok" : "Hanya blok di-bookmark"}
            className={`flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors ${bookmarkedOnly ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600" : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <Star className={`h-3.5 w-3.5 ${bookmarkedOnly ? "fill-white" : "fill-none"}`} />
            <span className="hidden sm:inline">Bookmark</span>
          </button>
          {isFiltering && (
            <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-muted-foreground">
              {filteredBlocks.length} dari {effectiveBlocks.length} blok
            </span>
          )}
        </motion.div>
      )}

      {/* Bulk action bar — only shown when at least one block is selected
          and we're not in comparison / reorder mode (those modes have their
          own focused UI). Slides down from the top via framer-motion. */}
      <AnimatePresence>
        {viewMode === "extracted" && !reorderMode && effectiveBlocks.length > 0 && selectedIndices.size > 0 && (
          <motion.div
            key="bulk-action-bar"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 shadow-md backdrop-blur"
          >
            <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {selectedIndices.size} blok dipilih
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                onClick={() => (allSelected ? deselectAll() : selectAll())}
                title={allSelected ? "Kosongkan pilihan" : "Pilih semua blok"}
              >
                {allSelected ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{allSelected ? "Kosongkan" : "Pilih semua"}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                onClick={handleBulkCopy}
                title="Salin blok terpilih ke clipboard"
              >
                {bulkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{bulkCopied ? "Tersalin" : "Salin"}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                onClick={handleBulkZip}
                disabled={bulkZipping}
                title="Download blok terpilih sebagai ZIP"
              >
                {bulkZipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileArchive className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{bulkZipping ? "Zipping…" : "ZIP"}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={`h-7 px-2 text-xs transition-colors ${confirmBulkDelete ? "bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400" : "text-emerald-700 hover:bg-rose-500/10 hover:text-rose-600 dark:text-emerald-300"}`}
                onClick={handleBulkDeleteClick}
                title={confirmBulkDelete ? "Klik lagi untuk konfirmasi hapus" : "Hapus blok terpilih"}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{confirmBulkDelete ? "Konfirmasi?" : "Hapus"}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                onClick={deselectAll}
                title="Keluar mode pilih"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          onChangeLang={handleBlockLangChange}
          onToggleBookmark={handleToggleBookmark}
        />
      ) : filteredBlocks.length === 0 ? (
        // Empty state: the extraction produced blocks but the current
        // search / language filter narrows the list to zero. Offer a
        // one-click reset so the user doesn't have to find the search
        // bar manually.
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Search className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">Tidak ada blok cocok dengan pencarian</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Coba ubah kata kunci atau filter bahasa, lalu cari lagi.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
            onClick={() => {
              setSearchQuery("");
              setLangFilter("all");
              setBookmarkedOnly(false);
            }}
          >
            <X className="h-4 w-4" />
            <span>Bersihkan pencarian</span>
          </Button>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          {filteredBlocks.map((b, i) => (
            <motion.div
              key={`${result.filename}-${b.index}`}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
            >
              <CodeBlockCard
                block={b}
                onDownload={handleBlockDownload}
                onChange={handleBlockChange}
                onMergeWithNext={handleMergeWithNext}
                onSplit={handleSplit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onChangeLang={handleBlockLangChange}
                onToggleBookmark={handleToggleBookmark}
                selected={selectedIndices.has(b.index)}
                onToggleSelect={toggleSelect}
                // Hide the "merge with next" button only when this block
                // is the truly last block in `effectiveBlocks` (not the
                // last visible block) — that way filtering never hides a
                // merge action that still has a valid target.
                isLast={b.index === effectiveBlocks[effectiveBlocks.length - 1]?.index}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
