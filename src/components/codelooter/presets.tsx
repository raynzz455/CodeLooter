"use client";

import { motion } from "framer-motion";
import { BarChart3, FileCode2, Database, Sparkles, type LucideIcon } from "lucide-react";

interface PresetsProps {
  lang: string;
  onSelect: (lang: string) => void;
}

interface Preset {
  value: string;
  label: string;
  tooltip: string;
  icon: LucideIcon;
}

const PRESETS: Preset[] = [
  { value: "r", label: "R Stats", tooltip: "Modul statistika R", icon: BarChart3 },
  { value: "python", label: "Python", tooltip: "Notebook Python", icon: FileCode2 },
  { value: "sql", label: "SQL", tooltip: "Skrip SQL", icon: Database },
  { value: "auto", label: "Auto", tooltip: "Deteksi otomatis", icon: Sparkles },
];

export function Presets({ lang, onSelect }: PresetsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Preset cepat</span>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isActive = lang === preset.value;
          return (
            <motion.button
              key={preset.value}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(preset.value)}
              title={preset.tooltip}
              aria-label={preset.tooltip}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{preset.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
