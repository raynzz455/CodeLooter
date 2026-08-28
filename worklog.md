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
