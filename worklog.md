# CodeLooter — Project Worklog

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Read PRD.md from the CodeLooter GitHub repo (https://github.com/raynzz455/CodeLooter) and implement Phase 1 "Fix Ekstraksi" (extraction improvements) in the current Next.js project.

Work Log:
- Cloned the CodeLooter repo to /tmp and read PRD.md + backend/app/pattern_extract.py to understand the existing Python pattern-extraction logic and the four Phase 1 fixes required.
- Ported the Python pattern extractor to TypeScript and implemented all four Phase 1 fixes:
  1. **Merge fragmented blocks (look-back/look-ahead)** — `src/lib/extractor/merge.ts`: two candidate blocks separated by ≤2 narrative lines (with no hard boundary marker like `# Kasus N`) are merged back into one. Also merges on structural-continuation signals (prev ends with `,` / open bracket / `<-`; next starts with digit / closing bracket).
  2. **Stricter narrative filter (prose ratio > 40%)** — `src/lib/extractor/line-classify.ts`: a line is classified as narrative (not code) if >40% of its word tokens are common Indonesian/English prose words, even if it contains code-like tokens (e.g. `X-squared = 2.2222 menunjukkan bahwa...`).
  3. **Repair line-wraps** — `src/lib/extractor/repair.ts`: detects continuation-end (trailing comma/operator, unclosed bracket) and continuation-start (digit, closing bracket) signals and re-joins PDF-split lines. Number continuations like `170\n0000` are glued without a space to reconstruct `1700000`.
  4. **Consistent R-output stripping** — `src/lib/extractor/pattern-extract.ts`: all `##` and `[N]` R-console-output lines are removed from each block's head, tail, and interior.
- Built the extraction pipeline (`src/lib/extractor/`): `types.ts`, `langdetect.ts`, `line-classify.ts`, `repair.ts`, `merge.ts`, `pattern-extract.ts`, `formats.ts` (markdown/ipynb/html/latex/txt), `pdf.ts`, `cache.ts`, `index.ts`.
- Set up Prisma schema (`prisma/schema.prisma`): `Snippet` model (stores extracted blocks as JSON) + `ExtractCache` model. Pushed with `bun run db:push`.
- Built API routes: `POST /api/extract?lang=`, `GET/POST /api/snippets`, `GET/DELETE /api/snippets/[id]`, `GET /api/snippets/[id]/download?block=`.
- Built the frontend UI (`src/components/codelooter/`): `header.tsx`, `footer.tsx` (sticky via `mt-auto`), `upload-panel.tsx` (drag&drop + native select), `code-block-card.tsx` (lightweight custom syntax highlighter — avoids the heavy react-syntax-highlighter bundle), `result-panel.tsx`, `snippet-list.tsx`, `stats-bar.tsx` (shows Phase 1 metrics). Main page `src/app/page.tsx` ties it together with a hero section explaining the 4 Phase 1 fixes.
- **PDF extraction challenge & solution**: pdf-parse v2 (pdfjs-dist v5) needs DOM polyfills unavailable in Node. pdf-parse v1, unpdf, and pdf2json all crash turbopack during bundling. Solved by writing a **pure-TypeScript PDF text extractor** (`src/lib/extractor/pdf-pure.ts`) that uses only Node's built-in `zlib` to inflate FlateDecode streams and regex to parse text-showing operators (Tj, TJ, ', ", Td, Tm). This bundles cleanly under turbopack and even produces better text than pdf2json (preserves indentation, proper line breaks).
- **Dev-server stability**: react-syntax-highlighter and the radix-ui Select caused client-bundle memory spikes that OOM-killed the 4GB-cgroup dev server on browser load. Replaced with a custom lightweight syntax highlighter and a native `<select>`. Also removed the unused radix Toaster (kept only sonner). Server now stays stable.
- Verified extraction correctness with a 9-check suite (`src/lib/extractor/__test__/verify.ts`): all 9 PASS (no `##` in blocks, no narrative "menunjukkan bahwa", cor.test captured, library(lmtest) captured, biaya_promosi line-wrap repaired to 1700000, summary(vp) captured, data.frame captured, chisq.test captured, ≥2 blocks produced).
- Verified end-to-end via agent-browser: sample module loads → 3 blocks extracted with correct content; stats bar shows wraps=9, narasi=2, R-out=3; footer sticks to viewport bottom on tall viewport (sticks:true); no console errors; mobile screenshot taken.

Stage Summary:
- **Phase 1 extraction is complete and verified.** The output matches the PRD section 7.1 desired output exactly: 3 clean code blocks per Kasus, no narrative, no R-output, line-wraps repaired, cor.test merged with data.frame despite intervening "Interpretasi" narrative.
- **Architecture**: Next.js 16 (App Router) + TypeScript + Prisma/SQLite + pure-TS PDF extractor. No external PDF library (avoids bundler crashes). In-memory cache with version invalidation (Phase 3 item #10 applied proactively).
- **Files produced**: `src/lib/extractor/*.ts` (9 modules), `src/app/api/{extract,snippets}/route.ts`, `src/components/codelooter/*.tsx` (7 components), `src/app/page.tsx`, updated `layout.tsx`, `next.config.ts`, `prisma/schema.prisma`.
- **Known limitation**: PDF extraction uses a pure-TS parser that handles text-based PDFs with FlateDecode + standard encodings. CID-keyed fonts / image-based PDFs (needing OCR) are out of scope for Phase 1.
- **Unresolved / next-phase**: Phase 2 (UX: inline editor for snippets, OCR progress bar, clear UI separation) and Phase 3 (dead-code cleanup, test suite, cache versioning) are NOT yet started — the PRD roadmap lists them after Phase 1.

---
Task ID: 2
Agent: webDevReview (cron round 1)
Task: QA assessment + bug fixes + new features + styling improvements for CodeLooter Phase 1.

Work Log:
- Reviewed worklog.md (Task 1) — Phase 1 extraction complete and verified.
- Performed QA testing via agent-browser: app loads, no console errors, all API endpoints respond correctly.
- Identified and fixed 2 bugs:
  1. **result-panel.tsx blocks state stale**: `blocks` state didn't reset when a new extraction result arrived. After editing a block in file A, extracting file B still showed file A's edited blocks. Fixed with `useEffect(() => setBlocks(null), [result])`.
  2. **code-block-card.tsx draft state stale**: `draft` state didn't sync when `block.code` changed externally (e.g., loading a saved snippet). Fixed via key-based remount: parent passes `key={result.filename + '-' + b.index}` so cards remount with fresh state on each new result.

- Added 7 new features:
  1. **Dark mode toggle** (header.tsx): Sun/Moon toggle using next-themes. CSS controls icon visibility via `dark:` classes to avoid hydration mismatch. ThemeProvider wrapper added to layout.tsx.
  2. **Paste-text mode** (upload-panel.tsx): Toggle between "Upload file" and "Tempel teks" (paste text). Paste mode provides a textarea for direct code/document input, creates a File from the text on extract. Shows live char/line count.
  3. **Snippet search** (snippet-list.tsx): Client-side search input that filters snippets by filename and language. Shows "no results" state when query matches nothing.
  4. **Copy-all-blocks button** (result-panel.tsx): Copies all block code to clipboard in one click, with copied-state feedback.
  5. **Block collapse/expand** (code-block-card.tsx): Chevron toggle to collapse/expand each code block. Collapsed blocks show only the header bar.
  6. **Language distribution badges** (result-panel.tsx): Shows which languages were detected and how many blocks per language (e.g., "r ×3, python ×1").
  7. **Keyboard shortcuts modal** (page.tsx): Press `?` to toggle a shortcuts overlay. Esc to close.

- Improved styling with framer-motion animations:
  - Hero section: staggered fade-in for badge, title, description
  - Feature pills: hover border color change to emerald
  - Upload/snippet cards: slide-in from left on mount
  - Result blocks: AnimatePresence with layout animation, staggered by block index
  - Keyboard shortcuts modal: scale + fade transition
  - Decorative grid pattern in hero background (radial-gradient)
  - Char count added to block header ("3 lines · 145 chars")
  - Total lines + chars in file header
  - Clear button next to "Upload & ekstrak" heading
  - Improved footer with GitHub link and format list

- Verified all API endpoints via curl:
  - MD extraction: 2 blocks, markdown-fenced ✓
  - PDF extraction: 2 blocks, pdf-text (1p), 2 line-wraps repaired ✓
  - Paste text extraction: 1 block, txt-pattern ✓
  - Snippets list: returns saved snippets ✓
  - Extraction verify suite: 9/9 checks pass ✓
  - Lint: passes cleanly ✓

- Verified via agent-browser:
  - Page loads with no console errors ✓
  - Dark mode toggle works ("DARK MODE ON" confirmed) ✓
  - Paste-text mode works (textarea found) ✓
  - Light/dark/paste-mode screenshots saved ✓

Stage Summary:
- **Current project status**: Phase 1 extraction is stable and verified. All API endpoints work correctly. The UI is now significantly more feature-rich with dark mode, paste-text input, snippet search, copy-all, block collapse, keyboard shortcuts, and framer-motion animations.
- **Completed modifications**: 2 bug fixes (stale state), 7 new features, comprehensive styling improvements with animations. All lint checks pass. Extraction quality unchanged (9/9 verify checks).
- **Unresolved risks**:
  - Dev server crashes under heavy browser load (4GB cgroup memory limit). Turbopack compilation spikes + chromium (~1GB RSS) can OOM-kill the server. This is an infrastructure limitation, not a code bug — all endpoints work via curl when the browser isn't open. Mitigation: pre-warm routes via curl before opening the browser.
  - PDF extraction uses a pure-TS parser (handles text-based PDFs with FlateDecode). CID-keyed fonts and image-based PDFs (needing OCR) are out of scope.
- **Priority recommendations for next phase**:
  1. Phase 2 (UX): inline snippet editor, OCR progress indicator, clear UI separation between extraction-language and preview-language panels
  2. Phase 3 (Reliability): dead-code cleanup, unit test suite with ground-truth fixtures, cache versioning (already partially done)
  3. Consider migrating from turbopack to webpack for dev mode (more memory-stable, but slower compilation)
  4. Add batch extraction (multiple files at once)
  5. Add export to ZIP (all blocks as separate files in a zip)

---
Task ID: 3
Agent: webDevReview (cron round 2)
Task: QA assessment + bug fixes + batch extraction + stats visualization + styling improvements.

Work Log:
- Reviewed worklog.md (Tasks 1-2) — Phase 1 extraction complete, 7 features added in Task 2.
- Performed QA via agent-browser and code review. Found 1 bug:
  1. **stats-bar.tsx cache icon bug**: The "from cache" badge used a spinning `Loader2` icon, which misleadingly looks like "loading" instead of "cache hit". Fixed by replacing with a `Database` icon. Also added contextual icons to all stat items (Zap, GitMerge, Eraser, Filter, Clock) and hover tooltips.

- Added 4 new features:
  1. **Batch extraction** (`POST /api/extract/batch`): New API endpoint that accepts multiple files via FormData and processes them sequentially. Returns `{ results: [{ filename, blocks, total, size, stats, error? }] }`. Max 10 files, 50MB each. Client API `extractBatch()` added to codelooter-api.ts.
  2. **Multi-file upload UI** (upload-panel.tsx): File input now accepts `multiple`. Selected files shown as a list with remove buttons. When >1 file selected, shows "X file siap diekstrak (batch)" and the extract button label changes to "Ekstrak N file (batch)".
  3. **Batch results view** (page.tsx `BatchResultsView`): Shows a summary card with total files/blocks/lines, then a list of per-file results. Each result card shows block count, line count, file size, and stat badges (wraps repaired, narrative filtered). Clicking a result opens it in the full ResultPanel. Error files show red border with error message.
  4. **Extraction statistics chart** (`stats-chart.tsx`): A horizontal bar chart using recharts (already installed) that visualizes the 4 Phase 1 fix metrics: line-wraps repaired, blocks merged, R-output stripped, narrative filtered. Only shows when at least one metric > 0. Each bar is color-coded to match the stats bar.

- Improved styling:
  1. **Loading skeleton** (`loading-skeleton.tsx`): Replaced the simple spinner loading state with a detailed skeleton that shows the file header, stats bar, and 3 block placeholders with shimmer animation. Uses the shadcn Skeleton component.
  2. **Stats bar icons**: Each stat item now has a contextual icon (Database for cache, Zap for wraps, GitMerge for merges, Eraser for R-output, Filter for narrative, Clock for duration).
  3. **Stats bar tooltips**: Each stat item has a `title` attribute for hover tooltips.
  4. **Batch result cards**: Color-coded (emerald for success, rose for errors), with stat badges showing wraps/filtered counts inline.

- Verified all API endpoints via curl:
  - Single extraction (MD): 2 blocks ✓
  - Single extraction (PDF): 2 blocks, 2 wraps repaired ✓
  - **Batch extraction (3 files)**: test.md (2 blocks), test_modul.pdf (2 blocks), paste_test.txt (1 block) — all 5 blocks extracted correctly ✓
  - Extraction verify suite: 9/9 checks pass ✓
  - Lint: passes cleanly ✓

- Verified via agent-browser:
  - Page loads with no console errors ✓
  - All UI elements present (theme toggle, sample button, upload/paste toggle) ✓
  - Screenshot saved ✓

Stage Summary:
- **Current project status**: Phase 1 extraction is stable and verified. The app now supports batch extraction (multiple files at once), visual statistics charts, loading skeletons, and improved stat bar with contextual icons. All API endpoints work correctly. Lint passes cleanly.
- **Completed modifications**: 1 bug fix (cache icon), 4 new features (batch extraction API + UI + results view + stats chart), loading skeleton, styling improvements. 9/9 extraction checks still pass.
- **Unresolved risks**:
  - Dev server crashes under heavy browser load (4GB cgroup memory limit). Turbopack compilation + chromium can OOM-kill. All endpoints work via curl. Mitigation: pre-warm routes before opening browser.
  - PDF extraction uses pure-TS parser (text-based PDFs only). CID fonts / OCR out of scope.
- **Priority recommendations for next phase**:
  1. Phase 2 (UX): inline snippet editor, OCR progress indicator
  2. Phase 3 (Reliability): unit test suite with ground-truth fixtures, dead-code cleanup
  3. Add ZIP export (all blocks as separate files in a zip) — needs a ZIP library
  4. Add block drag-and-drop reordering (@dnd-kit already installed)
  5. Add "before/after" comparison view showing removed narrative/R-output

---
Task ID: 4-b
Agent: full-stack-developer
Task: Add ZIP export feature for all blocks as separate files

Work Log:
- Read worklog.md (Tasks 1-3) to understand prior work: Phase 1 extraction complete, batch extraction + stats chart + loading skeleton added in Task 3. ZIP export was listed as a priority recommendation for the next phase in both Task 2 and Task 3.
- Verified `jszip` (^3.10.1) is already installed in node_modules.
- **`src/lib/codelooter-api.ts`**: Added `downloadSnippetZipUrl(id)` helper returning `/api/snippets/{id}/download?format=zip`.
- **`src/app/api/snippets/[id]/download/route.ts`**: Added `format=zip` query-parameter branch. Static `import JSZip from "jszip"` on the server. Builds a ZIP where each block becomes `block_{index}.{ext}` (extension derived per-block from the block's own language via `extForLang`). Responds with `Content-Type: application/zip` + `Content-Disposition: attachment; filename="{base}_blocks.zip"`. Includes duplicate-filename guard. Existing text and single-block behaviour unchanged. Documented all three modes in the file header comment.
- **`src/components/codelooter/result-panel.tsx`**: Added a new "ZIP" button (`FileArchive` icon, `variant="outline"`) next to the existing "Download" (text) button. Dynamic `const JSZip = (await import("jszip")).default` import keeps jszip out of the initial client bundle. `zipping` state shows `Loader2` spinner + "Zipping…" label while generating. Toast on success (`ZIP dengan N file dibuat`) and on error. Added a shared `extForLang` helper covering all 12 languages from the spec (r→.R, python→.py, sql→.sql, java→.java, cpp→.cpp, javascript→.js, typescript→.ts, php→.php, kotlin→.kt, go→.go, rust→.rs, bash→.sh, default→.txt).
- **`src/components/codelooter/snippet-list.tsx`**: Replaced the single `FileCode` download icon with two anchor links — a `Download` icon (text format) and a `FileArchive` icon (ZIP format) — each with a descriptive `title` tooltip. Imported `downloadSnippetZipUrl` from the API helper.
- Inserted a 3-block test snippet (2× R, 1× Python) directly into SQLite to avoid the OOM-prone extract endpoint, then tested the ZIP API via curl.
- **Verified via curl**:
  - `GET /api/snippets/{id}/download?format=zip` → HTTP 200, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="sample_module_blocks.zip"`, 502 bytes.
  - `unzip -l` shows 3 files: `block_0.R` (106 B), `block_1.R` (49 B), `block_2.py` (66 B). Extracted contents verified correct.
  - Text format (`?block=-1`) and single-block format (`?block=0`) still return HTTP 200 with correct content.
  - 404 for non-existent snippet (both formats) returns HTTP 404 JSON error.
- Cleaned up the test snippet from the DB after verification.
- `bun run lint` passes cleanly (no errors).
- Wrote work record to `/home/z/my-project/agent-ctx/4-b-full-stack-developer.md`.

Stage Summary:
- **ZIP export feature is complete and verified.** Users can now download all extracted code blocks as separate files inside a single ZIP archive — both from the ResultPanel (new "ZIP" button next to the existing "Download" text button) and from the saved SnippetList (new `FileArchive` icon link next to the existing text-download icon). The server-side API supports `?format=zip` on `GET /api/snippets/[id]/download`.
- **Per-block file extensions**: r→.R, python→.py, sql→.sql, java→.java, cpp→.cpp, javascript→.js, typescript→.ts, php→.php, kotlin→.kt, go→.go, rust→.rs, bash→.sh, default→.txt — applied per-block (each block's own language), so a mixed-language extraction produces correctly-named files in the same ZIP.
- **Bundle optimisation**: jszip is imported statically on the server (route.ts) and dynamically on the client (result-panel.tsx) to keep the initial client bundle small.
- **No blue/indigo colours** — the ZIP button uses neutral `variant="outline"`; the existing emerald accent on the Save button is preserved.
- **Known infrastructure issue (unchanged from Tasks 2-3)**: the dev server in the 4GB cgroup can transiently OOM-kill on the *first* `?format=zip` request because Turbopack must compile the jszip-bundled route. Pre-warming the text route first, then hitting the ZIP route, is the reliable sequence. This is an environment limitation, not a code bug — the ZIP API itself works correctly once compiled.

---
Task ID: 4
Agent: webDevReview (cron round 3)
Task: ZIP export + before/after comparison view + extractor improvements.

Work Log:
- Reviewed worklog.md (Tasks 1-3) — Phase 1 extraction complete, batch extraction + stats chart + loading skeleton added in Task 3.
- Performed QA: server stable, lint passes, 9/9 extraction checks pass. No new bugs found.
- Focused this round on 2 major new features from the Task 3 priority recommendations:

**Feature 1: ZIP Export (Task 4-b, via subagent)**
- Installed `jszip` (^3.10.1).
- Added `format=zip` query parameter to `GET /api/snippets/[id]/download` route — builds a ZIP where each block becomes `block_{index}.{ext}` (per-block language extension). Returns `Content-Type: application/zip`.
- Added "ZIP" button to ResultPanel header (dynamic `import("jszip")` on client to keep bundle small). Shows spinner during zipping, toast on success.
- Added `downloadSnippetZipUrl(id)` client helper.
- Updated SnippetList to show two download icons (text + ZIP).
- Verified via curl: 3-block snippet → ZIP with `block_0.R`, `block_1.R`, `block_2.py` (correct per-language extensions).

**Feature 2: Before/After Comparison View (Task 4-a, implemented directly)**
- **Extractor changes**: Added `removedLines: string[]` to `PatternExtractStats` and `ExtractStats` interfaces. The `extractCodeBlocksFromText` function now collects lines classified as narrative or R-output during extraction (capped at 200 lines to keep response small). This data flows through the extractor pipeline to the API response.
- Bumped `EXTRACTOR_VERSION` to `phase1-v1.1.0` (cache invalidation for the new field).
- Created `src/components/codelooter/comparison-view.tsx`: A side-by-side layout showing:
  - Left/top: Extracted code blocks (emerald border, clean code)
  - Right/bottom: Removed lines (color-coded: R-output `##` in amber, narrative in rose)
  - Summary bar with total extracted lines vs removed lines count
  - Framer-motion staggered animations for each removed line
- Integrated into ResultPanel: Added a "Bandingkan" (Compare) toggle button that appears only when `removedLines.length > 0`. Toggles between "extracted" view (default block cards) and "comparison" view (side-by-side). Button turns rose-colored when active.
- Updated `StatsBar` props to accept `removedLines` for type compatibility.
- Verified via curl: PDF extraction returns `removedLines` array with 8 entries (narrative headers + R-output lines).

- Verified all endpoints:
  - Lint: passes cleanly ✓
  - Extraction: 9/9 verify checks pass ✓
  - PDF API: returns `removedLines` (8 lines) + `strippedROutput: 2` + `filteredNarasi: 2` ✓
  - ZIP API: returns valid ZIP with correct per-block file extensions ✓
  - Browser: page loads, all UI elements present, no console errors ✓

Stage Summary:
- **Current project status**: Phase 1 extraction is stable and verified. The app now supports ZIP export (all blocks as separate per-language files in a ZIP) and a before/after comparison view that shows exactly which narrative and R-output lines were removed during extraction. The extractor now returns `removedLines` data for transparency. Extractor version bumped to v1.1.0.
- **Completed modifications**: 2 major features (ZIP export + comparison view), extractor pipeline extended with `removedLines` collection, 3 new/modified files (comparison-view.tsx, download route, extractor types/pattern-extract/index), extractor version bump. 9/9 extraction checks still pass.
- **Unresolved risks**:
  - Dev server crashes under heavy browser load (4GB cgroup memory limit). All endpoints work via curl. Mitigation: pre-warm routes before opening browser.
  - PDF extraction uses pure-TS parser (text-based PDFs only). CID fonts / OCR out of scope.
  - `removedLines` capped at 200 entries — very large files may have more removed lines not shown.
- **Priority recommendations for next phase**:
  1. Block drag-and-drop reordering (@dnd-kit already installed, not yet used)
  2. Phase 2 (UX): inline snippet editor, OCR progress indicator
  3. Phase 3 (Reliability): unit test suite with ground-truth fixtures, dead-code cleanup
  4. Add "copy as markdown" export (blocks as ``` fenced code blocks)
  5. Add extraction presets (R stats module, Python notebook, SQL scripts)
