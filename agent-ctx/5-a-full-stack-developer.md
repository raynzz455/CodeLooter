# Task 5-a — Add copy-as-markdown export feature

## Work Log
- Read `/home/z/my-project/worklog.md` (Tasks 1–4) and `src/components/codelooter/result-panel.tsx` to understand the existing UI patterns: `copiedAll` state, `handleCopyAll` clipboard pattern, and the file-header button group ordering (`Salin semua` → `Download` → `ZIP` → `Bandingkan` → `Simpan`).
- Added `ClipboardCopy` to the `lucide-react` import list (kept `Check` for the success feedback).
- Added `copiedMd` state alongside the existing `copiedAll` state.
- Implemented `handleCopyMarkdown()`:
  - Builds a Markdown string where each block is wrapped in a fenced code block with the block's language hint: ` ```r ... ``` `.
  - Prepends an HTML comment header before each block: `<!-- Block #0 | r | 5 lines -->`.
  - Blocks separated by a blank line (`\n\n`).
  - Copies via `navigator.clipboard.writeText()`.
  - Sets `copiedMd=true` for 1.5s with `setTimeout` to show a checkmark, mirroring `copiedAll`.
  - Toast on success: `N blok disalin sebagai Markdown`. Toast on failure: `Gagal menyalin`.
- Added the new "Markdown" button in the file-header button group, immediately after the "Salin semua" button:
  - `variant="ghost"` (matches the existing copy button style).
  - `title="Salin semua blok sebagai Markdown"`.
  - Icon: `ClipboardCopy` (or `Check` in emerald when copied).
  - Label "Markdown" hidden on mobile via `hidden sm:inline` (icon always visible).
  - `disabled` when `effectiveBlocks.length === 0`.
- Verified: `bun run lint` passes cleanly. No other files touched.

## Stage Summary
- The ResultPanel file-header button group now offers three copy/export paths:
  1. **Salin semua** — plain text concatenation of all block code.
  2. **Markdown** (NEW) — Markdown-fenced code blocks with language hints and HTML-comment headers, ready to paste into README/docs/notes.
  3. **Download** — single `.txt` file with banner separators.
  4. **ZIP** — per-block files inside a zip.
  5. **Bandingkan** — before/after comparison view (conditional).
  6. **Simpan** — save snippet to DB.
- Output format example:
  ```
  <!-- Block #0 | r | 5 lines -->
  ```r
  library(ggplot2)
  data <- read.csv("data.csv")
  ```

  <!-- Block #1 | python | 3 lines -->
  ```python
  import pandas as pd
  ```
  ```
- No blue/indigo colours used; the success checkmark uses the existing emerald accent.
- Only `src/components/codelooter/result-panel.tsx` was modified, as instructed.
