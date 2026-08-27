"use client";

import { Zap, Bell, User } from "lucide-react";

export function Header() {
  return (
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
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <div
          style={{
            backgroundColor: "#000",
            border: "3px solid #000",
            borderRadius: "8px",
            padding: "4px 7px",
            boxShadow: "3px 3px 0 #ff6b6b",
            flexShrink: 0,
          }}
        >
          <Zap size={18} color="#ffe8a3" fill="#ffe8a3" />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.5rem, 5vw, 2.2rem)",
            letterSpacing: "0.05em",
            lineHeight: 1,
            color: "#000",
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

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {/* Bell — hidden on mobile via CSS class */}
        <button
          className="bell-btn"
          aria-label="Notifikasi"
          style={{
            backgroundColor: "#d4f0e4",
            border: "3px solid #000",
            borderRadius: "8px",
            padding: "6px 9px",
            boxShadow: "3px 3px 0 #000",
            cursor: "pointer",
            alignItems: "center",
            gap: "4px",
            position: "relative",
          }}
        >
          <Bell size={16} />
          <span
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              backgroundColor: "#ff6b6b",
              border: "2px solid #000",
              borderRadius: "50%",
              width: "17px",
              height: "17px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.6rem",
              color: "#fff",
              fontWeight: 900,
            }}
          >
            3
          </span>
        </button>

        {/* Profile */}
        <div
          style={{
            backgroundColor: "#f5f0ff",
            border: "3px solid #000",
            borderRadius: "10px",
            padding: "5px 12px",
            boxShadow: "3px 3px 0 #000",
            display: "flex",
            alignItems: "center",
            gap: "7px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              backgroundColor: "#ff6b6b",
              border: "2px solid #000",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <User size={14} color="#fff" />
          </div>
          <div className="profile-text">
            <p style={{ fontSize: "0.72rem", fontWeight: 900, lineHeight: 1.1, margin: 0 }}>
              Budi_Dev
            </p>
            <p style={{ fontSize: "0.62rem", fontWeight: 700, color: "#555", lineHeight: 1.1, margin: 0 }}>
              Pro Plan
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
