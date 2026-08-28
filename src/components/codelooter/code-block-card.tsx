"use client";

import { useState, useMemo } from "react";
import { Copy, Check, Download, Pencil, Save, X, ChevronDown, ChevronRight, GitMerge, Scissors, Trash2, CopyPlus, CheckSquare, Square, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CodeBlock as CodeBlockType } from "@/lib/codelooter-api";
import { SUPPORTED_LANGS } from "@/lib/extractor/langdetect";

interface CodeBlockCardProps {
  block: CodeBlockType;
  onDownload: (index: number) => void;
  onChange: (index: number, code: string) => void;
  onMergeWithNext?: (index: number) => void;
  onSplit?: (index: number, atLine: number) => void;
  onDelete?: (index: number) => void;
  onDuplicate?: (index: number) => void;
  onChangeLang?: (index: number, lang: string) => void;
  /**
   * Whether this block is currently part of the multi-select set. When true,
   * the card receives an emerald ring + the checkbox shows a checked state.
   */
  selected?: boolean;
  /**
   * Toggles this block's membership in the multi-select set. Receives the
   * block's `index`. The handler in ResultPanel maintains a `Set<number>`.
   */
  onToggleSelect?: (index: number) => void;
  /**
   * Toggle this block's bookmark (star) state. Receives the block's
   * `index`. The handler in ResultPanel flips `bookmarked` on the
   * matching block in local state. The visual state is driven by
   * `block.bookmarked` (filled amber star when true, muted outline star
   * otherwise).
   */
  onToggleBookmark?: (index: number) => void;
  isLast?: boolean;
}

// Supported languages for the per-block override selector. "auto" is excluded
// because each block already has a concrete language at extraction time —
// re-running auto-detect from the UI is out of scope for this feature.
const OVERRIDABLE_LANGS = SUPPORTED_LANGS.filter((l) => l.value !== "auto");

const LANG_LABEL: Record<string, string> = {
  r: "R", python: "Python", sql: "SQL", java: "Java", cpp: "C++",
  javascript: "JS", typescript: "TS", php: "PHP", kotlin: "Kotlin",
  go: "Go", rust: "Rust", bash: "Bash", html: "HTML", css: "CSS",
  json: "JSON", unknown: "—",
};

const SOURCE_LABEL: Record<string, string> = {
  pattern: "marker", "pattern-split": "split", "scan-fallback": "scan",
  density: "density", fenced: "fenced", html: "html", ipynb: "ipynb",
  latex: "latex", "txt-pattern": "txt", "pattern+merge": "marker+merge",
  split: "split-manual", duplicate: "copy", "marker+merge": "marker+merge",
};

// Lightweight regex-based syntax highlighting. Handles comments, strings,
// numbers, and a small set of R/Python keywords. Tiny bundle vs.
// react-syntax-highlighter's full prism build.
const KEYWORDS = new Set([
  "library", "require", "function", "if", "else", "for", "while", "return",
  "TRUE", "FALSE", "NULL", "NA", "Inf", "NaN", "in", "break", "next",
  "def", "import", "from", "as", "class", "self", "lambda", "pass", "with",
  "SELECT", "FROM", "WHERE", "JOIN", "INSERT", "UPDATE", "DELETE", "CREATE",
]);

export interface Token { t: string; c: string }

export function highlight(code: string, lang: string): Token[] {
  const tokens: Token[] = [];
  // Comment detection depends on language family.
  const lineComment = lang === "r" || lang === "python" || lang === "bash" ? "#" :
    lang === "sql" ? "--" : "//";
  const lines = code.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let i = 0;
    while (i < line.length) {
      const rest = line.slice(i);
      // Comment to end of line.
      if (rest.startsWith(lineComment)) {
        tokens.push({ t: rest, c: "comment" });
        i = line.length;
        break;
      }
      // String literal (double or single quoted).
      const strMatch = rest.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
      if (strMatch) {
        tokens.push({ t: strMatch[0], c: "string" });
        i += strMatch[0].length;
        continue;
      }
      // Number.
      const numMatch = rest.match(/^\d[\d._]*e[+-]?\d+|^\d[\d._]*|^\.\d+/i);
      if (numMatch) {
        tokens.push({ t: numMatch[0], c: "number" });
        i += numMatch[0].length;
        continue;
      }
      // Identifier / keyword.
      const idMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_.]*/);
      if (idMatch) {
        const word = idMatch[0];
        if (KEYWORDS.has(word)) {
          tokens.push({ t: word, c: "keyword" });
        } else if (line.slice(i + word.length).trimStart().startsWith("(")) {
          tokens.push({ t: word, c: "func" });
        } else {
          tokens.push({ t: word, c: "ident" });
        }
        i += word.length;
        continue;
      }
      // Operators / punctuation — single char.
      tokens.push({ t: rest[0], c: "op" });
      i++;
    }
    if (li < lines.length - 1) tokens.push({ t: "\n", c: "nl" });
  }
  return tokens;
}

