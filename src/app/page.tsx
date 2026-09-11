"use client";

// CodeLooter — main page (minimalism pastel classic redesign).
//
// Adapted from the original CodeLooter repo's app/page.tsx:
//   - Removed auth/user profile (no login in our single-user sandbox).
//   - Removed useRouter navigation — this is a single-page app.
//   - Removed SplashScreen (no equivalent component in this project).
//   - extractCode → extractFile (pattern-based, 100% free, no LLM).
//   - saveSnippet signature now takes (filename, blocks, lang, size, tags).
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
} from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES, STATS, SAMPLE_CODES } from "@/components/codelooter/data";
import {
  extractFile,
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
// All minimalism pastel classic styling is inline (1px borders, soft
// diffused shadows, muted pastel colors, refined typography) so the
// visual language stays consistent throughout the page. No Tailwind
// classes for these elements.

function Tag({
  bg = "#f0ead4",
  color = "#3a3a3a",
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
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "6px",
        padding: "2px 9px",
        fontSize: "0.68rem",
        fontWeight: 500,
        letterSpacing: "0.01em",
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
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "14px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
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
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
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
        border: active
          ? "1px solid rgba(0,0,0,0.14)"
          : "1px solid rgba(0,0,0,0.08)",
        borderRadius: "8px",
        padding: "5px 11px",
        fontSize: "0.75rem",
        fontWeight: 500,
        color: "#3a3a3a",
        cursor: "pointer",
        fontFamily: "var(--font-body)",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        transition: "all 0.2s ease",
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
  // 100% pattern-based extraction. No LLM, no external API.
  const handleExtract = async () => {
    if (!uploadedFile) return;
    setIsExtracting(true);
    setExtractError(null);
    setExtractedBlocks([]);
    setSavedSnippetId(null);
    setExtractMeta({});

    try {
      const data: ExtractResult = await extractFile(uploadedFile, selectedLang);

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
            description: `⚡ ${data.stats?.method ?? "pattern"}`,
          },
        );
      } else {
        toast.warning("Tidak ada blok kode terdeteksi", {
          description: "Coba bahasa lain atau periksa format file.",
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
        backgroundColor: "#faf9f6",
        fontFamily: "var(--font-body)",
        color: "#3a3a3a",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ══ HEADER ══ */}
      <header
        style={{
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: "10px",
              backgroundColor: "#c9a0a0",
              boxShadow: "0 2px 8px rgba(201,160,160,0.25)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Code2 size={22} strokeWidth={2} />
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.5rem,5vw,2.1rem)",
              letterSpacing: "0.01em",
              fontWeight: 600,
              lineHeight: 1,
              color: "#3a3a3a",
              whiteSpace: "nowrap",
              margin: 0,
            }}
          >
            CodeLooter!
          </h1>
          <span
            style={{
              backgroundColor: "#f0d4d8",
              color: "#7a4a52",
              border: "1px solid rgba(122,74,82,0.18)",
              borderRadius: "999px",
              padding: "3px 10px",
              fontFamily: "var(--font-body)",
              fontSize: "0.66rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            Beta
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          {extractMeta.method && (
            <Tag bg="#e8f0e4" color="#4a6a4a">⚡ Pattern</Tag>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="cl-btn"
            style={{
              backgroundColor: "#3a3a3a",
              color: "#faf9f6",
              border: "1px solid #3a3a3a",
              borderRadius: "10px",
              padding: "9px 16px",
              fontFamily: "var(--font-body)",
              fontSize: "0.88rem",
              fontWeight: 500,
              letterSpacing: "0.01em",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Upload size={15} /> Pilih File
          </button>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main
        style={{
          padding: "24px 20px",
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
                backgroundColor: "#fff",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: "12px",
                padding: "16px 18px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  backgroundColor: s.color,
                }}
              />
              <p
                style={{
                  fontSize: "clamp(1.4rem,4vw,1.8rem)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  lineHeight: 1.1,
                  color: "#3a3a3a",
                  margin: 0,
                }}
              >
                {s.val}
              </p>
              <p
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 500,
                  color: "#8a8a8a",
                  marginTop: "4px",
                  marginBottom: 0,
                  fontFamily: "var(--font-body)",
                  letterSpacing: "0.02em",
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
            <CardHeader bg="#faf7f2">
              <Code2 size={15} color="#8a8a8a" />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  color: "#3a3a3a",
                }}
              >
                Pilih Bahasa
              </span>
            </CardHeader>
            <div
              style={{
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                flex: 1,
                overflow: "hidden",
              }}
            >
              {/* detected langs after extraction */}
              {detectedLangs.length > 0 && (
                <div
                  style={{
                    backgroundColor: "#e8f0e4",
                    border: "1px solid rgba(0,0,0,0.06)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.64rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "8px",
                      marginTop: 0,
                      color: "#4a6a4a",
                    }}
                  >
                    🔍 Terdeteksi
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
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
                              color: "#f0ead4",
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
                      fontSize: "0.64rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "6px",
                      marginTop: 0,
                      color: "#8a8a8a",
                    }}
                  >
                    Override manual
                  </p>
                )}
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="cl-btn"
                  style={{
                    width: "100%",
                    backgroundColor: "#fff",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: "10px",
                    padding: "11px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    color: "#3a3a3a",
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
                    <span
                      style={{
                        fontSize: "1.05rem",
                        width: 22,
                        height: 22,
                        borderRadius: "6px",
                        backgroundColor: currentLang?.color ?? "#f0ead4",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {currentLang?.emoji}
                    </span>
                    {currentLang?.label}
                  </span>
                  <ChevronDown
                    size={16}
                    color="#8a8a8a"
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
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      backgroundColor: "#fff",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: "10px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                      zIndex: 30,
                      overflow: "hidden",
                      animation: "fadeIn 0.2s ease",
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
                          padding: "10px 14px",
                          backgroundColor:
                            lang.id === selectedLang ? lang.color : "#fff",
                          border: "none",
                          borderBottom:
                            idx < LANGUAGES.length - 1
                              ? "1px solid rgba(0,0,0,0.04)"
                              : "none",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontWeight: 500,
                          fontSize: "0.85rem",
                          color: "#3a3a3a",
                          fontFamily: "var(--font-body)",
                          transition: "background-color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (lang.id !== selectedLang)
                            (e.currentTarget as HTMLElement).style.backgroundColor =
                              "#faf9f6";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            lang.id === selectedLang ? lang.color : "#fff";
                        }}
                      >
                        <span style={{ fontSize: "1.05rem" }}>{lang.emoji}</span>
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* info */}
              <div
                style={{
                  backgroundColor: currentLang?.color ?? "#f0ead4",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.15rem",
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    lineHeight: 1.2,
                    color: "#3a3a3a",
                    margin: 0,
                  }}
                >
                  {currentLang?.emoji} {currentLang?.label}
                </p>
                <p
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 400,
                    color: "#6a6a6a",
                    marginTop: "5px",
                    marginBottom: 0,
                  }}
                >
                  Bahasa terpilih untuk ekstraksi kode.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: "#faf9f6",
                  border: "1px dashed rgba(0,0,0,0.14)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginTop: "auto",
                }}
              >
                <p
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 400,
                    color: "#6a6a6a",
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
            <CardHeader bg="#f5f8f3">
              <FileText size={15} color="#8a8a8a" />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  color: "#3a3a3a",
                }}
              >
                Upload File
              </span>
              <Tag bg="#e8f0e4" color="#4a6a4a">
                PDF · DOC · PPTX
              </Tag>
            </CardHeader>
            <div
              style={{
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                gap: "14px",
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
                  backgroundColor: isDragging ? "#e8f0e4" : "#faf9f6",
                  border: `2px dashed ${isDragging ? "#a3b8a0" : "rgba(0,0,0,0.14)"}`,
                  borderRadius: "12px",
                  cursor: uploadedFile ? "default" : "pointer",
                  transition: "all 0.2s ease",
                  position: "relative",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "14px",
                  padding: "28px 18px",
                  minHeight: "220px",
                }}
              >
                {!uploadedFile ? (
                  <>
                    <div
                      style={{
                        backgroundColor: "#fff",
                        border: "1px solid rgba(0,0,0,0.06)",
                        borderRadius: "50%",
                        width: "clamp(72px,12vw,96px)",
                        height: "clamp(72px,12vw,96px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
                        color: "#c9a0a0",
                      }}
                    >
                      <Upload size={32} strokeWidth={1.75} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "clamp(1.1rem,3vw,1.4rem)",
                          fontWeight: 600,
                          letterSpacing: "0.01em",
                          lineHeight: 1.25,
                          margin: 0,
                          color: "#3a3a3a",
                        }}
                      >
                        Jatuhkan dokumenmu di sini
                      </p>
                      <p
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 400,
                          color: "#8a8a8a",
                          marginTop: "5px",
                          marginBottom: 0,
                        }}
                      >
                        atau klik untuk memilih file
                      </p>
                    </div>
                    <div
                      style={{
                        backgroundColor: "#f0ead4",
                        border: "1px solid rgba(0,0,0,0.06)",
                        borderRadius: "8px",
                        padding: "5px 14px",
                        fontSize: "0.72rem",
                        fontWeight: 500,
                        color: "#5a5a3a",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      Maks. 50MB · PDF, MD, IPYNB, TXT, TEX, HTML
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        backgroundColor: "#fff",
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: "10px",
                        padding: "14px 16px",
                        width: "92%",
                        maxWidth: 380,
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "#3a3a3a",
                          borderRadius: "8px",
                          padding: "8px",
                          flexShrink: 0,
                          color: "#faf9f6",
                        }}
                      >
                        <FileText size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontWeight: 600,
                            fontSize: "0.86rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            margin: 0,
                            color: "#3a3a3a",
                          }}
                        >
                          {uploadedFile.name}
                        </p>
                        <p
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 400,
                            color: "#8a8a8a",
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
                          backgroundColor: "transparent",
                          border: "1px solid rgba(0,0,0,0.1)",
                          borderRadius: "6px",
                          padding: "5px",
                          cursor: "pointer",
                          flexShrink: 0,
                          display: "flex",
                          color: "#8a8a8a",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "#c9646a";
                          (e.currentTarget as HTMLElement).style.color =
                            "#c9646a";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "rgba(0,0,0,0.1)";
                          (e.currentTarget as HTMLElement).style.color =
                            "#8a8a8a";
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "0.86rem",
                        color: "#6a8a5a",
                        fontWeight: 500,
                        letterSpacing: "0.01em",
                        margin: 0,
                      }}
                    >
                      ✅ File siap diekstrak
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

              {/* extract button */}
              <button
                onClick={handleExtract}
                disabled={!uploadedFile || isExtracting}
                className="cl-btn"
                style={{
                  width: "100%",
                  backgroundColor:
                    uploadedFile && !isExtracting ? "#c9a0a0" : "#e4e2de",
                  color: uploadedFile ? "#ffffff" : "#a8a8a8",
                  border: "1px solid transparent",
                  borderRadius: "10px",
                  padding: "13px",
                  fontFamily: "var(--font-body)",
                  fontSize: "clamp(0.95rem,3vw,1.1rem)",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  cursor:
                    uploadedFile && !isExtracting ? "pointer" : "not-allowed",
                  boxShadow: uploadedFile
                    ? "0 4px 14px rgba(201,160,160,0.3)"
                    : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                }}
              >
                {isExtracting ? (
                  <>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        border: "2px solid rgba(255,255,255,0.5)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                      }}
                    />
                    Sedang mengekstrak...
                  </>
                ) : (
                  <>
                    <Zap
                      size={20}
                      fill={uploadedFile ? "#ffffff" : "#a8a8a8"}
                      strokeWidth={1.5}
                    />
                    {extracted ? "Ekstrak Ulang" : "Ekstrak Kode"}
                  </>
                )}
              </button>
            </div>
          </Card>

          {/* COL 3: HASIL EKSTRAKSI */}
          <Card>
            <CardHeader bg="#f6f5fb">
              <div style={{ display: "flex", gap: "5px" }}>
                {["#c9a0a0", "#d4d0e8", "#c8d8c0"].map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: c,
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  color: "#3a3a3a",
                  flex: 1,
                }}
              >
                Hasil Ekstraksi
              </span>
              <div
                style={{
                  backgroundColor: extracted
                    ? "#e8f0e4"
                    : extractError
                      ? "#f0d4d8"
                      : "#f0ead4",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: "999px",
                  padding: "3px 10px",
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  color: extracted
                    ? "#4a6a4a"
                    : extractError
                      ? "#7a4a52"
                      : "#7a6a3a",
                  fontFamily: "var(--font-body)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: extracted
                      ? "#6a9a5a"
                      : extractError
                        ? "#c9646a"
                        : "#c9a85a",
                    display: "inline-block",
                  }}
                />
                {extracted
                  ? `${extractedBlocks.length} blok`
                  : extractError
                    ? "Gagal"
                    : "Menunggu"}
              </div>
            </CardHeader>

            {/* detected-language chips (multi-block switcher) */}
            {detectedLangs.length > 1 && (
              <div
                style={{
                  backgroundColor: "#faf9f6",
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                  padding: "10px 14px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
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
                          color: "#f0ead4",
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
                  backgroundColor: "#2a2826",
                  height: "100%",
                  overflowY: "auto",
                  padding: "20px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.78rem",
                  lineHeight: 1.7,
                  minHeight: "240px",
                  maxHeight: "440px",
                  color: "#e8e4dc",
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
                        fontSize: "2.6rem",
                        color: "#8a8a8a",
                        margin: 0,
                        fontWeight: 500,
                      }}
                    >
                      ???
                    </p>
                    <p
                      style={{
                        color: "#a8a8a8",
                        fontWeight: 400,
                        textAlign: "center",
                        fontSize: "0.82rem",
                        margin: 0,
                        letterSpacing: "0.01em",
                      }}
                    >
                      Upload file &amp; klik <strong>Ekstrak Kode</strong> untuk
                      memulai
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
                        fontFamily: "var(--font-body)",
                        fontSize: "0.95rem",
                        color: "#e8a0a0",
                        textAlign: "center",
                        margin: 0,
                        fontWeight: 500,
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
                        fontFamily: "var(--font-body)",
                        fontSize: "1rem",
                        color: "#d4d0e8",
                        animation: "pulse 0.9s ease-in-out infinite alternate",
                        margin: 0,
                        textAlign: "center",
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                      }}
                    >
                      Menganalisis file...
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          style={{
                            width: 7,
                            height: 7,
                            backgroundColor: "#c8d8c0",
                            borderRadius: "50%",
                            animation: `pulse 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                          }}
                        />
                      ))}
                    </div>
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
                        color: "#e8e4dc",
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
                    backgroundColor: "rgba(20,18,16,0.7)",
                    color: "#d4d0e8",
                    border: "1px solid rgba(212,208,232,0.2)",
                    borderRadius: "6px",
                    padding: "3px 9px",
                    fontSize: "0.64rem",
                    fontWeight: 500,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.01em",
                    backdropFilter: "blur(6px)",
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
                      className="cl-btn"
                      style={{
                        backgroundColor: "#e8f0e4",
                        color: "#4a6a4a",
                        border: "1px solid rgba(74,106,74,0.2)",
                        borderRadius: "999px",
                        padding: "9px 14px",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.82rem",
                        fontWeight: 500,
                        letterSpacing: "0.01em",
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Check size={14} strokeWidth={2.5} /> Tersimpan! Simpan Ulang
                    </button>
                  ) : (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      title="Simpan snippet"
                      className="cl-btn"
                      style={{
                        backgroundColor: "#fff",
                        color: "#3a3a3a",
                        border: "1px solid rgba(0,0,0,0.1)",
                        borderRadius: "999px",
                        padding: "9px 14px",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.82rem",
                        fontWeight: 500,
                        letterSpacing: "0.01em",
                        cursor: saving ? "not-allowed" : "pointer",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
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
                    className="cl-btn"
                    style={{
                      backgroundColor: "#fff",
                      color: "#4a6a5a",
                      border: "1px solid rgba(74,106,90,0.2)",
                      borderRadius: "999px",
                      padding: "9px 14px",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.82rem",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    ⬇ .{currentLang?.ext ?? "txt"}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="cl-btn"
                    style={{
                      backgroundColor: copied ? "#e8f0e4" : "#fff",
                      color: copied ? "#4a6a4a" : "#7a4a52",
                      border: copied
                        ? "1px solid rgba(74,106,74,0.2)"
                        : "1px solid rgba(122,74,82,0.2)",
                      borderRadius: "999px",
                      padding: "9px 16px",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.82rem",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={2.5} />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copied ? "Tersalin" : "Salin Kode"}
                  </button>
                </div>
              )}
            </div>

            {extracted && activeBlock && (
              <div
                style={{
                  backgroundColor: "#faf7f2",
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                  padding: "9px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                  fontFamily: "var(--font-body)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    color: "#5a5a5a",
                  }}
                >
                  {currentLang?.emoji} {currentLang?.label} ·{" "}
                  {activeBlock.lines} baris
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 400,
                    color: "#8a8a8a",
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
            marginTop: "20px",
            backgroundColor: "#fff",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: "14px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              backgroundColor: "#faf7f2",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <FolderOpen size={16} color="#8a8a8a" />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.1rem",
                fontWeight: 600,
                letterSpacing: "0.01em",
                color: "#3a3a3a",
              }}
            >
              📂 Snippet Tersimpan
            </span>
            <Tag bg="#f0ead4" color="#5a5a3a">
              {snippets.length} snippet
            </Tag>
            <button
              onClick={() => void refreshSnippets()}
              title="Refresh list"
              className="cl-btn"
              style={{
                marginLeft: "auto",
                backgroundColor: "#fff",
                color: "#5a5a5a",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "0.75rem",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              ⟳ Refresh
            </button>
          </div>

          <div
            style={{
              padding: "18px",
              backgroundColor: "#faf9f6",
              maxHeight: "320px",
              overflowY: "auto",
            }}
          >
            {loadingSnippets ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "28px",
                  color: "#8a8a8a",
                  fontWeight: 400,
                  fontSize: "0.85rem",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    border: "2px solid rgba(0,0,0,0.1)",
                    borderTopColor: "#c9a0a0",
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
                  padding: "28px",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.25rem",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    margin: "0 0 6px 0",
                    color: "#5a5a5a",
                  }}
                >
                  📭 Belum ada snippet
                </p>
                <p
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 400,
                    color: "#8a8a8a",
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
                  gap: "12px",
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
                        border: "1px solid rgba(0,0,0,0.06)",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        transition: "box-shadow 0.2s ease, transform 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            backgroundColor: lang?.color ?? "#f0ead4",
                            border: "1px solid rgba(0,0,0,0.06)",
                            borderRadius: "8px",
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
                            fontWeight: 600,
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                            color: "#3a3a3a",
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
                        <Tag bg="#e8f0e4" color="#4a6a4a">
                          {s.totalBlocks} blok
                        </Tag>
                        <Tag bg="#e4e0f0" color="#5a4a6a">
                          {(s.fileSize / 1024).toFixed(1)} KB
                        </Tag>
                        {s.tags && s.tags.trim() && (
                          <Tag bg="#f0ead4" color="#5a5a3a">
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
                            fontWeight: 400,
                            color: "#9a9a9a",
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
                            className="cl-btn"
                            style={{
                              backgroundColor: "#3a3a3a",
                              color: "#faf9f6",
                              border: "1px solid #3a3a3a",
                              borderRadius: "6px",
                              padding: "5px 10px",
                              fontSize: "0.72rem",
                              fontWeight: 500,
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
                            className="cl-btn"
                            style={{
                              backgroundColor: "#fff",
                              color: "#c9646a",
                              border: "1px solid rgba(201,100,106,0.25)",
                              borderRadius: "6px",
                              padding: "5px 8px",
                              fontSize: "0.72rem",
                              fontWeight: 500,
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
          backgroundColor: "#faf7f2",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          padding: "14px 20px",
          marginTop: "auto",
          textAlign: "center",
          fontFamily: "var(--font-body)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontSize: "0.82rem",
            fontWeight: 400,
            letterSpacing: "0.02em",
            color: "#8a8a8a",
          }}
        >
          CodeLooter · Ekstrak kode dari dokumen ·{" "}
          <span style={{ color: "#c9a0a0", fontWeight: 500 }}>Beta</span>
        </p>
      </footer>
    </div>
  );
}
