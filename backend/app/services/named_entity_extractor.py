"""
Alpha India — Named Entity Extractor  (Phase 3)
Extracts company names (ORG entities) from raw text using spaCy.
Uses the small English model (en_core_web_sm) for speed and low memory.
Falls back gracefully to a regex heuristic if spaCy model is not downloaded.

Usage:
    from app.services.named_entity_extractor import extract_companies
    results = extract_companies("Reliance Industries reported 20% revenue growth...")
    # [{"company_name": "Reliance Industries", "confidence": 0.85}]
"""

import logging
import re
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# spaCy model — loaded once at module level (thread-safe singleton)
# ---------------------------------------------------------------------------
_nlp = None
SPACY_MODEL = "en_core_web_sm"
CONFIDENCE_THRESHOLD = 0.60  # entities below this score are discarded

# Noise words that are ORG entities but NOT companies
_NOISE_WORDS = {
    "nse", "bse", "sebi", "rbi", "cbi", "mca", "itat", "nclt", "nclat",
    "sensex", "nifty", "dalal", "bloomberg", "reuters", "moneycontrol",
    "economic times", "livemint", "yourstory", "techcrunch", "twitter",
    "reddit", "youtube", "india", "govt", "government", "ministry",
    "etmarkets", "et markets", "the hindu", "ndtv", "cnbc", "zee",
    "ubs", "jpmorgan", "morgan stanley", "goldman sachs", "us federal reserve",
    "federal reserve", "the fed", "imf", "world bank", "bank of japan",
    "european central bank", "nasdaq", "dow jones", "s&p", "ftse",
    "kospi", "hang seng", "nikkei",
}

# Patterns that indicate noise (not real company names)
import re as _re
_NOISE_PATTERNS = [
    _re.compile(r"\.\w{2,5}$"),          # filenames: Prudential-life_200.jpg
    _re.compile(r"^Rs\s?\.?\d"),          # currency: Rs 7.75
    _re.compile(r"^\$?\d+"),              # starts with digit / price
    _re.compile(r"Q[1-4]\s?FY\d{2}"),     # quarter references: Q4 FY25
    _re.compile(r"\d{4,}"),               # 4+ consecutive digits
    _re.compile(r"^(the|an?|of|in)\s", _re.IGNORECASE),  # starts with article
]

# Minimum characters for a company name to be considered valid
_MIN_NAME_LEN = 5
_MIN_WORDS    = 1    # spaCy path; regex path already handles word structure


def _load_model():
    """Load spaCy model lazily; fall back to None if not installed."""
    global _nlp
    if _nlp is not None:
        return _nlp
    try:
        import spacy
        _nlp = spacy.load(SPACY_MODEL)
        logger.info(f"[NER] spaCy model '{SPACY_MODEL}' loaded.")
    except OSError:
        logger.warning(
            f"[NER] spaCy model '{SPACY_MODEL}' not found. "
            "Run: python -m spacy download en_core_web_sm"
        )
        _nlp = None
    except ImportError:
        logger.warning("[NER] spaCy not installed. Falling back to regex heuristic.")
        _nlp = None
    return _nlp


def _regex_extract(text: str) -> List[Dict[str, Any]]:
    """
    Lightweight regex fallback that finds CamelCase or ALL-CAPS words
    that look like company names (≥ 4 chars, optionally followed by Ltd/Corp/Inc).
    Confidence is fixed at 0.60 (minimum threshold) for regex matches.
    """
    # Pattern: e.g. "Reliance Industries", "HDFC Bank", "Infosys Ltd"
    pattern = r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Ltd|Limited|Corp|Inc|Pvt|Technologies|Industries|Finance|Bank|Energy|Pharma|Health))?)\b"
    matches = re.findall(pattern, text)
    results = []
    seen = set()
    for m in matches:
        name = m.strip()
        if (
            len(name) >= _MIN_NAME_LEN
            and name.lower() not in _NOISE_WORDS
            and name not in seen
        ):
            results.append({"company_name": name, "confidence": 0.60})
            seen.add(name)
    return results[:10]  # cap at 10 per text block


def _is_noise(name: str) -> bool:
    """Return True if the name is clearly not a real company."""
    lower = name.lower().strip()
    if lower in _NOISE_WORDS:
        return True
    if len(name) < _MIN_NAME_LEN:
        return True
    for pat in _NOISE_PATTERNS:
        if pat.search(name):
            return True
    return False


def extract_companies(text: str) -> list:
    """
    Main extraction function. Returns a list of dicts:
      {"company_name": str, "confidence": float}
    Confidence is a soft score: 0.85 for spaCy ORGs, 0.60 for regex fallback.
    Only results above CONFIDENCE_THRESHOLD are returned.
    """
    if not text or len(text.strip()) < 10:
        return []

    nlp = _load_model()

    if nlp is not None:
        # ---- spaCy path ----
        doc = nlp(text[:5000])  # limit input to 5000 chars for speed
        seen = set()
        results = []
        for ent in doc.ents:
            if ent.label_ != "ORG":
                continue
            name = ent.text.strip()
            if _is_noise(name) or name in seen:
                continue
            confidence = 0.85  # spaCy ORG entity = high confidence
            if confidence >= CONFIDENCE_THRESHOLD:
                results.append({"company_name": name, "confidence": confidence})
                seen.add(name)
        return results[:15]  # cap per text block
    else:
        # ---- regex fallback ----
        return _regex_extract(text)

