"""
Mini-model: Layout-Aware Region Detection untuk ekstraksi kode PDF.

Pendekatan ini mengatasi kelemahan metode lama (line-by-line scoring)
dengan 3 strategi:

1. Region clustering — group baris berdasarkan posisi & jarak (bukan keyword)
2. Context-aware features — pakai sliding window, bukan per-baris
3. Code probability scoring — mini-model probabilistic

Cara kerja:
- Setiap baris dapat score 0.0 - 1.0 (probabilitas adalah kode)
- Score dihitung dari 6 features (indent, density, punctuation, dll.)
- Sliding window: rata-rata 3 baris sekitar untuk smooth prediction
- Region clustering: gabung baris dengan score > 0.5 yang adjacent
- Look-back/look-ahead: jangan putus blok kalau cuma 1 baris non-kode
"""

import re
import sys
from typing import List, Dict, Any, Tuple


def extract_lines_via_pymupdf(pdf_path: str) -> List[Dict]:
    """Extract per-line text + position via PyMuPDF.

    Returns list of {page, y, x0, text, font, size, line_num_global}
    """
    try:
        import pymupdf
    except ImportError:
        return []

    try:
        doc = pymupdf.open(pdf_path)
    except Exception:
        return []

    lines = []
    line_num = 0
    for page_idx in range(doc.page_count):
        page = doc[page_idx]
        blocks_data = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)

        for block in blocks_data.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                line_text = ""
                x0 = None
                font = ""
                size = 0
                for span in line.get("spans", []):
                    line_text += span.get("text", "")
                    if x0 is None:
                        x0 = span.get("bbox", [0])[0]
                    if not font:
                        font = span.get("font", "")
                    size = max(size, span.get("size", 0))

                line_text = line_text.rstrip()
                if not line_text.strip():
                    continue

                bbox = line.get("bbox", [0, 0, 0, 0])
                lines.append({
                    "page": page_idx,
                    "y": bbox[1],
                    "x0": x0 or bbox[0],
                    "text": line_text,
                    "font": font,
                    "size": size,
                    "line_num": line_num,
                })
                line_num += 1

    doc.close()
    return lines


# ─── Feature extraction per line ───

def code_keyword_score(text: str) -> float:
    """Skor 0-1 berdasarkan keyword kode umum (R, Python, SQL, JS)."""
    t = text.strip()
    if not t:
        return 0.0

    # R-specific keywords (bobot tinggi)
    r_strong = bool(re.search(
        r"\b(library|require|data\.frame|read\.csv|read\.table|read\.xlsx|"
        r"summary|lm|glm|aov|cor\.test|chisq\.test|t\.test|"
        r"ggplot|plot|abline|hist|boxplot|"
        r"qt|qnorm|qf|qchisq|pt|pnorm|"
        r"set\.seed|cbind|rbind|sapply|lapply|"
        r"cat|paste0?|sprintf|"
        r"sample|seq|rep)\s*\(",
        t
    ))
    if r_strong:
        return 1.0

    # Assignment operators (R-style)
    if re.search(r"\w+\s*<-", t):
        return 0.9
    if "<-" in t or "%>%" in t or ":=" in t:
        return 0.8

    # Common code keywords
    if re.search(r"\b(def|class|import|from|return|if|else|elif|for|while|"
                 r"function|var|let|const|public|private|static|void|int|float|"
                 r"print|echo|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE)\b", t):
        return 0.8

    # Function call pattern: word(
    if re.search(r"\b\w+\s*\(", t):
        return 0.6

    # Comment
    if re.match(r"^\s*#", t):
        return 0.7

    # R output (## atau [1])
    if t.startswith("## ") or t.startswith("[1] "):
        return 0.5

    return 0.0


def punctuation_density(text: str) -> float:
    """Densitas karakter kode ((), {}, [], ;, =, <, >, +, -, *, /, dll.)."""
    if not text:
        return 0.0
    t = text.strip()
    code_chars = sum(1 for c in t if c in "(){}[];=<>+-*/\\&|!?:,'\".@")
    # Normalisasi: code dengan 30%+ punct = 1.0
    ratio = code_chars / len(t)
    return min(1.0, ratio * 3.0)


