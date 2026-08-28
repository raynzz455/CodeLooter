# Task 9-b — Add JSON export + snippet tags for organization

**Agent**: full-stack-developer
**Task ID**: 9-b
**Files modified**: 6
- `prisma/schema.prisma`
- `src/app/api/snippets/route.ts`
- `src/app/api/snippets/[id]/route.ts`
- `src/lib/codelooter-api.ts`
- `src/components/codelooter/result-panel.tsx`
- `src/components/codelooter/snippet-list.tsx`
- `src/app/page.tsx`

**Lint**: passes cleanly (exit code 0)
**DB**: `bun run db:push` applied successfully — `tags` column added.

## What was added

### Feature 1: Export as JSON

**`src/components/codelooter/result-panel.tsx`**:
- Imported `Braces` icon from `lucide-react`.
- Added `exportingJson` state (parallel to `exportingHtml`) for the loading spinner.
- Added `handleDownloadJson()` handler that builds a structured JSON object:
  ```json
  {
    "filename": "modul3.pdf",
    "fileSize": 336090,
    "totalBlocks": 3,
    "extractedAt": "2024-01-15T10:30:00Z",
    "stats": { ...extraction stats or null... },
    "blocks": [
      { "index": 0, "lang": "r", "code": "...", "lines": 5, "source": "pattern" }
    ]
  }
  ```
- Creates a `Blob` with `type="application/json;charset=utf-8"` and triggers a client-side download as `${base}_export.json`.
- Toasts `JSON dengan N blok dibuat` on success.
- Added a "JSON" button in the file header button group immediately after the "HTML" button. Uses `Braces` icon, `outline` variant, shows `Loader2` spinner while `exportingJson` is true. Label collapses to icon-only on mobile (`hidden sm:inline`).

### Feature 2: Snippet Tags

**`prisma/schema.prisma`**:
- Added `tags String @default("")` to the `Snippet` model. Stored as a single comma-separated string for simplicity (no separate Tag model needed for SQLite). Documented inline.
- Ran `bun run db:push` — schema applied to SQLite db.

**`src/app/api/snippets/route.ts`**:
- `GET`: added `tags: true` to the Prisma select so the list endpoint returns tags.
- `POST`: reads optional `tags` from the request body (defaults to empty string via `String(body.tags ?? "")`), persists it on snippet creation.

**`src/app/api/snippets/[id]/route.ts`**:
- `GET`: returns `tags` in the response payload.
- `PATCH`: conditionally accepts `tags` — only updates the field when the client explicitly sends a `tags` key (via `Object.prototype.hasOwnProperty.call(body, "tags")`). This means callers that only want to update the code don't accidentally wipe an existing tag set. When omitted, the SQL UPDATE doesn't include the `tags` column at all (verified via Prisma query log).

**`src/lib/codelooter-api.ts`**:
- Added `tags?: string` to `SnippetMeta` and `SnippetDetail`.
- `saveSnippet(filename, blocks, lang, size, tags?)` — optional 5th parameter, included in POST body.
- `updateSnippet(id, blocks, lang, tags?)` — optional 4th parameter; only included in the PATCH payload when explicitly provided (preserves the server-side conditional update behaviour).

**`src/components/codelooter/result-panel.tsx`**:
- Imported `Tag` icon (lucide-react) and shadcn `Input` component.
- Added `tagInput` state (string), initialized to `""`.
- New prop `currentTags?: string` — when the parent loads a saved snippet, this forwards its tags so the input can be pre-populated.
- New `useEffect([currentTags])` syncs `tagInput` from `currentTags` whenever the parent changes it (snippet loaded → tags populated; fresh extraction → cleared).
- Existing `useEffect([result])` also resets `tagInput` to `""` on a fresh extraction (defensive — covers the case where the parent clears `currentTags` to undefined before the new result arrives).
- `handleSave` now forwards `tagInput.trim()` as the `tags` argument to `saveSnippet`. The `onSaved` callback signature was extended to `(snippetId?, tags?)` so the parent can adopt the persisted tags into `currentTags` and keep the panel's input in sync.
- `handleUpdate` now forwards `tagInput.trim()` as the 3rd argument to `onUpdateSnippet`.
- The `onUpdateSnippet` prop signature was extended to `(id, blocks, tags?) => Promise<void> | void`.
- Added a tag input row in the file header card, below the filename row and above the language distribution badges. Uses the `Tag` icon (emerald palette), a shadcn `Input` (`h-8 text-xs`), with `placeholder="Tag (pisah dengan koma)..."` and `aria-label="Tag snippet (pisah dengan koma)"`. Bordered with `border-t border-border/40 pt-2` to match the language-distribution row visual treatment.

