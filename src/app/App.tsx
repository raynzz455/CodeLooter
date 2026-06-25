import { useState, useRef, useCallback } from "react";
import { Upload, Copy, Check, ChevronDown, Zap, FileText, User, Bell, Code2, X } from "lucide-react";

const LANGUAGES = [
  { id: "python",     label: "Python",     emoji: "🐍", color: "#d4f0e4" },
  { id: "r",          label: "R Code",     emoji: "📊", color: "#f5f0ff" },
  { id: "javascript", label: "JavaScript", emoji: "⚡", color: "#ffe8a3" },
  { id: "typescript", label: "TypeScript", emoji: "🔷", color: "#ffe0d0" },
  { id: "java",       label: "Java",       emoji: "☕", color: "#ffd6e0" },
  { id: "cpp",        label: "C++",        emoji: "⚙️", color: "#d0f0ff" },
  { id: "sql",        label: "SQL",        emoji: "🗃️", color: "#e8d4f0" },
  { id: "kotlin",     label: "Kotlin",     emoji: "🟣", color: "#d4f0e4" },
];

const SAMPLE_CODES: Record<string, string> = {
  python: `# === KODE PYTHON BERHASIL DIEKSTRAK! ===
# Sumber: analisis_data_penjualan.pdf

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def hitung_total_penjualan(data: pd.DataFrame) -> float:
    """Menghitung total penjualan dari dataframe."""
    return data['harga'].mul(data['jumlah']).sum()

def visualisasi_tren(df: pd.DataFrame):
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(df['tanggal'], df['penjualan'],
            color='#2ecc71', linewidth=2.5,
            marker='o', markersize=6)
    ax.set_title('Tren Penjualan Bulanan', fontsize=16)
    ax.set_xlabel('Tanggal')
    ax.set_ylabel('Total Penjualan (Rp)')
    plt.tight_layout()
    plt.show()

# Muat dataset
df = pd.read_csv('penjualan_2024.csv')
df['tanggal'] = pd.to_datetime(df['tanggal'])

total = hitung_total_penjualan(df)
print(f"Total Penjualan: Rp {total:,.0f}")
visualisasi_tren(df)`,

  r: `# === KODE R BERHASIL DIEKSTRAK! ===
# Sumber: laporan_statistik.pdf

library(tidyverse)
library(ggplot2)
library(readxl)

data_penjualan <- read_excel("data_2024.xlsx", sheet = "Penjualan")

ringkasan <- data_penjualan %>%
  group_by(kategori) %>%
  summarise(
    total     = sum(nilai, na.rm = TRUE),
    rata_rata = mean(nilai, na.rm = TRUE),
    maks      = max(nilai, na.rm = TRUE)
  ) %>%
  arrange(desc(total))

ggplot(ringkasan, aes(x = reorder(kategori, total),
                       y = total, fill = kategori)) +
  geom_col(color = "black", linewidth = 0.8) +
  coord_flip() +
  labs(title = "Penjualan per Kategori",
       x = "Kategori", y = "Total (Rp)") +
  theme_minimal() +
  theme(legend.position = "none")`,

  javascript: `// === KODE JAVASCRIPT BERHASIL DIEKSTRAK! ===
// Sumber: dokumentasi_api.pdf

const hitungDiskon = (harga, persen) => {
  if (persen < 0 || persen > 100)
    throw new Error('Persentase diskon tidak valid!');
  return harga - (harga * persen / 100);
};

class KeranjangBelanja {
  constructor() { this.items = []; this.diskon = 0; }

  tambahItem(nama, harga, jumlah = 1) {
    const existing = this.items.find(i => i.nama === nama);
    if (existing) existing.jumlah += jumlah;
    else this.items.push({ nama, harga, jumlah });
    return this;
  }

  hitungTotal() {
    const sub = this.items.reduce(
      (acc, item) => acc + item.harga * item.jumlah, 0
    );
    return hitungDiskon(sub, this.diskon);
  }

  formatRupiah(n) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR'
    }).format(n);
  }
}

const keranjang = new KeranjangBelanja();
keranjang.tambahItem('Laptop', 15000000)
         .tambahItem('Mouse', 350000, 2);
keranjang.diskon = 10;
console.log('Total:', keranjang.formatRupiah(keranjang.hitungTotal()));`,

  typescript: `// === KODE TYPESCRIPT BERHASIL DIEKSTRAK! ===
// Sumber: spesifikasi_sistem.pdf

interface Produk {
  id: string;
  nama: string;
  harga: number;
  stok: number;
  kategori: 'elektronik' | 'fashion' | 'makanan';
}

type FilterProduk = Partial<Pick<Produk, 'kategori'>> & {
  hargaMin?: number;
  hargaMaks?: number;
};

async function cariProduk(
  query: string,
  filter: FilterProduk = {},
  halaman = 1
): Promise<{ produk: Produk[]; total: number }> {
  const params = new URLSearchParams({ q: query, page: String(halaman) });
  const res = await fetch(\`/api/produk?\${params}\`);
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  return res.json();
}`,

  java: `// === KODE JAVA BERHASIL DIEKSTRAK! ===
// Sumber: panduan_pemrograman.pdf

import java.util.*;
import java.util.stream.*;

public class ManajemenInventaris {
    private final Map<String, Integer> stok = new HashMap<>();

    public void tambahBarang(String nama, int jumlah) {
        stok.merge(nama, jumlah, Integer::sum);
        System.out.printf("Ditambahkan: %s (+%d)%n", nama, jumlah);
    }

    public boolean kurangiStok(String nama, int jumlah) {
        int stokSaat = stok.getOrDefault(nama, 0);
        if (stokSaat < jumlah) {
            System.out.println("Stok tidak mencukupi!");
            return false;
        }
        stok.put(nama, stokSaat - jumlah);
        return true;
    }

    public List<String> barangHampirHabis(int batas) {
        return stok.entrySet().stream()
            .filter(e -> e.getValue() <= batas)
            .map(Map.Entry::getKey)
            .sorted()
            .collect(Collectors.toList());
    }
}`,

  cpp: `// === KODE C++ BERHASIL DIEKSTRAK! ===
// Sumber: algoritma_komputer.pdf

#include <iostream>
#include <vector>
#include <string>

template<typename T>
class TumpukanGenerik {
    std::vector<T> data;
public:
    void masukkan(const T& nilai) {
        data.push_back(nilai);
        std::cout << "Masuk: " << nilai << "\\n";
    }
    T keluarkan() {
        if (data.empty())
            throw std::underflow_error("Tumpukan kosong!");
        T atas = data.back();
        data.pop_back();
        return atas;
    }
    bool kosong() const { return data.empty(); }
    void tampilkan() const {
        for (auto it = data.rbegin(); it != data.rend(); ++it)
            std::cout << "[" << *it << "] ";
        std::cout << "\\n";
    }
};

int main() {
    TumpukanGenerik<std::string> ts;
    ts.masukkan("Indonesia");
    ts.masukkan("Raya");
    ts.tampilkan();
    std::cout << "Keluar: " << ts.keluarkan() << "\\n";
}`,

  sql: `-- === KODE SQL BERHASIL DIEKSTRAK! ===
-- Sumber: skema_database.pdf

CREATE TABLE pelanggan (
    id             SERIAL PRIMARY KEY,
    nama           VARCHAR(100) NOT NULL,
    email          VARCHAR(150) UNIQUE NOT NULL,
    kota           VARCHAR(50),
    tanggal_daftar DATE DEFAULT CURRENT_DATE
);

CREATE TABLE pesanan (
    id           SERIAL PRIMARY KEY,
    id_pelanggan INT REFERENCES pelanggan(id),
    total        DECIMAL(15,2) NOT NULL,
    status       VARCHAR(20) DEFAULT 'menunggu',
    dibuat_pada  TIMESTAMP DEFAULT NOW()
);

SELECT
    p.kota,
    COUNT(DISTINCT p.id)  AS jumlah_pelanggan,
    COUNT(o.id)           AS jumlah_pesanan,
    SUM(o.total)          AS total_penjualan,
    AVG(o.total)          AS rata_rata_pesanan
FROM pelanggan p
LEFT JOIN pesanan o
    ON p.id = o.id_pelanggan AND o.status = 'selesai'
WHERE p.tanggal_daftar >= '2024-01-01'
GROUP BY p.kota
ORDER BY total_penjualan DESC NULLS LAST
LIMIT 10;`,

  kotlin: `// === KODE KOTLIN BERHASIL DIEKSTRAK! ===
// Sumber: panduan_android.pdf

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class Pengguna(val id: Int, val nama: String, val email: String)

class RepositoriPengguna {
    private val daftar = mutableListOf<Pengguna>()

    fun tambah(p: Pengguna) {
        daftar.add(p)
        println("✅ Ditambahkan: \${p.nama}")
    }

    fun cari(query: String) =
        daftar.filter { it.nama.contains(query, ignoreCase = true) }

    fun aliran(): Flow<Pengguna> = flow {
        daftar.forEach { delay(100); emit(it) }
    }
}

fun main() = runBlocking {
    val repo = RepositoriPengguna()
    repo.tambah(Pengguna(1, "Budi Santoso", "budi@email.com"))
    repo.tambah(Pengguna(2, "Siti Rahayu", "siti@email.com"))
    repo.cari("budi").forEach { println("- \${it.nama}") }
    repo.aliran().collect { println("📌 \${it.nama}") }
}`,
};

