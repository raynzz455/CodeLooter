"use client";

// CodeLooter — main page (neo-brutalist redesign).
//
// Adapted from the original CodeLooter repo's app/page.tsx:
//   - Removed auth/user profile (no login in our single-user sandbox).
//   - Removed useRouter navigation — this is a single-page app.
//   - Removed SplashScreen (no equivalent component in this project).
//   - extractCode → extractFile (pattern) / extractFileLLM (LLM mode).
//   - saveSnippet signature now takes (filename, blocks, lang, size, tags).
//   - Added an "AI Mode" toggle in the upload panel that routes the extract
//     call to /api/extract-llm (z-ai-web-dev-sdk backend with pattern fallback).
//   - Added a "SNIPPET TERSIMPAN" section below the main grid that lists
//     saved snippets and lets the user load one back into the result panel
//     or delete it.

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronDown,
  Code2,
  FileText,
  Upload,
  X,
  Zap,
  Copy,
  Check,
  Save,
  FolderOpen,
  Trash2,
  Sparkles,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES, STATS, SAMPLE_CODES } from "@/components/codelooter/data";
import {
  extractFile,
  extractFileLLM,
  saveSnippet,
  listSnippets,
  deleteSnippet,
  getSnippet,
  type CodeBlock,
  type ExtractResult,
  type SnippetMeta,
} from "@/lib/codelooter-api";

const ACCEPTED_EXT = /\.(pdf|doc|docx|pptx?|xlsx?|txt|md|html|ipynb|tex)$/i;

// ─── Reusable presentational primitives ───
// All neo-brutalist styling is inline (3px black borders, hard shadows,
// bright pastel colors) so the visual language matches the original repo
// exactly. No Tailwind classes for these elements.

