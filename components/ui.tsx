import React from "react";

/* ── Card ── */
interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Card({ children, style = {}, className }: CardProps) {
  return (
    <div
      className={className}
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

/* ── CardHeader ── */
interface CardHeaderProps {
  bg: string;
  children: React.ReactNode;
}

export function CardHeader({ bg, children }: CardHeaderProps) {
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

/* ── Tag ── */
interface TagProps {
  bg?: string;
  color?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Tag({ bg = "#ffe8a3", color = "#000", children, style }: TagProps) {
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
        ...style,
      }}
    >
      {children}
    </span>
  );
}
