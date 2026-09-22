"""
Alpha India NSE Announcement Collector
Sprint 28.5.2 (Production)

Discovers financial filings from NSE and stores metadata.
"""

import re
from datetime import date, datetime, timedelta
from typing import Optional
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
            f"{announcement.get('attchmntText', '')} "
            f"{announcement.get('attchmntFile', '')}"
        ).lower()

        return any(keyword in text for keyword in self.FINANCIAL_KEYWORDS)

    def _extract_period(self, announcement: dict, ann_date: Optional[date] = None) -> str:
        desc = announcement.get("desc") or ""
        text = announcement.get("attchmntText") or ""
        filename = announcement.get("attchmntFile") or ""
        combined = f"{desc} {text} {filename}".upper()

        # 1. Look for explicit pattern: Q[1-4] with FY / year in text or filename
        # Examples: Q4 FY26, Q1 FY27, Q4FY26, Q1FY2021, Q4 & FY2020, Q2 and H1 FY2021, Q4andFY2019
        m_q_fy = re.search(
            r"\b(Q[1-4])\s*(?:(?:AND|&|/)\s*(?:H[12]|9M|FY\s*\d{2,4})\s*)?(?:(?:AND|&)?\s*FY\s*|FY)?(\d{2,4})\b",
            combined,
        )
        if m_q_fy:
            q_num = m_q_fy.group(1)
            raw_yr = m_q_fy.group(2)
            if len(raw_yr) in (2, 4):
                fy_num = raw_yr[-2:]
                return f"{q_num} FY{fy_num}"

        # 2. Look for 'period ended' or 'quarter ended' with month and year
        # Examples: 'period ended Jun 30, 2026', 'period ended March 31, 2026', 'quarter ended 31 March 2020'
        m_ended = re.search(
            r"(?:PERIOD|QUARTER|HALF\s*YEAR|YEAR|MONTHS?)\s+ENDED\s+([A-Z0-9\s,\.-]{4,25})",
            combined,
        )
        if m_ended:
            date_str = m_ended.group(1).strip()
            try:
                parsed = parse_date(date_str, fuzzy=True)
                yr = parsed.year
                m = parsed.month
                if m in (1, 2, 3):
                    return f"Q4 FY{str(yr)[-2:]}"
                elif m in (4, 5, 6):
                    return f"Q1 FY{str(yr + 1)[-2:]}"
                elif m in (7, 8, 9):
                    return f"Q2 FY{str(yr + 1)[-2:]}"
                elif m in (10, 11, 12):
                    return f"Q3 FY{str(yr + 1)[-2:]}"
            except Exception:
                pass

        # 3. Look for standalone Q[1-4] with announcement date to infer exact fiscal year
        m_q = re.search(r"\b(Q[1-4])\b", combined)
        if m_q and ann_date:
            q_num = m_q.group(1)
            yr = ann_date.year
            m = ann_date.month
            if q_num == "Q4":
                fy = yr if m <= 7 else yr + 1
            elif q_num == "Q1":
                fy = yr + 1 if m >= 6 else yr
            elif q_num == "Q2":
                fy = yr + 1 if m >= 9 else yr
            elif q_num == "Q3":
                fy = yr if m <= 3 else yr + 1
            else:
                fy = yr
            return f"{q_num} FY{str(fy)[-2:]}"

        if "ANNUAL REPORT" in combined or "ANNUAL" in combined:
            m_yr = re.search(r"20\d{2}", combined)
            yr = int(m_yr.group(0)) if m_yr else (ann_date.year if ann_date else 2026)
            return f"FY{str(yr)[-2:]} Annual"

        if "INVESTOR PRESENTATION" in combined or "EARNINGS PPT" in combined:
            return "Investor Presentation"

        return "Unknown"

    def fetch_announcements(self, symbol: str, max_days: Optional[int] = None):
        data = self.client.announcements(symbol)

        filings = []
        cutoff_date = None
        if max_days is not None:
            cutoff_date = datetime.utcnow().date() - timedelta(days=max_days)

        for item in data:
            if not self._is_financial(item):
                continue

            ann_date = (
                parse_date(item["sort_date"]).date()
                if item.get("sort_date")
                else datetime.utcnow().date()
            )

            if cutoff_date and ann_date < cutoff_date:
                continue

            filings.append(
                {
                    "symbol": symbol.upper(),
                    "exchange": "NSE",
                    "period": self._extract_period(item, ann_date),
                    "filing_type": item.get("desc"),
                    "announcement_date": ann_date,
                    "pdf_url": item.get("attchmntFile"),
                    "title": item.get("attchmntText"),
                    "xbrl": item.get("hasXbrl", False),
                }
            )

        return filings

    def fetch_global_announcements(self):
        """
        Fetches live market-wide announcements across all listed equities.
        """
        data = self.client.global_announcements()
        filings = []

        for item in data:
            sym = item.get("symbol", "").upper()
            if not sym:
                continue

            ann_date = (
                parse_date(item["sort_date"]).date()
                if item.get("sort_date")
                else datetime.utcnow().date()
            )

            filings.append(
                {
                    "symbol": sym,
                    "company_name": item.get("sm_name", ""),
                    "exchange": "NSE",
                    "period": self._extract_period(item, ann_date),
                    "filing_type": item.get("desc") or "Corporate Announcement",
                    "announcement_date": ann_date,
                    "pdf_url": item.get("attchmntFile"),
                    "title": item.get("attchmntText") or item.get("desc"),
                    "xbrl": item.get("hasXbrl", False),
                    "is_financial": self._is_financial(item),
                }
            )

        return filings