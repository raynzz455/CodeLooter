"use client";

import { useState } from "react";
import { Copy, Check, Download, Archive, AlertCircle } from "lucide-react";
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
  selectedLang,
  isExtracting,
  extractedBlocks,
  extractError,
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);

  const extracted = extractedBlocks.length > 0;

  // Find block matching selected lang, fallback to first block
  const activeBlock =
    extractedBlocks.find((b) => b.lang === selectedLang) ??
    extractedBlocks[0] ??
    null;

  const currentLang =
    LANGUAGES.find((l) => l.id === (activeBlock?.lang ?? selectedLang)) ??
    (LANGUAGES[0] as Language);

  const code = activeBlock?.code ?? "";

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    if (!activeBlock) return;
    downloadFile(code, `extracted_code.${currentLang.ext}`);
  };

  const handleDownloadAll = () => {
    if (extractedBlocks.length === 0) return;

    // Single lang → download directly
    if (extractedBlocks.length === 1) {
      const block = extractedBlocks[0];
      const lang = LANGUAGES.find((l) => l.id === block.lang);
      downloadFile(block.code, `extracted_${block.lang}.${lang?.ext ?? "txt"}`);
      return;
    }

    // Multi lang → download as a single combined .txt with clear separators
    // (no external zip library needed — clean and dependency-free)
    const combined = extractedBlocks
      .map((block) => {
        const lang = LANGUAGES.find((l) => l.id === block.lang);
        const header = `${"=".repeat(60)}\n// FILE: extracted_${block.lang}.${lang?.ext ?? "txt"}\n// LANGUAGE: ${lang?.label ?? block.lang} · ${block.lines} lines\n${"=".repeat(60)}`;
        return `${header}\n\n${block.code}`;
      })
      .join("\n\n\n");

    downloadFile(combined, "codelooter_all_extracted.txt");
  };

  const isMultiLang = extractedBlocks.length > 1;

  return (
    <Card>
      {/* Header */}
      <CardHeader bg="#f5f0ff">
        <div style={{ display: "flex", gap: "5px" }}>
          {["#ff6b6b", "#ffe8a3", "#d4f0e4"].map((c) => (
            <div
              key={c}
              style={{
                width: "11px",
                height: "11px",
                borderRadius: "50%",
                backgroundColor: c,
                border: "2px solid #000",
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.15rem",
            letterSpacing: "0.05em",
            flex: 1,
          }}
        >
          HASIL EKSTRAKSI
        </span>
        <div
          style={{
            backgroundColor: extracted ? "#d4f0e4" : extractError ? "#ffd6d6" : "#ffe8a3",
            border: "2px solid #000",
            borderRadius: "8px",
            padding: "2px 9px",
            fontSize: "0.68rem",
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontFamily: "var(--font-body)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: extracted ? "#00aa44" : extractError ? "#ff4444" : "#ffaa00",
              display: "inline-block",
            }}
          />
          {extracted ? `${extractedBlocks.length} BAHASA` : extractError ? "GAGAL" : "MENUNGGU"}
        </div>
      </CardHeader>

      {/* Multi-lang tab bar */}
      {isMultiLang && (
        <div
          style={{
            borderBottom: "3px solid #000",
            backgroundColor: "#fef9f0",
            padding: "8px 12px",
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          {extractedBlocks.map((block) => {
            const lang = LANGUAGES.find((l) => l.id === block.lang);
            const isActive = block.lang === (activeBlock?.lang ?? "");
            return (
              <button
                key={block.lang}
                onClick={() => {
                  // Trigger parent lang selection via a custom event workaround
                  // Parent listens via selectedLang prop change
                  const event = new CustomEvent("codelooter:selectlang", {
                    detail: block.lang,
                    bubbles: true,
                  });
                  document.dispatchEvent(event);
                }}
                style={{
                  backgroundColor: isActive ? (lang?.color ?? "#ffe8a3") : "#fff",
                  border: `2px solid #000`,
                  borderRadius: "8px",
                  padding: "3px 10px",
                  fontSize: "0.72rem",
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: isActive ? "2px 2px 0 #000" : "none",
                  transform: isActive ? "translate(1px,1px)" : "",
                  fontFamily: "var(--font-body)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.1s",
                }}
              >
                <span>{lang?.emoji ?? "📄"}</span>
                {lang?.label ?? block.lang}
                <span
                  style={{
                    backgroundColor: "#000",
                    color: "#fff",
                    borderRadius: "4px",
                    padding: "0px 4px",
                    fontSize: "0.6rem",
                  }}
                >
                  {block.lines}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Code area */}
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div
          style={{
            backgroundColor: "#1a1a2e",
            height: "100%",
            overflowY: "auto",
            padding: "18px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.78rem",
            lineHeight: "1.7",
            minHeight: "240px",
          }}
        >
          {/* Empty state */}
          {!extracted && !isExtracting && !extractError && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "12px",
                opacity: 0.5,
              }}
            >
              <p style={{ fontFamily: "var(--font-display)", fontSize: "3rem", color: "#aaa", margin: 0 }}>
                ???
              </p>
              <p style={{ color: "#888", fontWeight: 700, textAlign: "center", fontSize: "0.85rem", margin: 0 }}>
                Upload file &amp; klik EKSTRAK KODE! untuk memulai
              </p>
            </div>
          )}

          {/* Error state */}
          {extractError && !isExtracting && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "12px",
              }}
            >
              <AlertCircle size={36} color="#ff6b6b" />
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.3rem",
                  color: "#ff6b6b",
                  letterSpacing: "0.04em",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                {extractError}
              </p>
            </div>
          )}

          {/* Loading state */}
          {isExtracting && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "16px",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.8rem",
                  color: "#ffe8a3",
                  animation: "pulse 0.8s ease-in-out infinite alternate",
                  margin: 0,
                }}
              >
                MENGANALISIS FILE...
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor: "#d4f0e4",
                      borderRadius: "50%",
                      animation: `bounce 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {extracted && activeBlock && (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#e8f4fd" }}>
              <code>{code}</code>
            </pre>
          )}
        </div>

        {/* Action buttons */}
        {extracted && (
          <div
            style={{
              position: "absolute",
              bottom: "14px",
              right: "14px",
              display: "flex",
              gap: "8px",
              zIndex: 10,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {/* Download all as ZIP (multi-lang only) */}
            {isMultiLang && (
              <button
                onClick={handleDownloadAll}
                aria-label="Download semua sebagai ZIP"
                style={{
                  backgroundColor: "#ffe8a3",
                  border: "3px solid #000",
                  borderRadius: "999px",
                  padding: "10px 14px",
                  fontFamily: "var(--font-display)",
                  fontSize: "0.95rem",
                  letterSpacing: "0.06em",
                  color: "#000",
                  cursor: "pointer",
                  boxShadow: "5px 5px 0 #000",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 #000";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "";
                  (e.currentTarget as HTMLElement).style.boxShadow = "5px 5px 0 #000";
                }}
              >
                <Archive size={14} strokeWidth={2.5} />
                DOWNLOAD ALL
              </button>
            )}

            {/* Download current */}
            <button
              onClick={handleDownload}
              aria-label={`Download kode sebagai .${currentLang.ext}`}
              style={{
                backgroundColor: "#d4f0e4",
                border: "3px solid #000",
                borderRadius: "999px",
                padding: "10px 14px",
                fontFamily: "var(--font-display)",
                fontSize: "0.95rem",
                letterSpacing: "0.06em",
                color: "#000",
                cursor: "pointer",
                boxShadow: "5px 5px 0 #000",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 #000";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "";
                (e.currentTarget as HTMLElement).style.boxShadow = "5px 5px 0 #000";
              }}
            >
              <Download size={14} strokeWidth={2.5} />
              .{currentLang.ext}
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              aria-label={copied ? "Tersalin!" : "Salin kode"}
              style={{
                backgroundColor: copied ? "#d4f0e4" : "#ff6b6b",
                border: "3px solid #000",
                borderRadius: "999px",
                padding: "10px 18px",
                fontFamily: "var(--font-display)",
                fontSize: "0.95rem",
                letterSpacing: "0.06em",
                color: "#000",
                cursor: "pointer",
                boxShadow: copied ? "2px 2px 0 #000" : "5px 5px 0 #000",
                transform: copied ? "translate(3px,3px)" : "",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onMouseEnter={(e) => {
                if (!copied) {
                  (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 #000";
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  (e.currentTarget as HTMLElement).style.transform = "";
                  (e.currentTarget as HTMLElement).style.boxShadow = "5px 5px 0 #000";
                }
              }}
            >
              {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.5} />}
              {copied ? "TERSALIN!" : "SALIN"}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {extracted && activeBlock && (
        <div
          style={{
            backgroundColor: "#ffe0d0",
            borderTop: "3px solid #000",
            padding: "7px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            fontFamily: "var(--font-body)",
          }}
        >
          <span style={{ fontSize: "0.7rem", fontWeight: 900 }}>
            {currentLang.emoji} {currentLang.label} · {activeBlock.lines} baris
          </span>
          <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#555" }}>
            {new Date().toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      )}
    </Card>
  );
}
