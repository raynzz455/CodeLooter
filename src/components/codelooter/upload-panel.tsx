"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, Loader2, Languages } from "lucide-react";
import { SUPPORTED_LANGS } from "@/lib/extractor/langdetect";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface UploadPanelProps {
  onExtract: (file: File, lang: string) => Promise<void>;
  loading: boolean;
  disabled?: boolean;
}

const ACCEPT = ".pdf,.md,.markdown,.ipynb,.html,.htm,.txt,.tex,.latex,.sty,.cls";

export function UploadPanel({ onExtract, loading, disabled }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState("auto");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) setFile(f);
    },
    [],
  );

  const handlePick = (f: File | null) => {
    if (!f) return;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const allowed = ACCEPT.replace(/\./g, "").split(",");
    if (!allowed.includes(ext)) {
      toast.error(`Format .${ext} tidak didukung`);
      return;
    }
    setFile(f);
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }
    await onExtract(file, lang);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-emerald-500 bg-emerald-500/5"
            : "border-border hover:border-emerald-500/50 hover:bg-muted/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium">
            Tarik &amp; lepas file di sini, atau klik untuk memilih
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, Markdown, IPYNB, HTML, TXT, LaTeX · maks 50 MB
          </p>
        </div>
        {file && (
          <div className="mt-1 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs">
            <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-mono font-medium truncate max-w-[180px]">{file.name}</span>
            <span className="text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Languages className="h-3.5 w-3.5" />
          Bahasa kode
        </label>
        {/* Native <select> — avoids bundling radix-ui Select (~big chunk). */}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {SUPPORTED_LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Pilih <span className="font-mono">R</span> untuk modul statistika —
          semua blok akan dipaksa jadi R.
        </p>
      </div>

      <Button
        onClick={handleExtract}
        disabled={loading || !file || disabled}
        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengekstrak…
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4" />
            Ekstrak kode
          </>
        )}
      </Button>
    </div>
  );
}
