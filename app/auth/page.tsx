"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, register, getUser } from "@/lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getUser()) router.push("/dashboard");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        if (password.length < 8) {
          setError("Password minimal 8 karakter");
          setLoading(false);
          return;
        }
        await register(email, password, name || undefined);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "3px solid #000", borderRadius: "8px",
    padding: "12px", fontFamily: "var(--font-body)", fontWeight: 700,
    fontSize: "0.95rem", backgroundColor: "#fef9f0", boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div style={{ backgroundColor: "#fef9f0", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "var(--font-body)" }}>
      <div style={{ backgroundColor: "#fff", border: "3px solid #000", borderRadius: "20px", boxShadow: "8px 8px 0 #000", width: "100%", maxWidth: "420px", overflow: "hidden" }}>
        <div style={{ backgroundColor: "#ffe8a3", borderBottom: "3px solid #000", padding: "20px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", letterSpacing: "0.05em", margin: 0, textShadow: "3px 3px 0 #ff6b6b" }}>
            CodeLooter!
          </h1>
          <p style={{ fontWeight: 800, color: "#555", marginTop: "6px", marginBottom: 0, fontSize: "0.85rem" }}>
            {mode === "login" ? "Masuk untuk menyimpan snippet kode" : "Daftar akun baru"}
          </p>
        </div>

        <div style={{ display: "flex", borderBottom: "3px solid #000" }}>
          {(["login", "register"] as const).map((t) => (
            <button key={t} onClick={() => { setMode(t); setError(null); }}
              style={{ flex: 1, padding: "14px", fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.05em",
                backgroundColor: mode === t ? "#f5f0ff" : "#fef9f0", border: "none",
                borderRight: t === "login" ? "3px solid #000" : "none", cursor: "pointer", fontWeight: 900 }}>
              {t === "login" ? "🔑 MASUK" : "✨ DAFTAR"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {mode === "register" && (
            <div>
              <label style={{ display: "block", fontWeight: 900, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Nama (opsional)</label>
              <input style={inputStyle} placeholder="Nama kamu" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label style={{ display: "block", fontWeight: 900, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Email</label>
            <input style={inputStyle} type="email" placeholder="kamu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 900, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Password {mode === "register" && "(min. 8 karakter)"}</label>
            <input style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && (
            <div style={{ backgroundColor: "#ffd6d6", border: "2px solid #000", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, fontSize: "0.85rem", color: "#cc2222" }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ marginTop: "8px", width: "100%", backgroundColor: "#000", color: "#ffe8a3",
              border: "3px solid #000", borderRadius: "10px", padding: "14px",
              fontFamily: "var(--font-display)", fontSize: "1.25rem", letterSpacing: "0.06em",
              cursor: loading ? "not-allowed" : "pointer", boxShadow: "5px 5px 0 #ff6b6b" }}>
            {loading ? "MEMPROSES..." : (mode === "login" ? "MASUK SEKARANG!" : "DAFTAR SEKARANG!")}
          </button>

          <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#777", textAlign: "center", margin: "8px 0 0 0" }}>
            💾 Hanya user login yang bisa simpan snippet ke DB
          </p>
        </form>
      </div>
    </div>
  );
}
