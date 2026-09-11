"""
Alpha India PDF Download Service
Sprint 29.2.1 — Bronze Layer Downloader (Production)
Version: v0.9.8-alpha

Downloads NSE filing PDFs into the Bronze Data Lake.
Creates unique filenames so no historical filing is overwritten.
"""

from datetime import datetime
from pathlib import Path
import re
import time

import requests
from sqlalchemy.orm import Session

from app.models.filing_registry import FilingRegistry


class PDFDownloadService:
    """
    Downloads filing PDFs into Bronze storage and updates PostgreSQL.
    """

    BRONZE_ROOT = Path("data/bronze/nse/pdfs")

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/140.0.0.0 Safari/537.36"
        ),
        "Accept": "application/pdf,*/*",
        "Referer": "https://www.nseindia.com/",
        "Origin": "https://www.nseindia.com",
        "Connection": "keep-alive",
    }

    # ==========================================================
    # Download all pending PDFs for one company
    # ==========================================================
    @classmethod
    def download_company(cls, db: Session, symbol: str):

        symbol = symbol.upper()

        filings = (
            db.query(FilingRegistry)
            .filter(
                FilingRegistry.symbol == symbol,
                FilingRegistry.download_status == "PENDING",
            )
            .order_by(FilingRegistry.announcement_date.desc())
            .all()
        )

        downloaded = 0
        failed = 0

        for filing in filings:

            if not filing.pdf_url or filing.pdf_url == "-":
                filing.download_status = "FAILED"
                failed += 1
                continue

            ok = cls.download_filing(db, filing)

            if ok:
                downloaded += 1
            else:
                failed += 1

        db.commit()

        remaining = (
            db.query(FilingRegistry)
            .filter(
                FilingRegistry.symbol == symbol,
                FilingRegistry.download_status == "PENDING",
            )
            .count()
        )

        return {
            "symbol": symbol,
            "downloaded": downloaded,
            "failed": failed,
            "remaining": remaining,
        }

    # ==========================================================
    # Download one filing
    # ==========================================================
    @classmethod
    def download_filing(cls, db: Session, filing: FilingRegistry):
        """
        Download one filing PDF.
        Distinguishes unavailable NSE archive files from real failures.
        """

        try:

            # ---------------------------------------
            # Missing archive PDF
            # ---------------------------------------
            if not filing.pdf_url or filing.pdf_url.strip() in ["", "-"]:
                filing.download_status = "ARCHIVE_MISSING"
                db.flush()
                return False

            fy_folder = cls.extract_financial_year(filing.period)

            company_folder = cls.BRONZE_ROOT / filing.symbol / fy_folder
            company_folder.mkdir(parents=True, exist_ok=True)

            destination = company_folder / cls.build_filename(filing)

            # Already downloaded
            if destination.exists():
                filing.download_status = "DOWNLOADED"
                filing.pdf_local_path = str(destination)
                filing.downloaded_at = datetime.utcnow()
                db.flush()
                return True

            response = cls.download_with_retry(filing.pdf_url)

            if response is None:
                filing.download_status = "ARCHIVE_UNAVAILABLE"
                db.flush()
                return False

            content_type = response.headers.get("Content-Type", "").lower()

            if "pdf" not in content_type:
                filing.download_status = "INVALID_FILE"
                db.flush()
                return False

            destination.write_bytes(response.content)

            filing.download_status = "DOWNLOADED"
            filing.pdf_local_path = str(destination)
            filing.downloaded_at = datetime.utcnow()

            db.flush()

            return True

        except Exception as e:
            print(f"Download failed for {filing.symbol}: {e}")

            filing.download_status = "FAILED"
            db.flush()

            return False
    
    # ==========================================================
    # HTTP Download with Retry
    # ==========================================================
    @classmethod
    def download_with_retry(cls, url: str):

        session = requests.Session()
        session.headers.update(cls.HEADERS)

        for attempt in range(3):

            try:
                response = session.get(
                    url,
                    timeout=40,
                    allow_redirects=True,
                )

                if response.status_code == 200:
                    return response

            except Exception:
                pass

            time.sleep(2)

        return None

    # ==========================================================
    # Financial Year Folder
    # ==========================================================
    @staticmethod
    def extract_financial_year(period: str):

        if not period:
            return "UNKNOWN"

        match = re.search(r"(FY\d{2})", period)

        if match:
            return match.group(1)

        return "UNKNOWN"

    # ==========================================================
    # Safe Filename Helper
    # ==========================================================
    @staticmethod
    def safe_filename(text: str):

        if not text:
            return "Unknown"

        text = re.sub(r"[<>:\"/\\\\|?*]", "", text)
        text = re.sub(r"\s+", "_", text.strip())

        return text

    # ==========================================================
    # Unique Filename Generator
    # ==========================================================
    @classmethod
    def build_filename(cls, filing: FilingRegistry):
        """
        Example:

        2026-08-06_Q1_FY27_Analysts_Institutional_Investor_Meet_Con_Call_Updates_9.pdf
        """

        date_part = (
            filing.announcement_date.strftime("%Y-%m-%d")
            if filing.announcement_date
            else "UNKNOWN_DATE"
        )

        period = cls.safe_filename(filing.period)

        filing_type = cls.safe_filename(
            filing.filing_type or "Document"
        )

        return (
            f"{date_part}_"
            f"{period}_"
            f"{filing_type}_"
            f"{filing.id}.pdf"
        )