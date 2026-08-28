# Task 5-b — Extraction Presets (R/Python/SQL/Auto quick-select)

## Files modified
- **Created** `src/components/codelooter/presets.tsx` — new `Presets` component
- **Modified** `src/components/codelooter/upload-panel.tsx` — imported and placed `<Presets>` above the "Bahasa kode" dropdown, wired `lang` state + `setLang` callback

## Implementation notes
- Props interface matches spec exactly: `{ lang: string; onSelect: (lang: string) => void }`
- 4 presets: R Stats (`BarChart3`), Python (`FileCode2`), SQL (`Database`), Auto (`Sparkles`)
- Tooltips in Indonesian: "Modul statistika R", "Notebook Python", "Skrip SQL", "Deteksi otomatis"
- Active preset styling: `border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`
- Inactive preset styling: `border-border bg-background text-muted-foreground hover:bg-accent`
- framer-motion `motion.button` with `whileTap={{ scale: 0.95 }}` for click feedback
- Compact buttons (icon 3.5×3.5 + short label) wrapped in `flex-wrap gap-2` so they wrap on mobile
- `aria-pressed` + `aria-label` for accessibility
- Dropdown remains fully functional after preset click (user can fine-tune); selecting a preset simply calls `setLang(preset.value)`, which also updates the dropdown's displayed value (both bound to the same `lang` state)

## Verification
- `bun run lint` — passes cleanly (no errors)
- Dev server (Turbopack) compiles `/` and `/api/extract` routes successfully
- No blue/indigo colors — emerald/teal palette only
