"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Code2 } from "lucide-react";
import { Card, CardHeader } from "./ui";
import { LANGUAGES } from "./data";
import type { Language } from "@/types";

interface LanguagePanelProps {
  selectedLang: string;
  onSelect: (id: string) => void;
  detectedLangs: string[]; // langs found in the extracted document
}

export function LanguagePanel({ selectedLang, onSelect, detectedLangs }: LanguagePanelProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const currentLang = (LANGUAGES.find((l) => l.id === selectedLang) ?? LANGUAGES[0]) as Language;

  // Listen for tab clicks from ResultPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const lang = (e as CustomEvent<string>).detail;
      if (lang) onSelect(lang);
    };
    document.addEventListener("codelooter:selectlang", handler);
    return () => document.removeEventListener("codelooter:selectlang", handler);
  }, [onSelect]);

  const hasDetected = detectedLangs.length > 0;

  return (
    <Card>
      <CardHeader bg="#ffe8a3">
        <Code2 size={16} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", letterSpacing: "0.05em" }}>
          BAHASA
        </span>
      </CardHeader>

      <div
        style={{
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flex: 1,
          overflow: "hidden",
          fontFamily: "var(--font-body)",
        }}
      >
        {/* Detected langs (after extraction) */}
        {hasDetected && (
          <div
            style={{
              backgroundColor: "#d4f0e4",
              border: "2px solid #000",
              borderRadius: "10px",
              padding: "10px 12px",
            }}
          >
            <p style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "7px", marginTop: 0 }}>
              🔍 Terdeteksi
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {detectedLangs.map((id) => {
                const lang = LANGUAGES.find((l) => l.id === id);
                const isActive = id === selectedLang;
                return (
                  <button
                    key={id}
                    onClick={() => onSelect(id)}
                    style={{
                      backgroundColor: isActive ? (lang?.color ?? "#ffe8a3") : "#fff",
                      border: "2px solid #000",
                      borderRadius: "8px",
                      padding: "4px 10px",
                      fontSize: "0.75rem",
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
                    {lang?.label ?? id}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dropdown — manual override */}
        <div style={{ position: "relative" }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", marginTop: 0, color: "#555" }}>
            {hasDetected ? "Override manual" : "Pilih bahasa"}
          </p>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            style={{
              width: "100%",
              backgroundColor: currentLang.color,
              border: "3px solid #000",
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              boxShadow: "4px 4px 0 #000",
              fontWeight: 900,
              fontSize: "0.95rem",
              fontFamily: "var(--font-body)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.2rem" }}>{currentLang.emoji}</span>
              {currentLang.label}
            </span>
            <ChevronDown
              size={18}
              style={{
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
                flexShrink: 0,
              }}
            />
          </button>

          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                backgroundColor: "#fff",
                border: "3px solid #000",
                borderRadius: "10px",
                boxShadow: "5px 5px 0 #000",
                zIndex: 30,
                overflow: "hidden",
              }}
            >
              {LANGUAGES.map((lang, idx) => (
                <button
                  key={lang.id}
                  onClick={() => {
                    onSelect(lang.id);
                    setDropdownOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    backgroundColor: lang.id === selectedLang ? lang.color : "#fff",
                    border: "none",
                    borderBottom: idx < LANGUAGES.length - 1 ? "2px solid #eee" : "none",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 800,
                    fontSize: "0.88rem",
                    fontFamily: "var(--font-body)",
                  }}
                  onMouseEnter={(e) => {
                    if (lang.id !== selectedLang)
                      (e.currentTarget as HTMLElement).style.backgroundColor = "#fef9f0";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      lang.id === selectedLang ? lang.color : "#fff";
                  }}
                >
                  <span>{lang.emoji}</span>
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tip */}
        <div
          style={{
            backgroundColor: "#fef9f0",
            border: "2px dashed #000",
            borderRadius: "8px",
            padding: "10px 12px",
            marginTop: "auto",
          }}
        >
          <p style={{ fontSize: "0.72rem", fontWeight: 800, color: "#555", lineHeight: 1.5, margin: 0 }}>
            {hasDetected
              ? `💡 ${detectedLangs.length} bahasa ditemukan. Klik tab untuk preview masing-masing.`
              : "💡 Bahasa akan terdeteksi otomatis setelah file diekstrak."}
          </p>
        </div>
      </div>
    </Card>
  );
}
