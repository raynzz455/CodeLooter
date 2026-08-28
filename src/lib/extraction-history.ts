"use client";

import { create } from "zustand";
import type { ExtractResult } from "./codelooter-api";

// Maximum number of extractions retained in the session history.
// Older entries are dropped (FIFO) to keep the panel lightweight.
export const HISTORY_MAX_ENTRIES = 20;

export interface HistoryEntry {
  id: string;
  result: ExtractResult;
  timestamp: number;
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (result: ExtractResult) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

// In-memory (NOT persisted) session history of extractions.
// Allows users to quickly switch back to a previously extracted file
// without re-uploading or saving it as a snippet.
export const useHistory = create<HistoryState>((set) => ({
  entries: [],
  addEntry: (result) =>
    set((state) => ({
      entries: [
        {
          // crypto.randomUUID is available in all modern browsers + Node 19+.
          // Fall back to a timestamp-based id if unavailable (e.g. older runtime).
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          result,
          timestamp: Date.now(),
        },
        ...state.entries,
      ].slice(0, HISTORY_MAX_ENTRIES),
    })),
  removeEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    })),
  clearAll: () => set({ entries: [] }),
}));
