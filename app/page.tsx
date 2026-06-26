"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { LanguagePanel } from "@/components/LanguagePanel";
import { UploadPanel } from "@/components/UploadPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { RecentFiles } from "@/components/RecentFiles";
import { STATS } from "@/components/data";
import type { CodeBlock } from "@/types";

const ACCEPTED_EXT = /\.(pdf|doc|docx|pptx?|xlsx?|txt|md|html|ipynb|tex)$/i;

function isAccepted(file: File) {
  return ACCEPTED_EXT.test(file.name);
}

export default function Home() {
  const [selectedLang, setSelectedLang]       = useState("python");
  const [uploadedFile, setUploadedFile]       = useState<File | null>(null);
  const [isDragging, setIsDragging]           = useState(false);
  const [isExtracting, setIsExtracting]       = useState(false);
  const [extractedBlocks, setExtractedBlocks] = useState<CodeBlock[]>([]);
  const [extractError, setExtractError]       = useState<string | null>(null);

  // Listen for lang selection from ResultPanel tabs
  useEffect(() => {
    const handler = (e: Event) => {
      const lang = (e as CustomEvent<string>).detail;
      if (lang) setSelectedLang(lang);
    };
    document.addEventListener("codelooter:selectlang", handler);
    return () => document.removeEventListener("codelooter:selectlang", handler);
  }, []);

  const setFile = (file: File | null) => {
    setUploadedFile(file);
    setExtractedBlocks([]);
    setExtractError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isAccepted(file)) setFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile(file);
  };

  const handleExtract = async () => {
    if (!uploadedFile) return;
    setIsExtracting(true);
    setExtractError(null);
    setExtractedBlocks([]);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error ?? "Gagal mengekstrak kode");
        return;
      }

      const blocks: CodeBlock[] = data.blocks ?? [];
      setExtractedBlocks(blocks);

      // Auto-select first detected language
      if (blocks.length > 0 && blocks[0].lang !== "unknown") {
        setSelectedLang(blocks[0].lang);
      }
    } catch {
      setExtractError("Koneksi gagal — coba lagi");
    } finally {
      setIsExtracting(false);
    }
  };

  const extracted = extractedBlocks.length > 0;

  return (
    <div
      style={{
        backgroundColor: "#fef9f0",
        fontFamily: "var(--font-body)",
        minHeight: "100vh",
      }}
    >
      <Header />

      <main style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}>

        {/* Stats strip */}
        <div className="stats-grid">
          {STATS.map((s) => (
            <div
              key={s.label}
              style={{
                backgroundColor: s.color,
                border: "3px solid #000",
                borderRadius: "10px",
                padding: "10px 14px",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <p
                style={{
                  fontSize: "clamp(1.2rem, 4vw, 1.6rem)",
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                  margin: 0,
                }}
              >
                {s.val}
              </p>
              <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "#333", marginTop: "2px", marginBottom: 0 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Three-column grid */}
        <div className="main-grid">
          <LanguagePanel
            selectedLang={selectedLang}
            onSelect={setSelectedLang}
            detectedLangs={extractedBlocks.map((b) => b.lang)}
          />
          <UploadPanel
            uploadedFile={uploadedFile}
            isDragging={isDragging}
            isExtracting={isExtracting}
            extracted={extracted}
            onDrop={handleDrop}
            onDragOver={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onFileInput={handleFileInput}
            onClearFile={() => setFile(null)}
            onExtract={handleExtract}
          />
          <ResultPanel
            selectedLang={selectedLang}
            isExtracting={isExtracting}
            extractedBlocks={extractedBlocks}
            extractError={extractError}
          />
        </div>

        {/* Recent files — login-gated in production */}
        <RecentFiles />

      </main>
    </div>
  );
}