export const TOKEN_CLASS: Record<string, string> = {
  comment: "text-slate-500 italic dark:text-slate-400",
  string: "text-emerald-600 dark:text-emerald-400",
  number: "text-amber-600 dark:text-amber-400",
  keyword: "text-rose-600 dark:text-rose-400 font-semibold",
  func: "text-teal-600 dark:text-teal-400",
  ident: "text-slate-700 dark:text-slate-200",
  op: "text-slate-500 dark:text-slate-400",
  nl: "",
};

export function CodeBlockCard({ block, onDownload, onChange, onMergeWithNext, onSplit, onDelete, onDuplicate, onChangeLang, selected, onToggleSelect, onToggleBookmark, isLast }: CodeBlockCardProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.code);
  const [collapsed, setCollapsed] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitLine, setSplitLine] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // NOTE: draft syncs with block.code via key-based remount in the parent
  // (ResultPanel passes key={result.filename + '-' + b.index}). This avoids
  // both useEffect and render-phase setState lint violations.

  const tokens = useMemo(() => highlight(block.code, block.lang), [block.code, block.lang]);
  const lineCount = useMemo(() => block.code.split("\n").length, [block.code]);
  const charCount = useMemo(() => block.code.length, [block.code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  const handleSave = () => {
    onChange(block.index, draft);
    setEditing(false);
    toast.success("Blok diperbarui");
  };

  const handleCancel = () => {
    setDraft(block.code);
    setEditing(false);
  };

  const handleMerge = () => {
    if (onMergeWithNext) {
      onMergeWithNext(block.index);
      toast.success("Blok digabung dengan blok berikutnya");
    }
  };

  const handleSplitConfirm = () => {
    if (onSplit && splitLine > 1 && splitLine < lineCount) {
      onSplit(block.index, splitLine);
      toast.success(`Blok dipisah pada baris ${splitLine}`);
    } else {
      toast.error("Pilih baris antara 2 dan " + (lineCount - 1));
    }
    setSplitMode(false);
  };

  const handleDelete = () => {
    if (confirmDelete && onDelete) {
      onDelete(block.index);
      toast.success("Blok dihapus");
    }
    setConfirmDelete(false);
  };

  const handleDuplicate = () => {
    if (onDuplicate) {
      onDuplicate(block.index);
      toast.success("Blok diduplikasi");
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md ${selected ? "border-emerald-500/50 ring-2 ring-emerald-500/40" : "border-border"}`}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        {/* Multi-select checkbox — placed BEFORE the collapse chevron so it
            is the very first interactive element in the header. stopPropagation
            keeps the click from bubbling (defensive — the chevron button is a
            separate sibling, not an ancestor, so the click wouldn't normally
            trigger collapse anyway). */}
        {onToggleSelect && (
          <button
            type="button"
            role="checkbox"
            aria-checked={!!selected}
            aria-label={selected ? `Batal pilih blok #${block.index}` : `Pilih blok #${block.index}`}
            title={selected ? "Batal pilih" : "Pilih blok"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(block.index);
            }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${selected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={collapsed ? "Buka" : "Tutup"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {/* Bookmark toggle — sits between the collapse chevron and the
            index number. Star icon is filled amber when `block.bookmarked`
            is true, muted outline otherwise. stopPropagation keeps the
            click from bubbling up to the header (which would otherwise be
            a no-op since the chevron is a sibling, but defensive — keeps
            the click truly local). */}
        {onToggleBookmark && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(block.index);
            }}
            aria-pressed={!!block.bookmarked}
            aria-label={block.bookmarked ? `Hapus bookmark blok #${block.index}` : `Bookmark blok #${block.index}`}
            title={block.bookmarked ? "Hapus bookmark" : "Tandai blok penting"}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-accent ${block.bookmarked ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Star className={`h-3.5 w-3.5 ${block.bookmarked ? "fill-amber-400" : "fill-none"}`} />
          </button>
        )}
        <span className="font-mono text-xs font-semibold text-muted-foreground">
          #{block.index}
        </span>
        <Badge
          variant="secondary"
          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
        >
          {LANG_LABEL[block.lang] ?? block.lang}
        </Badge>
        {onChangeLang && (
          <select
            value={OVERRIDABLE_LANGS.some((l) => l.value === block.lang) ? block.lang : "unknown"}
            onChange={(e) => onChangeLang(block.index, e.target.value)}
            className="h-6 cursor-pointer rounded border border-border bg-background px-1 text-[10px] text-foreground outline-none transition-colors hover:bg-accent focus:ring-1 focus:ring-ring"
            title="Ubah bahasa blok ini"
            aria-label={`Ubah bahasa blok #${block.index}`}
          >
            {!OVERRIDABLE_LANGS.some((l) => l.value === block.lang) && (
              <option value={block.lang}>{block.lang}</option>
            )}
            {OVERRIDABLE_LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        )}
        <span className="text-[11px] text-muted-foreground">{block.lines} lines · {charCount} chars</span>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          {SOURCE_LABEL[block.source] ?? block.source}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          {/* Merge with next block — only if not last and handler provided */}
          {onMergeWithNext && !isLast && (
            <Button
              size="sm" variant="ghost" className="h-7 px-2 text-xs"
              onClick={handleMerge}
              title="Gabung dengan blok berikutnya"
            >
              <GitMerge className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Split block — only if handler provided and block has >1 line */}
          {onSplit && lineCount > 1 && (
            <Button
              size="sm" variant="ghost" className="h-7 px-2 text-xs"
              onClick={() => { setSplitMode((s) => !s); setSplitLine(Math.min(2, lineCount - 1)); }}
              title={splitMode ? "Batal pisah" : "Pisah blok"}
            >
              <Scissors className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Duplicate block */}
          {onDuplicate && (
            <Button
              size="sm" variant="ghost" className="h-7 px-2 text-xs"
              onClick={handleDuplicate}
              title="Duplikasi blok"
            >
              <CopyPlus className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Delete block — with confirm */}
          {onDelete && (
            <Button
              size="sm" variant="ghost"
              className={`h-7 px-2 text-xs transition-colors ${confirmDelete ? "bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400" : "text-muted-foreground hover:text-destructive"}`}
              onClick={() => {
                if (confirmDelete) {
                  handleDelete();
                } else {
                  setConfirmDelete(true);
                  setTimeout(() => setConfirmDelete(false), 3000);
                }
              }}
              title={confirmDelete ? "Klik lagi untuk konfirmasi hapus" : "Hapus blok"}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmDelete && <span className="ml-1 text-[10px] font-medium">Konfirmasi?</span>}
            </Button>
          )}
          <Button
            size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => setEditing((e) => !e)}
            title={editing ? "Batal edit" : "Edit blok"}
          >
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={handleCopy} title="Salin"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => onDownload(block.index)} title="Download blok ini"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {/* Split mode controls */}
      {splitMode && !collapsed && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <Scissors className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-amber-700 dark:text-amber-300">Pisah pada baris:</span>
          <input
            type="number"
            min={2}
            max={lineCount - 1}
            value={splitLine}
            onChange={(e) => setSplitLine(parseInt(e.target.value, 10) || 2)}
            className="h-6 w-16 rounded border border-input bg-background px-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-muted-foreground">dari {lineCount}</span>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setSplitMode(false)}>
              Batal
            </Button>
            <Button size="sm" className="h-6 bg-amber-600 px-2 text-[11px] hover:bg-amber-700" onClick={handleSplitConfirm}>
              <Scissors className="h-3 w-3" /> Pisah
            </Button>
          </div>
        </div>
      )}
      {!collapsed && (
        <div className="relative max-h-96 overflow-auto bg-slate-950/95 dark:bg-black/40">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[160px] w-full resize-y bg-background p-3 font-mono text-xs leading-relaxed text-foreground outline-none"
              spellCheck={false}
            />
          ) : (
            <div className="flex">
              {/* Line numbers */}
              <div className="select-none border-r border-white/5 py-3 pl-3 pr-2 text-right font-mono text-[11px] leading-relaxed text-slate-600">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div
                    key={i}
                    className={splitMode && i + 1 === splitLine ? "bg-amber-500/30 text-amber-300" : ""}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code */}
              <pre className="flex-1 overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">
                <code>
                  {tokens.map((tk, i) => (
                    <span key={i} className={TOKEN_CLASS[tk.c]}>{tk.t}</span>
                  ))}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
      {editing && !collapsed && (
        <div className="flex justify-end gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancel}>
            <X className="h-3.5 w-3.5" /> Batal
          </Button>
          <Button size="sm" className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Simpan
          </Button>
        </div>
      )}
    </div>
  );
}
