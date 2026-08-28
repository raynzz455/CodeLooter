// Standalone test of the Phase 1 extraction pipeline.
// Run: bun src/lib/extractor/__test__/verify.ts

import { extractCodeBlocksFromText } from "../pattern-extract";
import { repairLineWraps } from "../repair";
import { isCodeLine, isNarrativeLine, isROutput, proseRatio } from "../line-classify";

const FIXTURE = `MODUL 3 — STATISTIKA NON-PARAMETRIK

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

function run() {
  console.log("=== Phase 1 Extraction Verification ===\n");

  // Fix #3: line-wrap repair
  const repaired = repairLineWraps(FIXTURE.split("\n"));
  console.log(`[Fix #3] Line-wrap repairs: ${repaired.repairedCount}`);
  const joined = repaired.lines.find((l) => l.includes("biaya_promosi <- c("));
  console.log(`  biaya_promosi line: ${joined}\n`);

  // Fix #2: prose ratio / narrative detection
  const narrative1 = "X-squared = 2.2222 menunjukkan bahwa penyimpangan antara data aktual";
  console.log(`[Fix #2] proseRatio(narrative) = ${proseRatio(narrative1).toFixed(2)} → narrative? ${isNarrativeLine(narrative1)}`);
  const code1 = "cor.test(data_penilaian$nilai_kepuasan, data_penilaian$kenaikan_gaji)";
  console.log(`[Fix #2] isCodeLine(cor.test...) = ${isCodeLine(code1)}\n`);

  // Fix #4: R output stripping
  const rOut = "##  X-squared = 2.2222";
  console.log(`[Fix #4] isROutput("##...") = ${isROutput(rOut)}\n`);

  // Full extraction
  const { blocks, stats } = extractCodeBlocksFromText(FIXTURE);
  console.log(`=== Extraction result: ${blocks.length} blocks ===`);
  console.log(`Stats:`, stats);
  console.log("");
  blocks.forEach((b, i) => {
    console.log(`--- Block #${i} | ${b.lang} | ${b.lines} lines | ${b.source} ---`);
    console.log(b.code);
    console.log("");
  });

  const allCode = blocks.map((b) => b.code).join("\n");
  const checks: { name: string; pass: boolean }[] = [
    { name: "No '##' R-output lines in blocks", pass: !/\n##\s/.test("\n" + allCode) },
    { name: "No narrative 'menunjukkan bahwa' in blocks", pass: !/menunjukkan bahwa/.test(allCode) },
    { name: "cor.test captured", pass: /cor\.test/.test(allCode) },
    { name: "library(lmtest) captured", pass: /library\(lmtest\)/.test(allCode) },
    { name: "biaya_promosi line-wrap repaired (1700000 joined)", pass: /1700000/.test(allCode) },
    { name: "summary(vp) captured", pass: /summary\(vp\)/.test(allCode) },
    { name: "data.frame captured", pass: /data\.frame/.test(allCode) },
    { name: "chisq.test captured", pass: /chisq\.test/.test(allCode) },
    { name: "At least 2 blocks produced", pass: blocks.length >= 2 },
  ];
  console.log("\n=== Phase 1 checks ===");
  let ok = 0;
  for (const c of checks) {
    const mark = c.pass ? "PASS" : "FAIL";
    console.log(`  [${mark}] ${c.name}`);
    if (c.pass) ok++;
  }
  console.log(`\n${ok}/${checks.length} checks passed.`);
}

run();
