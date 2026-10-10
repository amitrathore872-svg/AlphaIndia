"""
Alpha India - Backtest Universe Service
Sprint 43.1 Institutional Equity Universe Provider & Survivorship Safeguards

Supplies constituent universes:
- NIFTY 50
- NIFTY 100
- NIFTY 200
- NIFTY 500
- TEST_10 (Controlled 10-stock validation set)
- Custom universe
Strictly excludes ETFs, Index funds, and non-equity series (e.g., UNIGOLD, GOLDBEES).
Includes survivorship bias disclosures.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from sqlalchemy.orm import Session
from app.models.company import Company

logger = logging.getLogger("alpha_india.backtest.universe")

ETF_EXCLUSION_KEYWORDS = [
    "ETF", "BEES", "GOLD", "SILVER", "NIFTYBEES", "BANKBEES",
    "LIQUID", "INVIT", "REIT", "UNIGOLD", "SETF", "FOF"
]

TEST_10_SYMBOLS = [
    "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "LT",
    "BHARATFORG", "TATAPOWER", "KAYNES", "TRENT", "DIVISLAB"
]

NIFTY_50_BENCHMARK_SYMBOLS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL", "SBIN",
    "LICI", "ITC", "HINDUNILVR", "LT", "BAJFINANCE", "HCLTECH", "MARUTI", "SUNPHARMA",
    "ADANIENT", "KOTAKBANK", "TITAN", "ONGC", "TATAMOTORS", "NTPC", "AXISBANK",
    "ADANIPORTS", "POWERGRID", "COALINDIA", "TATASTEEL", "M&M", "BAJAJFINSV", "SIEMENS",
    "ULTRACEMCO", "IOC", "BPCL", "ASIANPAINT", "HAL", "BEL", "NESTLEIND", "ZOMATO",
    "JSWSTEEL", "TRENT", "VBL", "GRASIM", "TECHM", "HINDALCO", "LTIM", "DLF",
    "EICHERMOT", "DIVISLAB", "CIPLA", "INDIGO", "APOLLOHOSP", "DRREDDY", "SHRIRAMFIN"
]


class UniverseService:
    """
    Manages equities universes with strict non-equity and ETF filtering.
    """

    NIFTY500_CSV = Path(__file__).resolve().parents[3] / "data" / "ind_nifty500list.csv"

    @classmethod
    def is_etf_or_non_equity(cls, symbol: str, company_name: str = "") -> bool:
        """
        Detects whether an instrument is an ETF, Index unit, or illiquid derivative.
        Filters out tokens like UNIGOLD, GOLDBEES, etc.
        """
        clean_sym = symbol.strip().upper()
        clean_name = company_name.strip().upper()

        for kw in ETF_EXCLUSION_KEYWORDS:
            if kw in clean_sym or (clean_name and kw in clean_name):
                return True
        return False

    @classmethod
    def get_universe_symbols(
        cls,
        universe_name: str = "NIFTY_500",
        db: Optional[Session] = None,
        custom_symbols: Optional[List[str]] = None,
        exclude_etfs: bool = True,
    ) -> Dict[str, Any]:
        """
        Retrieves vetted list of symbols for the specified universe.
        Returns dictionary with symbols list, total count, universe type, and survivorship warnings.
        """
        uname = universe_name.upper().strip()
        survivorship_warning = (
            "WARNING: Current constituent universe may introduce survivorship bias "
            "as historical constituent additions/deletions are not dynamically simulated."
        )

        symbols: List[str] = []

        if uname in ("TEST_10", "VALIDATION_10"):
            symbols = list(TEST_10_SYMBOLS)
        elif uname == "NIFTY_50":
            symbols = list(NIFTY_50_BENCHMARK_SYMBOLS)
        elif uname == "CUSTOM" and custom_symbols:
            symbols = [s.strip().upper().replace(".NS", "").replace(".BO", "") for s in custom_symbols]
        else:
            # Load from official NIFTY 500 CSV if available
            csv_path = cls.NIFTY500_CSV
            if not csv_path.exists():
                # Try relative to backend
                csv_path = Path(__file__).resolve().parent.parent.parent / "data" / "ind_nifty500list.csv"

            if csv_path.exists():
                try:
                    df = pd.read_csv(csv_path)
                    # Filter series == 'EQ'
                    if "Series" in df.columns:
                        df = df[df["Series"].str.strip() == "EQ"]

                    sym_col = "Symbol" if "Symbol" in df.columns else df.columns[2]
                    all_syms = df[sym_col].str.strip().str.upper().tolist()

                    if uname == "NIFTY_50":
                        symbols = all_syms[:50]
                    elif uname == "NIFTY_100":
                        symbols = all_syms[:100]
                    elif uname == "NIFTY_200":
                        symbols = all_syms[:200]
                    else:  # Default NIFTY_500
                        symbols = all_syms[:500]
                except Exception as e:
                    logger.error(f"[UniverseService] Error reading Nifty CSV: {e}")

            # Fallback to database companies if CSV failed
            if not symbols and db:
                query = db.query(Company.symbol).filter(Company.exchange.in_(["NSE", "BOTH"]))
                if uname == "NIFTY_50":
                    query = query.limit(50)
                elif uname == "NIFTY_100":
                    query = query.limit(100)
                elif uname == "NIFTY_200":
                    query = query.limit(200)
                else:
                    query = query.limit(500)
                symbols = [row[0] for row in query.all()]

        # Apply ETF / Non-Equity Exclusion Filter
        clean_symbols = []
        excluded_symbols = []
        for sym in symbols:
            clean = sym.strip().upper().replace(".NS", "").replace(".BO", "")
            if exclude_etfs and cls.is_etf_or_non_equity(clean):
                excluded_symbols.append(clean)
            else:
                clean_symbols.append(clean)

        return {
            "universe": uname,
            "symbols": clean_symbols,
            "total_count": len(clean_symbols),
            "excluded_count": len(excluded_symbols),
            "excluded_instruments": excluded_symbols,
            "survivorship_warning": survivorship_warning,
        }
