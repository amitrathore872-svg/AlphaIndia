"""
Script to normalize all fiscal_period entries in Athena tables
to standard Indian fiscal quarter format (e.g., Q1 FY27, Q4 FY26).
"""

import re
from app.db.database import SessionLocal
from app.models.athena_models import AthenaOmegaFiling, AthenaQuarterlyMetrics

MONTH_MAP = {
    "JAN": (4, 0), "FEB": (4, 0), "MAR": (4, 0),
    "APR": (1, 1), "MAY": (1, 1), "JUN": (1, 1),
    "JUL": (2, 1), "AUG": (2, 1), "SEP": (2, 1),
    "OCT": (3, 1), "NOV": (3, 1), "DEC": (3, 1),
}

def normalize_fiscal_period(val: str) -> str:
    if not val or not val.strip():
        return "Q1 FY27"
    p = val.strip()
    # If already Q1 FY27 or Q1FY27
    m_q = re.match(r"^Q([1-4])\s*FY\s*(\d{2,4})$", p, re.I)
    if m_q:
        q_num, yr = m_q.group(1), m_q.group(2)
        if len(yr) == 4:
            yr = yr[-2:]
        return f"Q{q_num} FY{yr}"
    # If month and year like 'Jun 2026' or 'March 2026'
    m_m = re.match(r"^([A-Za-z]{3,9})\s+(\d{4})$", p)
    if m_m:
        month_name = m_m.group(1)[:3].upper()
        year = int(m_m.group(2))
        if month_name in MONTH_MAP:
            q_num, yr_offset = MONTH_MAP[month_name]
            fy_year = (year + yr_offset) % 100
            return f"Q{q_num} FY{fy_year:02d}"
    return p

def run():
    db = SessionLocal()
    try:
        filings = db.query(AthenaOmegaFiling).all()
        updated_filings = 0
        for f in filings:
            norm = normalize_fiscal_period(f.fiscal_period)
            if norm != f.fiscal_period:
                f.fiscal_period = norm
                updated_filings += 1

        metrics = db.query(AthenaQuarterlyMetrics).all()
        updated_metrics = 0
        for m in metrics:
            norm = normalize_fiscal_period(m.fiscal_period)
            if norm != m.fiscal_period:
                m.fiscal_period = norm
                updated_metrics += 1

        db.commit()
        print(f"Successfully normalized {updated_filings} filings and {updated_metrics} metrics rows.")
    except Exception as e:
        db.rollback()
        print(f"Error during period normalization: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