**`src/components/codelooter/snippet-list.tsx`**:
- Imported `Tag` icon (lucide-react).
- Added a `parseTags(tags)` helper that splits a comma-separated string, trims each entry, and filters out empty results. Returns `[]` for empty/undefined input.
- Extended the client-side search filter to also match against the `tags` field (in addition to filename and language).
- For each snippet row: if `parseTags(s.tags).length > 0`, renders a small tag row below the block-count + time row. Each tag is a small emerald pill (`bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`), preceded by a small `Tag` icon. The row uses `flex flex-wrap items-center gap-1` so long tag lists wrap gracefully.
- Refactored the per-snippet `.map` to use a block body (returning JSX) so `parseTags` can be called once per row.

**`src/app/page.tsx`**:
- Added `currentTags` state (mirrors `currentSnippetId`).
- All paths that load a fresh extraction / batch result / history entry / clear now also set `currentTags` to `undefined`.
- `handleSelectSnippet` sets `currentTags = detail.tags` when a saved snippet is loaded.
- `handleUpdateSnippet` now accepts an optional `tags` parameter, forwards it to `updateSnippet(id, blocks, lang, tags)`, and on success sets `currentTags = updated.tags` (so the input stays in sync with what's persisted).
- Passed `currentTags={currentTags}` prop to `<ResultPanel>`.
- Extended the `onSaved` callback to also adopt the persisted tags: `if (tags !== undefined) setCurrentTags(tags);`.

## Design decisions

- **Comma-separated string vs Tag model**: chose the simpler comma-separated string per the task spec — SQLite has no array type and a separate Tag model would add a join table for a single-user sandbox. The `parseTags` helper centralises the split/trim/filter logic so future migrations to a proper Tag model would only touch one place.
- **Conditional PATCH on tags**: the server only includes `tags` in the UPDATE SQL when the client explicitly sends a `tags` key. This means existing callers (e.g. any future "edit code only" flow) don't accidentally wipe tags. Verified via the Prisma query log: PATCH without `tags` → SQL omits the `tags` column from SET.
- **Tag input sync via two effects**: the `[result]` effect resets `tagInput` on any new extraction (covers the case where `currentTags` hasn't been cleared yet but the result has changed). The `[currentTags]` effect handles the snippet-load case (result may be the same shape but tags differ). Together they cover all transitions without fighting each other — the second effect only fires when `currentTags` actually changes value (React skips effects when `Object.is(prev, next)` is true).
- **`onSaved` extended to receive tags**: without this, after a Save the parent's `currentTags` would still be `undefined` (from the pre-save state). If the user then edited `tagInput` and the parent later re-rendered for some unrelated reason with `currentTags` still undefined, the `[currentTags]` effect would fire and wipe the user's edit. Forwarding the saved tags makes the parent state match reality.
- **JSON export is client-side**: the JSON is built and downloaded entirely in the browser (no server round-trip), matching the existing ZIP/HTML export pattern. This keeps the export instant and avoids adding a new API route. The `extractedAt` timestamp uses `new Date().toISOString()` so each export is uniquely identifiable.
- **JSON button placement**: placed immediately after the HTML button to maintain a logical grouping (text → zip → html → json → comparison → reorder → save → update). Same `outline` variant and `hidden sm:inline` responsive label pattern as the HTML button.
- **Color discipline**: strictly emerald/teal palette for the tag icon and badges — no blue or indigo. The "Update" button retains its existing amber treatment (unchanged from prior task).
- **Tag badges only render when there are tags**: the `tagList.length > 0` guard keeps untagged snippets compact (single-line layout) — no empty badge row.

## Verification

- `bun run lint` → exit code 0, no errors or warnings.
- `bun run db:push` → schema applied successfully ("Your database is now in sync").
- `npx tsc --noEmit` → no new errors introduced by these changes (pre-existing errors in `examples/`, `skills/`, `extractor/pdf.ts`, `page.tsx` `detail.filename` mismatches, etc. were already present and are out of scope).
- API curl tests (all passed):
  - `POST /api/snippets` with `tags:"statistika, modul3"` → returns `{id, totalBlocks}` ✓
  - `GET /api/snippets` → returns `tags:"statistika, modul3"` for the new snippet, `tags:""` for older snippets ✓
  - `GET /api/snippets/{id}` → returns `tags` field ✓
  - `PATCH /api/snippets/{id}` with `tags:"regresi, uji-t"` → updates tags ✓
  - `PATCH /api/snippets/{id}` without `tags` → tags preserved (SQL UPDATE omits the column) ✓
  - `DELETE /api/snippets/{id}` → works ✓
- Dev server log: clean compile, Prisma queries include the `tags` column in SELECT / INSERT / UPDATE / DELETE — confirming the schema migration took effect at the ORM layer.
