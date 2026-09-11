"""
Alpha India Yahoo Finance Import Service
Sprint 30.2 — Financial Warehouse Importer
Version: v1.0.0
"""

from datetime import datetime
import logging
import pandas as pd
from sqlalchemy.orm import Session

from app.clients.yahoo_client import YahooClient
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult

logger = logging.getLogger(__name__)


class YahooImportService:
    """
    Imports quarterly financial statements from Yahoo Finance
    into Alpha India's Financial Warehouse.
    """

    client = YahooClient()

    # ==========================================================
    # Main Import
    # ==========================================================
    @classmethod
    def import_company(cls, db: Session, symbol: str):

        symbol = symbol.upper()

        company = (
            db.query(Company)
            .filter(Company.symbol == symbol)
            .first()
        )

        if company is None:
            raise ValueError(f"{symbol} not found in companies table.")

        logger.info("Importing Yahoo Finance data for %s", symbol)

        income_df = cls.client.quarterly_income_statement(symbol)
        balance_df = cls.client.quarterly_balance_sheet(symbol)

        imported = 0
        skipped = 0

        # Yahoo returns newest quarter first.
        quarters = sorted(income_df.columns)

        previous_revenue = None
        previous_profit = None

        for quarter in quarters:

            period_end = quarter.date()
            fiscal_period = cls._quarter_name(period_end)

            exists = (
                db.query(QuarterlyResult)
                .filter(
                    QuarterlyResult.company_id == company.id,
                    QuarterlyResult.period_end == period_end,
                )
                .first()
            )

            if exists:
                skipped += 1
                continue

            income = cls._normalize_income(income_df, quarter)
            balance = cls._normalize_balance(balance_df, quarter)

            revenue_growth = None
            pat_growth = None

            if previous_revenue and income["revenue"]:
                revenue_growth = round(
                    (
                        (income["revenue"] - previous_revenue)
                        / previous_revenue
                    )
                    * 100,
                    2,
                )

            if previous_profit and income["net_profit"]:
                pat_growth = round(
                    (
                        (income["net_profit"] - previous_profit)
                        / previous_profit
                    )
                    * 100,
                    2,
                )

            previous_revenue = income["revenue"]
            previous_profit = income["net_profit"]

            result = QuarterlyResult(
                company_id=company.id,

                fiscal_period=fiscal_period,
                period_end=period_end,
                result_date=period_end,

                revenue=income["revenue"],
                net_profit=income["net_profit"],
                eps=income["eps"],

                interest_income=income["interest_income"],
                interest_expense=income["interest_expense"],
                net_interest_income=income["net_interest_income"],

                total_equity=balance["total_equity"],
                total_debt=balance["total_debt"],
                book_value=balance["book_value"],

                revenue_growth=revenue_growth,
                pat_growth=pat_growth,
                roce=None,

                source="YAHOO_FINANCE",
                imported_at=datetime.utcnow(),
            )

            db.add(result)
            imported += 1

        db.commit()

        logger.info(
            "%s imported=%s skipped=%s",
            symbol,
            imported,
            skipped,
        )

        return {
            "success": True,
            "symbol": symbol,
            "company_id": company.id,
            "quarters_imported": imported,
            "duplicates_skipped": skipped,
            "quarters_available": len(quarters),
        }

    # ==========================================================
    # Income Statement Mapping
    # ==========================================================
    @classmethod
    def _normalize_income(cls, df: pd.DataFrame, quarter):

        return {
            "revenue": cls._metric(df, quarter, "Total Revenue"),

            "net_profit": (
                cls._metric(
                    df,
                    quarter,
                    "Net Income From Continuing Operation Net Minority Interest",
                )
                or cls._metric(df, quarter, "Net Income")
            ),

            "eps": (
                cls._metric(df, quarter, "Basic EPS")
                or cls._metric(df, quarter, "Diluted EPS")
            ),

            "interest_income": cls._metric(
                df,
                quarter,
                "Interest Income",
            ),

            "interest_expense": cls._metric(
                df,
                quarter,
                "Interest Expense",
            ),

            "net_interest_income": cls._metric(
                df,
                quarter,
                "Net Interest Income",
            ),
        }

    # ==========================================================
    # Balance Sheet Mapping
    # ==========================================================
    @classmethod
    def _normalize_balance(cls, df: pd.DataFrame, quarter):

        return {
            "total_equity": (
                cls._metric(
                    df,
                    quarter,
                    "Total Equity Gross Minority Interest",
                )
                or cls._metric(df, quarter, "Common Stock Equity")
            ),

            "total_debt": cls._metric(
                df,
                quarter,
                "Total Debt",
            ),

            "book_value": (
                cls._metric(df, quarter, "Tangible Book Value")
                or cls._metric(df, quarter, "Net Tangible Assets")
            ),
        }

    # ==========================================================
    # Safe Metric Reader
    # ==========================================================
    @staticmethod
    def _metric(df: pd.DataFrame, quarter, metric: str):

        try:
            value = df.loc[metric, quarter]

            if pd.isna(value):
                return None

            return float(value)

        except Exception:
            return None

    # ==========================================================
    # Fiscal Quarter Builder
    # ==========================================================
    @staticmethod
    def _quarter_name(date_obj):

        month = date_obj.month
        year = date_obj.year % 100

        if month == 6:
            return f"Q1 FY{year + 1}"

        if month == 9:
            return f"Q2 FY{year + 1}"

        if month == 12:
            return f"Q3 FY{year + 1}"

        if month == 3:
            return f"Q4 FY{year}"

        return str(date_obj)