"use client";

import { FileCode2, Github, Sparkles, Sun, Moon, BarChart3 } from "lucide-react";
import { useTheme } from "next-themes";

interface HeaderProps {
  /**
   * Fired when the user clicks the "Stats" button. The parent (page.tsx)
   * owns the modal visibility state and renders the `<StatsDashboard>`
   * overlay — the header just signals intent so the button can stay in
   * this otherwise stateless component.
   */
  onShowStats?: () => void;
}

export function Header({ onShowStats }: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <FileCode2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-base font-bold tracking-tight">
              Code<span className="text-emerald-600 dark:text-emerald-400">Looter</span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              extraction engine
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 sm:inline-flex">
            <Sparkles className="h-3 w-3" />
            Phase 1 · extraction fix
          </span>
          {/* Snippet statistics — opens the StatsDashboard modal. Placed next
              to the theme toggle so the two are visually grouped as
              "global actions" on the right edge of the header. The button is
              optional: callers that don't pass `onShowStats` simply get no
              button rendered (e.g. when used in a non-app context). */}
          {onShowStats && (
            <button
              onClick={onShowStats}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
              title="Statistik snippet"
              aria-label="Statistik snippet"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          )}
          {/* Dark mode toggle — both icons rendered, CSS controls visibility
              based on .dark class to avoid hydration mismatch. */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            <Sun className="hidden h-4 w-4 dark:block" />
            <Moon className="block h-4 w-4 dark:hidden" />
          </button>
          <a
            href="https://github.com/raynzz455/CodeLooter"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">Repo</span>
          </a>
        </div>
      </div>
    </header>
  );
}
