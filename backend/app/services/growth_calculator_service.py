"""
Alpha India Growth Calculator Service
Sprint 32.7.1A (Schema Compatible)

Calculates:
- Revenue Growth (YoY)
- PAT Growth (YoY)
- ROCE
- EPS Growth
"""

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult


class GrowthCalculatorService:

    # ==========================================================
    # Calculate metrics for one company
    # ==========================================================
    @classmethod
    def calculate_company_growth(cls, db: Session, symbol: str):

        company = (
            db.query(Company)
            .filter(Company.symbol == symbol.upper())
            .first()
        )

        if not company:
            return {
                "success": False,
                "message": "Company not found."
            }

        quarters = (
            db.query(QuarterlyResult)
            .filter(QuarterlyResult.company_id == company.id)
            .order_by(QuarterlyResult.period_end.desc())
            .all()
        )

        if len(quarters) < 5:
            return {
                "success": False,
                "message": "Minimum 5 quarters required.",
                "quarters_available": len(quarters),
            }

        latest = quarters[0]
        previous_year = None

        # Intelligently locate the matching quarter ~1 year prior (approx 365 days +/- 45 days)
        if latest.period_end:
            for q in quarters[1:]:
                if q.period_end:
                    days_diff = abs((latest.period_end - q.period_end).days - 365)
                    if days_diff <= 45:
                        previous_year = q
                        break

        # Fallback to index 4 if chronological match wasn't found but 5 quarters are present
        if previous_year is None and len(quarters) >= 5:
            previous_year = quarters[4]

        if previous_year is None:
            return {
                "success": False,
                "message": "Valid 1-year prior baseline quarter (Q-4) not found.",
                "quarters_available": len(quarters),
            }

        revenue_growth = cls.calculate_growth(
            latest.revenue,
            previous_year.revenue,
        )

        pat_growth = cls.calculate_growth(
            latest.net_profit,
            previous_year.net_profit,
        )

        eps_growth = cls.calculate_growth(
            latest.eps,
            previous_year.eps,
        )

        roce = cls.calculate_roce(latest)

        cls.update_company_metrics(
            db=db,
            company=company,
            revenue_growth=revenue_growth,
            pat_growth=pat_growth,
            roce=roce,
        )

        return {
            "success": True,
            "symbol": company.symbol,
            "quarters": len(quarters),
            "latest_quarter": latest.fiscal_period,
            "revenue_growth": revenue_growth,
            "pat_growth": pat_growth,
            "eps_growth": eps_growth,
            "roce": roce,
        }

    # ==========================================================
    # Generic Growth Calculator
    # ==========================================================
    @staticmethod
    def calculate_growth(current, previous):

        if current is None or previous in (None, 0):
            return 0.0

        try:
            return round(((current - previous) / previous) * 100, 2)
        except ZeroDivisionError:
            return 0.0

    # ==========================================================
    # ROCE Calculator
    # ==========================================================
    @staticmethod
    def calculate_roce(quarter: QuarterlyResult):

        # If ROCE already exists in warehouse, use it.
        if quarter.roce is not None:
            return round(float(quarter.roce), 2)

        if (
            quarter.net_profit is None
            or quarter.total_equity is None
            or quarter.total_debt is None
        ):
            return 0.0

        capital_employed = (
            quarter.total_equity + quarter.total_debt
        )

        if capital_employed == 0:
            return 0.0

        return round(
            (quarter.net_profit / capital_employed) * 100,
            2,
        )

    # ==========================================================
    # Update Company Master
    # ==========================================================
    @staticmethod
    def update_company_metrics(
        db: Session,
        company: Company,
        revenue_growth: float,
        pat_growth: float,
        roce: float,
    ):

        company.revenue_growth = revenue_growth
        company.pat_growth = pat_growth
        company.roce = roce

        db.commit()
        db.refresh(company)