const RECENT_FILES = [
  { nama: "laporan_keuangan_q4.pdf",    jenis: "PDF",  bahasa: "Python",     status: "Selesai", tgl: "24 Jun 2026", ok: true  },
  { nama: "tutorial_analisis_data.docx",jenis: "DOCX", bahasa: "R Code",     status: "Selesai", tgl: "23 Jun 2026", ok: true  },
  { nama: "spesifikasi_api_v2.pdf",     jenis: "PDF",  bahasa: "JavaScript", status: "Selesai", tgl: "22 Jun 2026", ok: true  },
  { nama: "panduan_backend.pdf",        jenis: "PDF",  bahasa: "Java",       status: "Gagal",   tgl: "21 Jun 2026", ok: false },
  { nama: "skema_database.docx",        jenis: "DOCX", bahasa: "SQL",        status: "Selesai", tgl: "20 Jun 2026", ok: true  },
];

const STATS = [
  { label: "File Diproses",   val: "1,247", color: "#d4f0e4" },
  { label: "Kode Diekstrak",  val: "8,903", color: "#ffe8a3" },
  { label: "Bahasa Didukung", val: "8",     color: "#f5f0ff" },
  { label: "Akurasi",         val: "97.2%", color: "#ffe0d0" },
];

/* ─── reusable neo-brutalist card shell ─── */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
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

