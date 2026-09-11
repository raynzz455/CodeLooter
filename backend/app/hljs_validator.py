"""highlight.js validation layer for Python backend.

Uses Pygments (pure Python, ~5MB) as the equivalent of highlight.js
for syntax validation. Pygments can guess the lexer (language) for a
code snippet and returns a relevance score.

This is Layer 2 of the multi-layer extraction:
1. Pattern matching (regex) — fast, catches ~80% of code
2. Pygments validation — syntax-aware, filters false positives
3. Pygments recovery — catches code that pattern matching missed
"""
import re
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Relevance threshold for multi-line blocks
BLOCK_RELEVANCE_THRESHOLD = 6

# For single lines, Pygments is less reliable — use higher threshold
LINE_RELEVANCE_THRESHOLD = 5

# Lines starting with these patterns are NOT code
NARRATIVE_PATTERNS = [
    re.compile(r"^\s*-\s"),              # bullet points
    re.compile(r"^\s*\d+\.\s"),          # numbered lists
    re.compile(r"^\s*Referensi\s*:", re.IGNORECASE),
    re.compile(r"^\s*Penugasan\s*:", re.IGNORECASE),
    re.compile(r"^\s*Interpretasi\s*:", re.IGNORECASE),
    re.compile(r"^\s*Output\s+yang\s+dihasilkan", re.IGNORECASE),
    re.compile(r"^\s*Penjelasan\s*:", re.IGNORECASE),
    re.compile(r"^\s*Analisis\s*:", re.IGNORECASE),
    re.compile(r"^\s*Kesimpulan\s*:", re.IGNORECASE),
    re.compile(r"^\s*Kasus\s+\d", re.IGNORECASE),
    re.compile(r"^\s*Contoh\s+\d", re.IGNORECASE),
    re.compile(r"^\s*Latihan\s+\d", re.IGNORECASE),
]

# UPGRADED (Task 21): Patterns that are DEFINITELY narrative, even if they contain
# = or (). Used as a pre-filter before pygments relevance scoring — matches lines
# like "X-squared = 2.2222 menunjukkan bahwa..." that pygments would otherwise
# mis-classify as code.
# IMPORTANT: single-word Indonesian terms use \b word boundaries so they don't
# match variable identifiers like `koefisien_variasi` or `signifikan_level`.
STATISTICAL_NARRATIVE_PATTERNS = [
    re.compile(r"menunjukkan\s+bahwa", re.IGNORECASE),
    re.compile(r"karena\s+p.?value", re.IGNORECASE),
    re.compile(r"\bH0\b.*diterima", re.IGNORECASE),
    re.compile(r"\bH0\b.*ditolak", re.IGNORECASE),
    re.compile(r"\bartinya\b", re.IGNORECASE),
    re.compile(r"\bR.?squared\b", re.IGNORECASE),
    re.compile(r"\bAdjusted\b", re.IGNORECASE),
    re.compile(r"\bsignifikan\b(?!_)", re.IGNORECASE),
    re.compile(r"\bkoefisien\b(?!_)", re.IGNORECASE),
    re.compile(r"hubungan\s+asosiasi", re.IGNORECASE),
    re.compile(r"\bpenyimpangan\b(?!_)", re.IGNORECASE),
    re.compile(r"\bdiperkirakan\b", re.IGNORECASE),
    re.compile(r"\bmeningkat\b", re.IGNORECASE),
    re.compile(r"\bberkontribusi\b", re.IGNORECASE),
    re.compile(r"\bmengindikasikan\b", re.IGNORECASE),
    re.compile(r"\bvariabilitas\b(?!_)", re.IGNORECASE),
    re.compile(r"\bdijelaskan\b", re.IGNORECASE),
]

_pygments_available = None


def _check_pygments():
    """Check if pygments is available."""
    global _pygments_available
    if _pygments_available is not None:
        return _pygments_available
    try:
        from pygments.lexers import guess_lexer
        _pygments_available = True
    except ImportError:
        _pygments_available = False
        logger.warning("Pygments not installed. Validation layer disabled.")
    return _pygments_available


def _get_relevance(code: str) -> Tuple[int, Optional[str]]:
    """Get relevance score and language for a code block using Pygments.
    
    Pygments doesn't return a numeric relevance score like highlight.js,
    but we can estimate it by counting how many tokens the lexer produces
    vs how much text remains untokenized.
    """
    if not _check_pygments():
        return 0, None
    try:
        from pygments.lexers import guess_lexer
        from pygments.token import Token
        
        lexer = guess_lexer(code)
        tokens = list(lexer.get_tokens(code))
        
        # Count "meaningful" tokens (not whitespace, not error)
        meaningful = 0
        errors = 0
        for tok_type, tok_val in tokens:
            if tok_type in (Token.Text, Token.Text.Whitespace):
                continue
            if tok_type in (Token.Error,):
                errors += 1
                continue
            meaningful += 1
        
        # Relevance = meaningful tokens - errors
        # More tokens = more likely to be valid code
        relevance = meaningful - errors * 2
        
        # Get language name
        lang_name = lexer.name.lower() if hasattr(lexer, 'name') else str(lexer.__class__.__name__).lower()
        
        return relevance, lang_name
    except Exception as e:
        logger.debug("Pygments relevance failed: %s", e)
        return 0, None


def validate_code_block(code: str) -> Dict:
    """Validate whether a text block is code or narrative.
    
    Returns:
        {
            "is_code": bool,
            "relevance": int,
            "language": str or None,
        }
    """
    relevance, language = _get_relevance(code)
    
    threshold = BLOCK_RELEVANCE_THRESHOLD
    if code.count("\n") <= 3:
        threshold = LINE_RELEVANCE_THRESHOLD
    
    return {
        "is_code": relevance >= threshold,
        "relevance": relevance,
        "language": language,
    }


def validate_line(line: str) -> Dict:
    """Validate a single line — useful for ambiguous lines.

    UPGRADED (Task 21): also filters statistical-narrative patterns
    ("X-squared = ... menunjukkan bahwa ...") that pygments would otherwise
    mis-classify as code.
    """
    t = line.strip()
    
    # Pre-filter: narrative patterns are never code
    for pattern in NARRATIVE_PATTERNS:
        if pattern.search(t):
            return {"is_code": False, "relevance": 0, "language": None}

    # Pre-filter (Task 21): statistical narrative patterns are never code
    for pattern in STATISTICAL_NARRATIVE_PATTERNS:
        if pattern.search(t):
            return {"is_code": False, "relevance": 0, "language": None}
    
    relevance, language = _get_relevance(t)
    return {
        "is_code": relevance >= LINE_RELEVANCE_THRESHOLD,
        "relevance": relevance,
        "language": language,
    }


def detect_language_pygments(code: str) -> Optional[str]:
    """Get the detected language for a code block."""
    if not _check_pygments():
        return None
    try:
        from pygments.lexers import guess_lexer
        lexer = guess_lexer(code)
        return lexer.name.lower() if hasattr(lexer, 'name') else None
    except Exception:
        return None
