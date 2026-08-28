"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Terminal, FileText } from "lucide-react";
import type { CodeBlock } from "@/lib/codelooter-api";

interface ComparisonViewProps {
  blocks: CodeBlock[];
  removedLines: string[];
}

// Classify a removed line as R-output or narrative for color-coding.
function isROutputLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("## ") || t.startsWith("##\t") || /^\[\d+\]\s/.test(t);
}

export function ComparisonView({ blocks, removedLines }: ComparisonViewProps) {
  const totalExtracted = blocks.reduce((s, b) => s + b.lines, 0);
  const totalRemoved = removedLines.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4"
    >
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-muted-foreground">Extracted:</span>
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            {blocks.length} blocks · {totalExtracted} lines
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span className="text-muted-foreground">Removed:</span>
          <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
            {totalRemoved} lines
          </span>
        </div>
      </div>

      {/* Side-by-side comparison on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Extracted blocks (left) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 px-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Extracted code blocks
            </h4>
          </div>
          <div className="flex max-h-[500px] flex-col gap-2 overflow-y-auto pr-1">
            {blocks.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="overflow-hidden rounded-md border border-emerald-500/20 bg-emerald-500/5"
              >
                <div className="flex items-center gap-2 border-b border-emerald-500/15 bg-emerald-500/10 px-2 py-1">
                  <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    #{b.index}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {b.lang} · {b.lines} lines
                  </span>
                </div>
                <pre className="overflow-x-auto p-2 font-mono text-[11px] leading-relaxed text-foreground">
                  <code>{b.code}</code>
                </pre>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Removed lines (right) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 px-1">
            <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <h4 className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              Removed lines (narrative &amp; R-output)
            </h4>
          </div>
          <div className="flex max-h-[500px] flex-col gap-1 overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {removedLines.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Tidak ada baris yang dihapus.
                </div>
              ) : (
                removedLines.map((line, i) => {
                  const isR = isROutputLine(line);
                  return (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className={`flex items-start gap-2 rounded-md border px-2 py-1.5 font-mono text-[11px] leading-relaxed ${
                        isR
                          ? "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300"
                          : "border-rose-500/20 bg-rose-500/5 text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      <span className="shrink-0 text-muted-foreground/60 select-none">
                        {isR ? <Terminal className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{line}</span>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
