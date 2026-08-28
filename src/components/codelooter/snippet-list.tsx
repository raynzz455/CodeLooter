"use client";

import { useEffect, useState, useMemo } from "react";
import { History, Trash2, FileCode, Loader2, Clock, Search, X, Download, FileArchive, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listSnippets,
  deleteSnippet,
  getSnippet,
  downloadSnippetUrl,
  downloadSnippetZipUrl,
  type SnippetMeta,
  type SnippetDetail,
} from "@/lib/codelooter-api";

// Lightweight relative-time formatter (avoids the heavy date-fns locale import).
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hr lalu`;
}

// Split a comma-separated tag string into a clean list of non-empty trimmed
// tags. Returns `[]` when the input is empty/whitespace-only so callers can
// simply `tags.length > 0 &&` to gate the badge row rendering.
function parseTags(tags: string | undefined | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

interface SnippetListProps {
  refreshKey: number;
  onSelect: (detail: SnippetDetail) => void;
}

export function SnippetList({ refreshKey, onSelect }: SnippetListProps) {
  const [snippets, setSnippets] = useState<SnippetMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setSnippets(await listSnippets());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  // Client-side search filter — searches filename, language and tags.
  const filtered = useMemo(() => {
    if (!query.trim()) return snippets;
    const q = query.toLowerCase();
    return snippets.filter(
      (s) =>
        s.originalFilename.toLowerCase().includes(q) ||
        s.extractedLang.toLowerCase().includes(q) ||
        (s.tags ?? "").toLowerCase().includes(q),
    );
  }, [snippets, query]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBusyId(id);
    try {
      await deleteSnippet(id);
      toast.success("Snippet dihapus");
      setSnippets((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("Gagal menghapus");
    } finally {
      setBusyId(null);
    }
  };

  const handleSelect = async (s: SnippetMeta) => {
    setBusyId(s.id);
    try {
      const detail = await getSnippet(s.id);
      onSelect(detail);
    } catch {
      toast.error("Gagal memuat snippet");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Snippet tersimpan</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {snippets.length}
        </span>
      </div>

      {/* Search input */}
      {snippets.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari snippet..."
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-7 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : snippets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <FileCode className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Belum ada snippet. Simpan hasil ekstraksi untuk menyimpannya di sini.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <Search className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Tidak ada snippet cocok dengan &ldquo;{query}&rdquo;
          </p>
        </div>
      ) : (
        <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
          {filtered.map((s) => {
            // Parse comma-separated tags once per row. Empty / whitespace-only
            // → empty array → the tag row is omitted entirely so untagged
            // snippets keep their compact single-line layout.
            const tagList = parseTags(s.tags);
            return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSelect(s);
              }}
              className="group flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
            >
              {busyId === s.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
              ) : (
                <FileCode className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-medium">{s.originalFilename}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {s.totalBlocks} bl
                  </Badge>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {timeAgo(s.createdAt)}
                  </span>
                </div>
                {tagList.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Tag className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                    {tagList.map((t, i) => (
                      <span
                        key={`${s.id}-tag-${i}-${t}`}
                        className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <a
                href={downloadSnippetUrl(s.id)}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Download semua blok (teks)"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <a
                href={downloadSnippetZipUrl(s.id)}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Download semua blok (ZIP)"
              >
                <FileArchive className="h-3.5 w-3.5" />
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => handleDelete(s.id, e)}
                title="Hapus"
              >
                {busyId === s.id ? null : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
