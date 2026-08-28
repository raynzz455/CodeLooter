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
