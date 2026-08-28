# Task 4-b — ZIP Export Feature

**Agent**: full-stack-developer
**Task**: Add ZIP export feature for all extracted code blocks as separate files inside a single ZIP archive.

## What was done

1. **`src/lib/codelooter-api.ts`** — Added `downloadSnippetZipUrl(id: string): string` helper that returns `/api/snippets/{id}/download?format=zip`.

2. **`src/app/api/snippets/[id]/download/route.ts`** — Added `format=zip` query-parameter branch. When `?format=zip` is present, the route uses JSZip (server-side, `import JSZip from "jszip"`) to build a ZIP where each block becomes a separate file named `block_{index}.{ext}` (extension derived per-block from the block's own language, not the snippet's dominant language). Responds with `Content-Type: application/zip` and `Content-Disposition: attachment; filename="{base}_blocks.zip"`. Duplicate filename guard included (rare case of two blocks with same index+ext). Existing text/single-block behaviour unchanged.

3. **`src/components/codelooter/result-panel.tsx`** — Added a new "ZIP" button (with `FileArchive` icon) next to the existing "Download" (text) button in the file header. Uses dynamic import `const JSZip = (await import("jszip")).default` to keep jszip out of the initial client bundle. Shows `Loader2` spinner + "Zipping…" label while generating. Toast on success (`ZIP dengan N file dibuat`) and on error. Added a shared `extForLang` helper covering all 12 languages from the task spec (r→.R, python→.py, sql→.sql, java→.java, cpp→.cpp, javascript→.js, typescript→.ts, php→.php, kotlin→.kt, go→.go, rust→.rs, bash→.sh, default→.txt).

4. **`src/components/codelooter/snippet-list.tsx`** — Replaced the single `FileCode` download icon with two anchor links: a `Download` icon (text format, existing `downloadSnippetUrl`) and a `FileArchive` icon (ZIP format, new `downloadSnippetZipUrl`). Both have descriptive `title` tooltips.

## Verification

- `bun run lint` — passes cleanly (no errors).
- ZIP API test via curl against a test snippet (3 blocks: 2× R, 1× Python):
  - `GET /api/snippets/{id}/download?format=zip` → HTTP 200, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="sample_module_blocks.zip"`, 502 bytes.
  - `unzip -l` shows 3 files: `block_0.R` (106 B), `block_1.R` (49 B), `block_2.py` (66 B).
  - Extracted file contents verified correct.
- Text format (`?block=-1`) and single-block format (`?block=0`) still work (HTTP 200).
- 404 path for non-existent snippet returns HTTP 404 JSON error.

## Notes for downstream agents

- jszip is imported **statically** on the server (route.ts) and **dynamically** on the client (result-panel.tsx) to minimise the client bundle.
- The dev server is unstable in this 4GB cgroup — Turbopack compilation of the jszip-bundled download route can transiently OOM-kill the server on the *first* `?format=zip` request. Pre-warming the text route first, then hitting the ZIP route, is the reliable sequence. This is a known infrastructure issue (see worklog Tasks 2 & 3), not a code bug.
- No blue/indigo colours used — ZIP button uses `variant="outline"` (neutral) with the emerald accent preserved only on the existing Save button.
