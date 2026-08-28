// Comprehensive extraction quality test — covers edge cases from real Indonesian
// statistics modules. Run: bun src/lib/extractor/__test__/verify-quality.ts

import { extractCodeBlocksFromText } from "../pattern-extract";
import { repairLineWraps, normalizeWhitespace, stripROutputLines } from "../repair";
import { isCodeLine, isNarrativeLine, isROutput, proseRatio } from "../line-classify";
import { detectLanguage } from "../langdetect";

// Test fixture 1: Multi-block R module with line-wrap, narrative, and R-output
const FIXTURE_1 = `MODUL 3 — STATISTIKA NON-PARAMETRIK

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

// Test fixture 2: Python notebook with markdown
const FIXTURE_2 = `# Data Analysis with Python

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

df = pd.read_csv("data.csv")
print(df.head())
print(df.describe())

# Filter data
filtered = df[df["score"] > 80]
mean_score = filtered["score"].mean()
print(f"Mean score: {mean_score}")

## This is R output that should not appear
## [1] 42.5
`;

// Test fixture 3: SQL scripts
const FIXTURE_3 = `# SQL Queries for Data Analysis

SELECT * FROM customers
WHERE country = 'Indonesia'
ORDER BY created_at DESC;

INSERT INTO orders (customer_id, total)
VALUES (123, 50000);

UPDATE products
SET price = price * 1.1
WHERE category = 'electronics';
`;

// Test fixture 4: Page numbers and PDF artifacts
const FIXTURE_4 = `MODUL PRAKTIKUM STATISTIKA

42

library(ggplot2)
data <- read.csv("modul.csv")
ggplot(data, aes(x=var1, y=var2)) +
  geom_point() +
  theme_minimal()

halaman 13

