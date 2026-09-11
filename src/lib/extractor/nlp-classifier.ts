// CodeLooter — NLP classifier using ONNX Runtime via transformers.js
//
// This is NOT an LLM. This is NOT PyTorch.
// This uses ONNX Runtime (~67MB Linux binary) + a small embedding model
// (all-MiniLM-L6-v2, ~22MB in ONNX format) to classify whether a line
// of text is code or narrative.
//
// Free tier compatibility:
// - Render free (512MB RAM): ONNX binary 67MB + model 22MB = 89MB ✅
// - Vercel free (1024MB RAM): Same, fits easily ✅
// - NO PyTorch (~500MB), NO TensorFlow, NO GPU needed
//
// SSR vs CSR:
// - This module runs ONLY on the server (SSR side) in API routes
// - The browser (CSR side) never loads this model — too heavy for bundle
// - Browser sends file → server runs pattern + NLP → sends results back

import { pipeline, env } from "@huggingface/transformers";

// Disable browser cache (we're on Node.js server)
env.allowLocalModels = false;
env.useBrowserCache = false;

let extractorPromise: Promise<any> | null = null;

// Lazy-load the model — only initialized on first use.
// Model downloads from HuggingFace Hub on first call (~22MB), cached after.
async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { device: "cpu" },
    ).catch((err) => {
      console.error("[nlp-classifier] Failed to load ONNX model:", err);
      extractorPromise = null;
      throw err;
    });
  }
  return extractorPromise;
}

// Reference prototypes — sentences representing "pure code" vs "pure narrative"
// in both Indonesian and English. The multilingual MiniLM model handles both.
const CODE_PROTOTYPES = [
  "library(ggplot2) data <- read.csv summary(model)",
  "def calculate_mean(values): return sum(values) / len(values)",
  "SELECT * FROM users WHERE age > 18 ORDER BY name",
  "import pandas as pd df = pd.read_csv print df head",
  "data <- data.frame x = c(1,2,3) print(data) chisq.test(data)",
  "for i in range(10): print(i) if i > 5: break",
  "vp <- lm(volume_penjualan ~ biaya_promosi, data = data_biaya)",
  "cor.test(x, y, method = pearson, conf.level = 0.95)",
];

const NARRATIVE_PROTOTYPES = [
  "Interpretasi hasil menunjukkan bahwa terdapat hubungan positif",
  "Berdasarkan analisis data dapat disimpulkan bahwa hipotesis diterima",
  "The results indicate a significant correlation between variables",
  "Mahasiswa diharapkan mampu memahami konsep uji statistik",
  "Output yang dihasilkan menunjukkan p-value lebih besar dari 0.05",
  "Penelitian ini dilakukan untuk mengetahui hubungan antara variabel",
  "Karena p-value = 0.136 lebih besar dari 0.05 maka H0 diterima",
  "Setelah mempelajari modul ini mahasiswa diharapkan mampu menerapkan",
];

let prototypeEmbeddings: { code: number[][]; narrative: number[][] } | null = null;

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

async function ensurePrototypes() {
  if (prototypeEmbeddings) return prototypeEmbeddings;
  const extractor = await getExtractor();

  const codeEmbeds: number[][] = [];
  for (const proto of CODE_PROTOTYPES) {
    const output = await extractor(proto, { pooling: "mean", normalize: true });
    codeEmbeds.push(Array.from(output.data as Float32Array));
  }

  const narrativeEmbeds: number[][] = [];
  for (const proto of NARRATIVE_PROTOTYPES) {
    const output = await extractor(proto, { pooling: "mean", normalize: true });
    narrativeEmbeds.push(Array.from(output.data as Float32Array));
  }

  prototypeEmbeddings = { code: codeEmbeds, narrative: narrativeEmbeds };
  return prototypeEmbeddings;
}

export interface NLPClassification {
  isCode: boolean;
  confidence: number;
  codeScore: number;
  narrativeScore: number;
}

// Classify a single line as code or narrative.
export async function classifyLineNLP(line: string): Promise<NLPClassification | null> {
  const t = line.trim();
  if (!t || t.length < 5) return null;

  try {
    const protos = await ensurePrototypes();
    const extractor = await getExtractor();
    const output = await extractor(t, { pooling: "mean", normalize: true });
    const lineEmbed = Array.from(output.data as Float32Array);

    let maxCodeSim = 0;
    for (const emb of protos.code) {
      const sim = cosineSim(lineEmbed, emb);
      if (sim > maxCodeSim) maxCodeSim = sim;
    }

    let maxNarrativeSim = 0;
    for (const emb of protos.narrative) {
      const sim = cosineSim(lineEmbed, emb);
      if (sim > maxNarrativeSim) maxNarrativeSim = sim;
    }

    const total = maxCodeSim + maxNarrativeSim;
    if (total === 0) return null;

    const codeScore = maxCodeSim / total;
    const narrativeScore = maxNarrativeSim / total;
    const isCode = codeScore > narrativeScore;
    const confidence = isCode ? codeScore : narrativeScore;

    return { isCode, confidence, codeScore, narrativeScore };
  } catch (err: any) {
    console.error("[nlp-classifier] Classification failed:", err?.message ?? err);
    return null;
  }
}

// Batch classify multiple lines.
export async function classifyLinesNLP(lines: string[]): Promise<(NLPClassification | null)[]> {
  const results: (NLPClassification | null)[] = [];
  const BATCH = 16;
  for (let i = 0; i < lines.length; i += BATCH) {
    const batch = lines.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map((l) => classifyLineNLP(l)));
    results.push(...batchResults);
  }
  return results;
}

// Check if the NLP model is available.
export async function isNLPAvailable(): Promise<boolean> {
  try {
    await getExtractor();
    return true;
  } catch {
    return false;
  }
}
