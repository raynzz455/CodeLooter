"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, listSnippets, deleteSnippet, type SnippetListItem } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(getUser());
  const [snippets, setSnippets] = useState<SnippetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    loadSnippets();
  }, [user, router]);

  const loadSnippets = async () => {
    setLoading(true);
    try {
      const data = await listSnippets();
      setSnippets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat snippet");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Hapus snippet "${filename}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteSnippet(id);
      setSnippets(snippets.filter((s) => s.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  if (!user) return null;

  return (
    <div style={{ backgroundColor: "#fef9f0", minHeight: "100vh", fontFamily: "var(--font-body)" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#ffe8a3", borderBottom: "3px solid #000", boxShadow: "0 5px 0 #000", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", letterSpacing: "0.05em", margin: 0, textShadow: "3px 3px 0 #ff6b6b" }}>
          CodeLooter! 📂
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>👋 {user.name || user.email}</span>
          <button onClick={() => router.push("/")}
            style={{ backgroundColor: "#fff", border: "2px solid #000", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontWeight: 800, fontSize: "0.85rem", boxShadow: "2px 2px 0 #000" }}>
            🏠 Home
          </button>
          <button onClick={handleLogout}
            style={{ backgroundColor: "#ff6b6b", color: "#fff", border: "2px solid #000", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontWeight: 800, fontSize: "0.85rem", boxShadow: "2px 2px 0 #000" }}>
            🚪 Keluar
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", letterSpacing: "0.04em", margin: "0 0 8px 0" }}>
            📚 Snippet Kamu
          </h2>
          <p style={{ fontWeight: 700, color: "#555", margin: 0, fontSize: "0.88rem" }}>
            Hasil ekstraksi kode yang tersimpan. File asli TIDAK disimpan — hanya nama file + text kode.
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px", fontWeight: 800, color: "#888" }}>
            ⏳ Memuat snippet...
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: "#ffd6d6", border: "3px solid #000", borderRadius: "10px", padding: "16px", fontWeight: 800, color: "#cc2222", boxShadow: "4px 4px 0 #000" }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && snippets.length === 0 && (
          <div style={{ backgroundColor: "#fff", border: "3px dashed #000", borderRadius: "16px", padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "3rem", margin: "0 0 12px 0", opacity: 0.5 }}>📭</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", margin: "0 0 6px 0" }}>Belum ada snippet</p>
            <p style={{ fontWeight: 700, color: "#555", fontSize: "0.9rem", margin: "0 0 20px 0" }}>
              Upload file & simpan hasil ekstraksi untuk menyimpannya di sini
            </p>
            <button onClick={() => router.push("/")}
              style={{ backgroundColor: "#000", color: "#ffe8a3", border: "3px solid #000", borderRadius: "10px", padding: "12px 24px", fontFamily: "var(--font-display)", fontSize: "1.1rem", cursor: "pointer", boxShadow: "4px 4px 0 #ff6b6b" }}>
              🚀 Mulai Ekstrak
            </button>
          </div>
        )}

        {!loading && snippets.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {snippets.map((s) => (
              <div key={s.id}
                style={{ backgroundColor: "#fff", border: "3px solid #000", borderRadius: "12px", boxShadow: "4px 4px 0 #000", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 900, fontSize: "1rem", margin: "0 0 4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    📄 {s.filename}
                  </p>
                  <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#666", margin: 0 }}>
                    {s.total_blocks} blok kode • {new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button onClick={() => router.push(`/snippets/${s.id}`)}
                    style={{ backgroundColor: "#d4f0e4", border: "2px solid #000", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontWeight: 900, fontSize: "0.82rem", boxShadow: "2px 2px 0 #000" }}>
                    👁️ Lihat
                  </button>
                  <button onClick={() => handleDelete(s.id, s.filename)}
                    style={{ backgroundColor: "#ffd6d6", border: "2px solid #000", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 900, fontSize: "0.82rem", boxShadow: "2px 2px 0 #000" }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
