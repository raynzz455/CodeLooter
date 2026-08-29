"""NLP-based code classifier using sentence-transformers.

Uses paraphrase-multilingual-MiniLM-L12-v2 (118M params, ~47MB) — a
multilingual model that supports 50+ languages including Indonesian and
English. Perfect for Render free tier (512MB RAM, shared CPU).

How it works:
1. Load model lazily on first use (~2-3s, cached afterwards)
2. Generate reference embeddings for "code prototypes" and "narrative prototypes"
3. For each ambiguous line, compute cosine similarity to both prototypes
4. If code similarity > narrative similarity with >55% confidence -> classify as code

This catches code that pattern matching misses (unusual syntax, non-English
comments, continuation lines without clear signals).
"""
import re
import math
import logging
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)

_model = None
_prototypes = None

# Reference prototypes — sentences representing "pure code" and "pure narrative"
# in both Indonesian and English (the multilingual model handles both).
CODE_PROTOTYPES = [
    "library(ggplot2) data <- read.csv summary(model)",
    "def calculate_mean(values): return sum(values) / len(values)",
    "SELECT * FROM users WHERE age > 18 ORDER BY name",
    "import pandas as pd df = pd.read_csv print df head",
    "data <- data.frame x = c(1,2,3) print(data) chisq.test(data)",
    "for i in range(10): print(i) if i > 5: break",
    "vp <- lm(volume_penjualan ~ biaya_promosi, data = data_biaya)",
    "cor.test(x, y, method = 'pearson', conf.level = 0.95)",
]

NARRATIVE_PROTOTYPES = [
    "Interpretasi hasil menunjukkan bahwa terdapat hubungan positif",
    "Berdasarkan analisis data dapat disimpulkan bahwa hipotesis diterima",
    "The results indicate a significant correlation between variables",
    "Mahasiswa diharapkan mampu memahami konsep uji statistik",
    "Output yang dihasilkan menunjukkan p-value lebih besar dari 0.05",
    "Penelitian ini dilakukan untuk mengetahui hubungan antara variabel",
    "Karena p-value = 0.136 > 0.05 maka H0 diterima",
    "Setelah mempelajari modul ini mahasiswa diharapkan mampu menerapkan",
]


def _get_model():
    """Lazy-load the sentence-transformers model."""
    global _model
    if _model is not None:
        return _model
    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        logger.info("NLP model loaded: paraphrase-multilingual-MiniLM-L12-v2")
        return _model
    except Exception as e:
        logger.error("Failed to load NLP model: %s", e)
        return None


def _ensure_prototypes():
    """Generate prototype embeddings (called once, cached)."""
    global _prototypes
    if _prototypes is not None:
        return _prototypes

    model = _get_model()
    if model is None:
        return None

    try:
        import numpy as np
        code_embs = model.encode(CODE_PROTOTYPES, convert_to_numpy=True)
        narrative_embs = model.encode(NARRATIVE_PROTOTYPES, convert_to_numpy=True)
        _prototypes = {"code": code_embs, "narrative": narrative_embs}
        logger.info("Prototype embeddings generated")
        return _prototypes
    except Exception as e:
        logger.error("Failed to generate prototypes: %s", e)
        return None


