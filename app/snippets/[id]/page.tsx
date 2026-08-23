"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getUser, getSnippet, downloadSnippet, type Snippet } from "@/lib/api";

const LANG_EXT: Record<string, string> = {
  python: "py", r: "R", javascript: "js", typescript: "ts", java: "java",
  cpp: "cpp", c: "c", sql: "sql", kotlin: "kt", php: "php", ruby: "rb",
  go: "go", rust: "rs", swift: "swift", bash: "sh", html: "html", unknown: "txt",
};

export default function SnippetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState(getUser());
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    loadSnippet();
  }, [user, router]);

  const loadSnippet = async () => {
    setLoading(true);
    try {
      const data = await getSnippet(id);
      setSnippet(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat snippet");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (blockIndex: number) => {
    if (!snippet) return;
    setDownloading(blockIndex);
    try {
      const { blob, filename } = await downloadSnippet(snippet.id, blockIndex);
      // Trigger download di browser
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal download");
    } finally {
      setDownloading(null);
    }
  };

  const handleCopy = async (blockIndex: number) => {
    if (!snippet) return;
    const block = snippet.blocks.find((b) => b.index === blockIndex);
    if (!block) return;
    await navigator.clipboard.writeText(block.code);
    setCopied(blockIndex);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!user) return null;

  return (
    <div style={{ backgroundColor: "#fef9f0", minHeight: "100vh", fontFamily: "var(--font-body)" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#ffe8a3", borderBottom: "3px solid #000", boxShadow: "0 5px 0 #000", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => router.push("/dashboard")}
            style={{ backgroundColor: "#fff", border: "2px solid #000", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontWeight: 800, fontSize: "0.85rem", boxShadow: "2px 2px 0 #000" }}>
            ← Kembali
          </button>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", letterSpacing: "0.05em", margin: 0, textShadow: "2px 2px 0 #ff6b6b" }}>
            📄 Snippet Detail
          </h1>
        </div>
        {snippet && (
          <button onClick={() => handleDownload(-1)}
            disabled={downloading === -1}
            style={{ backgroundColor: "#d4f0e4", border: "3px solid #000", borderRadius: "10px", padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: "0.05em", boxShadow: "3px 3px 0 #000", fontWeight: 900 }}>
            {downloading === -1 ? "⏳..." : "⬇ Download Semua"}
          </button>
        )}
      </header>

      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px 16px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", fontWeight: 800, color: "#888" }}>⏳ Memuat...</div>
        )}

        {error && (
          <div style={{ backgroundColor: "#ffd6d6", border: "3px solid #000", borderRadius: "10px", padding: "16px", fontWeight: 800, color: "#cc2222", boxShadow: "4px 4px 0 #000" }}>⚠️ {error}</div>
        )}

        {snippet && (
          <>
            {/* Info */}
            <div style={{ backgroundColor: "#fff", border: "3px solid #000", borderRadius: "12px", boxShadow: "4px 4px 0 #000", padding: "16px 20px", marginBottom: "20px" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: "0 0 8px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {snippet.filename}
              </h2>
              <p style={{ fontWeight: 700, color: "#666", fontSize: "0.85rem", margin: 0 }}>
                {snippet.total_blocks} blok kode • dibuat {new Date(snippet.created_at).toLocaleString("id-ID")}
              </p>
            </div>

            {/* Blocks */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {snippet.blocks.map((b) => {
                const ext = LANG_EXT[b.lang] || "txt";
                return (
                  <div key={b.index} style={{ backgroundColor: "#fff", border: "3px solid #000", borderRadius: "12px", boxShadow: "4px 4px 0 #000", overflow: "hidden" }}>
                    <div style={{ backgroundColor: "#f5f0ff", borderBottom: "3px solid #000", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ backgroundColor: "#000", color: "#ffe8a3", padding: "4px 10px", borderRadius: "6px", fontWeight: 900, fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                          {b.lang.toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#555" }}>
                          Block #{b.index} • {b.lines} baris
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => handleCopy(b.index)}
                          style={{ backgroundColor: copied === b.index ? "#d4f0e4" : "#ffe8a3", border: "2px solid #000", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontWeight: 900, fontSize: "0.78rem" }}>
                          {copied === b.index ? "✓ Tersalin" : "📋 Copy"}
                        </button>
                        <button onClick={() => handleDownload(b.index)} disabled={downloading === b.index}
                          style={{ backgroundColor: "#d4f0e4", border: "2px solid #000", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontWeight: 900, fontSize: "0.78rem" }}>
                          {downloading === b.index ? "⏳" : `⬇ .${ext}`}
                        </button>
                      </div>
                    </div>
                    <pre style={{ margin: 0, padding: "16px", backgroundColor: "#1a1a2e", color: "#e8f4fd", fontFamily: "var(--font-mono)", fontSize: "0.82rem", lineHeight: 1.7, overflowX: "auto", maxHeight: "400px", overflowY: "auto" }}>
                      <code>{b.code}</code>
                    </pre>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
