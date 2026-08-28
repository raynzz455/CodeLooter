# Task 10-a — Block bookmarking (mark important blocks for quick access)

## Summary
Added a per-block bookmark (star) feature to CodeLooter so users can mark important code blocks (key formula, main model, etc.) for quick access. Bookmarks persist with the snippet when saved (via the existing `blocksJson` round-trip — no API / schema changes required).

## Files Modified
1. `src/lib/codelooter-api.ts` — added `bookmarked?: boolean` to the `CodeBlock` interface.
2. `src/components/codelooter/code-block-card.tsx` — added `Star` import, `onToggleBookmark?` prop, and a bookmark toggle button in the header between the collapse chevron and the `#{index}` span. Filled amber star when bookmarked, muted outline otherwise. `e.stopPropagation()` on click.
3. `src/components/codelooter/sortable-block-list.tsx` — added `onToggleBookmark?` prop, forwarded through `SortableItem` to `CodeBlockCard`.
4. `src/components/codelooter/result-panel.tsx` — added `Star` import, `bookmarkedOnly` state (reset on new result), `handleToggleBookmark(index)` handler (mutates local state + toast), bookmark filter toggle button in the search bar (emerald when active, narrows `filteredBlocks` to `b.bookmarked === true`), wired `onToggleBookmark={handleToggleBookmark}` to both the normal cards list and the `SortableBlockList` reorder view, and updated the empty-state reset to also clear `bookmarkedOnly`.

## Verification
- `bun run lint` → exit code 0 (zero errors).
- Dev server log shows clean compile (Next.js 16.1.3 webpack), no errors.

## Color Palette
- Amber (`fill-amber-400 text-amber-400`) for the per-block bookmark star (filled state).
- Emerald (`bg-emerald-500 text-white`) for the active filter toggle.
- No blue or indigo introduced.

## Notes for Downstream Agents
- The snippet API routes already round-trip `blocksJson` verbatim, so `bookmarked` survives Save and Update with zero API / schema changes. Loading a saved snippet (GET `/api/snippets/[id]`) restores bookmarks.
- `bookmarked` is treated as `false` when `undefined` by all consumers (filter, visual state).
- The bookmark filter is AND-combined with the existing text + language filters in `filteredBlocks`.
