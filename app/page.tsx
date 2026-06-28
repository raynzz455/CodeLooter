"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronDown, LogIn, LogOut, FileText, Lock, ChevronRight, Code2, Upload, X, Zap, Copy, Check } from "lucide-react";
import { SplashScreen, useShouldShowSplash } from "@/components/SplashScreen";
import { AuthModal } from "@/components/AuthModal";
import { LANGUAGES, RECENT_FILES, STATS, SAMPLE_CODES } from "@/components/data";
import type { CodeBlock } from "@/types";

const ACCEPTED_EXT = /\.(pdf|doc|docx|pptx?|xlsx?|txt|md|html|ipynb|tex)$/i;

function Tag({ bg = "#ffe8a3", color = "#000", children }: { bg?: string; color?: string; children: React.ReactNode }) {
  return (
    <span style={{ backgroundColor: bg, color, border: "2px solid #000", borderRadius: "6px", padding: "2px 9px", fontSize: "0.68rem", fontWeight: 900, whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
      {children}
    </span>
  );
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: "#fff", border: "3px solid #000", borderRadius: "16px", boxShadow: "5px 5px 0 #000", overflow: "hidden", display: "flex", flexDirection: "column", ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: bg, borderBottom: "3px solid #000", padding: "11px 16px", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
      {children}
    </div>
  );
}

export default function Home() {
  const shouldShowSplash                  = useShouldShowSplash();
  const [splashDone, setSplashDone]       = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [profileOpen, setProfileOpen]     = useState(false);
  const [user, setUser]                   = useState<string | null>(null);
  const [selectedLang, setSelectedLang]   = useState("python");
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [uploadedFile, setUploadedFile]   = useState<File | null>(null);
  const [isDragging, setIsDragging]       = useState(false);
  const [isExtracting, setIsExtracting]   = useState(false);
  const [extractedBlocks, setExtractedBlocks] = useState<CodeBlock[]>([]);
  const [extractError, setExtractError]   = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileRef   = useRef<HTMLDivElement>(null);

  const extracted = extractedBlocks.length > 0;
  const currentLang = LANGUAGES.find((l) => l.id === selectedLang) ?? LANGUAGES[0];

  // active block for preview
  const activeBlock = extractedBlocks.find((b) => b.lang === selectedLang) ?? extractedBlocks[0] ?? null;
  const displayCode = activeBlock?.code ?? SAMPLE_CODES[selectedLang] ?? "";

  // close profile on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
    if (file && ACCEPTED_EXT.test(file.name)) setFile(file);
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
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setExtractError(data.error ?? "Gagal mengekstrak kode"); return; }
      const blocks: CodeBlock[] = data.blocks ?? [];
      setExtractedBlocks(blocks);
      if (blocks.length > 0 && blocks[0].lang !== "unknown") setSelectedLang(blocks[0].lang);
    } catch {
      setExtractError("Koneksi gagal — coba lagi");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeBlock) return;
    const blob = new Blob([activeBlock.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codelooter_${activeBlock.lang}.${currentLang?.ext ?? "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // lang tabs from extracted blocks
  const detectedLangs = [...new Set(extractedBlocks.map((b) => b.lang))];

  return (
    <>
      {/* SPLASH */}
      {shouldShowSplash && !splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      {/* AUTH MODAL */}
      {showModal && <AuthModal onClose={() => setShowModal(false)} onSignIn={(n) => setUser(n)} />}

      <div style={{ backgroundColor: "#fef9f0", fontFamily: "var(--font-body)", minHeight: "100vh" }}>

        {/* ══ HEADER ══ */}
        <header style={{ backgroundColor: "#ffe8a3", borderBottom: "3px solid #000", boxShadow: "0 5px 0 #000", position: "sticky", top: 0, zIndex: 50, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div style={{ width: 40, height: 40, border: "3px solid #000", borderRadius: "10px", overflow: "hidden", boxShadow: "3px 3px 0 #ff6b6b", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="CodeLooter logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem,5vw,2.1rem)", letterSpacing: "0.05em", lineHeight: 1, textShadow: "3px 3px 0 #ff6b6b", whiteSpace: "nowrap", margin: 0 }}>
              CodeLooter!
            </h1>
            <div style={{ backgroundColor: "#ff6b6b", border: "2px solid #000", borderRadius: "6px", padding: "1px 7px", fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "#fff", boxShadow: "2px 2px 0 #000", flexShrink: 0 }}>
              BETA
            </div>
          </div>

          {/* profile */}
          <div ref={profileRef} style={{ position: "relative", flexShrink: 0 }}>
            {user ? (
              <button onClick={() => setProfileOpen(!profileOpen)} style={{ backgroundColor: "#f5f0ff", border: "3px solid #000", borderRadius: "10px", padding: "5px 12px", boxShadow: "3px 3px 0 #000", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <div style={{ backgroundColor: "#ff6b6b", border: "2px solid #000", borderRadius: "50%", width: 30, height: 30, overflow: "hidden", flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.jpg" alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <span className="profile-name" style={{ fontWeight: 900, fontSize: "0.82rem", fontFamily: "var(--font-body)" }}>{user}</span>
                <ChevronDown size={14} style={{ transform: profileOpen ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
              </button>
            ) : (
              <button onClick={() => setShowModal(true)} style={{ backgroundColor: "#000", color: "#ffe8a3", border: "3px solid #000", borderRadius: "10px", padding: "8px 16px", fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: "0.05em", cursor: "pointer", boxShadow: "4px 4px 0 #ff6b6b", display: "flex", alignItems: "center", gap: "6px", transition: "transform 0.1s, box-shadow 0.1s" }}
                onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #ff6b6b"; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0 #ff6b6b"; }}
              >
                <LogIn size={15} /> MASUK
              </button>
            )}

            {/* profile dropdown */}
            {profileOpen && user && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, backgroundColor: "#fff", border: "3px solid #000", borderRadius: "12px", boxShadow: "5px 5px 0 #000", minWidth: "190px", zIndex: 60, overflow: "hidden", animation: "popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}>
                <div style={{ backgroundColor: "#f5f0ff", borderBottom: "3px solid #000", padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: 34, height: 34, border: "2px solid #000", borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo.jpg" alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 900, fontSize: "0.85rem", lineHeight: 1.2, margin: 0, fontFamily: "var(--font-body)" }}>{user}</p>
                      <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "#666", margin: 0 }}>Member</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setUser(null); setProfileOpen(false); }} style={{ width: "100%", padding: "11px 14px", backgroundColor: "#fff", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: "0.88rem", color: "#cc2222", transition: "background-color 0.1s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fff0f0"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fff"; }}
                >
                  <LogOut size={15} /> Keluar
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ══ MAIN ══ */}
        <main style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}>

          {/* STATS */}
          <div className="stats-grid">
            {STATS.map((s) => (
              <div key={s.label} style={{ backgroundColor: s.color, border: "3px solid #000", borderRadius: "10px", padding: "10px 14px", boxShadow: "4px 4px 0 #000" }}>
                <p style={{ fontSize: "clamp(1.2rem,4vw,1.6rem)", fontFamily: "var(--font-display)", letterSpacing: "0.04em", lineHeight: 1, margin: 0 }}>{s.val}</p>
                <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "#333", marginTop: "2px", marginBottom: 0, fontFamily: "var(--font-body)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* THREE COLUMNS */}
          <div className="main-grid">

            {/* COL 1: PILIH BAHASA */}
            <Card>
              <CardHeader bg="#ffe8a3">
                <Code2 size={15} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.05em" }}>PILIH BAHASA</span>
              </CardHeader>
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflow: "hidden" }}>
                {/* detected langs after extraction */}
                {detectedLangs.length > 0 && (
                  <div style={{ backgroundColor: "#d4f0e4", border: "2px solid #000", borderRadius: "10px", padding: "10px 12px" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "7px", marginTop: 0 }}>🔍 Terdeteksi</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {detectedLangs.map((id) => {
                        const lang = LANGUAGES.find((l) => l.id === id);
                        const isActive = id === selectedLang;
                        return (
                          <button key={id} onClick={() => setSelectedLang(id)} style={{ backgroundColor: isActive ? (lang?.color ?? "#ffe8a3") : "#fff", border: "2px solid #000", borderRadius: "8px", padding: "4px 10px", fontSize: "0.75rem", fontWeight: 900, cursor: "pointer", boxShadow: isActive ? "2px 2px 0 #000" : "none", transform: isActive ? "translate(1px,1px)" : "", fontFamily: "var(--font-body)", display: "flex", alignItems: "center", gap: "4px", transition: "all 0.1s" }}>
                            <span>{lang?.emoji ?? "📄"}</span>{lang?.label ?? id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* dropdown */}
                <div style={{ position: "relative" }}>
                  {detectedLangs.length > 0 && <p style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", marginTop: 0, color: "#555" }}>Override manual</p>}
                  <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{ width: "100%", backgroundColor: currentLang?.color ?? "#ffe8a3", border: "3px solid #000", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", boxShadow: "4px 4px 0 #000", fontWeight: 900, fontSize: "0.95rem", fontFamily: "var(--font-body)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "1.2rem" }}>{currentLang?.emoji}</span>
                      {currentLang?.label}
                    </span>
                    <ChevronDown size={16} style={{ transform: dropdownOpen ? "rotate(180deg)" : "", transition: "transform 0.2s", flexShrink: 0 }} />
                  </button>
                  {dropdownOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: "#fff", border: "3px solid #000", borderRadius: "10px", boxShadow: "5px 5px 0 #000", zIndex: 30, overflow: "hidden" }}>
                      {LANGUAGES.map((lang, idx) => (
                        <button key={lang.id} onClick={() => { setSelectedLang(lang.id); setDropdownOpen(false); }} style={{ width: "100%", padding: "9px 14px", backgroundColor: lang.id === selectedLang ? lang.color : "#fff", border: "none", borderBottom: idx < LANGUAGES.length - 1 ? "2px solid #eee" : "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "0.88rem", fontFamily: "var(--font-body)", transition: "background-color 0.1s" }}
                          onMouseEnter={(e) => { if (lang.id !== selectedLang) (e.currentTarget as HTMLElement).style.backgroundColor = "#fef9f0"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = lang.id === selectedLang ? lang.color : "#fff"; }}
                        >
                          <span>{lang.emoji}</span>{lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* info */}
                <div style={{ backgroundColor: currentLang?.color ?? "#ffe8a3", border: "2px solid #000", borderRadius: "10px", padding: "12px" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", letterSpacing: "0.04em", lineHeight: 1, margin: 0 }}>{currentLang?.emoji} {currentLang?.label}</p>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#444", marginTop: "4px", marginBottom: 0 }}>Bahasa terpilih untuk ekstraksi kode.</p>
                </div>

                <div style={{ backgroundColor: "#fef9f0", border: "2px dashed #000", borderRadius: "8px", padding: "10px 12px", marginTop: "auto" }}>
                  <p style={{ fontSize: "0.72rem", fontWeight: 800, color: "#555", lineHeight: 1.5, margin: 0 }}>
                    {detectedLangs.length > 0 ? `💡 ${detectedLangs.length} bahasa ditemukan. Klik chip untuk switch preview.` : "💡 Bahasa akan terdeteksi otomatis setelah file diekstrak."}
                  </p>
                </div>
              </div>
            </Card>

            {/* COL 2: UPLOAD FILE */}
            <Card>
              <CardHeader bg="#d4f0e4">
                <FileText size={15} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.05em" }}>UPLOAD FILE</span>
                <Tag bg="#000" color="#d4f0e4">PDF · DOC · PPTX</Tag>
              </CardHeader>
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", flex: 1 }}>
                {/* drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => !uploadedFile && fileInputRef.current?.click()}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !uploadedFile) fileInputRef.current?.click(); }}
                  style={{ backgroundColor: isDragging ? "#b8e8d0" : "#fef9f0", border: "3px dashed #000", borderRadius: "12px", cursor: uploadedFile ? "default" : "pointer", transition: "background-color 0.15s", position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", padding: "24px 16px", minHeight: "200px" }}
                >
                  {(["tl","tr","bl","br"] as const).map((c) => (
                    <div key={c} style={{ position: "absolute", width: 14, height: 14, backgroundColor: "#ffe8a3", border: "2px solid #000", borderRadius: "3px", top: c[0]==="t" ? -3 : undefined, bottom: c[0]==="b" ? -3 : undefined, left: c[1]==="l" ? -3 : undefined, right: c[1]==="r" ? -3 : undefined }} />
                  ))}

                  {!uploadedFile ? (
                    <>
                      <div style={{ backgroundColor: "#f5f0ff", border: "3px solid #000", borderRadius: "50%", width: "clamp(72px,12vw,96px)", height: "clamp(72px,12vw,96px)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "5px 5px 0 #000" }}>
                        <Upload size={36} strokeWidth={2.5} />
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.1rem,3vw,1.55rem)", letterSpacing: "0.04em", lineHeight: 1.25, margin: 0 }}>Jatuhkan dokumenmu di sini!</p>
                        <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#555", marginTop: "5px", marginBottom: 0 }}>atau klik untuk memilih file</p>
                      </div>
                      <div style={{ backgroundColor: "#ffe8a3", border: "2px solid #000", borderRadius: "8px", padding: "5px 16px", fontSize: "0.75rem", fontWeight: 800 }}>
                        Maks. 50MB · PDF, DOC, DOCX, PPTX, XLSX, MD, IPYNB
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ backgroundColor: "#d4f0e4", border: "3px solid #000", borderRadius: "10px", padding: "14px 18px", width: "90%", maxWidth: 360, display: "flex", alignItems: "center", gap: "10px", boxShadow: "3px 3px 0 #000" }}>
                        <div style={{ backgroundColor: "#000", borderRadius: "8px", padding: "8px", flexShrink: 0 }}><FileText size={20} color="#d4f0e4" /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 900, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{uploadedFile.name}</p>
                          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#444", margin: 0 }}>{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{ backgroundColor: "#ff6b6b", border: "2px solid #000", borderRadius: "6px", padding: "5px", cursor: "pointer", flexShrink: 0, display: "flex" }}>
                          <X size={14} color="#fff" />
                        </button>
                      </div>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "#009944", letterSpacing: "0.03em", margin: 0 }}>✅ File siap diekstrak!</p>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.pptx,.ppt,.xlsx,.xls,.txt,.md,.html,.ipynb,.tex" onChange={handleFileInput} style={{ display: "none" }} />
                </div>

                {/* extract button */}
                <button onClick={handleExtract} disabled={!uploadedFile || isExtracting} style={{ marginTop: "12px", width: "100%", backgroundColor: uploadedFile ? "#000" : "#ccc", color: uploadedFile ? "#ffe8a3" : "#888", border: "3px solid #000", borderRadius: "10px", padding: "14px", fontFamily: "var(--font-display)", fontSize: "clamp(1rem,3vw,1.35rem)", letterSpacing: "0.06em", cursor: uploadedFile && !isExtracting ? "pointer" : "not-allowed", boxShadow: uploadedFile ? "5px 5px 0 #ff6b6b" : "none", transition: "transform 0.1s, box-shadow 0.1s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexShrink: 0 }}
                  onMouseDown={(e) => { if (uploadedFile) { (e.currentTarget as HTMLElement).style.transform = "translate(3px,3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #ff6b6b"; } }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = uploadedFile ? "5px 5px 0 #ff6b6b" : "none"; }}
                >
                  {isExtracting ? (
                    <><div style={{ width: 20, height: 20, border: "3px solid #ffe8a3", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />SEDANG MENGEKSTRAK...</>
                  ) : (
                    <><Zap size={22} fill={uploadedFile ? "#ffe8a3" : "#888"} />{extracted ? "EKSTRAK ULANG!" : "EKSTRAK KODE!"}</>
                  )}
                </button>
              </div>
            </Card>

            {/* COL 3: HASIL EKSTRAKSI */}
            <Card>
              <CardHeader bg="#f5f0ff">
                <div style={{ display: "flex", gap: "5px" }}>
                  {["#ff6b6b","#ffe8a3","#d4f0e4"].map((c) => (
                    <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: c, border: "2px solid #000" }} />
                  ))}
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.05em", flex: 1 }}>HASIL EKSTRAKSI</span>
                <div style={{ backgroundColor: extracted ? "#d4f0e4" : extractError ? "#ffd6d6" : "#ffe8a3", border: "2px solid #000", borderRadius: "8px", padding: "2px 9px", fontSize: "0.68rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-body)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: extracted ? "#00aa44" : extractError ? "#ff4444" : "#ffaa00", display: "inline-block" }} />
                  {extracted ? `${extractedBlocks.length} BLOK` : extractError ? "GAGAL" : "MENUNGGU"}
                </div>
              </CardHeader>

              <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                <div style={{ backgroundColor: "#1a1a2e", height: "100%", overflowY: "auto", padding: "18px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: 1.7, minHeight: "240px" }}>
                  {!extracted && !isExtracting && !extractError && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", opacity: 0.45 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "3rem", color: "#aaa", margin: 0 }}>???</p>
                      <p style={{ color: "#888", fontWeight: 700, textAlign: "center", fontSize: "0.85rem", margin: 0 }}>Upload file &amp; klik EKSTRAK KODE! untuk memulai</p>
                    </div>
                  )}
                  {extractError && !isExtracting && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "#ff6b6b", textAlign: "center", margin: 0 }}>{extractError}</p>
                    </div>
                  )}
                  {isExtracting && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px" }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", color: "#ffe8a3", animation: "pulse 0.8s ease-in-out infinite alternate", margin: 0 }}>MENGANALISIS FILE...</p>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {[0,1,2,3,4].map((i) => <div key={i} style={{ width: 8, height: 8, backgroundColor: "#d4f0e4", borderRadius: "50%", animation: `bounce 0.6s ease-in-out ${i*0.1}s infinite alternate` }} />)}
                      </div>
                    </div>
                  )}
                  {(extracted || (!extracted && !isExtracting && !extractError)) && !isExtracting && (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#e8f4fd" }}>
                      <code>{extracted ? displayCode : ""}</code>
                    </pre>
                  )}
                </div>

                {/* action buttons */}
                {extracted && (
                  <div style={{ position: "absolute", bottom: 14, right: 14, display: "flex", gap: "8px", zIndex: 10 }}>
                    <button onClick={handleDownload} style={{ backgroundColor: "#d4f0e4", border: "3px solid #000", borderRadius: "999px", padding: "10px 14px", fontFamily: "var(--font-display)", fontSize: "0.9rem", letterSpacing: "0.05em", cursor: "pointer", boxShadow: "4px 4px 0 #000", display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #000"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0 #000"; }}
                    >
                      ⬇ .{currentLang?.ext ?? "txt"}
                    </button>
                    <button onClick={handleCopy} style={{ backgroundColor: copied ? "#d4f0e4" : "#ff6b6b", border: "3px solid #000", borderRadius: "999px", padding: "10px 18px", fontFamily: "var(--font-display)", fontSize: "0.9rem", letterSpacing: "0.06em", cursor: "pointer", boxShadow: copied ? "2px 2px 0 #000" : "5px 5px 0 #000", transform: copied ? "translate(3px,3px)" : "", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "6px" }}
                      onMouseEnter={(e) => { if (!copied) { (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 #000"; } }}
                      onMouseLeave={(e) => { if (!copied) { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "5px 5px 0 #000"; } }}
                    >
                      {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                      {copied ? "TERSALIN!" : "BOOM! Salin Kode"}
                    </button>
                  </div>
                )}
              </div>

              {extracted && activeBlock && (
                <div style={{ backgroundColor: "#ffe0d0", borderTop: "3px solid #000", padding: "7px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, fontFamily: "var(--font-body)" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 900 }}>{currentLang?.emoji} {currentLang?.label} · {activeBlock.lines} baris</span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#555" }}>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
            </Card>

          </div>

          {/* FILE TERBARU */}
          <div style={{ marginTop: "16px", backgroundColor: "#fff", border: "3px solid #000", borderRadius: "16px", boxShadow: "5px 5px 0 #000", overflow: "hidden" }}>
            <div style={{ backgroundColor: "#ffe0d0", borderBottom: "3px solid #000", padding: "11px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", letterSpacing: "0.05em" }}>📂 FILE TERBARU</span>
              <Tag bg="#000" color="#ffe0d0">5 TERAKHIR</Tag>
              {!user && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Lock size={13} />
                  <span style={{ fontSize: "0.72rem", fontWeight: 900, color: "#888", fontFamily: "var(--font-body)" }}>Khusus member</span>
                </div>
              )}
            </div>

            {!user ? (
              <div style={{ padding: "36px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", backgroundColor: "#fef9f0" }}>
                <div style={{ opacity: 0.18, pointerEvents: "none", width: "100%", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                    <tbody>
                      {RECENT_FILES.slice(0,3).map((row, i) => (
                        <tr key={i} style={{ borderBottom: "2px solid #eee" }}>
                          <td style={{ padding: "8px 14px", fontWeight: 800, fontSize: "0.82rem", fontFamily: "var(--font-body)" }}>{row.nama}</td>
                          <td style={{ padding: "8px 14px" }}><Tag>{row.jenis}</Tag></td>
                          <td style={{ padding: "8px 14px", fontWeight: 800, fontSize: "0.82rem", fontFamily: "var(--font-body)" }}>{row.bahasa}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ position: "relative", marginTop: "-100px", zIndex: 2, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <div style={{ backgroundColor: "#fff", border: "3px solid #000", borderRadius: "12px", padding: "14px 20px", boxShadow: "5px 5px 0 #000", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <Lock size={28} />
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", letterSpacing: "0.04em", margin: 0 }}>Fitur Khusus Member!</p>
                    <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#555", textAlign: "center", margin: 0, fontFamily: "var(--font-body)" }}>Masuk atau daftar untuk melihat riwayat file kamu.</p>
                    <button onClick={() => setShowModal(true)} style={{ backgroundColor: "#000", color: "#ffe8a3", border: "3px solid #000", borderRadius: "10px", padding: "10px 24px", fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.05em", cursor: "pointer", boxShadow: "4px 4px 0 #ff6b6b", display: "flex", alignItems: "center", gap: "6px", transition: "transform 0.1s, box-shadow 0.1s" }}
                      onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #ff6b6b"; }}
                      onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0 #ff6b6b"; }}
                    >
                      <LogIn size={16} /> MASUK / DAFTAR <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="recent-table" style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#fef9f0" }}>
                        {["Nama File","Jenis","Bahasa","Status","Tanggal","Aksi"].map((h) => (
                          <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 900, fontSize: "0.72rem", borderBottom: "2px solid #000", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-body)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RECENT_FILES.map((row, i) => (
                        <tr key={i} style={{ borderBottom: i < RECENT_FILES.length-1 ? "2px solid #eee" : "none", transition: "background-color 0.1s" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fef9f0"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                        >
                          <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: "0.82rem", fontFamily: "var(--font-body)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <FileText size={13} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180, display: "inline-block" }}>{row.nama}</span>
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px" }}><Tag>{row.jenis}</Tag></td>
                          <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: "0.82rem", fontFamily: "var(--font-body)" }}>{row.bahasa}</td>
                          <td style={{ padding: "9px 14px" }}><Tag bg={row.ok ? "#d4f0e4" : "#ffd6d6"}>{row.ok ? "✅ " : "❌ "}{row.status}</Tag></td>
                          <td style={{ padding: "9px 14px", fontWeight: 700, fontSize: "0.8rem", color: "#555", whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>{row.tgl}</td>
                          <td style={{ padding: "9px 14px" }}>
                            <button style={{ backgroundColor: "#f5f0ff", border: "2px solid #000", borderRadius: "8px", padding: "4px 12px", fontSize: "0.72rem", fontWeight: 900, cursor: "pointer", fontFamily: "var(--font-body)", boxShadow: "2px 2px 0 #000", transition: "all 0.1s" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(1px,1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "1px 1px 0 #000"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #000"; }}
                            >Lihat</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="recent-cards">
                  {RECENT_FILES.map((row, i) => (
                    <div key={i} style={{ border: "2px solid #000", borderRadius: "10px", overflow: "hidden", boxShadow: "3px 3px 0 #000" }}>
                      <div style={{ backgroundColor: row.ok ? "#d4f0e4" : "#ffd6d6", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #000" }}>
                        <span style={{ fontWeight: 900, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-body)" }}>
                          <FileText size={13} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180, display: "inline-block" }}>{row.nama}</span>
                        </span>
                        <Tag bg={row.ok ? "#d4f0e4" : "#ffd6d6"}>{row.ok ? "✅" : "❌"} {row.status}</Tag>
                      </div>
                      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fef9f0", flexWrap: "wrap", gap: "6px" }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                          <Tag>{row.jenis}</Tag>
                          <span style={{ fontWeight: 800, fontSize: "0.78rem", fontFamily: "var(--font-body)" }}>{row.bahasa}</span>
                          <span style={{ fontSize: "0.72rem", color: "#666", fontWeight: 700, fontFamily: "var(--font-body)" }}>{row.tgl}</span>
                        </div>
                        <button style={{ backgroundColor: "#f5f0ff", border: "2px solid #000", borderRadius: "7px", padding: "4px 10px", fontSize: "0.72rem", fontWeight: 900, cursor: "pointer", fontFamily: "var(--font-body)" }}>Lihat</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </main>
      </div>
    </>
  );
}
