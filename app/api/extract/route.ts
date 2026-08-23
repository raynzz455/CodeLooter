import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import hljs from "highlight.js/lib/core";
import r from "highlight.js/lib/languages/r";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import kotlin from "highlight.js/lib/languages/kotlin";

// ESM import (menggantikan require() yang lama)
import { parseOffice } from "officeparser";

const execFileAsync = promisify(execFile);

hljs.registerLanguage("r", r);
hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("kotlin", kotlin);

/* ─── Konstanta ─── */
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

// Ekstensi yang bisa dibaca sebagai plain-text/UTF-8 tanpa officeparser
const PLAIN_TEXT_EXT = new Set(["txt", "tex", "latex", "sty", "cls"]);

// Ekstensi legacy yang TIDAK didukung officeparser; akan ditolak dengan pesan jelas
const LEGACY_OFFICE_EXT = new Set(["doc", "ppt", "xls", "wps"]);

// Ekstensi yang didukung officeparser v7
const OFFICEPARSER_EXT = new Set([
  "docx", "pptx", "xlsx",
  "odt", "odp", "ods",
  "pdf", "rtf", "md", "html", "csv",
]);

/* ─── Types ─── */
export interface CodeBlock {
  index: number;
  lang: string;
  code: string;
  lines: number;
  source: string; // strategy yang menangkap blok ini (untuk debugging)
}

/* ─── Kata-kata prosa Indonesia/Inggris untuk filter ───
 * Baris yang mengandung terlalu banyak kata ini kemungkinan besar
 * naratif, bukan kode.
 */
const PROSE_WORDS = new Set([
  // Indonesia
  "dan", "atau", "yang", "untuk", "pada", "dengan", "dari", "ke", "di", "ini",
  "itu", "adalah", "akan", "sebuah", "seorang", "mahasiswa", "rata", "selisih",
  "proporsi", "signifikan", "berbeda", "menggunakan", "menghitung", "mencari",
  "memasukkan", "data", "sampel", "kelompok", "perbedaan", "nilai", "uji",
  "hipotesis", "dugaan", "estimasi", "parameter", "populasi", "distribusi",
  "derajat", "bebas", "kritis", "standar", "error", "margin", "batas", "atas",
  "bawah", "selang", "kepercayaan", "hasil", "output", "kode", "program",
  "contoh", "kasus", "latihan", "tugas", "penugasan", "modul", "praktikum",
  "sesi", "tersebut", "sehingga", "karena", "jika", "maka", "sedangkan",
  "tetapi", "namun", "agar", "supaya", "ketika", "saat", "setelah", "sebelum",
  "selama", "hingga", "daripada", "oleh", "tentang", "antara", "sangat",
  "lebih", "kurang", "dapat", "harus", "boleh", "ingin", "inginkan",
  "mengetahui", "menjelaskan", "membuktikan", "melakukan", "mendapatkan",
  "didapatkan", "diambil", "diukur", "dikumpulkan", "diasumsikan", "misalnya",
  "yaitu", "yaitu:", "antara", "antar", "terhadap", "tersebut", "demikian",
  // English
  "the", "and", "or", "for", "with", "from", "to", "in", "of", "a", "an",
  "is", "are", "was", "were", "be", "this", "that", "these", "those", "we",
  "you", "they", "he", "she", "it", "by", "as", "at", "on", "but", "if",
  "then", "else", "when", "while", "where", "which", "who", "what", "how",
  "why", "use", "using", "used", "given", "find", "calculate", "compute",
  "estimate", "test", "hypothesis", "sample", "population", "random",
  "value", "mean", "variance", "standard", "deviation", "interval",
  "confidence", "level", "case", "example", "exercise", "problem",
  "solution", "answer", "show", "prove", "demonstrate", "implement",
  "consider", "suppose", "assume", "let", "let's", "we", "want", "need",
]);

/* ─── Deteksi apakah baris terlihat seperti prosa ───
 * Mengembalikan true jika baris lebih mirip kalimat naratif daripada kode.
 */
