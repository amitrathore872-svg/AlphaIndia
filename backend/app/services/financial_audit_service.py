"""
Alpha India Financial Audit Service
Sprint 32.7.2

Per-company financial health audit service.
"""

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.financial_import_audit import FinancialImportAudit


class FinancialAuditService:

    # ==========================================================
    # Audit One Company
    # ==========================================================
    @classmethod
    def audit_company(cls, db: Session, symbol: str):

        company = (
            db.query(Company)
            .filter(Company.symbol == symbol.upper())
            .first()
        )

        if company is None:
            return {
                "status": "FAIL",
                "health_score": 0,
                "reason": "Company not found.",
            }

        quarters = (
            db.query(QuarterlyResult)
            .filter(QuarterlyResult.company_id == company.id)
            .order_by(QuarterlyResult.period_end.desc())
            .all()
        )

        if len(quarters) == 0:
            status = "FAIL"
            score = 0
            issues = ["No quarterly financial records."]

        else:
            score = 100
            issues = []

            if len(quarters) < 4:
                score -= 20
                issues.append("Less than four quarterly records.")

            latest = quarters[0]

            if latest.revenue is None:
                score -= 20
                issues.append("Missing revenue.")

            if latest.net_profit is None:
                score -= 20
                issues.append("Missing net profit.")

            if latest.eps is None:
                score -= 10
                issues.append("Missing EPS.")

            if latest.period_end is None:
                score -= 10
                issues.append("Missing period end.")

            if score >= 90:
                status = "PASS"
            elif score >= 70:
                status = "WARNING"
            else:
                status = "FAIL"

        audit = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.symbol == symbol.upper())
            .first()
        )

        if audit is None:
            audit = FinancialImportAudit(symbol=symbol.upper())
            db.add(audit)

        audit.company_id = company.id
        audit.status = status
        audit.health_score = score
        audit.notes = "; ".join(issues) if issues else "Healthy financial history."

        db.commit()

        return {
            "symbol": symbol.upper(),
            "status": status,
            "health_score": score,
            "issues": issues,
        }

    # ==========================================================
    # Warehouse Summary
    # ==========================================================
    @classmethod
    def warehouse_summary(cls, db: Session):

        total = db.query(Company).count()
        imported = db.query(QuarterlyResult.company_id).distinct().count()

        return {
            "total_companies": total,
            "companies_imported": imported,
            "coverage_percent": round(imported / total * 100, 2) if total else 0,
            "quarter_records": db.query(QuarterlyResult).count(),
        }

    # ==========================================================
    # Audit Summary
    # ==========================================================
    @classmethod
    def audit_summary(cls, db: Session):

        audits = db.query(FinancialImportAudit).all()

        if not audits:
            return {
                "pass": 0,
                "warning": 0,
                "fail": 0,
                "average_health_score": 0,
            }

        passed = sum(1 for a in audits if a.status == "PASS")
        warning = sum(1 for a in audits if a.status == "WARNING")
        failed = sum(1 for a in audits if a.status == "FAIL")

        average = round(
            sum(a.health_score for a in audits) / len(audits),
            2,
        )

        latest = max((a.updated_at for a in audits if a.updated_at), default=None)

        return {
            "pass": passed,
            "warning": warning,
            "fail": failed,
            "average_health_score": average,
            "latest_audit": latest,
        }

    # ==========================================================
    # Failed / Warning Companies
    # ==========================================================
    @classmethod
    def failures(cls, db: Session, limit: int = 100):

        audits = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.status != "PASS")
            .limit(limit)
            .all()
        )

        return [
            {
                "symbol": a.symbol,
                "status": a.status,
                "health_score": a.health_score,
                "notes": a.notes,
            }
            for a in audits
        ]