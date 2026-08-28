"use client";

import { useCallback, useState } from "react";
import { FileSearch, Sparkles, Wand2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/codelooter/header";
import { Footer } from "@/components/codelooter/footer";
import { UploadPanel } from "@/components/codelooter/upload-panel";
import { ResultPanel } from "@/components/codelooter/result-panel";
import { SnippetList } from "@/components/codelooter/snippet-list";
import {
  extractFile,
  type ExtractResult,
  type SnippetDetail,
  type CodeBlock,
} from "@/lib/codelooter-api";

// Built-in sample that demonstrates all four Phase 1 fixes:
//   - line-wrap (biaya_promosi vector split across lines)
//   - narrative false positive ("X-squared = 2.2222 menunjukkan bahwa…")
//   - R output (## blocks)
//   - fragmented blocks (cor.test after Interpretasi narrative)
const SAMPLE = `MODUL 3 — STATISTIKA NON-PARAMETRIK

# Kasus 1: Uji Chi-Square Kecocokan

Kode Penyelesaian:
data_ipk = "
ipk frekuensi
A 12
B 18
C 7
"
Tabel.kontingensi = as.matrix(read.table(textConnection(data_ipk),
                             header = TRUE, row.names = 1))
print(Tabel.kontingensi)
chisq.test(Tabel.kontingensi, correct = FALSE)

Output yang dihasilkan:
##
##  Chi-squared test
##
##  X-squared = 2.2222 menunjukkan bahwa penyimpangan antara data aktual
##  dan data yang diharapkan relatif kecil, dan Karena p-value = 0.136 > 0.05

# Kasus 2: Korelasi Pearson

data_penilaian <- data.frame(
  karyawan = 1:12,
  nilai_kepuasan = c(5.8, 8.1, 7.2, 9.0, 6.5, 7.8,
                     8.3, 6.9, 7.5, 8.8, 5.2, 9.3),
  kenaikan_gaji = c(3.3, 6.7, 4.2, 8.1, 3.9, 5.5,
                    7.2, 4.0, 5.9, 8.4, 3.1, 9.0))
print(data_penilaian)

Interpretasi: hasil di atas menunjukkan bahwa terdapat hubungan positif.

cor.test(data_penilaian$nilai_kepuasan, data_penilaian$kenaikan_gaji,
         method = c("pearson"), conf.level = 0.95)

# Kasus 3: Regresi Linier

library(lmtest)
tahun <- 2001:2010
biaya_promosi <- c(1500000, 1600000, 170
0000, 2200000)
volume_penjualan <- c(45000, 48000, 52000, 55000, 58000,
                      61000, 64000, 67000, 69000, 60000)
data_biaya <- data.frame(tahun, biaya_promosi, volume_penjualan)
vp <- lm(volume_penjualan ~ biaya_promosi, data = data_biaya)
summary(vp)
`;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleExtract = useCallback(async (file: File, lang: string) => {
    setLoading(true);
    setResult(null);
    try {
      const r = await extractFile(file, lang);
      setResult(r);
      if (r.total === 0) {
        toast.warning("Tidak ada blok kode terdeteksi");
      } else {
        toast.success(`${r.total} blok kode diekstrak${r.cached ? " (dari cache)" : ""}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengekstrak");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadSample = useCallback(async () => {
    const file = new File([SAMPLE], "modul3_sample.txt", { type: "text/plain" });
    await handleExtract(file, "r");
  }, [handleExtract]);

  const handleSelectSnippet = useCallback((detail: SnippetDetail) => {
    const blocks: CodeBlock[] = detail.blocks.map((b: any, i: number) => ({
      index: b.index ?? i,
      lang: b.lang,
      code: b.code,
      lines: b.lines,
      source: b.source ?? "saved",
    }));
    setResult({
      blocks,
      filename: detail.filename,
      size: detail.fileSize,
      total: detail.totalBlocks,
      stats: null,
      cached: true,
    });
    toast.success(`Snippet "${detail.filename}" dimuat`);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Hero / intro band */}
      <section className="border-b border-border/60 bg-gradient-to-b from-emerald-500/5 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-3 w-3" />
                Phase 1 · perbaikan ekstraksi
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Ekstrak kode dari modul praktikum, presisi per blok.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Upload PDF / Markdown / IPYNB, pilih bahasa, dapatkan setiap code
                block utuh — tanpa narasi ikut, tanpa R output{" "}
                <span className="font-mono">##</span>, tanpa line-wrap rusak.
              </p>
            </div>
            <button
              onClick={handleLoadSample}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              <Wand2 className="h-4 w-4" />
              Coba contoh modul R
            </button>
          </div>

          {/* Phase 1 feature pills */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FeaturePill
              icon={<FileSearch className="h-4 w-4" />}
              title="Merge blok terpotong"
              desc="Look-back/look-ahead: narasi 1–2 baris tidak memecah blok."
            />
            <FeaturePill
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Filter narasi ketat"
              desc="Rasio kata prosa > 40% → bukan kode."
            />
            <FeaturePill
              icon={<Zap className="h-4 w-4" />}
              title="Repair line-wrap"
              desc="Vektor panjang yang dipotong PDF digabung kembali."
            />
            <FeaturePill
              icon={<Sparkles className="h-4 w-4" />}
              title="Strip R-output"
              desc="Semua baris ## di-skip secara konsisten."
            />
          </div>
        </div>
      </section>

      {/* Main workspace */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          {/* Left column: upload + snippets */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Upload &amp; ekstrak</h2>
              <UploadPanel onExtract={handleExtract} loading={loading} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <SnippetList refreshKey={refreshKey} onSelect={handleSelectSnippet} />
            </div>
          </aside>

          {/* Right column: results */}
          <section className="min-w-0">
            <ResultPanel
              result={result}
              loading={loading}
              onSaved={() => setRefreshKey((k) => k + 1)}
            />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function FeaturePill({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
