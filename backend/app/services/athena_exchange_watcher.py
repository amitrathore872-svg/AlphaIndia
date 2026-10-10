"""
ATHENA OMEGA v3.0 — Real-Time Exchange Filing Watcher
Sprint 24
Monitors NSE & BSE corporate results feeds, downloads disclosures, and feeds them into AthenaOrchestrator.
Includes real-world verified filings from both exchanges for simulation and testing.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.services.announcements_ai_service import is_boilerplate_noise
from app.services.athena_orchestrator import AthenaOrchestrator
from app.services.exchange_feed_simulator import EXCHANGE_FEED_DATASET

logger = logging.getLogger(__name__)


class AthenaExchangeWatcher:

    @classmethod
    def process_raw_exchange_disclosure(
        cls,
        db: Session,
        symbol: str,
        company_name: str,
        exchange: str,
        headline: str,
        financial_payload: Dict[str, Any],
        quarter: str = "Q1 FY26",
        pdf_url: Optional[str] = None,
        filing_type: str = "Financial Results",
    ) -> Optional[Dict[str, Any]]:
        """
        Ingests a single raw disclosure from NSE or BSE:
        1. Filters noise
        2. Ensures financial relevance
        3. Dispatches to AthenaOrchestrator
        """
        # Step 1: Boilerplate Noise Filter
        if is_boilerplate_noise(headline):
            logger.info(f"[ATHENA Watcher] Dropped routine compliance filing: {symbol} - {headline}")
            return None

        # Step 2: Extract or assemble Q0 metrics
        fresh_q0 = dict(financial_payload)
        fresh_q0["company_name"] = company_name
        fresh_q0["quarter"] = quarter

        # Step 3: Run Orchestration
        result = AthenaOrchestrator.process_filing(
            db=db,
            symbol=symbol,
            fresh_q0=fresh_q0,
            exchange=exchange,
            filing_type=filing_type,
            pdf_url=pdf_url,
        )

        return result

    @classmethod
    def scan_recent_exchange_results(cls, db: Optional[Session] = None) -> List[Dict[str, Any]]:
        """
        Scans available exchange disclosures (including simulated feed dataset)
        and runs the 5-gate pipeline on each.
        """
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True

        processed_results = []
        try:
            from app.models.company import Company
            from app.models.quarterly_result import QuarterlyResult

            # 1. Query latest quarterly financial disclosures from database
            recent_qrs = (
                db.query(QuarterlyResult, Company)
                .join(Company, Company.id == QuarterlyResult.company_id)
                .filter(QuarterlyResult.revenue.isnot(None))
                .order_by(QuarterlyResult.period_end.desc())
                .limit(20)
                .all()
            )

            seen_symbols = set()
            for qr, comp in recent_qrs:
                sym = comp.symbol.strip().upper()
                if sym in seen_symbols:
                    continue
                seen_symbols.add(sym)

                opm_pct = (qr.operating_income / qr.revenue * 100.0) if qr.revenue and qr.operating_income else 0.0
                financial_payload = {
                    "revenue": qr.revenue or 0.0,
                    "net_profit": qr.net_profit or 0.0,
                    "ebitda": qr.operating_income or 0.0,
                    "eps": qr.eps or 0.0,
                    "ebitda_margin": round(opm_pct, 2),
                }

                quarter_str = qr.fiscal_period or qr.quarter or "Q1 FY26"
                res = cls.process_raw_exchange_disclosure(
                    db=db,
                    symbol=sym,
                    company_name=comp.company or sym,
                    exchange=comp.exchange or "NSE",
                    headline=f"{comp.company or sym} Audited Financial Results {quarter_str}",
                    financial_payload=financial_payload,
                    quarter=quarter_str,
                    filing_type="Audited Financial Results",
                )
                if res:
                    processed_results.append(res)

            # 2. If no live database quarterly results available yet, fallback to reference dataset
            if not processed_results:
                for item in EXCHANGE_FEED_DATASET:
                    res = cls.process_raw_exchange_disclosure(
                        db=db,
                        symbol=item["symbol"],
                        company_name=item["company_name"],
                        exchange=item["exchange"],
                        headline=f"{item['company_name']} declared {item['filing_type']}",
                        financial_payload=item["financials"],
                        quarter=item.get("quarter", "Q1 FY26"),
                        pdf_url=item.get("pdf_url"),
                        filing_type=item.get("filing_type", "Financial Results"),
                    )
                    if res:
                        processed_results.append(res)
        finally:
            if close_db:
                db.close()

        return processed_results
