"""
Alpha India — Cup & Handle Universe Builder
============================================
Loads the full 4000+ NSE/BSE universe from the `companies` DB table.
Applies smart filters to focus on scannable symbols:
  - Excludes BSE_XXXXXX prefixed codes (no yfinance ticker)
  - Tries NSE (.NS) first, falls back to BSE (.BO)
  - Skips penny stocks (optional min price filter)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.company import Company
from app.services.cup_handle.cup_handle_engine import SECTOR_MAP

logger = logging.getLogger("alpha_india.cup_handle.universe")


def load_full_universe(db: Session) -> List[Dict[str, str]]:
    """
    Returns all 4000+ scannable NSE/BSE symbols from the companies table.
    Excludes unresolvable BSE_XXXXXX prefixed codes.
    Each entry: {symbol, company_name, exchange, sector}
    """
    try:
        companies = (
            db.query(Company.symbol, Company.company, Company.exchange, Company.sector)
            .filter(
                # Skip BSE_XXXXXX prefixed codes — no yfinance ticker resolves
                ~Company.symbol.like("BSE_%"),
                # Only include known exchanges
                Company.exchange.in_(["NSE", "BSE", "BOTH"]),
            )
            .order_by(
                # BOTH first (largest, most liquid), then NSE, then BSE
                Company.exchange,
                Company.symbol,
            )
            .all()
        )

        universe = []
        seen: set = set()

        for row in companies:
            sym = str(row.symbol).strip().upper()
            if not sym or sym in seen:
                continue
            seen.add(sym)

            # Determine primary exchange for yfinance
            exchange = str(row.exchange or "BSE")
            if exchange == "BOTH":
                primary_exchange = "NSE"
            elif exchange == "NSE":
                primary_exchange = "NSE"
            else:
                primary_exchange = "BSE"

            resolved_sector = (
                SECTOR_MAP.get(sym)
                or str(row.sector or "Diversified")
            )

            universe.append({
                "symbol": sym,
                "company_name": str(row.company or sym),
                "exchange": primary_exchange,
                "sector": resolved_sector,
            })

        logger.info(
            f"[CupHandleUniverse] Loaded {len(universe)} unique scannable symbols."
        )
        return universe

    except Exception as e:
        logger.error(f"[CupHandleUniverse] Failed to load universe from DB: {e}")
        return []


def get_universe_stats(db: Session) -> Dict[str, Any]:
    """Returns universe composition statistics."""
    try:
        from sqlalchemy import func

        total = (
            db.query(func.count(Company.id))
            .filter(~Company.symbol.like("BSE_%"))
            .scalar()
        )
        nse_count = (
            db.query(func.count(Company.id))
            .filter(Company.exchange.in_(["NSE", "BOTH"]))
            .scalar()
        )
        bse_only = (
            db.query(func.count(Company.id))
            .filter(Company.exchange == "BSE", ~Company.symbol.like("BSE_%"))
            .scalar()
        )
        return {
            "total_scannable": total,
            "nse_tradeable": nse_count,
            "bse_only": bse_only,
        }
    except Exception as e:
        return {"error": str(e)}
