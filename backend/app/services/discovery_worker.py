"""
Alpha India Historical Filing Discovery Worker
Sprint 28.2
Version: v0.9.6
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.models.filing_registry import FilingRegistry
from app.models.monitoring_heartbeat import MonitoringHeartbeat


class DiscoveryWorker:
    """
    Discovers historical filings for one company.
    Currently returns sample filings.
    Sprint 28.3 will connect NSE/BSE APIs.
    """

    @staticmethod
    def discover_company(db: Session, symbol: str, exchange: str = "NSE"):
        """
        Discover filings for one company.
        """

        sample_filings = [
            {
                "period": "Q1 FY27",
                "announcement_date": datetime(2026, 7, 28),
                "filing_type": "Quarterly Results",
                "pdf_url": f"https://dummy.alphaindia.ai/{symbol}/Q1FY27.pdf",
            },
            {
                "period": "Q4 FY26",
                "announcement_date": datetime(2026, 4, 30),
                "filing_type": "Quarterly Results",
                "pdf_url": f"https://dummy.alphaindia.ai/{symbol}/Q4FY26.pdf",
            },
            {
                "period": "FY26 Annual",
                "announcement_date": datetime(2026, 5, 20),
                "filing_type": "Annual Report",
                "pdf_url": f"https://dummy.alphaindia.ai/{symbol}/FY26Annual.pdf",
            },
        ]

        discovered = 0

        for filing in sample_filings:

            exists = (
                db.query(FilingRegistry)
                .filter(
                    FilingRegistry.symbol == symbol,
                    FilingRegistry.period == filing["period"],
                )
                .first()
            )

            if exists:
                continue

            record = FilingRegistry(
                symbol=symbol,
                exchange=exchange,
                filing_type=filing["filing_type"],
                period=filing["period"],
                announcement_date=filing["announcement_date"],
                pdf_url=filing["pdf_url"],
                download_status="PENDING",
                parse_status="WAITING",
            )

            db.add(record)
            discovered += 1

        heartbeat = db.query(MonitoringHeartbeat).first()

        if heartbeat:
            heartbeat.results_found_today += discovered
            heartbeat.last_scan_time = datetime.utcnow()

        db.commit()

        return {
            "symbol": symbol,
            "exchange": exchange,
            "filings_discovered": discovered,
        }