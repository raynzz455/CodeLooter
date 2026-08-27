import { FileText } from "lucide-react";
import { Tag } from "./ui";
import { RECENT_FILES } from "./data";

export function RecentFiles() {
  return (
    <div
      style={{
        marginTop: "16px",
        backgroundColor: "#fff",
        border: "3px solid #000",
        borderRadius: "16px",
        boxShadow: "5px 5px 0 #000",
        overflow: "hidden",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Section header */}
      <div
        style={{
          backgroundColor: "#ffe0d0",
          borderBottom: "3px solid #000",
          padding: "11px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", letterSpacing: "0.05em" }}>
          📂 FILE TERBARU
        </span>
        <Tag bg="#000" color="#ffe0d0" style={{ marginLeft: "auto" }}>
          5 TERAKHIR
        </Tag>
      </div>

      {/* ── DESKTOP: table ── */}
      <div className="recent-table" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
          <thead>
            <tr style={{ backgroundColor: "#fef9f0" }}>
              {["Nama File", "Jenis", "Bahasa", "Status", "Tanggal", "Aksi"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "9px 14px",
                    textAlign: "left",
                    fontWeight: 900,
                    fontSize: "0.72rem",
                    borderBottom: "2px solid #000",
                    whiteSpace: "nowrap",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECENT_FILES.map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: i < RECENT_FILES.length - 1 ? "2px solid #eee" : "none",
                  transition: "background-color 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#fef9f0";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "";
                }}
              >
                {/* Nama file */}
                <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: "0.82rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileText size={13} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "180px",
                        display: "inline-block",
                      }}
                    >
                      {row.nama}
                    </span>
                  </span>
                </td>
                {/* Jenis */}
                <td style={{ padding: "9px 14px" }}>
                  <Tag>{row.jenis}</Tag>
                </td>
                {/* Bahasa */}
                <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: "0.82rem" }}>
                  {row.bahasa}
                </td>
                {/* Status */}
                <td style={{ padding: "9px 14px" }}>
                  <Tag bg={row.ok ? "#d4f0e4" : "#ffd6d6"}>
                    {row.ok ? "✅ " : "❌ "}
                    {row.status}
                  </Tag>
                </td>
                {/* Tanggal */}
                <td
                  style={{
                    padding: "9px 14px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    color: "#555",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.tgl}
                </td>
                {/* Aksi */}
                <td style={{ padding: "9px 14px" }}>
                  <button
                    style={{
                      backgroundColor: "#f5f0ff",
                      border: "2px solid #000",
                      borderRadius: "8px",
                      padding: "4px 12px",
                      fontSize: "0.72rem",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "2px 2px 0 #000",
                      fontFamily: "var(--font-body)",
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translate(1px,1px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "1px 1px 0 #000";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "";
                      (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #000";
                    }}
                  >
                    Lihat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE: cards ── */}
      <div className="recent-cards">
        {RECENT_FILES.map((row, i) => (
          <div
            key={i}
            style={{
              border: "2px solid #000",
              borderRadius: "10px",
              overflow: "hidden",
              boxShadow: "3px 3px 0 #000",
            }}
          >
            {/* Card header row */}
            <div
              style={{
                backgroundColor: row.ok ? "#d4f0e4" : "#ffd6d6",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "2px solid #000",
              }}
            >
              <span
                style={{
                  fontWeight: 900,
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileText size={13} />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "180px",
                    display: "inline-block",
                  }}
                >
                  {row.nama}
                </span>
              </span>
              <Tag bg={row.ok ? "#d4f0e4" : "#ffd6d6"}>
                {row.ok ? "✅" : "❌"} {row.status}
              </Tag>
            </div>
            {/* Card body row */}
            <div
              style={{
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#fef9f0",
              }}
            >
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <Tag>{row.jenis}</Tag>
                <span style={{ fontWeight: 800, fontSize: "0.78rem" }}>{row.bahasa}</span>
                <span style={{ fontSize: "0.72rem", color: "#666", fontWeight: 700 }}>{row.tgl}</span>
              </div>
              <button
                style={{
                  backgroundColor: "#f5f0ff",
                  border: "2px solid #000",
                  borderRadius: "7px",
                  padding: "4px 10px",
                  fontSize: "0.72rem",
                  fontWeight: 900,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Lihat
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