function CardHeader({ bg, children }: { bg: string; children: React.ReactNode }) {
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

function Tag({ bg = "#ffe8a3", color = "#000", children }: { bg?: string; color?: string; children: React.ReactNode }) {
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
      }}
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════ */
export default function App() {
  const [selectedLang, setSelectedLang] = useState("python");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging]     = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted]       = useState(false);
  const [copied, setCopied]             = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "application/pdf" || /\.docx?$/.test(file.name))) {
      setUploadedFile(file);
      setExtracted(false);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setUploadedFile(file); setExtracted(false); }
  };

  const handleExtract = () => {
    if (!uploadedFile) return;
    setIsExtracting(true);
    setTimeout(() => { setIsExtracting(false); setExtracted(true); }, 1800);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(SAMPLE_CODES[selectedLang] || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentLang = LANGUAGES.find((l) => l.id === selectedLang)!;

  return (
    <div style={{ backgroundColor: "#fef9f0", fontFamily: "'Nunito', sans-serif", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
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
              fontFamily: "'Bangers', cursive",
              fontSize: "clamp(1.5rem, 5vw, 2.2rem)",
              letterSpacing: "0.05em",
              lineHeight: 1,
              color: "#000",
              textShadow: "3px 3px 0 #ff6b6b",
              whiteSpace: "nowrap",
            }}
          >
            CodeSniper!
          </h1>
          <div
            style={{
              backgroundColor: "#ff6b6b",
              border: "2px solid #000",
              borderRadius: "6px",
              padding: "1px 7px",
              fontFamily: "'Bangers', cursive",
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
          {/* Bell — hidden on very small screens via inline media trick with a wrapper */}
          <button
            className="bell-btn"
            style={{
              backgroundColor: "#d4f0e4",
              border: "3px solid #000",
              borderRadius: "8px",
              padding: "6px 9px",
              boxShadow: "3px 3px 0 #000",
              cursor: "pointer",
              display: "flex",
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
              <p style={{ fontSize: "0.72rem", fontWeight: 900, lineHeight: 1.1 }}>Budi_Dev</p>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, color: "#555", lineHeight: 1.1 }}>Pro Plan</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}>

        {/* STATS STRIP */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "10px",
            marginBottom: "16px",
          }}
          className="stats-grid"
        >
          {STATS.map((s) => (
            <div
              key={s.label}
              style={{
                backgroundColor: s.color,
                border: "3px solid #000",
                borderRadius: "10px",
                padding: "10px 14px",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <p style={{ fontSize: "clamp(1.2rem,4vw,1.6rem)", fontFamily: "'Bangers', cursive", letterSpacing: "0.04em", lineHeight: 1 }}>
                {s.val}
              </p>
              <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "#333", marginTop: "2px" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* THREE-COLUMN GRID (desktop) / stacked (mobile) */}
        <div className="main-grid">

          {/* ── COL 1: PILIH BAHASA ── */}
          <Card>
            <CardHeader bg="#ffe8a3">
              <Code2 size={16} />
              <span style={{ fontFamily: "'Bangers', cursive", fontSize: "1.15rem", letterSpacing: "0.05em" }}>
                PILIH BAHASA
              </span>
            </CardHeader>

            <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflow: "hidden" }}>
              {/* Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{
                    width: "100%",
                    backgroundColor: currentLang.color,
                    border: "3px solid #000",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    boxShadow: "4px 4px 0 #000",
                    fontWeight: 900,
                    fontSize: "0.95rem",
                    fontFamily: "'Nunito', sans-serif",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>{currentLang.emoji}</span>
                    {currentLang.label}
                  </span>
                  <ChevronDown
                    size={18}
                    style={{ transform: dropdownOpen ? "rotate(180deg)" : "", transition: "transform 0.2s", flexShrink: 0 }}
                  />
                </button>

                {dropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      backgroundColor: "#fff",
                      border: "3px solid #000",
                      borderRadius: "10px",
                      boxShadow: "5px 5px 0 #000",
                      zIndex: 30,
                      overflow: "hidden",
                    }}
                  >
                    {LANGUAGES.map((lang, idx) => (
                      <button
                        key={lang.id}
                        onClick={() => { setSelectedLang(lang.id); setDropdownOpen(false); }}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          backgroundColor: lang.id === selectedLang ? lang.color : "#fff",
                          border: "none",
                          borderBottom: idx < LANGUAGES.length - 1 ? "2px solid #000" : "none",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontWeight: 800,
                          fontSize: "0.88rem",
                          fontFamily: "'Nunito', sans-serif",
                          transition: "background-color 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (lang.id !== selectedLang)
                            (e.currentTarget as HTMLElement).style.backgroundColor = "#fef9f0";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            lang.id === selectedLang ? lang.color : "#fff";
                        }}
                      >
                        <span>{lang.emoji}</span>
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Language info card */}
              <div
                style={{
                  backgroundColor: currentLang.color,
                  border: "2px solid #000",
                  borderRadius: "10px",
                  padding: "12px",
                  marginTop: "4px",
                }}
              >
                <p style={{ fontFamily: "'Bangers', cursive", fontSize: "1.3rem", letterSpacing: "0.04em", lineHeight: 1 }}>
                  {currentLang.emoji} {currentLang.label}
                </p>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#444", marginTop: "4px" }}>
                  Bahasa terpilih untuk ekstraksi kode dari dokumen Anda.
                </p>
              </div>

              {/* Tip */}
              <div
                style={{
                  backgroundColor: "#fef9f0",
                  border: "2px dashed #000",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginTop: "auto",
                }}
              >
                <p style={{ fontSize: "0.72rem", fontWeight: 800, color: "#555", lineHeight: 1.5 }}>
                  💡 <strong>Tips:</strong> Pilih bahasa yang sesuai dengan kode dalam dokumen agar hasil ekstraksi lebih akurat!
                </p>
              </div>
            </div>
          </Card>

          {/* ── COL 2: UPLOAD FILE (CENTER) ── */}
          <Card>
            <CardHeader bg="#d4f0e4">
              <FileText size={16} />
              <span style={{ fontFamily: "'Bangers', cursive", fontSize: "1.15rem", letterSpacing: "0.05em" }}>
                UPLOAD FILE
              </span>
              <Tag bg="#000" color="#d4f0e4" style={{ marginLeft: "auto" } as React.CSSProperties}>PDF · DOC</Tag>
            </CardHeader>

            <div style={{ padding: "14px", display: "flex", flexDirection: "column", flex: 1 }}>
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => !uploadedFile && fileInputRef.current?.click()}
                style={{
                  backgroundColor: isDragging ? "#b8e8d0" : "#fef9f0",
                  border: `3px dashed #000`,
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
                {(["tl","tr","bl","br"] as const).map((c) => (
                  <div key={c} style={{
                    position: "absolute",
                    width: "14px", height: "14px",
                    backgroundColor: "#ffe8a3",
                    border: "2px solid #000",
                    borderRadius: "3px",
                    top:    c[0]==="t" ? "-3px" : "auto",
                    bottom: c[0]==="b" ? "-3px" : "auto",
                    left:   c[1]==="l" ? "-3px" : "auto",
                    right:  c[1]==="r" ? "-3px" : "auto",
                  }} />
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
                      <p style={{
                        fontFamily: "'Bangers', cursive",
                        fontSize: "clamp(1.2rem, 3.5vw, 1.6rem)",
                        letterSpacing: "0.04em",
                        lineHeight: 1.25,
                      }}>
                        Jatuhkan PDF/Word-mu di sini!
                      </p>
                      <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#555", marginTop: "5px" }}>
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
                      Maks. 50MB · PDF, DOC, DOCX
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
                      <div style={{ backgroundColor: "#000", borderRadius: "8px", padding: "9px", flexShrink: 0 }}>
                        <FileText size={22} color="#d4f0e4" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 900, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {uploadedFile.name}
                        </p>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#444" }}>
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setExtracted(false); }}
                        style={{
                          backgroundColor: "#ff6b6b",
                          border: "2px solid #000",
                          borderRadius: "6px",
                          padding: "5px",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <X size={15} color="#fff" />
                      </button>
                    </div>
                    <p style={{ fontFamily: "'Bangers', cursive", fontSize: "1.15rem", color: "#009944", letterSpacing: "0.03em" }}>
                      ✅ File siap diekstrak!
                    </p>
                  </>
                )}

                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileInput} style={{ display: "none" }} />
              </div>

              {/* Extract button */}
              <button
                onClick={handleExtract}
                disabled={!uploadedFile || isExtracting}
                style={{
                  marginTop: "12px",
                  width: "100%",
                  backgroundColor: uploadedFile ? "#000" : "#ccc",
                  color: uploadedFile ? "#ffe8a3" : "#888",
                  border: "3px solid #000",
                  borderRadius: "10px",
                  padding: "14px",
                  fontFamily: "'Bangers', cursive",
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
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = uploadedFile ? "5px 5px 0 #ff6b6b" : "none";
                }}
              >
                {isExtracting ? (
                  <>
                    <div style={{ width: "20px", height: "20px", border: "3px solid #ffe8a3", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
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

          {/* ── COL 3: HASIL EKSTRAKSI ── */}
          <Card>
            {/* Header */}
            <CardHeader bg="#f5f0ff">
              <div style={{ display: "flex", gap: "5px" }}>
                {["#ff6b6b","#ffe8a3","#d4f0e4"].map((c) => (
                  <div key={c} style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: c, border: "2px solid #000" }} />
                ))}
              </div>
              <span style={{ fontFamily: "'Bangers', cursive", fontSize: "1.15rem", letterSpacing: "0.05em", flex: 1 }}>
                HASIL EKSTRAKSI
              </span>
              <div style={{
                backgroundColor: extracted ? "#d4f0e4" : "#ffe8a3",
                border: "2px solid #000",
                borderRadius: "8px",
                padding: "2px 9px",
                fontSize: "0.68rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: extracted ? "#00aa44" : "#ffaa00", display: "inline-block" }} />
                {extracted ? "SIAP" : "MENUNGGU"}
              </div>
            </CardHeader>

            {/* Code area — fixed height, scrollable */}
            <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
              <div
                style={{
                  backgroundColor: "#1a1a2e",
                  height: "100%",
                  overflowY: "auto",
                  padding: "18px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.78rem",
                  lineHeight: "1.7",
                }}
              >
                {!extracted && !isExtracting && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", opacity: 0.5 }}>
                    <p style={{ fontFamily: "'Bangers', cursive", fontSize: "3rem", color: "#aaa" }}>???</p>
                    <p style={{ color: "#888", fontWeight: 700, textAlign: "center", fontSize: "0.85rem" }}>
                      Upload file &amp; klik EKSTRAK KODE! untuk memulai
                    </p>
                  </div>
                )}
                {isExtracting && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px" }}>
                    <p style={{ fontFamily: "'Bangers', cursive", fontSize: "1.8rem", color: "#ffe8a3", animation: "pulse 0.8s ease-in-out infinite alternate" }}>
                      MENGANALISIS FILE...
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[0,1,2,3,4].map((i) => (
                        <div key={i} style={{ width: "8px", height: "8px", backgroundColor: "#d4f0e4", borderRadius: "50%", animation: `bounce 0.6s ease-in-out ${i*0.1}s infinite alternate` }} />
                      ))}
                    </div>
                  </div>
                )}
                {extracted && (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#e8f4fd" }}>
                    <code>{SAMPLE_CODES[selectedLang]}</code>
                  </pre>
                )}
              </div>

              {/* FAB — Salin Kode */}
              {extracted && (
                <button
                  onClick={handleCopy}
                  style={{
                    position: "absolute",
                    bottom: "14px",
                    right: "14px",
                    backgroundColor: copied ? "#d4f0e4" : "#ff6b6b",
                    border: "3px solid #000",
                    borderRadius: "999px",
                    padding: "10px 18px",
                    fontFamily: "'Bangers', cursive",
                    fontSize: "1rem",
                    letterSpacing: "0.06em",
                    color: "#000",
                    cursor: "pointer",
                    boxShadow: copied ? "2px 2px 0 #000" : "5px 5px 0 #000",
                    transform: copied ? "translate(3px,3px)" : "",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    zIndex: 10,
                  }}
                  onMouseEnter={(e) => { if (!copied) { (e.currentTarget as HTMLElement).style.transform = "translate(2px,2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 #000"; } }}
                  onMouseLeave={(e) => { if (!copied) { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "5px 5px 0 #000"; } }}
                >
                  {copied ? <Check size={15} strokeWidth={3} /> : <Copy size={15} strokeWidth={2.5} />}
                  {copied ? "TERSALIN!" : "BOOM! Salin Kode"}
                </button>
              )}
            </div>

            {/* Footer */}
            {extracted && (
              <div style={{ backgroundColor: "#ffe0d0", borderTop: "3px solid #000", padding: "7px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 900 }}>
                  {currentLang.emoji} {currentLang.label} · {SAMPLE_CODES[selectedLang].split("\n").length} baris
                </span>
                <span style={{ fontSize: "0.7rem", fontWeight: 900, color: "#555" }}>
                  {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            )}
          </Card>

        </div>{/* /main-grid */}

        {/* ── RECENT FILES ── */}
        <div
          style={{
            marginTop: "16px",
            backgroundColor: "#fff",
            border: "3px solid #000",
            borderRadius: "16px",
            boxShadow: "5px 5px 0 #000",
            overflow: "hidden",
          }}
        >
          <div style={{ backgroundColor: "#ffe0d0", borderBottom: "3px solid #000", padding: "11px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontFamily: "'Bangers', cursive", fontSize: "1.2rem", letterSpacing: "0.05em" }}>
              📂 FILE TERBARU
            </span>
            <Tag bg="#000" color="#ffe0d0" style={{ marginLeft: "auto" } as React.CSSProperties}>5 TERAKHIR</Tag>
          </div>

          {/* Desktop table */}
          <div className="recent-table" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
              <thead>
                <tr style={{ backgroundColor: "#fef9f0" }}>
                  {["Nama File","Jenis","Bahasa","Status","Tanggal","Aksi"].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 900, fontSize: "0.72rem", borderBottom: "2px solid #000", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT_FILES.map((row, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: i < RECENT_FILES.length - 1 ? "2px solid #eee" : "none", transition: "background-color 0.1s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fef9f0"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                  >
                    <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: "0.82rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileText size={13} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px", display: "inline-block" }}>{row.nama}</span>
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <Tag>{row.jenis}</Tag>
                    </td>
                    <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: "0.82rem" }}>{row.bahasa}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <Tag bg={row.ok ? "#d4f0e4" : "#ffd6d6"}>
                        {row.ok ? "✅ " : "❌ "}{row.status}
                      </Tag>
                    </td>
                    <td style={{ padding: "9px 14px", fontWeight: 700, fontSize: "0.8rem", color: "#555", whiteSpace: "nowrap" }}>{row.tgl}</td>
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
                          fontFamily: "'Nunito', sans-serif",
                          transition: "all 0.1s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(1px,1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "1px 1px 0 #000"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 #000"; }}
                      >
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="recent-cards" style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
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
                <div style={{ backgroundColor: row.ok ? "#d4f0e4" : "#ffd6d6", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #000" }}>
                  <span style={{ fontWeight: 900, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileText size={13} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px", display: "inline-block" }}>{row.nama}</span>
                  </span>
                  <Tag bg={row.ok ? "#d4f0e4" : "#ffd6d6"}>{row.ok ? "✅" : "❌"} {row.status}</Tag>
                </div>
                <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fef9f0" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <Tag>{row.jenis}</Tag>
                    <span style={{ fontWeight: 800, fontSize: "0.78rem" }}>{row.bahasa}</span>
                    <span style={{ fontSize: "0.72rem", color: "#666", fontWeight: 700 }}>{row.tgl}</span>
                  </div>
                  <button style={{ backgroundColor: "#f5f0ff", border: "2px solid #000", borderRadius: "7px", padding: "4px 10px", fontSize: "0.72rem", fontWeight: 900, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                    Lihat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes bounce  { from { transform: translateY(0); } to { transform: translateY(-8px); } }
        @keyframes pulse   { from { opacity: 0.6; } to { opacity: 1; } }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }

        /* ── DESKTOP (>= 900px) ── */
        @media (min-width: 900px) {
          .stats-grid  { grid-template-columns: repeat(4, 1fr) !important; }
          .main-grid   {
            display: grid;
            grid-template-columns: 240px 1fr 1fr;
            gap: 16px;
            align-items: stretch;
            height: 580px;
          }
          .recent-table { display: block; }
          .recent-cards { display: none !important; }
          .profile-text { display: block; }
          .bell-btn     { display: flex !important; }
        }

        /* ── MOBILE (< 900px) ── */
        @media (max-width: 899px) {
          .main-grid {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          /* upload zone has natural height on mobile */
          .main-grid > div { height: auto !important; }
          /* code output: fixed height so it scrolls */
          .main-grid > div:last-child { height: auto !important; }
          .main-grid > div:last-child > div[style*="flex: 1"] { min-height: 280px; }

          .recent-table { display: none; }
          .recent-cards { display: flex !important; }
          .profile-text { display: none; }
          .bell-btn     { display: none !important; }
        }

        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
