"""NLP-based code classifier using ONNX Runtime (NOT PyTorch).

Uses onnxruntime (~15MB) + tokenizers (~5MB) + ONNX model (~22MB) = ~42MB total.
Fits in Render free tier (512MB RAM). NO PyTorch, NO TensorFlow, NO LLM.

The model (all-MiniLM-L6-v2) is a sentence embedding model that supports
English. For Indonesian + multilingual, swap to paraphrase-multilingual-MiniLM-L12-v2
(also available in ONNX format, ~47MB).

How it works:
1. Load ONNX model directly via onnxruntime.InferenceSession
2. Tokenize text via tokenizers (Rust-based, no Python ML framework)
3. Run ONNX inference to get embeddings
4. Compare cosine similarity to code vs narrative prototypes
5. If code_sim > narrative_sim with >55% confidence -> classify as code

SSR vs CSR:
- This module runs ONLY on the server (SSR side) in the FastAPI backend
- The browser (CSR side) never loads this model
- Browser sends file -> server runs pattern + NLP -> sends results back
"""
import os
import re
import math
import logging
import numpy as np
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)

_session = None
_tokenizer = None
_prototypes = None
_model_path = None

# Model URL — pre-converted ONNX format, ~22MB
# all-MiniLM-L6-v2: English-focused, small, fast
# For Indonesian support, use: paraphrase-multilingual-MiniLM-L12-v2 (~47MB)
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
ONNX_MODEL_URL = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx"
TOKENIZER_URL = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json"

# Cache directory for model files
CACHE_DIR = os.environ.get("CL_NLP_CACHE", os.path.expanduser("~/.cache/codelooter-nlp"))

# Reference prototypes
CODE_PROTOTYPES = [
    "library(ggplot2) data <- read.csv summary(model)",
    "def calculate_mean(values): return sum(values) / len(values)",
    "SELECT * FROM users WHERE age > 18 ORDER BY name",
    "import pandas as pd df = pd.read_csv print df head",
    "data <- data.frame x = c(1,2,3) print(data) chisq.test(data)",
    "for i in range(10): print(i) if i > 5: break",
    "vp <- lm(volume_penjualan ~ biaya_promosi, data = data_biaya)",
    "cor.test(x, y, method = pearson, conf.level = 0.95)",
]

NARRATIVE_PROTOTYPES = [
    "Interpretasi hasil menunjukkan bahwa terdapat hubungan positif",
    "Berdasarkan analisis data dapat disimpulkan bahwa hipotesis diterima",
    "The results indicate a significant correlation between variables",
    "Mahasiswa diharapkan mampu memahami konsep uji statistik",
    "Output yang dihasilkan menunjukkan p-value lebih besar dari 0.05",
    "Penelitian ini dilakukan untuk mengetahui hubungan antara variabel",
    "Karena p-value = 0.136 lebih besar dari 0.05 maka H0 diterima",
    "Setelah mempelajari modul ini mahasiswa diharapkan mampu menerapkan",
]


def _download_file(url: str, dest: str) -> bool:
    """Download a file if it doesn't exist."""
    if os.path.exists(dest):
        return True
    try:
        import urllib.request
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        logger.info("Downloading %s -> %s", url, dest)
        urllib.request.urlretrieve(url, dest)
        logger.info("Download complete: %s", dest)
        return True
    except Exception as e:
        logger.error("Download failed: %s", e)
        return False


def _get_model():
    """Lazy-load the ONNX model and tokenizer."""
    global _session, _tokenizer, _model_path
    if _session is not None and _tokenizer is not None:
        return _session, _tokenizer

    try:
        import onnxruntime as ort
        from tokenizers import Tokenizer

        model_file = os.path.join(CACHE_DIR, "model.onnx")
        tokenizer_file = os.path.join(CACHE_DIR, "tokenizer.json")

        # Download model and tokenizer if not cached
        if not _download_file(ONNX_MODEL_URL, model_file):
            return None, None
        if not _download_file(TOKENIZER_URL, tokenizer_file):
            return None, None

        # Load ONNX model
        _session = ort.InferenceSession(model_file)
        _tokenizer = Tokenizer.from_file(tokenizer_file)
        _model_path = model_file
        logger.info("ONNX model loaded: %s", model_file)
        return _session, _tokenizer
    except ImportError:
        logger.warning("onnxruntime or tokenizers not installed. NLP disabled.")
        logger.warning("Install with: pip install onnxruntime tokenizers")
        return None, None
    except Exception as e:
        logger.error("Failed to load ONNX model: %s", e)
        return None, None


