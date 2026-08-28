"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, Loader2, Languages, ClipboardPaste, FileUp, X, Files } from "lucide-react";
import { SUPPORTED_LANGS } from "@/lib/extractor/langdetect";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Presets } from "./presets";

interface UploadPanelProps {
  onExtract: (file: File, lang: string) => Promise<void>;
  onBatchExtract?: (files: File[], lang: string) => Promise<void>;
  loading: boolean;
  disabled?: boolean;
}

const ACCEPT = ".pdf,.docx,.md,.markdown,.ipynb,.html,.htm,.txt,.tex,.latex,.sty,.cls";

type Mode = "file" | "paste";

export function UploadPanel({ onExtract, onBatchExtract, loading, disabled }: UploadPanelProps) {
  const [mode, setMode] = useState<Mode>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [lang, setLang] = useState("r"); // Default: R (most common for statistika modul)
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAllowed = (ext: string) => {
    const allowed = ACCEPT.replace(/\./g, "").split(",");
    return allowed.includes(ext);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files || []);
      const valid = dropped.filter((f) => {
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        if (!isAllowed(ext)) {
          toast.error(`Format .${ext} tidak didukung`);
          return false;
        }
        return true;
      });
      if (valid.length > 0) setFiles((prev) => [...prev, ...valid].slice(0, 10));
    },
    [],
  );

  const handlePick = (picked: FileList | null) => {
    if (!picked) return;
    const valid = Array.from(picked).filter((f) => {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if (!isAllowed(ext)) {
        toast.error(`Format .${ext} tidak didukung`);
        return false;
      }
      return true;
    });
    if (valid.length > 0) setFiles((prev) => [...prev, ...valid].slice(0, 10));
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExtract = async () => {
    if (mode === "file") {
      if (files.length === 0) {
        toast.error("Pilih file terlebih dahulu");
        return;
      }
      if (files.length === 1) {
        await onExtract(files[0], lang);
      } else if (onBatchExtract) {
        await onBatchExtract(files, lang);
      } else {
        // Fallback: extract one by one
        for (const f of files) await onExtract(f, lang);
      }
    } else {
      if (!pastedText.trim()) {
        toast.error("Tempel kode terlebih dahulu");
        return;
      }
      const blob = new Blob([pastedText], { type: "text/plain" });
      const f = new File([blob], "pasted_code.txt", { type: "text/plain" });
      await onExtract(f, lang);
    }
  };

  const canExtract = mode === "file" ? files.length > 0 : pastedText.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
        <button
          onClick={() => setMode("file")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "file"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileUp className="h-3.5 w-3.5" />
          Upload file
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "paste"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Tempel teks
        </button>
      </div>

      {mode === "file" ? (
        <div className="flex flex-col gap-2">
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
            className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragOver
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-border hover:border-emerald-500/50 hover:bg-muted/40"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => handlePick(e.target.files)}
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Tarik &amp; lepas file, atau klik untuk memilih
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bisa pilih multiple file · maks 10 · 50 MB per file
              </p>
            </div>
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate font-mono font-medium flex-1">{f.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.length > 1 && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <Files className="h-3 w-3" />
                  {files.length} file siap diekstrak (batch)
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={"Tempel teks kode atau dokumen di sini...\n\nContoh:\n# Kasus 1\nKode Penyelesaian:\ndata <- data.frame(...)\nprint(data)"}
            className="h-48 w-full resize-y rounded-xl border-2 border-dashed border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-emerald-500/50"
            spellCheck={false}
          />
          <p className="text-[11px] text-muted-foreground">
            {pastedText.length > 0
              ? `${pastedText.length.toLocaleString()} karakter · ${pastedText.split("\n").length} baris`
              : "Tempel teks modul/kode untuk ekstraksi langsung"}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Presets lang={lang} onSelect={setLang} />
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Languages className="h-3.5 w-3.5" />
          Bahasa kode (wajib pilih)
        </label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {SUPPORTED_LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.emoji} {l.label}
            </option>
          ))}
        </select>
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            ⚡ Bahasa yang dipilih akan memaksa SEMUA blok output menggunakan bahasa tersebut.
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Pilih bahasa yang sesuai dengan isi dokumen Anda.
          </p>
        </div>
      </div>

      <Button
        onClick={handleExtract}
        disabled={loading || disabled || !canExtract}
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
            {mode === "file" && files.length > 1
              ? `Ekstrak ${files.length} file (batch)`
              : "Ekstrak kode"}
          </>
        )}
      </Button>
    </div>
  );
}
