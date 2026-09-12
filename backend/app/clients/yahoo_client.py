# backend/app/clients/yahoo_client.py

"""
Alpha India Yahoo Finance Client
Sprint 31.2 — Production Financial Client
Version: v1.1.0
"""

from __future__ import annotations

import time
from functools import lru_cache
from typing import Dict

import pandas as pd
import yfinance as yf

from app.services.yahoo_symbol_resolver import YahooSymbolResolver


class YahooClient:
    """
    Production Yahoo Finance Client for Alpha India.

    Features
    --------
    • Automatic NSE/BSE ticker resolution.
    • Retry mechanism.
    • Cached Yahoo ticker lookup.
    • Graceful handling of missing quarterly cash flow.
    """

    RETRIES = 3
    RETRY_DELAY = 2

    # ---------------------------------------------------------
    # Resolve Yahoo Symbol (.NS / .BO)
    # ---------------------------------------------------------
    @staticmethod
    @lru_cache(maxsize=10000)
    def resolve_symbol(symbol: str) -> str:

        resolved = YahooSymbolResolver.resolve(symbol)

        if resolved is None:
            raise ValueError(
                f"No Yahoo Finance ticker found for {symbol}"
            )

        return resolved

    # ---------------------------------------------------------
    # Yahoo Ticker
    # ---------------------------------------------------------
    @classmethod
    @lru_cache(maxsize=10000)
    def ticker(cls, symbol: str) -> yf.Ticker:

        yahoo_symbol = cls.resolve_symbol(symbol)
        return yf.Ticker(yahoo_symbol)

    # ---------------------------------------------------------
    # Company Info
    # ---------------------------------------------------------
    def company_info(self, symbol: str) -> Dict:

        ticker = self.ticker(symbol)

        try:
            info = ticker.info

            return {
                "symbol": symbol.upper(),
                "yahoo_symbol": ticker.ticker,
                "name": info.get("longName"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "market_cap": info.get("marketCap"),
                "currency": info.get("currency"),
                "exchange": info.get("exchange"),
            }

        except Exception:
            return {
                "symbol": symbol.upper(),
                "yahoo_symbol": None,
                "name": None,
                "sector": None,
                "industry": None,
                "market_cap": None,
                "currency": None,
                "exchange": None,
            }

    # ---------------------------------------------------------
    # Quarterly Statements
    # ---------------------------------------------------------
    def quarterly_income_statement(self, symbol: str) -> pd.DataFrame:
        return self._download_dataframe(symbol, "income")

    def quarterly_balance_sheet(self, symbol: str) -> pd.DataFrame:
        return self._download_dataframe(symbol, "balance")

    def quarterly_cash_flow(self, symbol: str) -> pd.DataFrame:
        return self._download_dataframe(symbol, "cashflow")

    # ---------------------------------------------------------
    # Internal Downloader
    # ---------------------------------------------------------
    def _download_dataframe(
        self,
        symbol: str,
        dataset: str,
    ) -> pd.DataFrame:

        ticker = self.ticker(symbol)

        for attempt in range(self.RETRIES):

            try:

                if dataset == "income":
                    df = ticker.quarterly_income_stmt

                elif dataset == "balance":
                    df = ticker.quarterly_balance_sheet

                elif dataset == "cashflow":
                    df = ticker.quarterly_cash_flow

                else:
                    raise ValueError("Unknown dataset requested.")

                # Yahoo does not publish quarterly cash flow
                # for many Indian banks.
                if df is None or df.empty:

                    if dataset == "cashflow":
                        return pd.DataFrame()

                    raise ValueError(
                        f"{dataset} returned empty dataframe."
                    )

                return df.fillna(0)

            except Exception:

                if attempt == self.RETRIES - 1:

                    if dataset == "cashflow":
                        return pd.DataFrame()

                    raise

                time.sleep(self.RETRY_DELAY)

        return pd.DataFrame()

    # ---------------------------------------------------------
    # Complete Financial Package
    # ---------------------------------------------------------
    def financial_package(self, symbol: str):

        return {
            "company": self.company_info(symbol),
            "income_statement": self.quarterly_income_statement(symbol),
            "balance_sheet": self.quarterly_balance_sheet(symbol),
            "cash_flow": self.quarterly_cash_flow(symbol),
        }