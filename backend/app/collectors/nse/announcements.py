"""
Alpha India NSE Announcement Collector
Sprint 28.5.2 (Production)

Discovers financial filings from NSE and stores metadata.
"""

from datetime import datetime
from dateutil.parser import parse as parse_date

from app.clients.nse_client import NSEClient


class NSEAnnouncementCollector:

    FINANCIAL_KEYWORDS = [
        "financial result",
        "financial results",
        "annual report",
        "investor presentation",
        "board meeting",
        "earnings",
        "quarterly results",
    ]

    def __init__(self):
        self.client = NSEClient()

    def _is_financial(self, announcement: dict) -> bool:
        text = (
            f"{announcement.get('desc', '')} "
            f"{announcement.get('attchmntText', '')}"
        ).lower()

        return any(keyword in text for keyword in self.FINANCIAL_KEYWORDS)

    def _extract_period(self, announcement: dict) -> str:
        text = (
            f"{announcement.get('desc', '')} "
            f"{announcement.get('attchmntText', '')}"
        )

        text = text.upper()

        if "Q1" in text:
            return "Q1 FY27"
        if "Q2" in text:
            return "Q2 FY27"
        if "Q3" in text:
            return "Q3 FY27"
        if "Q4" in text:
            return "Q4 FY26"

        if "ANNUAL REPORT" in text:
            return "FY26 Annual"

        if "INVESTOR PRESENTATION" in text:
            return "Investor Presentation"

        return "Unknown"

    def fetch_announcements(self, symbol: str):
        data = self.client.announcements(symbol)

        filings = []

        for item in data:

            if not self._is_financial(item):
                continue

            filings.append(
                {
                    "symbol": symbol.upper(),
                    "exchange": "NSE",
                    "period": self._extract_period(item),
                    "filing_type": item.get("desc"),
                    "announcement_date": parse_date(item["sort_date"]).date(),
                    "pdf_url": item.get("attchmntFile"),
                    "title": item.get("attchmntText"),
                    "xbrl": item.get("hasXbrl", False),
                }
            )

        return filings