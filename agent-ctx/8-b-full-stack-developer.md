# Task 8-b — Add select all / bulk operations on blocks

**Agent**: full-stack-developer
**Files modified**: 2 (`code-block-card.tsx`, `result-panel.tsx`)
**Lint**: passes cleanly (exit code 0)
**TypeScript**: no new errors introduced (pre-existing errors in other files untouched)

## What was added

### 1. CodeBlockCard (`src/components/codelooter/code-block-card.tsx`)
- New optional props: `selected?: boolean`, `onToggleSelect?: (index: number) => void`
- Imported `CheckSquare` and `Square` from `lucide-react`
- Added a multi-select checkbox button at the very START of the card header (before the collapse chevron) — rendered only when `onToggleSelect` is provided.
- The checkbox swaps `Square` → `CheckSquare` based on the `selected` prop and uses emerald text color (`text-emerald-600 dark:text-emerald-400`) when checked.
- `onClick` calls `e.stopPropagation()` defensively then forwards `block.index` to `onToggleSelect`.
- `aria-checked`, `role="checkbox"`, and a dynamic `aria-label` (`Pilih blok #N` / `Batal pilih blok #N`) for screen-reader support.
- When `selected` is true, the outer card div receives `border-emerald-500/50 ring-2 ring-emerald-500/40` (and `border-border` when not selected).

### 2. ResultPanel (`src/components/codelooter/result-panel.tsx`)
- Imported `CheckSquare`, `Square`, `Trash2`, `X` from `lucide-react` (Copy, Check, FileArchive, Loader2 already imported).
- New state: `selectedIndices: Set<number>`, `confirmBulkDelete: boolean`, `bulkZipping: boolean`, `bulkCopied: boolean`.
- Existing `useEffect([result])` extended to also reset `selectedIndices` + `confirmBulkDelete` so stale selections don't bleed into a new file.
- Helpers: `toggleSelect(index)`, `selectAll()`, `deselectAll()`, and an `allSelected` derived boolean for the toggle button label.
- Bulk handlers:
  - `handleBulkCopy()` — joins selected blocks' code with `\n\n`, copies to clipboard, sets `bulkCopied` for 1.5s, toasts success.
  - `handleBulkDeleteClick()` — two-click confirm pattern (mirrors per-block delete): first click arms, second click within 3s commits. After commit: filters out selected blocks, renumbers indices 0..n-1, clears `selectedIndices`, toasts count.
  - `handleBulkZip()` — dynamically imports jszip, builds a ZIP containing ONLY selected blocks (same de-duplication logic as `handleDownloadZip`), writes as `{base}_selected.zip`, toasts count.
- Bulk action bar — `AnimatePresence`-wrapped `motion.div` between the file header and the blocks list. Renders only when:
  - `viewMode === "extracted"` (not in comparison view),
  - `!reorderMode` (reorder mode has its own UI),
  - `effectiveBlocks.length > 0`,
  - `selectedIndices.size > 0`.
  - Animates `y: -12 → 0` on enter and reverse on exit, 0.2s easeOut.
  - Emerald-tinted background: `border-emerald-500/40 bg-emerald-500/10 backdrop-blur shadow-md`.
  - Sticky at `top-2 z-20` so it stays visible while scrolling through blocks.
  - Buttons: "Pilih semua" / "Kosongkan" toggle (uses `allSelected` to pick label + icon), Salin (with Check confirmation), ZIP (with Loader2 spinner during compression), Hapus (two-click confirm with rose tint), X (clears selection entirely).
- Wired `selected={selectedIndices.has(b.index)}` and `onToggleSelect={toggleSelect}` to every `<CodeBlockCard>` in the normal (non-reorder) view.

## Design decisions
- **Set vs array**: chose `Set<number>` per the task spec — O(1) membership checks for the per-card `selected` prop and O(1) toggle.
- **Icon-only checkbox**: used lucide `CheckSquare` / `Square` rather than the shadcn `<Checkbox>` component to match the task's icon list and to keep the visual treatment fully under our control (emerald when checked).
- **Reorder mode exclusion**: bulk-select is hidden in reorder mode because (a) the SortableBlockList component was out of scope for this task, and (b) reordering + multi-select are conceptually different workflows. Users finish reordering first, then bulk-select.
- **Comparison view exclusion**: bulk-select is hidden in comparison view since that view is read-only.
- **Sticky bar**: chose `sticky top-2 z-20` rather than fixed so the bar stays within the ResultPanel's vertical scroll context — no overlap with the page header or sidebar.
- **Two-click delete confirm**: matches the per-block delete UX already established in CodeBlockCard — no extra modal, no `window.confirm`.
- **File naming**: bulk ZIP uses `_selected.zip` suffix to distinguish from the all-blocks `_blocks.zip` download.
- **Color discipline**: strictly emerald / rose for the bulk bar — no blue or indigo. Rose only for the delete-confirmed state, matching the existing delete-confirm treatment.

## Verification
- `bun run lint` → exit code 0, no errors or warnings.
- `npx tsc --noEmit` → no new errors in the two modified files (pre-existing errors in `page.tsx`, `examples/`, `skills/`, and other API routes are untouched and were present before this task).
- Dev server log shows clean compile and successful extraction requests — no regressions from the changes.
