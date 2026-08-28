# Task 6-b — Extraction History (Zustand, session-based)

**Agent**: full-stack-developer
**Task**: Add an "extraction history" feature to CodeLooter that tracks all extractions in the current browser session for quick re-access, using Zustand for state management.

## Summary

Implemented a session-scoped (in-memory, NOT persisted) extraction history that lets users quickly switch back to previously extracted files without re-uploading or saving them as snippets.

## Files

### Created
- `src/lib/extraction-history.ts` — Zustand `useHistory` store
  - `entries: HistoryEntry[]` (`{ id, result: ExtractResult, timestamp }`)
  - `addEntry(result)` — prepends new entry, slices to last 20 (`HISTORY_MAX_ENTRIES = 20`)
  - `removeEntry(id)` — filters out by id
  - `clearAll()` — empties entries
  - ID via `crypto.randomUUID()` with timestamp+random fallback

- `src/components/codelooter/history-panel.tsx` — UI component
  - Header: `Clock` icon + "Riwayat ekstraksi" + count + "Bersihkan" button
  - Subtitle: "Sesi ini saja — tidak disimpan"
  - Empty state with dashed border
  - List: `max-h-80 overflow-y-auto`, framer-motion `AnimatePresence` + `layout`
  - Each entry: FileCode icon, mono filename, block-count Badge, timeAgo (lightweight, no date-fns), optional `cache` tag, X remove button
  - Click → 350ms emerald flash via animated `backgroundColor` → `onSelect(result)` + toast
  - Clear-all → store.clearAll() + toast.info
  - Keyboard accessible (role=button, tabIndex=0, Enter/Space)

### Modified
- `src/app/page.tsx`
  - Imported `HistoryPanel` + `useHistory`
  - `addHistoryEntry = useHistory((s) => s.addEntry)` (selector subscription)
  - `handleExtract`: `addHistoryEntry(r)` after `setResult(r)` (added to deps)
  - `handleBatchExtract`: loops over results, skips `r.error`, adds each successful one (added to deps)
  - `handleSelectHistory(r)`: sets result, clears batchResults
  - Placed `<HistoryPanel onSelect={handleSelectHistory} />` as 3rd card in left sidebar (below SnippetList, same card style, stagger delay 0.1s)

## Verification
- `bun run lint` → clean (no errors, no warnings)
- dev.log → GET / 200, POST /api/extract 200, no runtime errors

## Design Decisions
- Used `Clock` icon for the panel header (snippet-list already uses `History` for its header, so Clock differentiates and conveys "recent in time")
- Batch results: each successful file added as a separate history entry (per task spec option "add each file's result as a separate entry")
- Emerald/teal palette throughout — no blue/indigo
- Restoring from history clears any open batch-results view so ResultPanel shows the selected extraction directly
- Session-scoped only (cleared on refresh) per "in-memory, not persisted" constraint