summary(data)
`;

function run() {
  console.log("=== Extraction Quality Verification ===\n");
  let totalPass = 0;
  let totalChecks = 0;

  // Test 1: Main R module fixture
  console.log("--- Test 1: R Statistics Module ---");
  const r1 = extractCodeBlocksFromText(FIXTURE_1);
  const allCode1 = r1.blocks.map((b) => b.code).join("\n");
  const checks1: { name: string; pass: boolean }[] = [
    { name: "No '##' R-output in blocks", pass: !/\n##\s/.test("\n" + allCode1) },
    { name: "No 'menunjukkan bahwa' narrative", pass: !/menunjukkan bahwa/.test(allCode1) },
    { name: "cor.test captured", pass: /cor\.test/.test(allCode1) },
    { name: "library(lmtest) captured", pass: /library\(lmtest\)/.test(allCode1) },
    { name: "biaya_promosi line-wrap repaired (1700000)", pass: /1700000/.test(allCode1) },
    { name: "summary(vp) captured", pass: /summary\(vp\)/.test(allCode1) },
    { name: "data.frame captured", pass: /data\.frame/.test(allCode1) },
    { name: "chisq.test captured", pass: /chisq\.test/.test(allCode1) },
    { name: "textConnection captured", pass: /textConnection/.test(allCode1) },
    { name: "print(Tabel.kontingensi) captured", pass: /print\(Tabel/.test(allCode1) },
    { name: "All blocks detected as R", pass: r1.blocks.every((b) => b.lang === "r") },
    { name: "At least 3 blocks produced", pass: r1.blocks.length >= 3 },
    { name: "Line-wraps repaired count > 0", pass: r1.stats.repairedWraps > 0 },
    { name: "R-output stripped count > 0", pass: r1.stats.strippedROutput > 0 },
  ];
  for (const c of checks1) {
    totalChecks++;
    if (c.pass) totalPass++;
    console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.name}`);
  }
  console.log(`  → ${checks1.filter((c) => c.pass).length}/${checks1.length} passed\n`);

  // Test 2: Python fixture
  console.log("--- Test 2: Python Notebook ---");
  const r2 = extractCodeBlocksFromText(FIXTURE_2);
  const allCode2 = r2.blocks.map((b) => b.code).join("\n");
  const checks2: { name: string; pass: boolean }[] = [
    { name: "import pandas captured", pass: /import pandas/.test(allCode2) },
    { name: "import numpy captured", pass: /import numpy/.test(allCode2) },
    { name: "pd.read_csv captured", pass: /read_csv/.test(allCode2) },
    { name: "df.describe() captured", pass: /describe\(\)/.test(allCode2) },
    { name: "Filtered mean captured", pass: /mean\(\)/.test(allCode2) },
    { name: "No R-output ## in blocks", pass: !/\n##\s/.test("\n" + allCode2) },
    { name: "At least 1 block", pass: r2.blocks.length >= 1 },
  ];
  for (const c of checks2) {
    totalChecks++;
    if (c.pass) totalPass++;
    console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.name}`);
  }
  console.log(`  → ${checks2.filter((c) => c.pass).length}/${checks2.length} passed\n`);

  // Test 3: SQL fixture
  console.log("--- Test 3: SQL Scripts ---");
  const r3 = extractCodeBlocksFromText(FIXTURE_3);
  const allCode3 = r3.blocks.map((b) => b.code).join("\n");
  const checks3: { name: string; pass: boolean }[] = [
    { name: "SELECT * captured", pass: /SELECT\s+\*/.test(allCode3) },
    { name: "WHERE captured", pass: /WHERE/.test(allCode3) },
    { name: "INSERT INTO captured", pass: /INSERT\s+INTO/.test(allCode3) },
    { name: "UPDATE captured", pass: /UPDATE\s+products/.test(allCode3) },
    { name: "At least 1 block", pass: r3.blocks.length >= 1 },
  ];
  for (const c of checks3) {
    totalChecks++;
    if (c.pass) totalPass++;
    console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.name}`);
  }
  console.log(`  → ${checks3.filter((c) => c.pass).length}/${checks3.length} passed\n`);

  // Test 4: PDF artifacts (page numbers)
  console.log("--- Test 4: PDF Artifacts (page numbers) ---");
  const r4 = extractCodeBlocksFromText(FIXTURE_4);
  const allCode4 = r4.blocks.map((b) => b.code).join("\n");
  const checks4: { name: string; pass: boolean }[] = [
    { name: "Standalone '42' page number removed", pass: !/^\s*42\s*$/m.test(allCode4) },
    { name: "'halaman 13' removed", pass: !/halaman\s+13/i.test(allCode4) },
    { name: "library(ggplot2) captured", pass: /library\(ggplot2\)/.test(allCode4) },
    { name: "read.csv captured", pass: /read\.csv/.test(allCode4) },
    { name: "ggplot() captured", pass: /ggplot\(/.test(allCode4) },
    { name: "geom_point() captured", pass: /geom_point/.test(allCode4) },
    { name: "summary(data) captured", pass: /summary\(data\)/.test(allCode4) },
    { name: "theme_minimal() captured", pass: /theme_minimal/.test(allCode4) },
  ];
  for (const c of checks4) {
    totalChecks++;
    if (c.pass) totalPass++;
    console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.name}`);
  }
  console.log(`  → ${checks4.filter((c) => c.pass).length}/${checks4.length} passed\n`);

  // Test 5: Line-wrap repair unit tests
  console.log("--- Test 5: Line-wrap Repair ---");
  const wrapTest = [
    "biaya <- c(1500000, 1600000, 170",
    "0000, 2200000)",
    "volume <- c(45000, 48000,",
    "          52000, 55000)",
    "model <- lm(y ~ x,",
    "           data = df)",
    "result <- summary(model)",
  ];
  const wrapResult = repairLineWraps(wrapTest);
  const joined = wrapResult.lines.join("\n");
  const checks5: { name: string; pass: boolean }[] = [
    { name: "Number '1700000' reconstructed", pass: /1700000/.test(joined) },
    { name: "Multi-line c() joined", pass: wrapResult.lines.length < wrapTest.length },
    { name: "lm() multi-line joined", pass: /lm\(y ~ x/.test(joined) },
    { name: "summary() on separate line", pass: /summary\(model\)/.test(joined) },
  ];
  for (const c of checks5) {
    totalChecks++;
    if (c.pass) totalPass++;
    console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.name}`);
  }
  console.log(`  → ${checks5.filter((c) => c.pass).length}/${checks5.length} passed\n`);

  // Test 6: Narrative detection
  console.log("--- Test 6: Narrative Detection ---");
  const narrativeTests: { line: string; expectedNarrative: boolean }[] = [
    { line: "X-squared = 2.2222 menunjukkan bahwa penyimpangan kecil", expectedNarrative: true },
    { line: "Hasil di atas menunjukkan bahwa terdapat hubungan positif", expectedNarrative: true },
    { line: "Interpretasi: nilai p-value lebih besar dari 0.05", expectedNarrative: true },
    { line: "data_penilaian <- data.frame(karyawan = 1:12)", expectedNarrative: false },
    { line: "cor.test(x, y, method = 'pearson')", expectedNarrative: false },
    { line: "library(lmtest)", expectedNarrative: false },
    { line: "summary(vp)", expectedNarrative: false },
  ];
  for (const t of narrativeTests) {
    totalChecks++;
    const actual = isNarrativeLine(t.line);
    const pass = actual === t.expectedNarrative;
    if (pass) totalPass++;
    console.log(`  [${pass ? "PASS" : "FAIL"}] "${t.line.slice(0, 45)}..." → narrative=${actual} (expected ${t.expectedNarrative})`);
  }
  console.log("");

  // Test 7: Whitespace normalization
  console.log("--- Test 7: Whitespace Normalization ---");
  const wsLines = [
    "library(ggplot2)",
    "42",
    "data <- read.csv('test.csv')",
    "hal 13",
    "summary(data)",
  ];
  const normalized = normalizeWhitespace(wsLines);
  const checks7: { name: string; pass: boolean }[] = [
    { name: "Standalone '42' removed", pass: !normalized.includes("42") },
    { name: "'hal 13' removed", pass: !normalized.includes("hal 13") },
    { name: "library(ggplot2) kept", pass: normalized.includes("library(ggplot2)") },
    { name: "read.csv kept", pass: normalized.some((l) => l.includes("read.csv")) },
    { name: "summary(data) kept", pass: normalized.includes("summary(data)") },
  ];
  for (const c of checks7) {
    totalChecks++;
    if (c.pass) totalPass++;
    console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.name}`);
  }
  console.log(`  → ${checks7.filter((c) => c.pass).length}/${checks7.length} passed\n`);

  console.log("================================");
  console.log(`TOTAL: ${totalPass}/${totalChecks} checks passed (${Math.round((totalPass / totalChecks) * 100)}%)`);
  console.log("================================");
}

run();