def prose_penalty(text: str) -> float:
    """Penalty 0-1 kalau baris mirip narasi (banyak kata biasa)."""
    if not text:
        return 0.0
    t = text.strip().lower()
    # Indonesian + English prose words
    prose_words = re.findall(
        r"\b(?:dan|atau|yang|untuk|pada|dengan|dari|ke|di|ini|itu|"
        r"adalah|akan|sebuah|seorang|mahasiswa|rata|selisih|"
        r"proporsi|signifikan|berbeda|menggunakan|menghitung|"
        r"menganalisis|menunjukkan|menjelaskan|merupakan|tersebut|"
        r"dimana|sebagai|jika|maka|sehingga|karena|"
        r"the|and|or|for|with|from|to|in|of|a|an|is|are|was|were|"
        r"this|that|these|those|which|who|what|how|why|"
        r"can|will|would|should|may|might|must|"
        r"example|however|therefore|thus|hence|also)\b",
        t
    )
    if len(prose_words) >= 3:
        return 1.0
    if len(prose_words) >= 2:
        return 0.7
    if len(prose_words) == 1:
        return 0.3
    return 0.0


def line_density_score(text: str) -> float:
    """Skor berdasarkan kepadatan token (kode biasanya lebih padat)."""
    if not text:
        return 0.0
    t = text.strip()
    # Hitung token non-whitespace
    tokens = re.findall(r"\S+", t)
    if not tokens:
        return 0.0
    # Token dengan identifier panjang (>5 char) = kode
    long_tokens = sum(1 for tok in tokens if len(tok) > 5)
    if len(tokens) >= 3 and long_tokens >= 2:
        return 0.6
    if len(tokens) >= 2 and long_tokens >= 1:
        return 0.3
    return 0.0


def continuation_signal(line: Dict, prev_lines: List[Dict], next_lines: List[Dict]) -> float:
    """Skor 0-1: apakah baris ini kemungkinan bagian dari blok kode yang sudah berjalan?

    Pakai look-back (5 baris sebelumnya) dan look-ahead (5 baris sesudahnya).
    Longgar: kalau ada minimal 1 baris kode di window, boost.
    """
    score = 0.0

    # Look-back: cek 5 baris sebelumnya
    if prev_lines:
        prev_probs = [l.get("_code_prob", 0) for l in prev_lines[-5:] if l]
        if prev_probs:
            max_prev = max(prev_probs)
            count_code = sum(1 for p in prev_probs if p > 0.5)
            # Kalau ada >= 2 baris kode di 5 baris terakhir, boost kuat
            if count_code >= 2:
                score = max(score, 0.5)
            elif max_prev > 0.6:
                score = max(score, 0.4)
            elif max_prev > 0.4:
                score = max(score, 0.2)

    # Look-ahead: cek 5 baris sesudahnya
    if next_lines:
        next_probs = [l.get("_code_prob", 0) for l in next_lines[:5] if l]
        if next_probs:
            max_next = max(next_probs)
            count_code = sum(1 for p in next_probs if p > 0.5)
            if count_code >= 2:
                score = max(score, 0.4)
            elif max_next > 0.6:
                score = max(score, 0.3)

    return score


def compute_line_features(line: Dict, prev_lines: List[Dict] = None, next_lines: List[Dict] = None) -> Dict:
    """Hitung semua features untuk 1 baris."""
    text = line["text"]
    prev = prev_lines or []
    nxt = next_lines or []

    features = {
        "keyword": code_keyword_score(text),
        "punct": punctuation_density(text),
        "prose": prose_penalty(text),
        "density": line_density_score(text),
        "continuation": continuation_signal(line, prev, nxt),
    }

    # Mini-model v2: bobot di-tune dari analisis debug
    # - keyword: paling penting (0.30)
    # - punct: penting (0.25) — kode punya banyak () {} [] =
    # - density: sedikit (0.10)
    # - continuation: boost (0.20) — kalau sebelumnya kode, kemungkinan kode
    # - prose penalty: kuat (-0.30) — kalau banyak kata biasa, bukan kode
    # Boost: kalau keyword > 0.8 (R function call), bump prob ke atas
    score = (
        features["keyword"] * 0.30
        + features["punct"] * 0.25
        + features["density"] * 0.10
        + features["continuation"] * 0.20
        - features["prose"] * 0.30
    )

    # Strong signal: kalau keyword score >= 0.9 (R function calls), boost
    if features["keyword"] >= 0.9:
        score = max(score, 0.7)

    # Clamp 0-1
    features["code_prob"] = max(0.0, min(1.0, score))
    return features


# ─── Region clustering ───

