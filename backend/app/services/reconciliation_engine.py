"""
Alpha India Data Reconciliation Engine
Sprint 23 — Critical Business Engine
Compares Screener.in data against official NSE corporate filing data.
Enforces the permanent ±2% tolerance business rule before updating production records.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.financial_reconciliation_log import FinancialReconciliationLog


class ReconciliationEngine:
    """
    Data Reconciliation Engine with permanent ±2% tolerance rule.
    """

    TOLERANCE_PCT = 2.0  # ±2.0% permanent threshold

    FIELD_LABELS = {
        "revenue": "Revenue",
        "pat": "PAT",
        "eps": "EPS",
        "operating_profit": "Operating Profit",
        "operating_margin_pct": "Operating Margin %",
        "revenue_growth_pct": "Revenue Growth %",
        "pat_growth_pct": "PAT Growth %",
        "eps_growth_pct": "EPS Growth %",
    }

    @classmethod
    def reconcile_company(
        cls,
        db: Session,
        symbol: str,
        company_name: str,
        quarter: str,
        screener_data: Dict[str, Any],
        nse_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Performs field-by-field reconciliation between Screener.in and official NSE values.
        Logs every audit record into financial_reconciliation_log and determines the
        precise update action for screener_growth_records.
        """
        field_results = []
        fields_to_update = {}
        should_update_company = False
        max_variance = 0.0

        for field_key, field_label in cls.FIELD_LABELS.items():
            sc_val = screener_data.get(field_key)
            nse_val = nse_data.get(field_key)

            variance_pct = None
            diagnosis = "EXACT_MATCH"
            action = "EXACT_MATCH_NO_UPDATE"
            status = "EXACT_MATCH"
            notes = None

            if sc_val is None and nse_val is not None:
                status = "MISSING_IN_SCREENER"
                diagnosis = "MISSING_SCREENER_VALUE"
                action = "FILLED_FROM_NSE"
                should_update_company = True
                fields_to_update[field_key] = nse_val
                notes = f"Field missing in Screener.in; populated from official NSE filing ({nse_val})"

            elif nse_val is None:
                status = "PARSE_ERROR"
                diagnosis = "PARSER_EXTRACTION_ERROR"
                action = "PARSE_ERROR_SENT_TO_AUDIT"
                notes = "NSE official filing value could not be extracted; sent to Audit."

            else:
                # Both values present - calculate variance %
                sc_num = float(sc_val)
                nse_num = float(nse_val)

                if abs(sc_num) < 1e-6:
                    variance_pct = 0.0 if abs(nse_num) < 1e-6 else 100.0
                else:
                    variance_pct = round(((nse_num - sc_num) / abs(sc_num)) * 100.0, 2)

                abs_var = abs(variance_pct)
                if abs_var > max_variance:
                    max_variance = abs_var

                if abs_var == 0.0:
                    status = "EXACT_MATCH"
                    diagnosis = "EXACT_MATCH"
                    action = "EXACT_MATCH_NO_UPDATE"
                    notes = "Screener.in and official NSE values match exactly."

                elif abs_var <= cls.TOLERANCE_PCT:
                    status = "WITHIN_TOLERANCE"
                    diagnosis = "ROUND_OFF"
                    action = "WITHIN_TOLERANCE_NO_UPDATE"
                    notes = (
                        f"Variance of {variance_pct:+0.2f}% is within ±{cls.TOLERANCE_PCT}% tolerance. "
                        "Preserved without modification to prevent round-off churn."
                    )

                else:
                    # Variance > ±2% -> Update required
                    status = "DIFFERENCE_FOUND"
                    action = "UPDATED_FROM_NSE"
                    should_update_company = True
                    fields_to_update[field_key] = nse_num

                    if 90.0 <= abs_var <= 110.0 or 900.0 <= abs_var <= 1100.0:
                        diagnosis = "UNIT_CONVERSION"
                        notes = f"Unit scale discrepancy detected ({variance_pct:+0.2f}%). Corrected with NSE."
                    else:
                        diagnosis = "REVISED_NSE_FILING"
                        notes = (
                            f"Significant difference of {variance_pct:+0.2f}% detected. "
                            f"Overwritten with official NSE filing ({nse_num})."
                        )

            # Record audit entry into financial_reconciliation_log
            log_entry = FinancialReconciliationLog(
                company_symbol=symbol.upper(),
                company_name=company_name,
                quarter=quarter,
                field_name=field_label,
                screener_value=sc_val,
                nse_value=nse_val,
                variance_pct=variance_pct,
                diagnosis=diagnosis,
                action_taken=action,
                notes=notes,
                created_at=datetime.utcnow(),
            )
            db.add(log_entry)

            field_results.append({
                "field_name": field_label,
                "field_key": field_key,
                "screener_value": sc_val,
                "nse_value": nse_val,
                "variance_pct": variance_pct,
                "status": status,
                "diagnosis": diagnosis,
                "action_taken": action,
                "notes": notes,
            })

        db.commit()

        # Overall reconciliation conclusion for this company
        company_action = "UPDATED_FROM_NSE" if should_update_company else "UNCHANGED"
        if all(r["status"] == "EXACT_MATCH" for r in field_results):
            company_status = "EXACT_MATCH"
        elif any(r["status"] == "DIFFERENCE_FOUND" for r in field_results):
            company_status = "DIFFERENCE_FOUND"
        elif any(r["status"] == "MISSING_IN_SCREENER" for r in field_results):
            company_status = "MISSING_IN_SCREENER"
        else:
            company_status = "WITHIN_TOLERANCE"

        return {
            "symbol": symbol.upper(),
            "quarter": quarter,
            "overall_status": company_status,
            "overall_action": company_action,
            "should_update": should_update_company,
            "fields_to_update": fields_to_update,
            "max_variance": max_variance,
            "field_results": field_results,
        }
