// CodeLooter — recently-used-tags store (Zustand)
//
// Holds an in-memory list of the user's most recently used tags across the
// app session. Tags are stored most-recent-first, deduplicated case-
// insensitively, and capped at 20 entries. The store is intentionally
// ephemeral (no persistence to localStorage) so the "recent tags" row in
// the TagInput component reflects the current session's history only.
//
// The store is safe to call from outside a React component via
// `useTagHistory.getState().addTag(...)` — that pattern is used by
// ResultPanel after a successful save / update so the tags just typed are
// recorded without requiring a separate hook subscription.

import { create } from "zustand";

interface TagHistoryState {
  // Unique, most-recent-first, max 20 entries. Each entry is the tag as
  // originally typed (preserving case) — deduplication is case-insensitive
  // but the first-seen (most-recent) casing wins.
  tags: string[];
  /**
   * Record one or more tags (comma-separated input is split). New tags are
   * prepended (most-recent-first) and duplicates (case-insensitive) are
   * removed. The list is capped at 20 entries.
   */
  addTag: (tag: string) => void;
}

export const useTagHistory = create<TagHistoryState>((set) => ({
  tags: [],
  addTag: (tag) =>
    set((state) => {
      const trimmed = tag.trim();
      if (!trimmed) return state;
      // Split by comma in case multiple tags are passed at once (the tag
      // input is a comma-separated string). Reverse so the leftmost tag in
      // the input ends up most-recent in the history (matches user intent:
      // the first tag they typed is the "primary" one).
      const newTags = trimmed
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .reverse();
      const combined = [...newTags, ...state.tags];
      // Deduplicate case-insensitively, keeping the most-recent-first order.
      const seen = new Set<string>();
      const unique = combined.filter((t) => {
        const lower = t.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
      return { tags: unique.slice(0, 20) };
    }),
}));
