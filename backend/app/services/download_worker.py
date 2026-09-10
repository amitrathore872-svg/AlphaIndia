from pathlib import Path
from datetime import datetime
import requests

from sqlalchemy.orm import Session

from app.models.filing_registry import FilingRegistry


class DownloadWorker:
    """
    Downloads filing PDFs into Bronze Data Lake.
    """

    BRONZE_ROOT = Path("data/bronze")

    @classmethod
    def download_company(cls, db: Session, symbol: str):

        filings = (
            db.query(FilingRegistry)
            .filter(
                FilingRegistry.symbol == symbol.upper(),
                FilingRegistry.download_status == "PENDING",
            )
            .all()
        )

        downloaded = 0

        for filing in filings:

            if not filing.pdf_url:
                continue

            company_folder = cls.BRONZE_ROOT / "nse" / symbol.upper()
            company_folder.mkdir(parents=True, exist_ok=True)

            filename = (
                filing.period.replace(" ", "_")
                .replace("/", "_")
                + ".pdf"
            )

            pdf_path = company_folder / filename

            try:
                response = requests.get(filing.pdf_url, timeout=60)

                if response.status_code == 200:

                    pdf_path.write_bytes(response.content)

                    filing.pdf_local_path = str(pdf_path)
                    filing.download_status = "DOWNLOADED"
                    filing.downloaded_at = datetime.utcnow()

                    downloaded += 1

            except Exception as e:
                print(f"Download failed for {filing.symbol} {filing.period}: {e}")

        db.commit()

        return {
            "symbol": symbol.upper(),
            "downloaded": downloaded,
            "remaining": (
                db.query(FilingRegistry)
                .filter(
                    FilingRegistry.symbol == symbol.upper(),
                    FilingRegistry.download_status == "PENDING",
                )
                .count()
            ),
        }