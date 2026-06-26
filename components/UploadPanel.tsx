"use client";

import { useRef } from "react";
import { Upload, FileText, Zap, X } from "lucide-react";
import { Card, CardHeader, Tag } from "./ui";

interface UploadPanelProps {
  uploadedFile: File | null;
  isDragging: boolean;
  isExtracting: boolean;
  extracted: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  onExtract: () => void;
}

export function UploadPanel({
  uploadedFile,
  isDragging,
  isExtracting,
  extracted,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInput,
  onClearFile,
  onExtract,
}: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader bg="#d4f0e4">
        <FileText size={16} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", letterSpacing: "0.05em" }}>
          UPLOAD FILE
        </span>
        <Tag bg="#000" color="#d4f0e4" style={{ marginLeft: "auto" }}>
          PDF · DOC · PPTX
        </Tag>
      </CardHeader>

      <div
        style={{
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          fontFamily: "var(--font-body)",
        }}
      >
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
          onDragLeave={onDragLeave}
          onClick={() => !uploadedFile && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Area upload file — seret file ke sini atau klik untuk memilih"
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploadedFile) {
              fileInputRef.current?.click();
            }
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
          {/* Corner dots */}
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <div
              key={c}
              style={{
                position: "absolute",
                width: "14px",
                height: "14px",
                backgroundColor: "#ffe8a3",
                border: "2px solid #000",
                borderRadius: "3px",
                top:    c[0] === "t" ? "-3px" : "auto",
                bottom: c[0] === "b" ? "-3px" : "auto",
                left:   c[1] === "l" ? "-3px" : "auto",
                right:  c[1] === "r" ? "-3px" : "auto",
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
                  width: "clamp(72px, 12vw, 96px)",
                  height: "clamp(72px, 12vw, 96px)",
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
                    fontSize: "clamp(1.2rem, 3.5vw, 1.6rem)",
                    letterSpacing: "0.04em",
                    lineHeight: 1.25,
                    margin: 0,
                  }}
                >
                  Jatuhkan dokumenmu di sini!
                </p>
                <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#555", marginTop: "5px", marginBottom: 0 }}>
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
                Maks. 50MB · PDF, DOC, DOCX, PPTX, XLSX, MD, IPYNB
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
                  maxWidth: "360px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#000",
                    borderRadius: "8px",
                    padding: "9px",
                    flexShrink: 0,
                  }}
                >
                  <FileText size={22} color="#d4f0e4" />
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
                  <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#444", margin: 0 }}>
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearFile();
                  }}
                  aria-label="Hapus file"
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
                  <X size={15} color="#fff" />
                </button>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.15rem",
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
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.pptx,.ppt,.xlsx,.xls,.txt,.md,.html,.ipynb,.tex"
            onChange={onFileInput}
            style={{ display: "none" }}
          />
        </div>

        {/* Extract button */}
        <button
          onClick={onExtract}
          disabled={!uploadedFile || isExtracting}
          aria-label={extracted ? "Ekstrak ulang kode" : "Ekstrak kode dari file"}
          style={{
            marginTop: "12px",
            width: "100%",
            backgroundColor: uploadedFile ? "#000" : "#ccc",
            color: uploadedFile ? "#ffe8a3" : "#888",
            border: "3px solid #000",
            borderRadius: "10px",
            padding: "14px",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.1rem, 3vw, 1.4rem)",
            letterSpacing: "0.06em",
            cursor: uploadedFile && !isExtracting ? "pointer" : "not-allowed",
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
              (e.currentTarget as HTMLButtonElement).style.transform = "translate(3px,3px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "2px 2px 0 #ff6b6b";
            }
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = uploadedFile
              ? "5px 5px 0 #ff6b6b"
              : "none";
          }}
        >
          {isExtracting ? (
            <>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: "3px solid #ffe8a3",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              SEDANG MENGEKSTRAK...
            </>
          ) : (
            <>
              <Zap size={22} fill={uploadedFile ? "#ffe8a3" : "#888"} />
              {extracted ? "EKSTRAK ULANG!" : "EKSTRAK KODE!"}
            </>
          )}
        </button>
      </div>
    </Card>
  );
}
