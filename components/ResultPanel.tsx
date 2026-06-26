"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { Card, CardHeader } from "./ui";
import { LANGUAGES, SAMPLE_CODES } from "./data";
import type { Language } from "@/types";

interface ResultPanelProps {
  selectedLang: string;
  isExtracting: boolean;
  extracted: boolean;
}

export function ResultPanel({ selectedLang, isExtracting, extracted }: ResultPanelProps) {
  const [copied, setCopied] = useState(false);

  const currentLang = LANGUAGES.find((l) => l.id === selectedLang) as Language;
  const code = SAMPLE_CODES[selectedLang] ?? "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted_code.${currentLang.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            backgroundColor: extracted ? "#d4f0e4" : "#ffe8a3",
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
              backgroundColor: extracted ? "#00aa44" : "#ffaa00",
              display: "inline-block",
            }}
          />
          {extracted ? "SIAP" : "MENUNGGU"}
        </div>
      </CardHeader>

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
          }}
        >
          {/* Empty state */}
          {!extracted && !isExtracting && (
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
          {extracted && (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#e8f4fd" }}>
              <code>{code}</code>
            </pre>
          )}
        </div>

        {/* Action buttons — shown after extraction */}
        {extracted && (
          <div
            style={{
              position: "absolute",
              bottom: "14px",
              right: "14px",
              display: "flex",
              gap: "8px",
              zIndex: 10,
            }}
          >
            {/* Download button */}
            <button
              onClick={handleDownload}
              aria-label={`Download kode sebagai .${currentLang.ext}`}
              style={{
                backgroundColor: "#d4f0e4",
                border: "3px solid #000",
                borderRadius: "999px",
                padding: "10px 14px",
                fontFamily: "var(--font-display)",
                fontSize: "1rem",
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
              <Download size={15} strokeWidth={2.5} />
              .{currentLang.ext}
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              aria-label={copied ? "Tersalin!" : "Salin kode"}
              style={{
                backgroundColor: copied ? "#d4f0e4" : "#ff6b6b",
                border: "3px solid #000",
                borderRadius: "999px",
                padding: "10px 18px",
                fontFamily: "var(--font-display)",
                fontSize: "1rem",
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
              {copied ? <Check size={15} strokeWidth={3} /> : <Copy size={15} strokeWidth={2.5} />}
              {copied ? "TERSALIN!" : "BOOM! Salin"}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {extracted && (
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
            {currentLang.emoji} {currentLang.label} · {code.split("\n").length} baris
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
