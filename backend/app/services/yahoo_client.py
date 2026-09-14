"""
Alpha India Yahoo Finance Client Service
Sprint 35 — Market Intelligence & Growth Screener PRO
Fetches live market valuation, CMP, market cap, and profile data from Yahoo Finance.
"""

import logging
from typing import Any, Dict, Optional
import yfinance as yf

from app.services.screener_client import ScreenerClient

logger = logging.getLogger(__name__)


class YahooClient:
    """
    Intelligent Market Intelligence client combining Screener.in official Indian metrics
    with Yahoo Finance automated symbol mapping (.NS / .BO).
    """

    @staticmethod
    def resolve_ticker(symbol: str, exchange: str = "NSE", bse_code: Optional[str] = None) -> yf.Ticker:
        clean_symbol = symbol.strip().upper()

        # BSE specific lookup if exchange is BSE exclusively
        if exchange and exchange.upper() == "BSE":
            ticker = yf.Ticker(f"{clean_symbol}.BO")
            try:
                if ticker.fast_info.get("lastPrice") is not None:
                    return ticker
            except Exception:
                pass

            if bse_code and bse_code.strip():
                ticker = yf.Ticker(f"{bse_code.strip()}.BO")
                try:
                    if ticker.fast_info.get("lastPrice") is not None:
                        return ticker
                except Exception:
                    pass

        # Try NSE primary
        ticker = yf.Ticker(f"{clean_symbol}.NS")
        try:
            if ticker.fast_info.get("lastPrice") is not None:
                return ticker
        except Exception:
            pass

        # Fallback to BSE
        ticker_bo = yf.Ticker(f"{clean_symbol}.BO")
        try:
            if ticker_bo.fast_info.get("lastPrice") is not None:
                return ticker_bo
        except Exception:
            pass

        return ticker

    @classmethod
    def fetch_market_metrics(
        cls,
        symbol: str,
        exchange: str = "NSE",
        bse_code: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Fetches live valuation and market metrics for an Indian listed equity.
        Prioritizes Screener.in for official Indian ratios (Stock P/E, ROCE, ROE, Book Value)
        and supplements with Yahoo Finance for fast pricing, 52W levels, and profile data.
        """
        clean_symbol = symbol.strip().upper()

        # 1. First attempt extraction from Screener.in (exact Indian standard)
        screener_data = None
        try:
            screener_data = ScreenerClient.fetch_metrics(clean_symbol)
        except Exception as sc_err:
            logger.debug(f"ScreenerClient error for {clean_symbol}: {sc_err}")

        # If Screener.in successfully returned full metrics, we can use them directly
        # and supplement with Yahoo only if needed.
        cmp_val = screener_data.get("cmp") if screener_data else None
        mcap_cr = screener_data.get("market_cap") if screener_data else None
        category = screener_data.get("market_cap_category") if screener_data else None
        pe_ratio = screener_data.get("pe_ratio") if screener_data else None
        pb_ratio = screener_data.get("pb_ratio") if screener_data else None
        roce = screener_data.get("roce") if screener_data else None
        roe = screener_data.get("roe") if screener_data else None
        book_value = screener_data.get("book_value") if screener_data else None
        dividend_yield = screener_data.get("dividend_yield") if screener_data else None
        high_52 = screener_data.get("fifty_two_week_high") if screener_data else None
        low_52 = screener_data.get("fifty_two_week_low") if screener_data else None
        sector = screener_data.get("sector") if screener_data else None
        industry = screener_data.get("industry") if screener_data else None

        # 2. Yahoo Finance fallback / supplement for missing metrics
        need_yahoo = (
            cmp_val is None
            or mcap_cr is None
            or pe_ratio is None
            or high_52 is None
            or sector is None
        )

        if need_yahoo:
            try:
                ticker = cls.resolve_ticker(clean_symbol, exchange, bse_code)
                fast = ticker.fast_info

                if cmp_val is None:
                    try:
                        cmp_val = fast.get("lastPrice") or fast.get("regularMarketPreviousClose")
                    except Exception:
                        pass

                if mcap_cr is None:
                    try:
                        mcap_raw = fast.get("marketCap")
                        if mcap_raw:
                            mcap_cr = round(mcap_raw / 10000000.0, 2)
                    except Exception:
                        pass

                if high_52 is None:
                    try:
                        high_52 = fast.get("yearHigh")
                        low_52 = fast.get("yearLow")
                    except Exception:
                        pass

                # Deep info fallback
                if pe_ratio is None or pb_ratio is None or sector is None:
                    try:
                        info = ticker.info or {}
                        if pe_ratio is None:
                            pe_ratio = info.get("trailingPE") or info.get("forwardPE")
                        if pb_ratio is None:
                            pb_ratio = info.get("priceToBook")
                        if roe is None:
                            raw_roe = info.get("returnOnEquity")
                            if raw_roe is not None:
                                roe = round(raw_roe * 100.0, 2)
                        if book_value is None:
                            book_value = info.get("bookValue")
                        if dividend_yield is None:
                            raw_div = info.get("dividendYield")
                            if raw_div is not None:
                                dividend_yield = round(raw_div * 100.0, 2)
                        if sector is None:
                            sector = info.get("sector")
                        if industry is None:
                            industry = info.get("industry")
                    except Exception as e:
                        logger.warning(f"Could not load Yahoo info for {clean_symbol}: {e}")

            except Exception as err:
                logger.debug(f"Yahoo fetch exception for {clean_symbol}: {err}")

        # Compute category if still missing
        if not category and mcap_cr is not None:
            if mcap_cr >= 20000.0:
                category = "LARGE"
            elif mcap_cr >= 5000.0:
                category = "MID"
            else:
                category = "SMALL"

        if cmp_val is None and mcap_cr is None and pe_ratio is None:
            return None

        return {
            "symbol": clean_symbol,
            "cmp": round(cmp_val, 2) if cmp_val else None,
            "market_cap": round(mcap_cr, 2) if mcap_cr else None,
            "market_cap_category": category or "SMALL",
            "pe_ratio": round(pe_ratio, 2) if pe_ratio else None,
            "pb_ratio": round(pb_ratio, 2) if pb_ratio else None,
            "peg_ratio": None,
            "roce": round(roce, 2) if roce is not None else None,
            "roe": round(roe, 2) if roe is not None else None,
            "book_value": round(book_value, 2) if book_value else None,
            "dividend_yield": round(dividend_yield, 2) if dividend_yield else None,
            "fifty_two_week_high": round(high_52, 2) if high_52 else None,
            "fifty_two_week_low": round(low_52, 2) if low_52 else None,
            "sector": sector,
            "industry": industry,
        }
