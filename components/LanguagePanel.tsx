"use client";

import { useState } from "react";
import { ChevronDown, Code2 } from "lucide-react";
import { Card, CardHeader } from "./ui";
import { LANGUAGES } from "./data";
import type { Language } from "@/types";

interface LanguagePanelProps {
  selectedLang: string;
  onSelect: (id: string) => void;
}

export function LanguagePanel({ selectedLang, onSelect }: LanguagePanelProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const currentLang = LANGUAGES.find((l) => l.id === selectedLang) as Language;

  return (
    <Card>
      <CardHeader bg="#ffe8a3">
        <Code2 size={16} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", letterSpacing: "0.05em" }}>
          PILIH BAHASA
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
        {/* Dropdown trigger */}
        <div style={{ position: "relative" }}>
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
                    borderBottom: idx < LANGUAGES.length - 1 ? "2px solid #000" : "none",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 800,
                    fontSize: "0.88rem",
                    fontFamily: "var(--font-body)",
                    transition: "background-color 0.1s",
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

        {/* Language info */}
        <div
          style={{
            backgroundColor: currentLang.color,
            border: "2px solid #000",
            borderRadius: "10px",
            padding: "12px",
            marginTop: "4px",
          }}
        >
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", letterSpacing: "0.04em", lineHeight: 1, margin: 0 }}>
            {currentLang.emoji} {currentLang.label}
          </p>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#444", marginTop: "4px", marginBottom: 0 }}>
            Bahasa terpilih untuk ekstraksi kode dari dokumen Anda.
          </p>
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
            💡 <strong>Tips:</strong> Pilih bahasa yang sesuai dengan kode dalam dokumen agar hasil ekstraksi lebih akurat!
          </p>
        </div>
      </div>
    </Card>
  );
}
