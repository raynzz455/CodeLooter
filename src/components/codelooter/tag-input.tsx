"use client";

// TagInput — text input for comma-separated snippet tags with a "recent
// tags" autocomplete row.
//
// Props:
//   - value / onChange: controlled text input (comma-separated tags).
//   - onCommit: fired on blur or Enter so the parent can record the
//     current tags into the shared `useTagHistory` store.
//
// Below the input, a row of small clickable badges renders the user's
// recently-used tags (from the shared Zustand store). Clicking a badge
// appends that tag to the current value (if not already present). Tags
// that are already in the current value are hidden so the row never
// offers a no-op suggestion.

import { useMemo } from "react";
import { Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTagHistory } from "@/lib/tag-history";

interface TagInputProps {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
}

// Parse the comma-separated input into a lowercased Set for O(1) membership
// checks when filtering recent tags.
function parseCurrentTags(value: string): Set<string> {
  const out = new Set<string>();
  if (!value) return out;
  for (const part of value.split(",")) {
    const t = part.trim().toLowerCase();
    if (t) out.add(t);
  }
  return out;
}

export function TagInput({ value, onChange, onCommit }: TagInputProps) {
  const recentTags = useTagHistory((s) => s.tags);

  // Compute the list of recent tags NOT already present in the current
  // input value. Recomputed on every render (cheap: max 20 entries).
  const availableRecent = useMemo(() => {
    const present = parseCurrentTags(value);
    return recentTags.filter((t) => !present.has(t.toLowerCase()));
  }, [recentTags, value]);

  // Append a tag to the current value. Inserts a comma separator when the
  // input already has content; trims trailing whitespace; never adds a
  // duplicate (defensive — the filter above already hides dupes, but the
  // user could click fast).
  const appendTag = (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    const present = parseCurrentTags(value);
    if (present.has(t.toLowerCase())) return;
    const next = value.trimEnd();
    onChange(next ? `${next.replace(/,\s*$/, "")}, ${t}` : t);
    // Treat a badge click as an implicit commit so the newly-appended tag
    // is recorded into history immediately (in case the user never hits
    // Enter / blurs afterwards).
    onCommit?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Commit on Enter so the tags just typed land in the recent-tags
      // history without requiring the user to blur the field.
      onCommit?.();
    }
  };

  return (
    <div className="border-t border-border/40 pt-2">
      <div className="flex items-center gap-2">
        <Tag
          className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={handleKeyDown}
          placeholder="Tag (pisah dengan koma)..."
          aria-label="Tag snippet (pisah dengan koma)"
          className="h-8 text-xs"
        />
      </div>
      {/* Recent-tags row — only rendered when there's at least one recent
          tag that isn't already in the current value. */}
      {availableRecent.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-5">
          <span className="text-[10px] text-muted-foreground">Terbaru:</span>
          {availableRecent.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => appendTag(t)}
              title={`Tambahkan tag "${t}"`}
              className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
