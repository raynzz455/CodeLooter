# Task 6-a — HTML Export Feature

## Summary
Added an "Export to HTML" feature to CodeLooter that downloads all extracted
code blocks as a standalone, syntax-highlighted, self-contained HTML file.

## Files Modified
1. `src/components/codelooter/code-block-card.tsx` — exported `highlight()`,
   `TOKEN_CLASS`, and the `Token` interface so they can be reused by the
   result panel.
2. `src/components/codelooter/result-panel.tsx` — added `FileCode2` icon
   import, `highlight`/`TOKEN_CLASS` imports, `exportingHtml` state,
   `handleDownloadHtml()` handler, and a new "HTML" button placed right
   after the "ZIP" button in the file-header button group.

## Design Decisions
- **Option A (export + import)** chosen over Option B (copy to shared util),
  per the task brief. `TOKEN_CLASS` is imported and used as the type
  constraint for the inline-style colour map (`Record<keyof typeof
  TOKEN_CLASS, ...>`), keeping the two in sync if a new token category is
  ever added upstream.
- **Standalone HTML**: every style is inlined in a single `<style>` tag —
  no external CSS/JS, no CDN dependencies. The file works offline and can
  be opened in any browser.
- **Dark theme palette** (no blue/indigo): background `#0f172a` (slate-900),
  text `#e2e8f0` (slate-200), code-bg `#1e293b` (slate-800), borders
  `#334155` (slate-700). Token colours mirror the in-app dark-mode
  highlighter: comment slate-400 italic, string emerald-400, number
  amber-400, keyword rose-400 bold, func teal-400, ident slate-200,
  op slate-400.
- **Responsive**: container `max-width: 960px` centred; long code lines
  scroll horizontally inside each `<pre>` (`overflow-x: auto`); header
  text uses `word-break: break-all` so very long filenames don't overflow.
- **HTML escaping**: every text node (`<`, `>`, `&`, `"`, `'`) is escaped
  before being inserted into `<code>` to prevent injection and broken
  rendering of code containing HTML-like characters.
- **Loading state**: `exportingHtml` boolean drives a `Loader2` spinner
  inside the button (matching the existing ZIP button pattern) and a
  "Membuat…" label.
- **Toast**: `HTML dengan N blok dibuat` on success,
  `Gagal membuat HTML` on error.

## Verification
- `bun run lint` — passes cleanly (exit code 0, no errors/warnings).
- Dev server log shows clean Turbopack compile (no compile errors).