def cluster_into_regions(lines: List[Dict], threshold: float = 0.5) -> List[List[Dict]]:
    """Group baris-baris berurutan yang punya code_prob > threshold.

    Strategi:
    - Baris dengan code_prob > threshold = kode
    - Baris dengan code_prob < threshold:
      - Kalau look-back & look-ahead > 0.6, tetap masuk blok (jangan putus)
      - Kalau tidak, putus blok
    """
    regions = []
    current = []

    for i, line in enumerate(lines):
        prob = line.get("_code_prob", 0)
        text = line["text"].strip()

        # R output (##) selalu ikut blok kalau sedang dalam blok kode
        is_r_output = text.startswith("## ") or text.startswith("[1] ")

        if prob >= threshold or (is_r_output and current):
            current.append(line)
        else:
            # Baris non-kode — cek apakah harus putus atau lanjut
            if current:
                # Look-ahead: cek 3 baris berikutnya
                next_probs = [l.get("_code_prob", 0) for l in lines[i:i + 3]]
                if next_probs and max(next_probs) >= 0.6:
                    # Baris setelahnya kode lagi → jangan putus, lanjut
                    current.append(line)
                else:
                    # Putus blok
                    if len(current) >= 2:
                        regions.append(current)
                    current = []
            # else: skip baris non-kode di awal

    if len(current) >= 2:
        regions.append(current)

    return regions


# ─── Region post-processing ───

def postprocess_region(region: List[Dict]) -> str:
    """Bersihkan region: strip ## R output, normalize whitespace."""
    lines = []
    for line in region:
        text = line["text"].rstrip()
        if not text.strip():
            continue
        # Skip pure ## R output (akan di-handle terpisah)
        t = text.strip()
        if t.startswith("## ") or t.startswith("[1] "):
            # Include tapi sebagai output, bukan kode
            lines.append(text)
        else:
            lines.append(text)
    return "\n".join(lines).strip()


def split_region_at_r_output(region: List[Dict]) -> List[List[Dict]]:
    """Pisah region kalau ada baris ## di tengah (output R bercampur kode)."""
    sub_regions = []
    current = []
    for line in region:
        text = line["text"].strip()
        is_r_output = text.startswith("## ") or text.startswith("[1] ")
        if is_r_output and current:
            # Save current chunk (sebelum ##)
            sub_regions.append(current)
            current = []
        elif not is_r_output:
            current.append(line)
        # Skip ## lines (R output, bukan kode)
    if current:
        sub_regions.append(current)
    return sub_regions


# ─── Main extractor ───

def extract_code_blocks(pdf_path: str) -> List[Dict[str, Any]]:
    """Ekstrak code blocks dari PDF pakai mini-model probabilistic.

    Pipeline:
    1. Extract per-line text + position via PyMuPDF
    2. Compute features per line (keyword, punct, density, continuation, prose)
    3. Mini-model: weighted combination → code_prob 0-1
    4. Cluster baris adjacent dengan code_prob > threshold
    5. Post-process: strip R output, normalize whitespace
    """
    lines = extract_lines_via_pymupdf(pdf_path)
    if not lines:
        return []

    # Step 1: Compute features & code_prob per line (2-pass untuk continuation)
    # Pass 1: keyword, punct, prose, density (tanpa continuation)
    for i, line in enumerate(lines):
        feat = compute_line_features(line, [], [])  # pass 1 tanpa continuation
        line["_features"] = feat
        line["_code_prob"] = feat["code_prob"]

    # Pass 2: recompute dengan continuation (pakai prob dari pass 1)
    for i, line in enumerate(lines):
        prev = lines[:i]
        nxt = lines[i + 1:]
        cont = continuation_signal(line, prev, nxt)
        # Recompute dengan continuation
        feat = line["_features"]
        feat["continuation"] = cont
        score = (
            feat["keyword"] * 0.30
            + feat["punct"] * 0.25
            + feat["density"] * 0.10
            + cont * 0.20
            - feat["prose"] * 0.30
        )
        if feat["keyword"] >= 0.9:
            score = max(score, 0.7)
        line["_code_prob"] = max(0.0, min(1.0, score))

    # Step 2: Cluster regions (threshold diturunkan ke 0.35)
    regions = cluster_into_regions(lines, threshold=0.35)

    # Step 3: Post-process each region
    blocks = []
    for region in regions:
        # Split di ## R output kalau ada
        sub_regions = split_region_at_r_output(region)
        for sub in sub_regions:
            if len(sub) < 2:
                continue
            code = postprocess_region(sub)
            if len(code) < 10:
                continue
            blocks.append({
                "code": code,
                "page": sub[0]["page"] + 1,
                "lines": code.count("\n") + 1,
                "source": "minimodel",
                "avg_prob": sum(l["_code_prob"] for l in sub) / len(sub),
            })

    return blocks


# ─── CLI for testing ───
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 minimodel_extract.py /path/to/file.pdf")
        sys.exit(1)

    pdf_path = sys.argv[1]
    blocks = extract_code_blocks(pdf_path)
    print(f"\nExtracted {len(blocks)} blocks:\n")
    for i, b in enumerate(blocks):
        print(f"=== Block #{i} | {b['lines']} lines | page {b['page']} | avg_prob={b['avg_prob']:.2f} ===")
        print(b["code"][:300])
        if len(b["code"]) > 300:
            print(f"... ({len(b['code'])} chars total)")
        print()
