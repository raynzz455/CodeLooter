// CodeLooter — NLP-based code classifier using HuggingFace transformers.js
//
// Uses a small embedding model to classify whether a line of text is code or
// narrative. This is a quality improvement over the regex-based isCodeLine()
// for cases where pattern matching fails (e.g., narrative that looks like code,
// or code that doesn't match any known pattern).
//
// Model: sentence-transformers/all-MiniLM-L6-v2 (ONNX, ~22MB)
// This is a small, fast model that runs in Node.js via transformers.js.
// It generates embeddings — we compare each line's embedding against
// reference embeddings for "code" and "narrative" prototypes.
//
// Render free tier compatibility:
// - Model is ~22MB, loads in ~2s on first call, cached afterwards
// - Inference is ~50ms per line (CPU-only, no GPU needed)
// - No API key, no external calls, runs entirely locally

import { pipeline, env } from "@huggingface/transformers";

// Disable remote model loading in production (use local cache).
env.allowLocalModels = false;
env.useBrowserCache = false;

let classifierPromise: Promise<any> | null = null;

// Lazy-load the model — only initialized on first use.
async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { device: "cpu" },
    ).catch((err) => {
      console.error("[nlp-classifier] Failed to load model:", err);
      classifierPromise = null; // Allow retry on next call
      throw err;
    });
  }
  return classifierPromise;
}

// Reference prototypes — sentences that represent "pure code" and "pure narrative".
// We compare each input line's embedding against these to classify it.
const CODE_PROTOTYPES = [
  "library(ggplot2) data <- read.csv summary(model)",
  "def calculate_mean(values): return sum(values) / len(values)",
  "SELECT * FROM users WHERE age > 18 ORDER BY name",
  "import pandas as pd df = pd.read_csv print df head",
  "data <- data.frame x = c(1,2,3) print(data) chisq.test(data)",
  "for i in range(10): print(i) if i > 5: break",
];

const NARRATIVE_PROTOTYPES = [
  "Interpretasi hasil menunjukkan bahwa terdapat hubungan positif",
  "Berdasarkan analisis data dapat disimpulkan bahwa hipotesis diterima",
  "The results indicate a significant correlation between variables",
  "Mahasiswa diharapkan mampu memahami konsep uji statistik",
  "Output yang dihasilkan menunjukkan p-value lebih besar dari 0.05",
  "Penelitian ini dilakukan untuk mengetahui hubungan antara variabel",
];

let prototypeEmbeddings: { code: number[][]; narrative: number[][] } | null = null;

// Cosine similarity between two vectors.
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

// Mean-pool a sequence of token embeddings into a single sentence embedding.
function meanPool(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0].length;
  const result = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) result[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) result[i] /= embeddings.length;
  return result;
}

// Initialize prototype embeddings (called on first use).
async function ensurePrototypes() {
  if (prototypeEmbeddings) return prototypeEmbeddings;
  const extractor = await getClassifier();

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
  confidence: number; // 0..1
  codeScore: number;
  narrativeScore: number;
}

// Classify a single line as code or narrative using embedding similarity.
// Returns confidence 0..1 (higher = more confident it's code).
export async function classifyLineNLP(line: string): Promise<NLPClassification | null> {
  const t = line.trim();
  if (!t || t.length < 5) return null;

  try {
    const protos = await ensurePrototypes();
    const extractor = await getClassifier();

    // Get embedding for the input line.
    const output = await extractor(t, { pooling: "mean", normalize: true });
    const lineEmbed = Array.from(output.data as Float32Array);

    // Compute max similarity to code prototypes and narrative prototypes.
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

    // Normalize: if codeSim > narrativeSim, it's code.
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

// Batch classify multiple lines (more efficient — loads model once).
export async function classifyLinesNLP(lines: string[]): Promise<(NLPClassification | null)[]> {
  const results: (NLPClassification | null)[] = [];
  // Process in batches of 16 to avoid memory issues.
  const BATCH = 16;
  for (let i = 0; i < lines.length; i += BATCH) {
    const batch = lines.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map((l) => classifyLineNLP(l)));
    results.push(...batchResults);
  }
  return results;
}

// Check if the NLP model is available (has been loaded successfully).
export async function isNLPAvailable(): Promise<boolean> {
  try {
    await getClassifier();
    return true;
  } catch {
    return false;
  }
}