def _embed(text: str) -> Optional[np.ndarray]:
    """Generate embedding for a single text using ONNX model."""
    session, tokenizer = _get_model()
    if session is None or tokenizer is None:
        return None

    try:
        # Tokenize
        encoded = tokenizer.encode(text)
        input_ids = np.array([encoded.ids], dtype=np.int64)
        attention_mask = np.array([encoded.attention_mask], dtype=np.int64)

        # Run ONNX inference
        inputs = {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
        }
        outputs = session.run(None, inputs)

        # Mean pool over sequence dimension
        # Output shape: (1, seq_len, hidden_size)
        token_embeddings = outputs[0]
        # Apply attention mask
        mask = attention_mask[..., None].astype(np.float32)
        pooled = (token_embeddings * mask).sum(axis=1) / mask.sum(axis=1)
        # Normalize
        norm = np.linalg.norm(pooled, axis=1, keepdims=True)
        norm[norm == 0] = 1
        pooled = pooled / norm
        return pooled[0]
    except Exception as e:
        logger.error("Embedding failed for '%s': %s", text[:50], e)
        return None


def _ensure_prototypes():
    """Generate prototype embeddings (cached after first call)."""
    global _prototypes
    if _prototypes is not None:
        return _prototypes

    code_embs = []
    for proto in CODE_PROTOTYPES:
        emb = _embed(proto)
        if emb is not None:
            code_embs.append(emb)

    narrative_embs = []
    for proto in NARRATIVE_PROTOTYPES:
        emb = _embed(proto)
        if emb is not None:
            narrative_embs.append(emb)

    if not code_embs or not narrative_embs:
        logger.error("Failed to generate prototype embeddings")
        return None

    _prototypes = {"code": code_embs, "narrative": narrative_embs}
    return _prototypes


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    dot = float(np.dot(a, b))
    mag_a = float(np.linalg.norm(a))
    mag_b = float(np.linalg.norm(b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


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

    protos = _ensure_prototypes()
    if protos is None:
        return None

    line_emb = _embed(t)
    if line_emb is None:
        return None

    # Compute max similarity to code prototypes
    max_code_sim = 0.0
    for emb in protos["code"]:
        sim = _cosine_similarity(line_emb, emb)
        if sim > max_code_sim:
            max_code_sim = sim

    # Compute max similarity to narrative prototypes
    max_narrative_sim = 0.0
    for emb in protos["narrative"]:
        sim = _cosine_similarity(line_emb, emb)
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


def classify_lines_nlp(lines: List[str]) -> List[Optional[Dict]]:
    """Batch classify multiple lines."""
    results = []
    BATCH = 16
    for i in range(0, len(lines), BATCH):
        batch = lines[i:i + BATCH]
        batch_results = [classify_line_nlp(line) for line in batch]
        results.extend(batch_results)
    return results


def is_nlp_available() -> bool:
    """Check if the NLP model is available."""
    session, tokenizer = _get_model()
    return session is not None and tokenizer is not None


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

    session, tokenizer = _get_model()
    if session is None or tokenizer is None:
        return [], 0

    # Find ambiguous lines
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
        if re.search(r"[()=<>{}]", t) and not t.endswith(".") and not t.endswith(":"):
            ambiguous.append((i, line))

    if not ambiguous:
        return [], 0

    # Limit to 50 lines
    sample = ambiguous[:50]
    nlp_results = classify_lines_nlp([line for _, line in sample])

    nlp_code_lines = []
    for i, (line_idx, line) in enumerate(sample):
        result = nlp_results[i]
        if result and result["is_code"] and result["confidence"] > 0.55:
            nlp_code_lines.append(line)

    # Group into blocks
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
                    "source": "nlp-onnx",
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
                "source": "nlp-onnx",
                "page": 1,
            })

    return nlp_blocks, len(nlp_code_lines)
