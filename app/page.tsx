"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { LanguagePanel } from "@/components/LanguagePanel";
import { UploadPanel } from "@/components/UploadPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { RecentFiles } from "@/components/RecentFiles";
import { STATS } from "@/components/data";

// Accepted MIME types and extensions
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/html",
  "application/json",
];
const ACCEPTED_EXT = /\.(pdf|doc|docx|pptx?|xlsx?|txt|md|html|ipynb|tex)$/i;

function isAccepted(file: File) {
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.test(file.name);
}

export default function Home() {
  const [selectedLang, setSelectedLang] = useState("python");
  const [uploadedFile, setUploadedFile]  = useState<File | null>(null);
  const [isDragging, setIsDragging]      = useState(false);
  const [isExtracting, setIsExtracting]  = useState(false);
  const [extracted, setExtracted]        = useState(false);

  const setFile = (file: File | null) => {
    setUploadedFile(file);
    setExtracted(false);
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

  const handleExtract = () => {
    if (!uploadedFile) return;
    setIsExtracting(true);
    // TODO: replace with real API call to /api/extract
    setTimeout(() => {
      setIsExtracting(false);
      setExtracted(true);
    }, 1800);
  };

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
            extracted={extracted}
          />
        </div>

        {/* Recent files — login-gated in production */}
        <RecentFiles />

      </main>
    </div>
  );
}
