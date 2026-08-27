"use client";

import { useState } from "react";
import { LogIn, UserPlus, X } from "lucide-react";

interface AuthModalProps {
  onClose: () => void;
  onSignIn: (name: string) => void;
}

export function AuthModal({ onClose, onSignIn }: AuthModalProps) {
  const [tab, setTab]     = useState<"masuk" | "daftar">("masuk");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");

  const handle = () => {
    const displayName = name.trim() || email.split("@")[0] || "Pengguna";
    onSignIn(displayName);
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "3px solid #000", borderRadius: "8px",
    padding: "10px 12px", fontFamily: "var(--font-body)",
    fontWeight: 800, fontSize: "0.88rem", backgroundColor: "#fef9f0",
    boxSizing: "border-box", outline: "none",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", border: "3px solid #000", borderRadius: "20px", boxShadow: "8px 8px 0 #000", width: "100%", maxWidth: "380px", overflow: "hidden", animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        {/* header */}
        <div style={{ backgroundColor: "#ffe8a3", borderBottom: "3px solid #000", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #000", borderRadius: "8px", overflow: "hidden", boxShadow: "2px 2px 0 #000", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", letterSpacing: "0.05em" }}>CodeLooter!</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", borderBottom: "3px solid #000" }}>
          {(["masuk", "daftar"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "11px", fontFamily: "var(--font-display)",
              fontSize: "1.05rem", letterSpacing: "0.05em",
              backgroundColor: tab === t ? "#f5f0ff" : "#fef9f0",
              border: "none", borderRight: t === "masuk" ? "3px solid #000" : "none",
              cursor: "pointer", fontWeight: 900,
            }}>
              {t === "masuk" ? "🔑 Masuk" : "✨ Daftar"}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {tab === "daftar" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontWeight: 900, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nama</label>
              <input style={inputStyle} placeholder="Nama kamu" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontWeight: 900, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
            <input style={inputStyle} type="email" placeholder="kamu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontWeight: 900, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
            <input style={inputStyle} type="password" placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
          <button
            onClick={handle}
            style={{
              marginTop: "4px", width: "100%",
              backgroundColor: "#000", color: "#ffe8a3",
              border: "3px solid #000", borderRadius: "10px",
              padding: "13px", fontFamily: "var(--font-display)",
              fontSize: "1.25rem", letterSpacing: "0.06em",
              cursor: "pointer", boxShadow: "5px 5px 0 #ff6b6b",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(3px,3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #ff6b6b"; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "5px 5px 0 #ff6b6b"; }}
          >
            {tab === "masuk" ? <><LogIn size={18} /> MASUK SEKARANG!</> : <><UserPlus size={18} /> DAFTAR SEKARANG!</>}
          </button>
        </div>
      </div>
    </div>
  );
}
