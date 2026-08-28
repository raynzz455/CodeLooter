"use client";

import { useState } from "react";
import { Clock, X, FileCode, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useHistory, type HistoryEntry } from "@/lib/extraction-history";
import type { ExtractResult } from "@/lib/codelooter-api";

// Lightweight relative-time formatter (matches snippet-list style — no date-fns).
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hr lalu`;
}

interface HistoryPanelProps {
  onSelect: (result: ExtractResult) => void;
}

export function HistoryPanel({ onSelect }: HistoryPanelProps) {
  const entries = useHistory((s) => s.entries);
  const removeEntry = useHistory((s) => s.removeEntry);
  const clearAll = useHistory((s) => s.clearAll);

  // Tracks which entry is currently flashing emerald on click.
  const [flashId, setFlashId] = useState<string | null>(null);

  const handleSelect = (entry: HistoryEntry) => {
    // Brief emerald highlight, then restore the result to ResultPanel.
    setFlashId(entry.id);
    window.setTimeout(() => setFlashId((cur) => (cur === entry.id ? null : cur)), 350);
    onSelect(entry.result);
    toast.success(`Riwayat "${entry.result.filename}" dimuat kembali`);
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeEntry(id);
  };

  const handleClearAll = () => {
    if (entries.length === 0) return;
    clearAll();
    toast.info("Riwayat sesi dibersihkan");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Riwayat ekstraksi</h3>
        <span className="ml-auto text-xs text-muted-foreground">{entries.length}</span>
        {entries.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
            onClick={handleClearAll}
            title="Bersihkan semua riwayat"
          >
            <Trash2 className="h-3 w-3" />
            Bersihkan
          </Button>
        )}
      </div>

      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Sesi ini saja — tidak disimpan. Klik entri untuk memuat ulang hasilnya.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Clock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Belum ada riwayat.</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Setiap ekstraksi baru akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {entries.map((entry) => {
              const isFlashing = flashId === entry.id;
              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    height: "auto",
                    backgroundColor: isFlashing
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(0, 0, 0, 0)",
                  }}
                  exit={{ opacity: 0, x: 12, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelect(entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(entry);
                      }
                    }}
                    className={`group flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 transition-colors ${
                      isFlashing
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-border bg-card hover:border-emerald-500/40 hover:bg-emerald-500/5"
                    }`}
                  >
                    <FileCode
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isFlashing
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-medium">
                        {entry.result.filename}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                          {entry.result.total} bl
                        </Badge>
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(entry.timestamp)}
                        </span>
                        {entry.result.cached && (
                          <span className="text-emerald-600 dark:text-emerald-400">cache</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleRemove(entry.id, e)}
                      title="Hapus dari riwayat"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
