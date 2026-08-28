"use client";

import { Heart, Cpu, Github, FileCode2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/20">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          <p className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              CodeLooter · Phase 1 extraction engine · zero-token, pattern-based
            </span>
          </p>
          <a
            href="https://github.com/raynzz455/CodeLooter"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Github className="h-3 w-3" />
            GitHub
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1">
            <FileCode2 className="h-3 w-3" />
            PDF · MD · IPYNB · HTML · LaTeX · TXT
          </span>
          <p className="flex items-center gap-1.5">
            <span>Dibangun untuk modul praktikum Indonesia</span>
            <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
}
