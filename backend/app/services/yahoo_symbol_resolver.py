"""
Alpha India Yahoo Symbol Resolver
Sprint 31.5 — Production Resolver
Version: v2.0.0
"""

from __future__ import annotations

import yfinance as yf


class YahooSymbolResolver:
    """
    Resolve NSE symbols safely.

    Rules:
    - Try NSE (.NS)
    - Try BSE (.BO)
    - Return None quickly if Yahoo has no ticker.
    """

    @classmethod
    def resolve(cls, symbol: str):

        symbol = symbol.upper().strip()

        candidates = [
            f"{symbol}.NS",
            f"{symbol}.BO",
        ]

        for ticker_symbol in candidates:

            try:
                ticker = yf.Ticker(ticker_symbol)

                # Fast metadata call (much faster than ticker.info)
                hist = ticker.history(period="1d")

                if hist is not None and not hist.empty:
                    return ticker_symbol

            except Exception:
                pass

        return None