function looksLikeProse(line: string): boolean {
  const t = line.trim();
  if (!t) return false;

  // Baris komentar diawali # atau // atau -- → tidak prose (meskipun isinya naratif,
  // itu masih bagian dari blok kode sebagai komentar)
  if (/^\s*(#|\/\/|--)/.test(line)) return false;

  // Strip kode komentar yang menyertai baris kode (# atau // di akhir baris)
  // Penting supaya `z_crit <- qnorm(1 - alpha/2) # Nilai Z untuk 0.90` tidak
  // dianggap prose karena ada kata "Nilai" dan "untuk" di komentar.
  const withoutComments = t.replace(/(?:#|\/\/).*$/, " ");

  // Strip string literals terlebih dahulu — kata-kata di dalam "..." atau '...'
  // tidak boleh dihitung sebagai kata prosa.
  // Contoh: cat("Nilai Kritis t:", t_score, "\n") → setelah strip: cat
  const withoutStrings = withoutComments.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, " ");

  // Tokenisasi: pecah ke kata-kata huruf (panjang >= 2)
  const words = withoutStrings.toLowerCase().split(/[\s,;.(){}\[\]=<>+\-*/\\&|!?:'"]+/).filter((w) => w.length >= 2);
  if (words.length === 0) return false;

  let proseCount = 0;
  for (const w of words) {
    if (PROSE_WORDS.has(w)) proseCount++;
  }

  // Jika > 30% kata adalah kata prosa, dan ada minimal 2 kata prosa → prose
  if (proseCount >= 2 && proseCount / words.length > 0.3) return true;

  // Jika ada >= 4 kata prosa → prose (densitas tak peduli)
  if (proseCount >= 4) return true;

  // Kalimat lengkap dengan tanda baca akhir
  // "Untuk kelompok B, ..." — diakhiri dengan tanda titik & >3 kata
  if (/\.\s*$/.test(t) && words.length >= 4) return true;

  return false;
}

/* ─── Normalisasi kode ───
 * Hanya normalisasi whitespace umum yang aman untuk semua bahasa.
 */
function normalizeCode(raw: string): string {
  return raw
    .split("\n")
    .map((line) =>
      line
        .replace(/\r/g, "")          // CRLF -> LF
        .replace(/[ \t]+$/g, "")     // trailing whitespace
        .replace(/[ \t]{2,}/g, " ")  // collapse multiple spaces (horizontal only)
        .trimEnd()
    )
    .filter((line) => {
      const t = line.trim();
      if (t.length === 0) return true; // keep blank lines
      if (/^\d+$/.test(t)) return false; // buang baris nomor halaman
      // Buang baris ## (output R console) — bukan kode, tapi output
      if (/^##\s/.test(t)) return false;
      // Buang baris [1] (output R scalar)
      if (/^\[1\]\s/.test(t)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // max 2 newline berturut-turut
    .trim();
}

/* ─── Deteksi R secara eksplisit ───
 * highlight.js sering salah mendeteksi R sebagai Python/Kotlin karena
 * syntax mirip. Kita cek pattern khas R lebih dulu.
 */
function detectR(code: string): boolean {
  const c = code;
  let hits = 0;
  const patterns: RegExp[] = [
    /\b\w+\s*<-\s/,                  // x <- value
    /\b\w+\s*->\s*\w/,               // value -> x
    /\bcat\s*\(/,                    // cat("...")
    /\bqt\s*\(/,                     // qt(p, df)
    /\bqnorm\s*\(/,                  // qnorm(p)
    /\bqf\s*\(/,                     // qf(p, df1, df2)
    /\bqchisq\s*\(/,                 // qchisq(p, df)
    /\bqlnorm\s*\(/,                 // qlnorm
    /\bqbeta\s*\(/,                 // qbeta
    /\blibrary\s*\(/,                // library(ggplot2)
    /\brequire\s*\(/,                // require(...)
    /\bread\.\w+\s*\(/,              // read.csv(), read.table(), read_xlsx()
    /\bdata\.frame\s*\(/,            // data.frame()
    /\bggplot\s*\(/,                 // ggplot()
    /\bsummary\s*\(/,                // summary() — juga di Python, bobot rendah
    /\bhead\s*\(/,                   // head()
    /\bstr\s*\(/,                    // str()
    /\bsetwd\s*\(/,                  // setwd()
    /\bset\.seed\s*\(/,              // set.seed()
    /\bsample\s*\(/,                 // sample() — juga Python
    /\b\w+\$[\w.]+/,                 // data$col
    /%>%/,                           // pipe operator
    /%<-%/,                          // multi-assign
    /%<>%/,                          // compound assignment pipe
    /\bT\b|\bFALSE\b|\bTRUE\b/,      // R logicals
    /\bseq\s*\(/,                    // seq()
    /\brep\s*\(/,                    // rep()
    /\bsapply\s*\(/,                // sapply()
    /\blapply\s*\(/,                 // lapply()
    /\bapply\s*\(/,                  // apply()
    /\bmapply\s*\(/,                 // mapply()
    /\bvapply\s*\(/,                 // vapply()
    /\bfunction\s*\(/,               // function() — juga JS, bobot rendah
    /\bstop\s*\(/,                   // stop()
    /\bwarning\s*\(/,                // warning()
    /\bmessage\s*\(/,                // message()
    /\bprint\s*\(/,                  // print() — juga Python
  ];

  for (const p of patterns) {
    if (p.test(c)) hits++;
  }

  // Bobot lebih tinggi untuk pattern yang sangat khas R
  const strongR = /\b(cat|qt|qnorm|qf|qchisq|qlnorm|qbeta|setwd|set\.seed|sapply|lapply|vapply|mapply)\s*\(/.test(c);
  const assignR = /\b\w+\s*<-\s/.test(c);
  const pipeR = /%>%|%<>%|%<-%/.test(c);
  const libR = /\blibrary\s*\(/.test(c);

  // Decision:
  // - Strong R indicator (cat/qt/qnorm/etc OR pipe) + assignment → R
  // - library() + assignment → R
  // - assignment + >= 2 R-style function calls → R
  if ((strongR || pipeR || libR) && assignR) return true;
  if (assignR && hits >= 3) return true;
  if (hits >= 4) return true;
  return false;
}

/* ─── Deteksi bahasa via highlight.js + R override ─── */
function detectLang(code: string): string {
  if (code.trim().length < 10) return "unknown";

  // Cek R eksplisit lebih dulu — highlight.js sering salah
  if (detectR(code)) return "r";

  const result = hljs.highlightAuto(normalizeCode(code));
  if (!result.language || (result.relevance ?? 0) < 2) return "unknown";

  // Jika highlight.js bilang Python, tapi ada pattern R kuat, override ke R
  if (result.language === "python" && detectR(code)) return "r";
  // Jika highlight.js bilang Kotlin, tapi ada assignment <-, override ke R
  if (result.language === "kotlin" && /\b\w+\s*<-\s/.test(code)) return "r";

  return result.language;
}

/* ─── Repair line-wrap PDF ───
 * PDF sering memotong baris panjang di tengah identifier. Contoh:
 *   cat("...", lower
 *        _bound, ...)
 * harus digabung jadi:
 *   cat("...", lower_bound, ...)
 */
function repairLineWraps(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    while (i + 1 < lines.length && shouldJoinLines(line, lines[i + 1])) {
      i++;
      // Join: trim leading whitespace dari next line, langsung tempel tanpa separator
      line = line + lines[i].replace(/^\s+/, "");
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

function shouldJoinLines(cur: string, next: string): boolean {
  const trimmed = cur.replace(/\s+$/, "");
  const nextTrimmed = next.replace(/^\s+/, "");
  if (!trimmed || !nextTrimmed) return false;

  // HARDEST REJECT: ends with `;` → end of statement, never join
  // (mis. `std::cout << "Hello" << endl;` harus berakhir, jangan digabung dengan `return 0;`)
  if (trimmed.endsWith(";")) return false;

  // ─── Pre-check: unbalanced parens → continuation ───
  // (closing bracket mid-expression means continuation)
  // Contoh: `df_denominator <- ( (s1^2/n1)^2 / (n1-1) ) + ( (s2^2/n2)`
  //         diikuti `^2 / (n2-1) )` — kurung belum seimbang, harus join.
  const opens = (cur.match(/[(\[{]/g) || []).length;
  const closes = (cur.match(/[)\]}]/g) || []).length;
  if (opens > closes) return true;

  // ─── Hard rejects: tidak boleh join ───

  // Next line punya assignment operator early (<- atau ->) → new statement
  if (/<-|->/.test(nextTrimmed.slice(0, 30))) return false;
  // Next line punya = early (single =, bukan ==, !=, <=, >=) → new statement
  if (/^[^=<>!]{1,20}=[^=]/.test(nextTrimmed)) return false;

  // Strong terminators di akhir current line (hanya jika parens balanced — di atas sudah return true kalau unbalanced)
  const lastChar = trimmed[trimmed.length - 1];
  if (/[.!?:]$/.test(trimmed)) return false;       // sentence terminators
  if (/[)\]}]$/.test(trimmed)) return false;        // balanced closing bracket = end of expr
  if (/[["']$/.test(trimmed)) return false;         // closing quote

  // Code keyword di awal next line → new statement
  const codeKeywords = /^\s*(import|from|def|class|function|func|fn|return|if|else|elif|for|while|switch|case|break|continue|public|private|protected|static|void|int|float|double|long|string|var|let|const|print|printf|println|cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP|library|require|module|export|async|await|package|interface|struct|enum|namespace|using|include|extends|implements|new|throw|try|catch|finally|#|\/\/|\/\*|--)/;
  if (codeKeywords.test(nextTrimmed)) return false;

  // Next line looks like a sentence (Huruf besar + spasi + huruf kecil, bukan method call)
  if (/^[A-Z][a-z]+\s+[a-z]/.test(nextTrimmed) && !/^\w+\s*\(/.test(nextTrimmed)) return false;

  // ─── Accepts: clear continuation markers ───

  // 1. Current berakhir dengan operator yang jelas menandakan continuation
  if (/[,+*/<>=&|({\[]$/.test(trimmed)) return true;

  // 2. Hyphenated word continuation: "Welch-\nSatterthwaite"
  if (/-$/.test(trimmed) && /^[A-Z]/.test(nextTrimmed)) return true;

  // 3. Current berakhir dengan identifier lowercase + next berawalan `_` (PDF wrap di tengah identifier)
  //    Contoh: "lower\n_bound, ..." → "lower_bound, ..."
  if (/[a-z]$/.test(trimmed) && /^[_]/.test(nextTrimmed)) return true;

  // 4. Current berakhir alphanumeric + next berawalan `)` atau `]` (PDF wrap sebelum closing)
  //    Contoh: "upper_bound\n)" → "upper_bound)"
  if (/[a-zA-Z0-9_]$/.test(trimmed) && /^[)\]}]/.test(nextTrimmed)) return true;

  // 5. PDF word-wrap continuation: current berakhir lowercase letter (mid-word),
  //    next line adalah kata lowercase pendek (≤8 char) tanpa operator.
  //    Contoh: "# ... secara manual atau simul\nasi" → "...simulasi"
  //    Hanya berlaku jika current TIDAK punya assignment `=` atau `<-`.
  //    (kalau ada assignment, kemungkinan besar baris berikutnya adalah new statement)
  if (/[a-z]$/.test(trimmed) && /^[a-z]{1,8}$/.test(nextTrimmed) && !/[<\-]=|^.{0,40}=[^=]/.test(trimmed)) {
    return true;
  }

  // Default: jangan join. Lebih aman tidak join daripada join yang salah.
  return false;
}

/* ─── Strategy 4: heuristik token density ─── */
function scoreCodeLikeness(line: string): number {
  if (line.length === 0) return 0;
  const t = line.trim();
  if (t.length === 0) return 0;
  if (/^\d+$/.test(t)) return 0;             // angka saja (nomor halaman)
  if (/^##\s/.test(t)) return 0;             // output R console
  if (/^\[1\]\s/.test(t)) return 0;          // output R scalar
  if (looksLikeProse(line)) return 0;        // prose naratif

  // Reject baris yang mengandung simbol matematika unicode
  // (math italic letters 𝑛, 𝜎, 𝜃, dll — tipikal rumus di PDF akademik)
  if (/[\u{1D400}-\u{1D7FF}\u{1EE00}-\u{1EEFF}\u{2200}-\u{22FF}\u{0250}-\u{02AF}]/u.test(t)) return 0;

  // Reject baris yang hanya berisi simbol matematika/relasional + angka tanpa identifier ASCII
  // Contoh: "(𝑛1 −1) + (𝑛2 −1)" atau "< 𝜇 < 𝜃 <"
  // Tapi jangan reject kalau ada keyword R/fn call yang jelas
  const hasKnownCodeFn = /\b(cat|qt|qnorm|qf|qchisq|library|require|read\.\w+|data\.frame|ggplot|summary|head|str|seq|rep|sapply|lapply|sample|set\.seed|setwd|print|mean|median|sd|var|sum|max|min|sqrt|abs|round|floor|ceiling|cbind|rbind|merge|subset|transform|mutate|filter|select|group_by|summarise|arrange|aes|geom_|labs|theme)\s*\(/.test(t);
  if (!hasKnownCodeFn) {
    // Strip semua karakter yang biasa ada di rumus matematika
    // (whitespace, digit, operator dasar, kurung, relasional unicode)
    const stripped = t.replace(/[\s\d.,()+\-*/<>=]/g, "").replace(/[≤≥≠≈√∑∫πβαλμσθ]/g, "");
    if (stripped.length === 0 && t.length < 40) return 0; // pure math expression
  }

  // Token kode umum
  const codeChars = (t.match(/[(){}\[\];=<>+\-*/\\&|!?:,'".@]/g) || []).length;
  const kwHits = (t.match(/\b(import|from|def|class|function|func|fn|return|if|else|elif|for|while|switch|case|break|continue|public|private|static|void|int|float|string|var|let|const|print|printf|println|cout|cin|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|library|require|module|export|async|await|package|interface|struct|enum|namespace|using|include|extends|implements|new|throw|try|catch|finally)\b/gi) || []).length;

  // Pola khas kode
  const methodCall = (t.match(/\.\w+\s*\(/g) || []).length;
  const fnCall = (t.match(/\b\w+\s*\(/g) || []).length;
  const assignment = (t.match(/\b\w+\s*=[^=]/g) || []).length;
  const rAssign = (t.match(/\b\w+\s*<-\s/g) || []).length;
  const indexing = (t.match(/\w+\s*\[[^\]]*\]/g) || []).length;
  const chaining = (t.match(/->|\.\w+\./g) || []).length;
  const pipeR = (t.match(/%>%|%<>%|%<-%/g) || []).length;

  // Komentar dan string
  const hasComment = /^\s*(#|\/\/|--|\/\*)/.test(t);
  const hasString = /(['"]).*\1/.test(t);

  const ratio = codeChars / t.length;
  let score = ratio * 8 + kwHits * 2;
  score += methodCall * 1.5;
  score += chaining * 1.0;
  score += indexing * 0.8;
  score += assignment * 0.5;
  score += rAssign * 2.5;     // <- sangat khas R
  score += pipeR * 3.0;       // %>% sangat khas R
  score += fnCall * 0.3;
  if (hasComment) score += 1.5;
  if (hasString) score += 0.8;
  return score;
}

function extractHeuristicBlocks(rawText: string): CodeBlock[] {
  const lines = rawText.split("\n");
  const scores = lines.map(scoreCodeLikeness);
  const THRESHOLD = 1.5;
  const MIN_HIGH_SCORE = 3.0;
  const LOOKAHEAD = 4; // berapa jauh ke depan mencari kode setelah baris "soft"

  // Helper: apakah ada baris kode (score >= THRESHOLD) dalam LOOKAHEAD baris ke depan?
  function hasCodeAhead(from: number): boolean {
    for (let j = from; j < Math.min(lines.length, from + LOOKAHEAD); j++) {
      if (scores[j] >= THRESHOLD) return true;
    }
    return false;
  }

  // Helper: apakah baris ini "soft" (boleh dilewati tanpa memutus blok)?
  // Soft = baris kosong, komentar, R output (##), atau R scalar output ([1])
  function isSoft(i: number): boolean {
    const t = lines[i].trim();
    return t === "" || t.startsWith("#") || t.startsWith("##") || t.startsWith("[1]");
  }

  const blocks: { start: number; end: number }[] = [];
  let i = 0;
  while (i < lines.length) {
    if (scores[i] >= THRESHOLD) {
      const start = i;
      // Perluas blok selama:
      // - baris saat ini berkode (score >= THRESHOLD), atau
      // - baris saat ini "soft" DAN ada kode dalam LOOKAHEAD baris ke depan
      while (
        i < lines.length &&
        (scores[i] >= THRESHOLD || (isSoft(i) && hasCodeAhead(i + 1)))
      ) {
        i++;
      }
      const end = i;
      if (end - start >= 2 || scores[start] >= MIN_HIGH_SCORE) {
        blocks.push({ start, end });
      }
    } else {
      i++;
    }
  }

  // Merge blocks yang dipisah hanya oleh baris "soft" (kosong, komentar, ## output)
  // — bukan teks naratif. Komentar pendek antara dua baris kode tetap satu blok.
  const merged: typeof blocks = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last) {
      const gap = lines.slice(last.end, b.start);
      const isBridgeable = gap.every((l, idx) => isSoft(last.end + idx));
      if (isBridgeable) {
        last.end = b.end;
        continue;
      }
    }
    merged.push({ ...b });
  }

  const result: CodeBlock[] = [];
  for (const { start, end } of merged) {
    const code = normalizeCode(lines.slice(start, end).join("\n"));
    if (code.length < 10) continue;
    const lang = detectLang(code);
    result.push({
      index: 0,
      lang,
      code,
      lines: code.split("\n").length,
      source: "heuristic",
    });
  }
  return result;
}

/* ─── Code block extractor ─── */
function extractFromText(rawText: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];

  // Pre-processing: repair line wraps dari PDF extraction
  const text = repairLineWraps(rawText);

  // Strategy 0: LaTeX listing/verbatim
  const LSTLNG = /\\begin\{lstlisting\}(?:\[language=([^\]]+)\])?([\s\S]*?)\\end\{lstlisting\}/g;
  let lm: RegExpExecArray | null;
  while ((lm = LSTLNG.exec(text)) !== null) {
    const hint = (lm[1] || "").toLowerCase().trim();
    const code = (lm[2] || "").replace(/^\n/, "").replace(/\n$/, "").trim();
    if (code.length < 10) continue;
    const lang = hint && hljs.getLanguage(hint) ? hint : detectLang(code);
    blocks.push({ index: 0, lang, code, lines: code.split("\n").length, source: "latex" });
  }
  const VERB = /\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g;
  while ((lm = VERB.exec(text)) !== null) {
    const code = (lm[1] || "").replace(/^\n/, "").replace(/\n$/, "").trim();
    if (code.length < 10) continue;
    const lang = detectLang(code);
    blocks.push({ index: 0, lang, code, lines: code.split("\n").length, source: "latex" });
  }
  const MINT = /\\begin\{minted\}(?:\{?\s*(\w+)\s*\}?)?([\s\S]*?)\\end\{minted\}/g;
  while ((lm = MINT.exec(text)) !== null) {
    const hint = (lm[1] || "").toLowerCase().trim();
    const code = (lm[2] || "").replace(/^\n/, "").replace(/\n$/, "").trim();
    if (code.length < 10) continue;
    const lang = hint && hljs.getLanguage(hint) ? hint : detectLang(code);
    blocks.push({ index: 0, lang, code, lines: code.split("\n").length, source: "latex" });
  }

  if (blocks.length > 0) return indexBlocks(blocks);

  // Strategy 1: anchor-based — label eksplisit
  const ANCHOR_START = /(?:kode\s+[\w\s]*?\s*:|syntax\s*:|script\s*:|program\s*:|code\s*:|listing\s*:|example\s*:|contoh\s+kode\s*:|source\s+code\s*:)/gi;
  const ANCHOR_END = /(?:output\s+yang\s+dihasilkan|interpretasi|^contoh\s+\d|^penugasan|hasil\s+output|^diskusi|^latihan|exercise|discussion|expected\s+output)/im;

  let match: RegExpExecArray | null;
  ANCHOR_START.lastIndex = 0;

  while ((match = ANCHOR_START.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const rest = text.slice(start);
    const endMatch = ANCHOR_END.exec(rest);
    const end = endMatch ? endMatch.index : Math.min(rest.length, 4000);

    const candidate = rest.slice(0, end).trim();
    if (candidate.length < 10) continue;

    const cleaned = candidate
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("##"))
      .join("\n")
      .trim();

    if (cleaned.length < 10) continue;
    const normalized = normalizeCode(cleaned);
    const lang = detectLang(normalized);
    if (lang !== "unknown") {
      blocks.push({ index: 0, lang, code: normalized, lines: normalized.split("\n").length, source: "anchor" });
    }
  }

  if (blocks.length > 0) return indexBlocks(blocks);

  // Strategy 2: fenced code blocks (MD/DOCX/IPYNB)
  const FENCED = /```(\w*)\n?([\s\S]*?)```|~~~(\w*)\n?([\s\S]*?)~~~/g;
  let fm: RegExpExecArray | null;
  while ((fm = FENCED.exec(text)) !== null) {
    const hint = (fm[1] || fm[3] || "").toLowerCase().trim();
    const code = (fm[2] || fm[4] || "").trim();
    if (code.length < 10) continue;
    const lang = hint && hljs.getLanguage(hint) ? hint : detectLang(code);
    blocks.push({ index: 0, lang, code, lines: code.split("\n").length, source: "fenced" });
  }

  if (blocks.length > 0) return indexBlocks(blocks);

  // Strategy 3: IPYNB source cells
  if (text.includes('"source"') && text.includes('"cell_type"')) {
    try {
      const nb = JSON.parse(text);
      for (const cell of nb.cells ?? []) {
        if (cell.cell_type !== "code") continue;
        const src = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source ?? "");
        const code = src.trim();
        if (code.length < 10) continue;
        const lang = detectLang(code);
        if (lang !== "unknown") {
          blocks.push({ index: 0, lang, code, lines: code.split("\n").length, source: "ipynb" });
        }
      }
    } catch {
      // not valid JSON — fall through
    }
  }

  if (blocks.length > 0) return indexBlocks(blocks);

  // Strategy 4: heuristik token-density
  const heuristicBlocks = extractHeuristicBlocks(text);
  if (heuristicBlocks.length > 0) return indexBlocks(heuristicBlocks);

  return indexBlocks(blocks);
}

function indexBlocks(blocks: CodeBlock[]): CodeBlock[] {
  return blocks.map((b, i) => ({ ...b, index: i }));
}

/* ─── PDF parsing via Python sidecar (pdfplumber + font analysis) ───
 *
 * Strategi baru berbasis FONT ANALYSIS:
 * pdfplumber membaca setiap char PDF dengan informasi fontname.
 * Kita identifikasi font monospace (Courier/Consolas/Mono/...)
 * yang dipakai di dokumen, lalu group char monospace menjadi
 * "code blocks" berdasarkan region. Ini JAUH lebih presisi daripada
 * heuristic token-density karena PDF secara visual sudah membedakan
 * kode (Courier/Consolas) dengan narasi (Times/Calibri/Arial).
 *
 * Untuk konsistensi, sidecar mengembalikan blok-blok kode yang sudah
 * di-postprocess; route handler tinggal deteksi bahasa + return ke UI.
 *
 * Fallback: pdftotext -layout + heuristic TS (jika sidecar gagal).
 */

interface FontBasedBlock {
  code: string;
  page: number;
  lines: number;
  source: string;
}

interface SidecarResult {
  blocks: FontBasedBlock[];
  fonts_detected?: {
    monospace?: string[];
    prose?: string[];
    math?: string[];
  };
  stats?: {
    total_chars?: number;
    code_chars?: number;
    code_ratio?: number;
  };
  error?: string;
}

const SIDECAR_SCRIPT = path.join(process.cwd(), "scripts", "pdf_extract.py");
const SIDECAR_TIMEOUT_MS = 90_000; // 90 detik untuk file besar

async function parsePdfViaSidecar(buffer: Buffer): Promise<SidecarResult> {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `codelooter-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    fs.writeFileSync(tmpFile, buffer);
    const { stdout } = await execFileAsync("python3", [SIDECAR_SCRIPT, tmpFile], {
      maxBuffer: 100 * 1024 * 1024,
      timeout: SIDECAR_TIMEOUT_MS,
      encoding: "utf-8",
    });
    return JSON.parse(stdout) as SidecarResult;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

async function parsePdf(buffer: Buffer): Promise<{ text: string; fontBlocks?: FontBasedBlock[] }> {
  // Coba font-based extraction via Python sidecar (paling akurat)
  try {
    const result = await parsePdfViaSidecar(buffer);
    if (result.error) {
      console.warn("[/api/extract] sidecar error:", result.error);
    } else if (result.blocks && result.blocks.length > 0) {
      // Kembalikan blok-blok yang sudah terstruktur — route handler akan pakai ini langsung
      return { text: "", fontBlocks: result.blocks };
    }
  } catch (err) {
    console.warn("[/api/extract] sidecar gagal, fallback ke pdftotext:", err instanceof Error ? err.message : err);
  }

  // Fallback: pdftotext -layout + heuristic TS
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `codelooter-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    fs.writeFileSync(tmpFile, buffer);
    const { stdout } = await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", tmpFile, "-"], {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 30_000,
      encoding: "utf-8",
    });
    return { text: stdout };
  } catch {
    // Last resort: officeparser (pdfjs)
    const ast = await parseOffice(buffer, { fileType: "pdf", includeBreakNodes: true });
    return { text: ast.toText() };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/* ─── Document parser via officeparser ───
 * Catatan: PDF ditangani terpisah di parsePdf() yang return { text, fontBlocks? }.
 * Fungsi ini hanya untuk format office (DOCX, PPTX, XLSX, dll) dan plain text.
 */
async function parseDocument(buffer: Buffer, filename: string): Promise<string> {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();

  if (PLAIN_TEXT_EXT.has(ext)) {
    return buffer.toString("utf-8");
  }

  if (ext === "pdf") {
    // PDF tidak boleh masuk sini — ditangani langsung di route handler
    throw new Error("parseDocument() tidak menangani PDF; gunakan parsePdf() langsung");
  }

  if (LEGACY_OFFICE_EXT.has(ext)) {
    throw new Error(
      `Format .${ext} (legacy Microsoft Office) belum didukung. Silakan konversi ke .${ext}x terlebih dahulu (misalnya dengan LibreOffice atau Microsoft Word → Save As .docx).`
    );
  }

  if (!OFFICEPARSER_EXT.has(ext)) {
    throw new Error(`Format .${ext} tidak didukung. Format yang didukung: pdf, docx, pptx, xlsx, odt, odp, ods, rtf, md, html, csv, txt, tex, ipynb.`);
  }

  const ast = await parseOffice(buffer, {
    fileType: ext as any,
    includeBreakNodes: true,
  });

  if (ext === "md" || ext === "html") {
    try {
      const md = await ast.to("md");
      if (md?.value) return md.value;
    } catch {
      // fallback ke toText
    }
  }

  return ast.toText();
}

/* ─── Route handler ─── */
export async function POST(req: NextRequest) {
  try {
    const cl = Number(req.headers.get("content-length") ?? 0);
    if (cl > MAX_FILE_BYTES * 1.5) {
      return NextResponse.json(
        { error: `Ukuran upload melebihi batas ${MAX_FILE_BYTES / (1024 * 1024)}MB.` },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Tidak ada file yang dikirim" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Ukuran file ${(file.size / (1024 * 1024)).toFixed(1)}MB melebihi batas ${MAX_FILE_BYTES / (1024 * 1024)}MB.` },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let rawText = "";
    let fontBlocks: FontBasedBlock[] | undefined;
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".ipynb")) {
      rawText = buffer.toString("utf-8");
    } else if (lowerName.endsWith(".pdf")) {
      // PDF: gunakan font-based extraction via Python sidecar
      const pdfResult = await parsePdf(buffer);
      if (pdfResult.fontBlocks && pdfResult.fontBlocks.length > 0) {
        // Sidecar berhasil — pakai blok-blok font-based langsung
        fontBlocks = pdfResult.fontBlocks;
      } else {
        // Fallback ke heuristic TS
        rawText = pdfResult.text;
      }
    } else {
      rawText = await parseDocument(buffer, file.name);
    }

    // Jalankan deteksi bahasa pada blok-blok font-based (jika ada),
    // ATAU jalankan extraction heuristik pada rawText
    let blocks: CodeBlock[];
    if (fontBlocks) {
      blocks = fontBlocks.map((b) => ({
        index: 0,
        lang: detectLang(b.code),
        code: b.code,
        lines: b.lines,
        source: "font",
      }));
    } else {
      if (!rawText || rawText.trim().length === 0) {
        return NextResponse.json({ error: "File kosong atau tidak dapat dibaca" }, { status: 422 });
      }
      blocks = extractFromText(rawText);
    }

    blocks = indexBlocks(blocks);

    if (blocks.length === 0) {
      return NextResponse.json(
        { error: "Tidak ditemukan kode dalam dokumen ini" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      blocks,
      filename: file.name,
      size: file.size,
      total: blocks.length,
    });
  } catch (err) {
    console.error("[/api/extract]", err);
    const message = err instanceof Error ? err.message : "Gagal memproses file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
