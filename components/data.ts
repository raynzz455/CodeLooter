import type { Language, RecentFile, Stat } from "@/types";

export const LANGUAGES: Language[] = [
  { id: "python",     label: "Python",     emoji: "🐍", color: "#d4f0e4", ext: "py"  },
  { id: "r",          label: "R Code",     emoji: "📊", color: "#f5f0ff", ext: "R"   },
  { id: "javascript", label: "JavaScript", emoji: "⚡", color: "#ffe8a3", ext: "js"  },
  { id: "typescript", label: "TypeScript", emoji: "🔷", color: "#ffe0d0", ext: "ts"  },
  { id: "java",       label: "Java",       emoji: "☕", color: "#ffd6e0", ext: "java"},
  { id: "cpp",        label: "C++",        emoji: "⚙️",  color: "#d0f0ff", ext: "cpp" },
  { id: "sql",        label: "SQL",        emoji: "🗃️",  color: "#e8d4f0", ext: "sql" },
  { id: "kotlin",     label: "Kotlin",     emoji: "🟣", color: "#d4f0e4", ext: "kt"  },
];

export const SAMPLE_CODES: Record<string, string> = {
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
        println("Ditambahkan: \${p.nama}")
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
    repo.aliran().collect { println("\${it.nama}") }
}`,
};

export const RECENT_FILES: RecentFile[] = [
  { nama: "laporan_keuangan_q4.pdf",     jenis: "PDF",  bahasa: "Python",     status: "Selesai", tgl: "24 Jun 2026", ok: true  },
  { nama: "tutorial_analisis_data.docx", jenis: "DOCX", bahasa: "R Code",     status: "Selesai", tgl: "23 Jun 2026", ok: true  },
  { nama: "spesifikasi_api_v2.pdf",      jenis: "PDF",  bahasa: "JavaScript", status: "Selesai", tgl: "22 Jun 2026", ok: true  },
  { nama: "panduan_backend.pdf",         jenis: "PDF",  bahasa: "Java",       status: "Gagal",   tgl: "21 Jun 2026", ok: false },
  { nama: "skema_database.docx",         jenis: "DOCX", bahasa: "SQL",        status: "Selesai", tgl: "20 Jun 2026", ok: true  },
];

export const STATS: Stat[] = [
  { label: "File Diproses",   val: "1,247", color: "#d4f0e4" },
  { label: "Kode Diekstrak",  val: "8,903", color: "#ffe8a3" },
  { label: "Bahasa Didukung", val: "8",     color: "#f5f0ff" },
  { label: "Akurasi",         val: "97.2%", color: "#ffe0d0" },
];
