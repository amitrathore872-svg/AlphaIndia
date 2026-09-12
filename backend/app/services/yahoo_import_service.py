"""
Alpha India Yahoo Financial Import Service
Sprint 31.5.1 — Production Financial Warehouse Importer
Version: v2.0.0
"""

from datetime import datetime
import pandas as pd
from sqlalchemy.orm import Session

from app.clients.yahoo_client import YahooClient
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult


class YahooImportService:
    """
    Imports quarterly financial statements from Yahoo Finance into
    Alpha India's Financial Warehouse.
    """

    client = YahooClient()

    # ----------------------------------------------------------
    # Safe row extractor
    # ----------------------------------------------------------

    @staticmethod
    def value(df: pd.DataFrame, row_name: str, period):
        try:
            if row_name in df.index:
                value = df.loc[row_name, period]
                if pd.isna(value):
                    return None
                return float(value)
        except Exception:
            pass
        return None

    # ----------------------------------------------------------
    # Import Company Financials
    # ----------------------------------------------------------

    @classmethod
    def import_company(cls, db: Session, symbol: str):

        symbol = symbol.upper()

        company = (
            db.query(Company)
            .filter(Company.symbol == symbol)
            .first()
        )

        if company is None:
            raise ValueError(f"{symbol} not found.")

        # ---------------------------------------------
        # Download Yahoo datasets
        # ---------------------------------------------

        income_df = cls.client.quarterly_income_statement(symbol)

        balance_df = pd.DataFrame()
        try:
            balance_df = cls.client.quarterly_balance_sheet(symbol)
        except Exception:
            pass

        quarters_imported = 0
        duplicates_skipped = 0

        # Columns are quarterly dates
        for period in income_df.columns:

            period_date = pd.Timestamp(period).date()

            exists = (
                db.query(QuarterlyResult)
                .filter(
                    QuarterlyResult.company_id == company.id,
                    QuarterlyResult.period_end == period_date,
                )
                .first()
            )

            if exists:
                duplicates_skipped += 1
                continue

            revenue = cls.value(income_df, "Total Revenue", period)

            if revenue is None:
                revenue = cls.value(income_df, "Operating Revenue", period)

            net_profit = cls.value(
                income_df,
                "Net Income",
                period,
            )

            if net_profit is None:
                net_profit = cls.value(
                    income_df,
                    "Net Income Common Stockholders",
                    period,
                )

            eps = cls.value(
                income_df,
                "Diluted EPS",
                period,
            )

            if eps is None:
                eps = cls.value(
                    income_df,
                    "Basic EPS",
                    period,
                )

            interest_income = cls.value(
                income_df,
                "Interest Income",
                period,
            )

            interest_expense = cls.value(
                income_df,
                "Interest Expense",
                period,
            )

            net_interest_income = cls.value(
                income_df,
                "Net Interest Income",
                period,
            )

            book_value = None

            if not balance_df.empty:
                equity = cls.value(
                    balance_df,
                    "Stockholders Equity",
                    period,
                )

                shares = cls.value(
                    balance_df,
                    "Ordinary Shares Number",
                    period,
                )

                if equity and shares and shares != 0:
                    book_value = equity / shares

            record = QuarterlyResult(
                company_id=company.id,
                fiscal_period=f"Q{((period_date.month-1)//3)+1}-{period_date.year}",
                period_end=period_date,
                revenue=revenue,
                net_profit=net_profit,
                eps=eps,
                interest_income=interest_income,
                interest_expense=interest_expense,
                net_interest_income=net_interest_income,
                book_value=book_value,
                revenue_growth=None,
                pat_growth=None,
                roce=None,
                source="YAHOO_FINANCE",
                imported_at=datetime.utcnow(),
            )

            db.add(record)
            quarters_imported += 1

        db.commit()

        return {
            "success": True,
            "symbol": symbol,
            "company_id": company.id,
            "quarters_imported": quarters_imported,
            "duplicates_skipped": duplicates_skipped,
            "quarters_available": len(income_df.columns),
        }