function Tag({
  bg = "#ffe8a3",
  color = "#000",
  children,
}: {
  bg?: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        backgroundColor: bg,
        color,
        border: "2px solid #000",
        borderRadius: "6px",
        padding: "2px 9px",
        fontSize: "0.68rem",
        fontWeight: 900,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "3px solid #000",
        borderRadius: "16px",
        boxShadow: "5px 5px 0 #000",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  bg,
  children,
}: {
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: bg,
        borderBottom: "3px solid #000",
        padding: "11px 16px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

// ─── Active-block picker for the result panel ───
// When the extractor returns multiple blocks (possibly in different
// languages) we show a row of language chips so the user can switch the
// displayed block without re-extracting.
function LangChip({
  lang,
  active,
  onClick,
}: {
  lang: { id: string; label: string; emoji: string; color: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: active ? lang.color : "#fff",
        border: "2px solid #000",
        borderRadius: "8px",
        padding: "4px 10px",
        fontSize: "0.75rem",
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: active ? "2px 2px 0 #000" : "none",
        transform: active ? "translate(1px,1px)" : "",
        fontFamily: "var(--font-body)",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        transition: "all 0.1s",
      }}
    >
      <span>{lang.emoji}</span>
      {lang.label}
    </button>
  );
}

// ─── Main page ───
export default function Home() {
  // Language picker state.
  const [selectedLang, setSelectedLang] = useState<string>("r");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Upload state.
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extraction state.
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedBlocks, setExtractedBlocks] = useState<CodeBlock[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractMeta, setExtractMeta] = useState<{
    method?: string;
    durationMs?: number;
    cached?: boolean;
  }>({});

  // Per-result actions.
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSnippetId, setSavedSnippetId] = useState<string | null>(null);

  // Snippet list (sidebar / footer section).
  const [snippets, setSnippets] = useState<SnippetMeta[]>([]);
  const [loadingSnippets, setLoadingSnippets] = useState(true);

  const langDropdownRef = useRef<HTMLDivElement>(null);

  const extracted = extractedBlocks.length > 0;
  const currentLang =
    LANGUAGES.find((l) => l.id === selectedLang) ?? LANGUAGES[0];

  // active block for preview — prefers the user-selected language, else the
  // first non-"unknown" block, else the first block, else falls back to the
  // sample code so the panel is never empty.
  const activeBlock =
    extractedBlocks.find((b) => b.lang === selectedLang) ??
    extractedBlocks.find((b) => b.lang !== "unknown") ??
    extractedBlocks[0] ??
    null;
  const displayCode = activeBlock?.code ?? SAMPLE_CODES[selectedLang] ?? "";

  // Detected languages across all extracted blocks.
  const detectedLangs = Array.from(
    new Set(extractedBlocks.map((b) => b.lang)),
  ).filter((l) => LANGUAGES.some((lang) => lang.id === l));

  // ─── Load saved snippets from /api/snippets on mount ───
  const refreshSnippets = useCallback(async () => {
    setLoadingSnippets(true);
    try {
      const list = await listSnippets();
      setSnippets(list);
    } catch (err) {
      // Don't toast on initial load — just log to console.
      console.error("Failed to load snippets:", err);
    } finally {
      setLoadingSnippets(false);
    }
  }, []);

  useEffect(() => {
    void refreshSnippets();
  }, [refreshSnippets]);

  // Close language dropdown on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── File handling ───
  const setFile = (file: File | null) => {
    setUploadedFile(file);
    setExtractedBlocks([]);
    setExtractError(null);
    setSavedSnippetId(null);
    setExtractMeta({});
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && ACCEPTED_EXT.test(file.name)) setFile(file);
    else if (file)
      toast.error("Format file tidak didukung", {
        description: file.name,
      });
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile(file);
  };

  // ─── Extract ───
  // Routes to /api/extract-llm when AI mode is on, /api/extract otherwise.
  // The LLM endpoint falls back to the pattern extractor server-side if the
  // LLM call fails or times out, so a 200 is always returned (unless the
  // upload itself is rejected).
  const handleExtract = async () => {
    if (!uploadedFile) return;
    setIsExtracting(true);
    setExtractError(null);
    setExtractedBlocks([]);
    setSavedSnippetId(null);
    setExtractMeta({});

    try {
      const data: ExtractResult = aiMode
        ? await extractFileLLM(uploadedFile, selectedLang)
        : await extractFile(uploadedFile, selectedLang);

      const blocks = data.blocks ?? [];
      setExtractedBlocks(blocks);
      setExtractMeta({
        method: data.stats?.method,
        durationMs: data.stats?.durationMs,
        cached: data.cached,
      });

      if (blocks.length > 0) {
        const firstKnown =
          blocks.find((b) => b.lang !== "unknown") ?? blocks[0];
        setSelectedLang(firstKnown.lang);
        toast.success(
          `${blocks.length} blok kode berhasil diekstrak!${data.cached ? " (cache)" : ""}`,
          {
            description: aiMode
              ? `🤖 AI mode · ${data.stats?.method ?? "llm"}`
              : `⚡ ${data.stats?.method ?? "pattern"}`,
          },
        );
      } else {
        toast.warning("Tidak ada blok kode terdeteksi", {
          description: "Coba bahasa lain atau aktifkan AI mode.",
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Koneksi gagal — coba lagi";
      setExtractError(msg);
      toast.error("Ekstraksi gagal", { description: msg });
    } finally {
      setIsExtracting(false);
    }
  };

  // ─── Save snippet ───
  // Persists the current extracted blocks to the local SQLite store via
  // /api/snippets. On success, refreshes the snippet list and shows a "saved"
  // state on the result panel's save button.
  const handleSave = async () => {
    if (!uploadedFile || extractedBlocks.length === 0) return;
    setSaving(true);
    try {
      const { id } = await saveSnippet(
        uploadedFile.name,
        extractedBlocks,
        selectedLang,
        uploadedFile.size,
        "",
      );
      setSavedSnippetId(id);
      toast.success("Snippet tersimpan!", {
        description: `${extractedBlocks.length} blok · ${uploadedFile.name}`,
      });
      void refreshSnippets();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan snippet";
      toast.error("Gagal menyimpan", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  // ─── Load a saved snippet into the result panel ───
  // Replaces the current extracted blocks with the snippet's blocks and
  // updates the filename/lang so the user can keep editing / re-saving.
  const handleLoadSnippet = async (s: SnippetMeta) => {
    try {
      const detail = await getSnippet(s.id);
      setUploadedFile(
        new File([""], detail.originalFilename, { type: "text/plain" }),
      );
      setExtractedBlocks(detail.blocks);
      setExtractMeta({ method: "saved-snippet" });
      setSavedSnippetId(detail.id);
      setExtractError(null);
      setSelectedLang(detail.extractedLang || "auto");
      toast.success("Snippet dimuat", {
        description: `${detail.blocks.length} blok · ${detail.originalFilename}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat snippet";
      toast.error("Gagal memuat", { description: msg });
    }
  };

  const handleDeleteSnippet = async (s: SnippetMeta) => {
    if (!confirm(`Hapus snippet "${s.originalFilename}"?`)) return;
    try {
      await deleteSnippet(s.id);
      setSnippets((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("Snippet dihapus", { description: s.originalFilename });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus";
      toast.error("Gagal menghapus", { description: msg });
    }
  };

  // ─── Copy & download ───
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Kode disalin!", {
        description: `${activeBlock?.lines ?? displayCode.split("\n").length} baris`,
      });
    } catch {
      toast.error("Gagal menyalin ke clipboard");
    }
  };

  const handleDownload = () => {
    if (!activeBlock) return;
    const blob = new Blob([activeBlock.code], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codelooter_${activeBlock.lang}.${currentLang?.ext ?? "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File diunduh", {
      description: a.download,
    });
  };

  return (
    <div
      style={{
        backgroundColor: "#fef9f0",
        fontFamily: "var(--font-body)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ══ HEADER ══ */}
      <header
        style={{
          backgroundColor: "#ffe8a3",
          borderBottom: "3px solid #000",
          boxShadow: "0 5px 0 #000",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #000",
              borderRadius: "10px",
              backgroundColor: "#ff6b6b",
              boxShadow: "3px 3px 0 #000",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Code2 size={22} strokeWidth={2.5} />
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.5rem,5vw,2.1rem)",
              letterSpacing: "0.05em",
              lineHeight: 1,
              textShadow: "3px 3px 0 #ff6b6b",
              whiteSpace: "nowrap",
              margin: 0,
            }}
          >
            CodeLooter!
          </h1>
          <div
            style={{
              backgroundColor: "#ff6b6b",
              border: "2px solid #000",
              borderRadius: "6px",
              padding: "1px 7px",
              fontFamily: "var(--font-display)",
              fontSize: "0.78rem",
              color: "#fff",
              boxShadow: "2px 2px 0 #000",
              flexShrink: 0,
            }}
          >
            BETA
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {extractMeta.method && (
            <Tag
              bg={aiMode ? "#f5f0ff" : "#d4f0e4"}
              color="#000"
            >
              {aiMode ? "🤖 AI" : "⚡ PATTERN"}
            </Tag>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              backgroundColor: "#000",
              color: "#ffe8a3",
              border: "3px solid #000",
              borderRadius: "10px",
              padding: "8px 14px",
              fontFamily: "var(--font-display)",
              fontSize: "0.95rem",
              letterSpacing: "0.05em",
              cursor: "pointer",
              boxShadow: "4px 4px 0 #ff6b6b",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLElement).style.transform =
                "translate(2px,2px)";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "2px 2px 0 #ff6b6b";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "4px 4px 0 #ff6b6b";
            }}
          >
            <Upload size={15} /> PILIH FILE
          </button>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main
        style={{
          padding: "16px",
          maxWidth: "1400px",
          margin: "0 auto",
          width: "100%",
          flex: 1,
        }}
      >
        {/* STATS */}
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
                  fontSize: "clamp(1.2rem,4vw,1.6rem)",
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                  margin: 0,
                }}
              >
                {s.val}
              </p>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  color: "#333",
                  marginTop: "2px",
                  marginBottom: 0,
                  fontFamily: "var(--font-body)",
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* THREE COLUMNS */}
        <div className="main-grid">
          {/* COL 1: PILIH BAHASA */}
          <Card>
            <CardHeader bg="#ffe8a3">
              <Code2 size={15} />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.1rem",
                  letterSpacing: "0.05em",
                }}
              >
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
              }}
            >
              {/* detected langs after extraction */}
              {detectedLangs.length > 0 && (
                <div
                  style={{
                    backgroundColor: "#d4f0e4",
                    border: "2px solid #000",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "7px",
                      marginTop: 0,
                    }}
                  >
                    🔍 Terdeteksi
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "5px",
                    }}
                  >
                    {detectedLangs.map((id) => {
                      const lang = LANGUAGES.find((l) => l.id === id);
                      const isActive = id === selectedLang;
                      return (
                        <LangChip
                          key={id}
                          lang={
                            lang ?? {
                              id,
                              label: id,
                              emoji: "📄",
                              color: "#ffe8a3",
                            }
                          }
                          active={isActive}
                          onClick={() => setSelectedLang(id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* dropdown */}
              <div ref={langDropdownRef} style={{ position: "relative" }}>
                {detectedLangs.length > 0 && (
                  <p
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "6px",
                      marginTop: 0,
                      color: "#555",
                    }}
                  >
                    Override manual
                  </p>
                )}
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{
                    width: "100%",
                    backgroundColor: currentLang?.color ?? "#ffe8a3",
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
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>
                      {currentLang?.emoji}
                    </span>
                    {currentLang?.label}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: dropdownOpen ? "rotate(180deg)" : "",
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
                      animation: "popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                  >
                    {LANGUAGES.map((lang, idx) => (
                      <button
                        key={lang.id}
                        onClick={() => {
                          setSelectedLang(lang.id);
                          setDropdownOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "9px 14px",
                          backgroundColor:
                            lang.id === selectedLang ? lang.color : "#fff",
                          border: "none",
                          borderBottom:
                            idx < LANGUAGES.length - 1
                              ? "2px solid #eee"
                              : "none",
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
                            (e.currentTarget as HTMLElement).style.backgroundColor =
                              "#fef9f0";
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

              {/* info */}
              <div
                style={{
                  backgroundColor: currentLang?.color ?? "#ffe8a3",
                  border: "2px solid #000",
                  borderRadius: "10px",
                  padding: "12px",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.25rem",
                    letterSpacing: "0.04em",
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  {currentLang?.emoji} {currentLang?.label}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#444",
                    marginTop: "4px",
                    marginBottom: 0,
                  }}
                >
                  Bahasa terpilih untuk ekstraksi kode.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: "#fef9f0",
                  border: "2px dashed #000",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginTop: "auto",
                }}
              >
                <p
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    color: "#555",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {detectedLangs.length > 0
                    ? `💡 ${detectedLangs.length} bahasa ditemukan. Klik chip untuk switch preview.`
                    : "💡 Bahasa akan terdeteksi otomatis setelah file diekstrak."}
                </p>
              </div>
            </div>
          </Card>

          {/* COL 2: UPLOAD FILE */}
          <Card>
            <CardHeader bg="#d4f0e4">
              <FileText size={15} />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.1rem",
                  letterSpacing: "0.05em",
                }}
              >
                UPLOAD FILE
              </span>
              <Tag bg="#000" color="#d4f0e4">
                PDF · DOC · PPTX
              </Tag>
            </CardHeader>
            <div
              style={{
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                flex: 1,
              }}
            >
              {/* drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() =>
                  !uploadedFile && fileInputRef.current?.click()
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (
                    (e.key === "Enter" || e.key === " ") &&
                    !uploadedFile
                  )
                    fileInputRef.current?.click();
                }}
                style={{
                  backgroundColor: isDragging ? "#b8e8d0" : "#fef9f0",
                  border: "3px dashed #000",
                  borderRadius: "12px",
                  cursor: uploadedFile ? "default" : "pointer",
                  transition: "background-color 0.15s",
                  position: "relative",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "14px",
                  padding: "24px 16px",
                  minHeight: "200px",
                }}
              >
                {/* corner decorations */}
                {(["tl", "tr", "bl", "br"] as const).map((c) => (
                  <div
                    key={c}
                    style={{
                      position: "absolute",
                      width: 14,
                      height: 14,
                      backgroundColor: "#ffe8a3",
                      border: "2px solid #000",
                      borderRadius: "3px",
                      top: c[0] === "t" ? -3 : undefined,
                      bottom: c[0] === "b" ? -3 : undefined,
                      left: c[1] === "l" ? -3 : undefined,
                      right: c[1] === "r" ? -3 : undefined,
                    }}
                  />
                ))}

                {!uploadedFile ? (
                  <>
                    <div
                      style={{
                        backgroundColor: "#f5f0ff",
                        border: "3px solid #000",
                        borderRadius: "50%",
                        width: "clamp(72px,12vw,96px)",
                        height: "clamp(72px,12vw,96px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "5px 5px 0 #000",
                      }}
                    >
                      <Upload size={36} strokeWidth={2.5} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "clamp(1.1rem,3vw,1.55rem)",
                          letterSpacing: "0.04em",
                          lineHeight: 1.25,
                          margin: 0,
                        }}
                      >
                        Jatuhkan dokumenmu di sini!
                      </p>
                      <p
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "#555",
                          marginTop: "5px",
                          marginBottom: 0,
                        }}
                      >
                        atau klik untuk memilih file
                      </p>
                    </div>
                    <div
                      style={{
                        backgroundColor: "#ffe8a3",
                        border: "2px solid #000",
                        borderRadius: "8px",
                        padding: "5px 16px",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                      }}
                    >
                      Maks. 50MB · PDF, MD, IPYNB, TXT, TEX, HTML
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        backgroundColor: "#d4f0e4",
                        border: "3px solid #000",
                        borderRadius: "10px",
                        padding: "14px 18px",
                        width: "90%",
                        maxWidth: 360,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        boxShadow: "3px 3px 0 #000",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "#000",
                          borderRadius: "8px",
                          padding: "8px",
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={20} color="#d4f0e4" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontWeight: 900,
                            fontSize: "0.88rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            margin: 0,
                          }}
                        >
                          {uploadedFile.name}
                        </p>
                        <p
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#444",
                            margin: 0,
                          }}
                        >
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        style={{
                          backgroundColor: "#ff6b6b",
                          border: "2px solid #000",
                          borderRadius: "6px",
                          padding: "5px",
                          cursor: "pointer",
                          flexShrink: 0,
                          display: "flex",
                        }}
                      >
                        <X size={14} color="#fff" />
                      </button>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.1rem",
                        color: "#009944",
                        letterSpacing: "0.03em",
                        margin: 0,
                      }}
                    >
                      ✅ File siap diekstrak!
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.pptx,.ppt,.xlsx,.xls,.txt,.md,.html,.ipynb,.tex"
                  onChange={handleFileInput}
                  style={{ display: "none" }}
                />
              </div>

              {/* AI Mode toggle */}
              <div
                style={{
                  marginTop: "12px",
                  backgroundColor: aiMode ? "#f5f0ff" : "#fef9f0",
                  border: `3px solid ${aiMode ? "#000" : "#000"}`,
                  borderRadius: "10px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  boxShadow: aiMode ? "3px 3px 0 #000" : "none",
                  transition: "all 0.15s",
                }}
              >
                <button
                  onClick={() => setAiMode(!aiMode)}
                  role="switch"
                  aria-checked={aiMode}
                  aria-label="Toggle AI mode"
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: "12px",
                    border: "2px solid #000",
                    backgroundColor: aiMode ? "#ff6b6b" : "#fff",
                    cursor: "pointer",
                    position: "relative",
                    flexShrink: 0,
                    padding: 0,
                    transition: "background-color 0.15s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: aiMode ? 22 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      backgroundColor: aiMode ? "#ffe8a3" : "#d4f0e4",
                      border: "2px solid #000",
                      transition: "left 0.15s, background-color 0.15s",
                    }}
                  />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 900,
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {aiMode ? (
                      <>
                        <Cpu size={14} /> AI Mode AKTIF
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> AI Mode
                      </>
                    )}
                  </p>
                  <p
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#555",
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {aiMode
                      ? "🤖 Gunakan AI (LLM) untuk ekstraksi"
                      : "🤖 Gunakan AI (LLM) untuk ekstraksi"}
                  </p>
                </div>
                {aiMode && (
                  <Tag bg="#ff6b6b" color="#fff">
                    LLM
                  </Tag>
                )}
              </div>

              {/* extract button */}
              <button
                onClick={handleExtract}
                disabled={!uploadedFile || isExtracting}
                style={{
                  marginTop: "12px",
                  width: "100%",
                  backgroundColor: uploadedFile ? "#000" : "#ccc",
                  color: uploadedFile ? "#ffe8a3" : "#888",
                  border: "3px solid #000",
                  borderRadius: "10px",
                  padding: "14px",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1rem,3vw,1.35rem)",
                  letterSpacing: "0.06em",
                  cursor:
                    uploadedFile && !isExtracting ? "pointer" : "not-allowed",
                  boxShadow: uploadedFile ? "5px 5px 0 #ff6b6b" : "none",
                  transition: "transform 0.1s, box-shadow 0.1s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  flexShrink: 0,
                }}
                onMouseDown={(e) => {
                  if (uploadedFile) {
                    (e.currentTarget as HTMLElement).style.transform =
                      "translate(3px,3px)";
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "2px 2px 0 #ff6b6b";
                  }
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "";
                  (e.currentTarget as HTMLElement).style.boxShadow = uploadedFile
                    ? "5px 5px 0 #ff6b6b"
                    : "none";
                }}
              >
                {isExtracting ? (
                  aiMode ? (
                    <>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          border: "3px solid #ffe8a3",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                        }}
                      />
                      AI SEDANG MENGANALISIS...
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          border: "3px solid #ffe8a3",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                        }}
                      />
                      SEDANG MENGEKSTRAK...
                    </>
                  )
                ) : (
                  <>
                    <Zap
                      size={22}
                      fill={uploadedFile ? "#ffe8a3" : "#888"}
                    />
                    {extracted ? "EKSTRAK ULANG!" : "EKSTRAK KODE!"}
                  </>
                )}
              </button>
            </div>
          </Card>

          {/* COL 3: HASIL EKSTRAKSI */}
          <Card>
            <CardHeader bg="#f5f0ff">
              <div style={{ display: "flex", gap: "5px" }}>
                {["#ff6b6b", "#ffe8a3", "#d4f0e4"].map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 11,
                      height: 11,
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
                  fontSize: "1.1rem",
                  letterSpacing: "0.05em",
                  flex: 1,
                }}
              >
                HASIL EKSTRAKSI
              </span>
              <div
                style={{
                  backgroundColor: extracted
                    ? "#d4f0e4"
                    : extractError
                      ? "#ffd6d6"
                      : "#ffe8a3",
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
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: extracted
                      ? "#00aa44"
                      : extractError
                        ? "#ff4444"
                        : "#ffaa00",
                    display: "inline-block",
                  }}
                />
                {extracted
                  ? `${extractedBlocks.length} BLOK`
                  : extractError
                    ? "GAGAL"
                    : "MENUNGGU"}
              </div>
            </CardHeader>

            {/* detected-language chips (multi-block switcher) */}
            {detectedLangs.length > 1 && (
              <div
                style={{
                  backgroundColor: "#fef9f0",
                  borderBottom: "2px solid #000",
                  padding: "8px 12px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "5px",
                }}
              >
                {detectedLangs.map((id) => {
                  const lang = LANGUAGES.find((l) => l.id === id);
                  return (
                    <LangChip
                      key={id}
                      lang={
                        lang ?? {
                          id,
                          label: id,
                          emoji: "📄",
                          color: "#ffe8a3",
                        }
                      }
                      active={id === selectedLang}
                      onClick={() => setSelectedLang(id)}
                    />
                  );
                })}
              </div>
            )}

            <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
              <div
                style={{
                  backgroundColor: "#1a1a2e",
                  height: "100%",
                  overflowY: "auto",
                  padding: "18px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.78rem",
                  lineHeight: 1.7,
                  minHeight: "240px",
                  maxHeight: "440px",
                }}
              >
                {!extracted && !isExtracting && !extractError && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      gap: "12px",
                      opacity: 0.45,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "3rem",
                        color: "#aaa",
                        margin: 0,
                      }}
                    >
                      ???
                    </p>
                    <p
                      style={{
                        color: "#888",
                        fontWeight: 700,
                        textAlign: "center",
                        fontSize: "0.85rem",
                        margin: 0,
                      }}
                    >
                      Upload file &amp; klik EKSTRAK KODE! untuk memulai
                    </p>
                  </div>
                )}
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
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.3rem",
                        color: "#ff6b6b",
                        textAlign: "center",
                        margin: 0,
                      }}
                    >
                      {extractError}
                    </p>
                  </div>
                )}
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
                        animation:
                          "pulse 0.8s ease-in-out infinite alternate",
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      {aiMode
                        ? "AI SEDANG MENGANALISIS..."
                        : "MENGANALISIS FILE..."}
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          style={{
                            width: 8,
                            height: 8,
                            backgroundColor: "#d4f0e4",
                            borderRadius: "50%",
                            animation: `bounce 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                          }}
                        />
                      ))}
                    </div>
                    {aiMode && (
                      <p
                        style={{
                          color: "#aaa",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          margin: 0,
                          textAlign: "center",
                        }}
                      >
                        🤖 LLM sedang membaca seluruh dokumen...
                        <br />
                        (lebih lambat, tapi lebih teliti)
                      </p>
                    )}
                  </div>
                )}
                {(extracted ||
                  (!extracted && !isExtracting && !extractError)) &&
                  !isExtracting && (
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        color: "#e8f4fd",
                      }}
                    >
                      <code>{extracted ? displayCode : ""}</code>
                    </pre>
                  )}
              </div>

              {/* extraction meta badge */}
              {extractMeta.method && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    color: "#ffe8a3",
                    border: "1px solid #ffe8a3",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    zIndex: 5,
                  }}
                >
                  {extractMeta.method}
                  {extractMeta.durationMs
                    ? ` · ${extractMeta.durationMs}ms`
                    : ""}
                  {extractMeta.cached ? " · cached" : ""}
                </div>
              )}

              {/* action buttons */}
              {extracted && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 14,
                    right: 14,
                    display: "flex",
                    gap: "8px",
                    zIndex: 10,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  {savedSnippetId ? (
                    <button
                      onClick={handleSave}
                      title="Snippet ini sudah tersimpan — klik untuk simpan ulang"
                      style={{
                        backgroundColor: "#d4f0e4",
                        border: "3px solid #000",
                        borderRadius: "999px",
                        padding: "10px 14px",
                        fontFamily: "var(--font-display)",
                        fontSize: "0.9rem",
                        letterSpacing: "0.05em",
                        cursor: "pointer",
                        boxShadow: "4px 4px 0 #000",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Check size={14} strokeWidth={3} /> Tersimpan! Simpan Ulang
                    </button>
                  ) : (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      title="Simpan snippet"
                      style={{
                        backgroundColor: "#f5f0ff",
                        border: "3px solid #000",
                        borderRadius: "999px",
                        padding: "10px 14px",
                        fontFamily: "var(--font-display)",
                        fontSize: "0.9rem",
                        letterSpacing: "0.05em",
                        cursor: saving ? "not-allowed" : "pointer",
                        boxShadow: "4px 4px 0 #000",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? (
                        "⏳..."
                      ) : (
                        <>
                          <Save size={14} /> Simpan
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={handleDownload}
                    style={{
                      backgroundColor: "#d4f0e4",
                      border: "3px solid #000",
                      borderRadius: "999px",
                      padding: "10px 14px",
                      fontFamily: "var(--font-display)",
                      fontSize: "0.9rem",
                      letterSpacing: "0.05em",
                      cursor: "pointer",
                      boxShadow: "4px 4px 0 #000",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translate(2px,2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "2px 2px 0 #000";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "4px 4px 0 #000";
                    }}
                  >
                    ⬇ .{currentLang?.ext ?? "txt"}
                  </button>
                  <button
                    onClick={handleCopy}
                    style={{
                      backgroundColor: copied ? "#d4f0e4" : "#ff6b6b",
                      border: "3px solid #000",
                      borderRadius: "999px",
                      padding: "10px 18px",
                      fontFamily: "var(--font-display)",
                      fontSize: "0.9rem",
                      letterSpacing: "0.06em",
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
                        (e.currentTarget as HTMLElement).style.transform =
                          "translate(2px,2px)";
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "3px 3px 0 #000";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!copied) {
                        (e.currentTarget as HTMLElement).style.transform = "";
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "5px 5px 0 #000";
                      }
                    }}
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={3} />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copied ? "TERSALIN!" : "BOOM! Salin Kode"}
                  </button>
                </div>
              )}
            </div>

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
                  {currentLang?.emoji} {currentLang?.label} ·{" "}
                  {activeBlock.lines} baris
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 900,
                    color: "#555",
                  }}
                >
                  {new Date().toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </Card>
        </div>

        {/* ══ SNIPPET TERSIMPAN ══ */}
        <div
          style={{
            marginTop: "16px",
            backgroundColor: "#fff",
            border: "3px solid #000",
            borderRadius: "16px",
            boxShadow: "5px 5px 0 #000",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffe0d0",
              borderBottom: "3px solid #000",
              padding: "11px 16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <FolderOpen size={16} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.15rem",
                letterSpacing: "0.05em",
              }}
            >
              📂 SNIPPET TERSIMPAN
            </span>
            <Tag bg="#000" color="#ffe0d0">
              {snippets.length} SNIPPET
            </Tag>
            <button
              onClick={() => void refreshSnippets()}
              title="Refresh list"
              style={{
                marginLeft: "auto",
                backgroundColor: "#ffe8a3",
                border: "2px solid #000",
                borderRadius: "8px",
                padding: "5px 10px",
                fontSize: "0.75rem",
                fontWeight: 900,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ⟳ Refresh
            </button>
          </div>

          <div
            style={{
              padding: "14px",
              backgroundColor: "#fef9f0",
              maxHeight: "320px",
              overflowY: "auto",
            }}
          >
            {loadingSnippets ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px",
                  color: "#777",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    border: "3px solid #000",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    margin: "0 auto 10px",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Memuat snippet...
              </div>
            ) : snippets.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.4rem",
                    letterSpacing: "0.04em",
                    margin: "0 0 6px 0",
                  }}
                >
                  📭 Belum ada snippet
                </p>
                <p
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#555",
                    margin: 0,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Ekstrak kode dari file, lalu klik{" "}
                  <strong>Simpan</strong> untuk menyimpannya di sini.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
                  gap: "10px",
                }}
              >
                {snippets.map((s) => {
                  const lang = LANGUAGES.find(
                    (l) => l.id === s.extractedLang,
                  );
                  return (
                    <div
                      key={s.id}
                      style={{
                        backgroundColor: "#fff",
                        border: "2px solid #000",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        boxShadow: "3px 3px 0 #000",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            backgroundColor: lang?.color ?? "#ffe8a3",
                            border: "2px solid #000",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.9rem",
                            flexShrink: 0,
                          }}
                        >
                          {lang?.emoji ?? "📄"}
                        </div>
                        <p
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 900,
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                          }}
                          title={s.originalFilename}
                        >
                          {s.originalFilename}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "5px",
                          flexWrap: "wrap",
                        }}
                      >
                        <Tag bg="#d4f0e4">
                          {s.totalBlocks} blok
                        </Tag>
                        <Tag bg="#f5f0ff">
                          {(s.fileSize / 1024).toFixed(1)} KB
                        </Tag>
                        {s.tags && s.tags.trim() && (
                          <Tag bg="#ffe8a3">
                            🏷 {s.tags.split(",")[0]?.trim()}
                          </Tag>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "2px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.66rem",
                            fontWeight: 800,
                            color: "#666",
                          }}
                        >
                          {new Date(s.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button
                            onClick={() => void handleLoadSnippet(s)}
                            title="Muat snippet ini ke panel hasil"
                            style={{
                              backgroundColor: "#000",
                              color: "#ffe8a3",
                              border: "2px solid #000",
                              borderRadius: "6px",
                              padding: "4px 9px",
                              fontSize: "0.72rem",
                              fontWeight: 900,
                              cursor: "pointer",
                              fontFamily: "var(--font-body)",
                              display: "flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <FolderOpen size={11} /> Muat
                          </button>
                          <button
                            onClick={() => void handleDeleteSnippet(s)}
                            title="Hapus snippet"
                            style={{
                              backgroundColor: "#ff6b6b",
                              color: "#fff",
                              border: "2px solid #000",
                              borderRadius: "6px",
                              padding: "4px 7px",
                              fontSize: "0.72rem",
                              fontWeight: 900,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* hidden file input shared with header button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.pptx,.ppt,.xlsx,.xls,.txt,.md,.html,.ipynb,.tex"
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
      </main>

      {/* ══ FOOTER ══ */}
      <footer
        style={{
          backgroundColor: "#ffe8a3",
          borderTop: "3px solid #000",
          boxShadow: "0 -5px 0 #000",
          padding: "10px 16px",
          marginTop: "auto",
          textAlign: "center",
          fontFamily: "var(--font-body)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "0.95rem",
            letterSpacing: "0.04em",
          }}
        >
          CodeLooter! · Ekstrak kode dari dokumen ·{" "}
          <span style={{ color: "#ff6b6b" }}>BETA</span>
        </p>
      </footer>
    </div>
  );
}
