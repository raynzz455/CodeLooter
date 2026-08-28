"use client";

import { Heart, Cpu } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/20">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <p className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            CodeLooter · Phase 1 extraction engine · zero-token, pattern-based
          </span>
        </p>
        <p className="flex items-center gap-1.5">
          <span>Dibangun untuk modul praktikum Indonesia</span>
          <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
        </p>
      </div>
    </footer>
  );
}
