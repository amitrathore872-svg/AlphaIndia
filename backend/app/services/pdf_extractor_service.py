"""
Alpha India — Institutional PDF Extractor & Segmentation Service
Downloads investor presentations and concall PDFs, extracts clean text,
and performs sectional segmentation (Management Speech vs Analyst Q&A).
"""

import io
import logging
import re
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import requests

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    PdfReader = None
    HAS_PYPDF = False

logger = logging.getLogger(__name__)


class PDFExtractorService:
    STORAGE_ROOT = Path("data/bronze/investor_documents")

    HTTP_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/pdf,application/xhtml+xml,text/html,*/*",
        "Referer": "https://www.nseindia.com/",
    }

    # Markers where management speech ends and Q&A begins
    QA_START_PATTERNS = [
        r"question[- ]and[- ]answer\s+session",
        r"floor\s+is\s+(?:now\s+)?open\s+for\s+questions",
        r"we\s+will\s+now\s+begin\s+the\s+q\s*&\s*a",
        r"we\s+shall\s+now\s+begin\s+the\s+question",
        r"ladies\s+and\s+gentlemen,\s+we\s+will\s+now\s+begin",
        r"open\s+the\s+floor\s+for\s+q\s*&\s*a",
        r"first\s+question\s+is\s+from",
        r"question\s+from\s+the\s+line\s+of",
    ]

    # Markers where management remarks start
    SPEECH_START_PATTERNS = [
        r"i\s+(?:would\s+like\s+to\s+)?hand\s+(?:over\s+)?the\s+conference\s+(?:over\s+)?to",
        r"i\s+now\s+invite\s+our\s+(?:managing\s+director|chairman|ceo|cfo)",
        r"let\s+me\s+hand\s+over\s+to\s+mr",
        r"welcome\s+to\s+the\s+(?:earnings|quarterly|investor)\s+conference\s+call",
        r"thank\s+you\s+and\s+a\s+very\s+warm\s+welcome",
    ]

    @classmethod
    def download_pdf(cls, url: str, symbol: str, doc_name: str) -> Optional[bytes]:
        """Downloads PDF bytes from URL with retry and timeout."""
        if not url or not url.startswith("http"):
            return None

        # Build local cached storage path
        clean_sym = re.sub(r"[^\w-]", "", symbol.upper())
        clean_name = re.sub(r"[^\w-]", "_", doc_name)[:120] + ".pdf"
        target_dir = cls.STORAGE_ROOT / clean_sym
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / clean_name

        if target_path.exists() and target_path.stat().st_size > 1024:
            try:
                return target_path.read_bytes()
            except Exception as e:
                logger.warning(f"Error reading cached PDF {target_path}: {e}")

        try:
            resp = requests.get(url, headers=cls.HTTP_HEADERS, timeout=35)
            if resp.status_code == 200 and len(resp.content) > 500:
                # Save to disk
                try:
                    target_path.write_bytes(resp.content)
                except Exception as write_err:
                    logger.warning(f"Could not write cache file {target_path}: {write_err}")
                return resp.content
            else:
                logger.warning(f"Failed to fetch PDF from {url}: HTTP {resp.status_code}")
                return None
        except Exception as exc:
            logger.error(f"Exception downloading PDF from {url}: {exc}")
            return None

    @classmethod
    def extract_text_from_bytes(cls, pdf_bytes: bytes, max_pages: int = 60) -> Tuple[str, int]:
        """Extracts text and page count from PDF bytes using pypdf."""
        if not HAS_PYPDF or not pdf_bytes:
            return "", 0

        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            total_pages = len(reader.pages)
            pages_to_extract = min(total_pages, max_pages)

            text_chunks = []
            for i in range(pages_to_extract):
                try:
                    page = reader.pages[i]
                    page_text = page.extract_text()
                    if page_text:
                        text_chunks.append(f"--- PAGE {i+1} ---\n{page_text}")
                except Exception as page_err:
                    logger.debug(f"Error extracting page {i+1}: {page_err}")

            extracted_clean = "\n\n".join(text_chunks).replace("\x00", "")
            return extracted_clean, total_pages
        except Exception as exc:
            logger.error(f"Failed to parse PDF bytes: {exc}")
            return "", 0

    @classmethod
    def segment_concall_transcript(cls, full_text: str) -> Dict[str, str]:
        """
        Segments a concall transcript into:
        1. Management Opening Remarks
        2. Analyst Q&A Dialogue
        """
        if not full_text:
            return {"management_speech": "", "analyst_qa": ""}

        lower = full_text.lower()

        # Find Q&A split point
        qa_index = -1
        for pattern in cls.QA_START_PATTERNS:
            match = re.search(pattern, lower)
            if match:
                qa_index = match.start()
                break

        if qa_index != -1:
            management_part = full_text[:qa_index].strip()
            qa_part = full_text[qa_index:].strip()
        else:
            # Fallback: first 40% management remarks, remainder Q&A
            split_len = int(len(full_text) * 0.4)
            management_part = full_text[:split_len].strip()
            qa_part = full_text[split_len:].strip()

        # Clean management part to start from opening remarks if preamble is long
        for pat in cls.SPEECH_START_PATTERNS:
            m = re.search(pat, management_part.lower())
            if m and m.start() > 100:
                management_part = management_part[m.start():]
                break

        return {
            "management_speech": management_part[:60000],  # Cap for context window safety
            "analyst_qa": qa_part[:90000],
        }

    @classmethod
    def process_document_url(
        cls,
        pdf_url: str,
        symbol: str,
        doc_type: str,
        doc_name: str,
    ) -> Dict[str, Any]:
        """
        Full pipeline: Downloads, extracts text, and segments document.
        """
        pdf_bytes = cls.download_pdf(pdf_url, symbol, doc_name)
        if not pdf_bytes:
            return {
                "success": False,
                "error": "Failed to download PDF artifact",
                "raw_text": "",
                "num_pages": 0,
                "management_speech": "",
                "analyst_qa": "",
            }

        full_text, num_pages = cls.extract_text_from_bytes(pdf_bytes)
        if not full_text or len(full_text.strip()) < 50:
            return {
                "success": False,
                "error": "PDF contained no extractable text (likely image scans)",
                "raw_text": "",
                "num_pages": num_pages,
                "management_speech": "",
                "analyst_qa": "",
            }

        if "CONCALL" in doc_type.upper() or "TRANSCRIPT" in doc_type.upper():
            segmented = cls.segment_concall_transcript(full_text)
            mgmt_speech = segmented["management_speech"]
            analyst_qa = segmented["analyst_qa"]
        else:
            # For presentations, entire document contains operating/capex slides
            mgmt_speech = full_text[:60000]
            analyst_qa = ""

        return {
            "success": True,
            "error": None,
            "raw_text": full_text,
            "num_pages": num_pages,
            "management_speech": mgmt_speech,
            "analyst_qa": analyst_qa,
        }
