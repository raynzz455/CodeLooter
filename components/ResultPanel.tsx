"use client";

import { useState, useMemo } from "react";
import { Copy, Check, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader } from "./ui";
import { LANGUAGES } from "./data";
import type { CodeBlock, Language } from "@/types";

interface ResultPanelProps {
  selectedLang: string;
  isExtracting: boolean;
  extractedBlocks: CodeBlock[];
  extractError: string | null;
}

export function ResultPanel({
  isExtracting,
  extractedBlocks,
  extractError,
}: ResultPanelProps) {
  const [activeIndex, setActiveIndex]     = useState<number>(0);
  const [checked, setChecked]             = useState<Set<number>>(new Set());
  const [copied, setCopied]               = useState(false);
  const [filterLang, setFilterLang]       = useState<string>("all");
  const [showFilter, setShowFilter]       = useState(false);

  const extracted = extractedBlocks.length > 0;

  // Langs present in result
  const langs = useMemo(() =>
    [...new Set(extractedBlocks.map((b) => b.lang))],
    [extractedBlocks]
  );

  // Filtered list
  const visible = useMemo(() =>
    filterLang === "all"
      ? extractedBlocks
      : extractedBlocks.filter((b) => b.lang === filterLang),
    [extractedBlocks, filterLang]
  );

  const activeBlock = visible.find((b) => b.index === activeIndex) ?? visible[0] ?? null;
  const currentLang = (LANGUAGES.find((l) => l.id === activeBlock?.lang) ?? LANGUAGES[0]) as Language;

  // Toggle single checkbox
  const toggle = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // Select all visible / deselect all
  const allVisibleChecked = visible.length > 0 && visible.every((b) => checked.has(b.index));
  const toggleAll = () => {
    if (allVisibleChecked) {
      setChecked((prev) => {
        const next = new Set(prev);
        visible.forEach((b) => next.delete(b.index));
        return next;
      });
    } else {
      setChecked((prev) => {
        const next = new Set(prev);
        visible.forEach((b) => next.add(b.index));
        return next;
      });
    }
  };

  const handleCopy = async () => {
    if (!activeBlock) return;
    await navigator.clipboard.writeText(activeBlock.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download selected blocks — merge per lang into one file each
  const handleDownload = () => {
    const selected = extractedBlocks.filter((b) => checked.has(b.index));
    if (selected.length === 0) return;

    // Group by lang
    const byLang = new Map<string, string[]>();
    for (const b of selected) {
      const arr = byLang.get(b.lang) ?? [];
      arr.push(b.code);
      byLang.set(b.lang, arr);
    }

    for (const [lang, codes] of byLang.entries()) {
      const ext = LANGUAGES.find((l) => l.id === lang)?.ext ?? "txt";
      const content = codes.join("\n\n# ── next block ──\n\n");
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `codelooter_${lang}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const checkedCount = checked.size;

  return (
    <Card>
      {/* Header */}
      <CardHeader bg="#f5f0ff">
        <div style={{ display: "flex", gap: "5px" }}>
          {["#ff6b6b", "#ffe8a3", "#d4f0e4"].map((c) => (
            <div key={c} style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: c, border: "2px solid #000" }} />
          ))}
        </div>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", letterSpacing: "0.05em", flex: 1 }}>
          HASIL EKSTRAKSI
        </span>
        {/* Status badge */}
        <div style={{
          backgroundColor: extracted ? "#d4f0e4" : extractError ? "#ffd6d6" : "#ffe8a3",
          border: "2px solid #000", borderRadius: "8px", padding: "2px 9px",
          fontSize: "0.68rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "4px",
          fontFamily: "var(--font-body)",
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: extracted ? "#00aa44" : extractError ? "#ff4444" : "#ffaa00", display: "inline-block" }} />
          {extracted ? `${extractedBlocks.length} BLOK` : extractError ? "GAGAL" : "MENUNGGU"}
        </div>
      </CardHeader>

      {extracted && (
        <>
          {/* Toolbar: filter + select all + download */}
          <div style={{
            borderBottom: "3px solid #000", backgroundColor: "#fef9f0",
            padding: "8px 12px", display: "flex", alignItems: "center",
            gap: "8px", flexWrap: "wrap", flexShrink: 0,
          }}>
            {/* Select all checkbox */}
            <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontWeight: 900, fontSize: "0.75rem", fontFamily: "var(--font-body)" }}>
              <input
                type="checkbox"
                checked={allVisibleChecked}
                onChange={toggleAll}
                style={{ width: "15px", height: "15px", cursor: "pointer" }}
              />
              Pilih semua
            </label>

            <div style={{ width: "1px", height: "20px", backgroundColor: "#000", flexShrink: 0 }} />

            {/* Lang filter */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowFilter((v) => !v)}
                style={{
                  backgroundColor: filterLang === "all" ? "#fff" : LANGUAGES.find((l) => l.id === filterLang)?.color ?? "#fff",
                  border: "2px solid #000", borderRadius: "7px", padding: "3px 10px",
                  fontSize: "0.72rem", fontWeight: 900, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "4px",
                  fontFamily: "var(--font-body)",
                }}
              >
                {filterLang === "all" ? "Semua bahasa" : LANGUAGES.find((l) => l.id === filterLang)?.label ?? filterLang}
                {showFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showFilter && (
                <div style={{
                  position: "absolute", top: "calc(100% + 3px)", left: 0,
                  backgroundColor: "#fff", border: "2px solid #000", borderRadius: "8px",
                  boxShadow: "4px 4px 0 #000", zIndex: 20, overflow: "hidden", minWidth: "130px",
                }}>
                  {["all", ...langs].map((l, i) => {
                    const lang = LANGUAGES.find((x) => x.id === l);
                    return (
                      <button key={l} onClick={() => { setFilterLang(l); setShowFilter(false); }}
                        style={{
                          width: "100%", padding: "7px 12px", textAlign: "left",
                          backgroundColor: filterLang === l ? (lang?.color ?? "#ffe8a3") : "#fff",
                          border: "none", borderBottom: i < langs.length ? "1px solid #eee" : "none",
                          fontSize: "0.75rem", fontWeight: 800, cursor: "pointer",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {l === "all" ? "Semua bahasa" : `${lang?.emoji ?? ""} ${lang?.label ?? l}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={checkedCount === 0}
              style={{
                marginLeft: "auto",
                backgroundColor: checkedCount > 0 ? "#000" : "#ccc",
                color: checkedCount > 0 ? "#ffe8a3" : "#888",
                border: "2px solid #000", borderRadius: "8px",
                padding: "4px 12px", fontSize: "0.75rem", fontWeight: 900,
                cursor: checkedCount > 0 ? "pointer" : "not-allowed",
                fontFamily: "var(--font-display)", letterSpacing: "0.05em",
                boxShadow: checkedCount > 0 ? "3px 3px 0 #ff6b6b" : "none",
                display: "flex", alignItems: "center", gap: "5px",
                transition: "all 0.1s",
              }}
            >
              <Download size={13} />
              {checkedCount > 0 ? `DOWNLOAD (${checkedCount})` : "DOWNLOAD"}
            </button>
          </div>

          {/* Main content: block list + preview */}
          <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

            {/* Block list */}
            <div style={{
              width: "180px", flexShrink: 0, borderRight: "3px solid #000",
              overflowY: "auto", backgroundColor: "#fef9f0",
            }}>
              {visible.map((block, i) => {
                const lang = LANGUAGES.find((l) => l.id === block.lang);
                const isActive = activeIndex === block.index;
                return (
                  <div
                    key={block.index}
                    onClick={() => setActiveIndex(block.index)}
                    style={{
                      padding: "8px 10px",
                      borderBottom: i < visible.length - 1 ? "2px solid #eee" : "none",
                      backgroundColor: isActive ? (lang?.color ?? "#ffe8a3") : "transparent",
                      cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "7px",
                      transition: "background-color 0.1s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(block.index)}
                      onChange={(e) => { e.stopPropagation(); toggle(block.index); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: "2px", flexShrink: 0, cursor: "pointer" }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "0.72rem", fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: "3px" }}>
                        <span>{lang?.emoji ?? "📄"}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lang?.label ?? block.lang}
                        </span>
                      </p>
                      <p style={{ fontSize: "0.62rem", fontWeight: 700, color: "#666", margin: 0 }}>
                        Blok #{block.index + 1} · {block.lines} baris
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Code preview */}
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <div style={{
                backgroundColor: "#1a1a2e", height: "100%", overflowY: "auto",
                padding: "16px", fontFamily: "var(--font-mono)",
                fontSize: "0.76rem", lineHeight: "1.7",
              }}>
                {activeBlock ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#e8f4fd" }}>
                    <code>{activeBlock.code}</code>
                  </pre>
                ) : (
                  <p style={{ color: "#666", fontWeight: 700, margin: 0 }}>Pilih blok untuk preview</p>
                )}
              </div>

              {/* Copy button */}
              {activeBlock && (
                <button
                  onClick={handleCopy}
                  style={{
                    position: "absolute", bottom: "12px", right: "12px",
                    backgroundColor: copied ? "#d4f0e4" : "#ff6b6b",
                    border: "3px solid #000", borderRadius: "999px",
                    padding: "8px 14px", fontFamily: "var(--font-display)",
                    fontSize: "0.9rem", letterSpacing: "0.05em",
                    cursor: "pointer", boxShadow: copied ? "2px 2px 0 #000" : "4px 4px 0 #000",
                    display: "flex", alignItems: "center", gap: "5px",
                    transition: "all 0.15s",
                  }}
                >
                  {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
                  {copied ? "TERSALIN!" : "SALIN"}
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            backgroundColor: "#ffe0d0", borderTop: "3px solid #000",
            padding: "6px 14px", display: "flex", alignItems: "center",
            justifyContent: "space-between", flexShrink: 0, fontFamily: "var(--font-body)",
          }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 900 }}>
              {currentLang.emoji} {currentLang.label} · Blok #{(activeBlock?.index ?? 0) + 1} · {activeBlock?.lines ?? 0} baris
            </span>
            <span style={{ fontSize: "0.68rem", fontWeight: 900, color: "#555" }}>
              {checkedCount > 0 ? `${checkedCount} blok dipilih` : "Belum ada yang dipilih"}
            </span>
          </div>
        </>
      )}

      {/* Empty / loading / error states */}
      {!extracted && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "12px",
          backgroundColor: "#1a1a2e", padding: "24px",
        }}>
          {isExtracting ? (
            <>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "#ffe8a3", animation: "pulse 0.8s ease-in-out infinite alternate", margin: 0 }}>
                MENGANALISIS FILE...
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                {[0,1,2,3,4].map((i) => (
                  <div key={i} style={{ width: "8px", height: "8px", backgroundColor: "#d4f0e4", borderRadius: "50%", animation: `bounce 0.6s ease-in-out ${i * 0.1}s infinite alternate` }} />
                ))}
              </div>
            </>
          ) : extractError ? (
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "#ff6b6b", textAlign: "center", margin: 0 }}>
              {extractError}
            </p>
          ) : (
            <>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "3rem", color: "#aaa", margin: 0 }}>???</p>
              <p style={{ color: "#888", fontWeight: 700, textAlign: "center", fontSize: "0.85rem", margin: 0 }}>
                Upload file &amp; klik EKSTRAK KODE! untuk memulai
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
