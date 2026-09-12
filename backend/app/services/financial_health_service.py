"""
Alpha India Financial Health Scanner
Sprint 31.5.1 — Warehouse Quality Scanner
Version: v1.0.0
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.financial_import_audit import FinancialImportAudit


class FinancialHealthService:

    @classmethod
    def scan_company(cls, db: Session, company: Company):

        quarters = (
            db.query(QuarterlyResult)
            .filter(QuarterlyResult.company_id == company.id)
            .all()
        )

        quarter_count = len(quarters)

        missing_revenue = 0
        missing_profit = 0
        missing_eps = 0
        missing_period = 0

        seen_periods = set()
        duplicate_quarters = 0

        for q in quarters:

            if q.revenue is None:
                missing_revenue += 1

            if q.net_profit is None:
                missing_profit += 1

            if q.eps is None:
                missing_eps += 1

            if q.period_end is None:
                missing_period += 1
            else:
                if q.period_end in seen_periods:
                    duplicate_quarters += 1
                seen_periods.add(q.period_end)

        score = 100

        score -= missing_revenue * 10
        score -= missing_profit * 10
        score -= missing_eps * 5
        score -= missing_period * 5
        score -= duplicate_quarters * 10

        if quarter_count < 4:
            score -= 20

        score = max(score, 0)

        if score >= 90:
            status = "PASS"
        elif score >= 70:
            status = "WARNING"
        else:
            status = "FAILED"

        audit = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.company_id == company.id)
            .first()
        )

        if audit is None:
            audit = FinancialImportAudit(
                company_id=company.id,
                symbol=company.symbol,
            )
            db.add(audit)

        audit.quarter_count = quarter_count
        audit.missing_revenue = missing_revenue
        audit.missing_profit = missing_profit
        audit.missing_eps = missing_eps
        audit.missing_period = missing_period
        audit.duplicate_quarters = duplicate_quarters
        audit.health_score = score
        audit.status = status
        audit.audited_at = datetime.utcnow()

        db.commit()

        return {
            "symbol": company.symbol,
            "status": status,
            "score": score,
            "quarters": quarter_count,
        }

    @classmethod
    def scan_all(cls, db: Session):

        companies = (
            db.query(Company)
            .join(QuarterlyResult)
            .distinct()
            .all()
        )

        results = []

        for company in companies:
            results.append(cls.scan_company(db, company))

        return {
            "companies_scanned": len(results),
            "results": results,
        }

    @classmethod
    def summary(cls, db: Session):

        total = db.query(FinancialImportAudit).count()

        passed = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.status == "PASS")
            .count()
        )

        warning = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.status == "WARNING")
            .count()
        )

        failed = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.status == "FAILED")
            .count()
        )

        average_score = 0

        if total:
            scores = db.query(FinancialImportAudit.health_score).all()
            average_score = round(
                sum(score[0] for score in scores) / total,
                2,
            )

        return {
            "companies": total,
            "passed": passed,
            "warning": warning,
            "failed": failed,
            "average_score": average_score,
        }