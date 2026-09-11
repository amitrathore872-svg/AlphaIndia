# backend/app/clients/yahoo_client.py

"""
Alpha India Yahoo Finance Client
Sprint 30.1 — Production Financial Client
Version: v1.0.1
"""

from __future__ import annotations

import time
from typing import Dict

import pandas as pd
import yfinance as yf


class YahooClient:
    """
    Production Yahoo Finance Client for Alpha India.
    Fetches structured financial statements from Yahoo Finance.
    """

    RETRIES = 3
    RETRY_DELAY = 2

    # ---------------------------------------------------------
    # Symbol Converter
    # ---------------------------------------------------------
    @staticmethod
    def to_symbol(symbol: str) -> str:
        symbol = symbol.upper().strip()

        if symbol.endswith(".NS"):
            return symbol

        return f"{symbol}.NS"

    # ---------------------------------------------------------
    # Yahoo Ticker
    # ---------------------------------------------------------
    def ticker(self, symbol: str) -> yf.Ticker:
        return yf.Ticker(self.to_symbol(symbol))

    # ---------------------------------------------------------
    # Company Info
    # ---------------------------------------------------------
    def company_info(self, symbol: str) -> Dict:

        ticker = self.ticker(symbol)

        try:
            info = ticker.info

            return {
                "symbol": symbol.upper(),
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
    def _download_dataframe(self, symbol: str, dataset: str) -> pd.DataFrame:

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

                # Quarterly cash flow is unavailable for many Indian banks.
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
