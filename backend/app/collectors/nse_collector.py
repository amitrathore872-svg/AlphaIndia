"""
Alpha India — Multi-Exchange Live Corporate Announcement Collector
Sprint 34 Production Version
Discovers and ingests real-time filings from official NSE & BSE feeds.
"""

from typing import Optional
from app.db.database import SessionLocal
from app.services.discovery_worker import DiscoveryWorker


def collect_nse_announcements(symbol: Optional[str] = None):
    """
    Collects live corporate announcements from NSE and BSE and saves to filing_registry and announcements.
    If symbol is None or "ALL", polls the entire live exchange market wire.
    """
    db = SessionLocal()
    try:
        if not symbol or symbol.upper() == "ALL":
            res = DiscoveryWorker.discover_live_market(db)
            print(f"[Exchange Collector] Live Market Wire Discovered {res['new_entries_discovered']} new filings (Scanned {res['total_scanned']})")
            return res
        else:
            res = DiscoveryWorker.discover_company(db, symbol, exchange="NSE")
            print(f"[Exchange Collector] Discovered {res['filings_discovered']} filings for {symbol}")
            return res

    finally:
        db.close()