def classify_line_nlp(line: str) -> Optional[Dict]:
    """Classify a single line as code or narrative using NLP embeddings.

    Returns:
        {
            "is_code": bool,
            "confidence": float,  # 0..1
            "code_score": float,
            "narrative_score": float,
        }
        or None if model unavailable or line too short.
    """
    t = line.strip()
    if not t or len(t) < 5:
        return None

    model = _get_model()
    protos = _ensure_prototypes()
    if model is None or protos is None:
        return None

    try:
        import numpy as np
        line_emb = model.encode([t], convert_to_numpy=True)[0]

        # Compute max similarity to code prototypes
        max_code_sim = 0.0
        for emb in protos["code"]:
            sim = float(np.dot(line_emb, emb) / (np.linalg.norm(line_emb) * np.linalg.norm(emb)))
            if sim > max_code_sim:
                max_code_sim = sim

        # Compute max similarity to narrative prototypes
        max_narrative_sim = 0.0
        for emb in protos["narrative"]:
            sim = float(np.dot(line_emb, emb) / (np.linalg.norm(line_emb) * np.linalg.norm(emb)))
            if sim > max_narrative_sim:
                max_narrative_sim = sim

        total = max_code_sim + max_narrative_sim
        if total == 0:
            return None

        code_score = max_code_sim / total
        narrative_score = max_narrative_sim / total
        is_code = code_score > narrative_score
        confidence = code_score if is_code else narrative_score

        return {
            "is_code": is_code,
            "confidence": confidence,
            "code_score": code_score,
            "narrative_score": narrative_score,
        }
    except Exception as e:
        logger.error("Classification failed for line '%s': %s", t[:50], e)
        return None


def classify_lines_nlp(lines: List[str]) -> List[Optional[Dict]]:
    """Batch classify multiple lines (loads model once)."""
    results = []
    BATCH = 16
    for i in range(0, len(lines), BATCH):
        batch = lines[i:i + BATCH]
        batch_results = [classify_line_nlp(line) for line in batch]
        results.extend(batch_results)
    return results


def is_nlp_available() -> bool:
    """Check if the NLP model is available (has been loaded successfully)."""
    model = _get_model()
    return model is not None


def nlp_enhanced_extraction(blocks: List[Dict], lines: List[str], captured_lines: set) -> Tuple[List[Dict], int]:
    """NLP enhancement pass: find code lines that pattern matching missed.

    Args:
        blocks: Already-extracted code blocks from pattern matching
        lines: All lines from the document text
        captured_lines: Set of lines already captured in blocks

    Returns:
        (nlp_blocks, nlp_code_count) - new blocks found by NLP and count of code lines
    """
    from pattern_extract import is_code_line, is_r_output, detect_language_r

    model = _get_model()
    if model is None:
        return [], 0

    # Find ambiguous lines: not captured, not R-output, not already classified as code
    ambiguous = []
    for i, line in enumerate(lines):
        t = line.strip()
        if not t or len(t) < 5:
            continue
        if t in captured_lines:
            continue
        if is_r_output(line):
            continue
        if is_code_line(line):
            continue
        # Only send lines with some code-like tokens to NLP
        if re.search(r"[()=<>{}]", t) and not t.endswith(".") and not t.endswith(":"):
            ambiguous.append((i, line))

    if not ambiguous:
        return [], 0

    # Limit to 50 ambiguous lines to keep inference fast
    sample = ambiguous[:50]
    nlp_results = classify_lines_nlp([line for _, line in sample])

    nlp_code_lines = []
    for i, (line_idx, line) in enumerate(sample):
        result = nlp_results[i]
        if result and result["is_code"] and result["confidence"] > 0.55:
            nlp_code_lines.append(line)

    # Group consecutive NLP-detected code lines into blocks
    nlp_blocks = []
    current = []
    for line in nlp_code_lines:
        current.append(line)
        if len(current) >= 2:
            code = "\n".join(current).strip()
            if len(code) >= 10 and not any(code in b["code"] for b in blocks):
                nlp_blocks.append({
                    "code": code,
                    "lang": detect_language_r(code),
                    "lines": code.count("\n") + 1,
                    "source": "nlp",
                    "page": 1,
                })
            current = []

    if current:
        code = "\n".join(current).strip()
        if len(code) >= 5 and not any(code in b["code"] for b in blocks):
            nlp_blocks.append({
                "code": code,
                "lang": detect_language_r(code),
                "lines": code.count("\n") + 1,
                "source": "nlp",
                "page": 1,
            })

    return nlp_blocks, len(nlp_code_lines)
