"""
Alpha India — Investor Intelligence V2 Database Migration & Backfill
Creates `management_commitments` table and adds quarterly coverage, stage tracking,
and thesis impact columns to `investor_documents` and `investor_intelligence_insights`.
"""

import datetime
import hashlib
import re
import sys
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db.database import engine, SessionLocal, Base
from app.models.investor_intelligence import (
    InvestorDocument,
    InvestorIntelligenceInsight,
    ManagementCommitment,
)

def run_migration():
    print("[AlphaIndia] Starting Investor Intelligence V2 Migration...")

    with engine.connect() as conn:
        # 1. Create table management_commitments if not exists
        Base.metadata.create_all(bind=conn, tables=[ManagementCommitment.__table__])
        conn.commit()
        print("[AlphaIndia] Created / verified `management_commitments` table.")

        # 2. Add columns to investor_documents
        doc_cols = [
            ("financial_year", "INTEGER"),
            ("financial_quarter", "INTEGER"),
            ("content_hash", "VARCHAR(64)"),
            ("download_status", "VARCHAR(30) DEFAULT 'PENDING'"),
            ("extraction_status", "VARCHAR(30) DEFAULT 'PENDING'"),
            ("ai_analysis_status", "VARCHAR(30) DEFAULT 'PENDING'"),
            ("analysis_completed_at", "TIMESTAMP WITH TIME ZONE"),
            ("processing_error", "TEXT"),
        ]
        for col_name, col_type in doc_cols:
            try:
                conn.execute(text(f"ALTER TABLE investor_documents ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
                conn.commit()
            except Exception as e:
                print(f"  Note on investor_documents.{col_name}: {e}")

        # 3. Add columns to investor_intelligence_insights
        ins_cols = [
            ("thesis_impact", "VARCHAR(30) DEFAULT 'NEUTRAL'"),
            ("positive_developments", "JSONB"),
            ("negative_developments", "JSONB"),
            ("guidance_changes", "JSONB"),
            ("growth_implications", "TEXT"),
            ("thesis_evidence", "JSONB"),
            ("qoq_comparison", "JSONB"),
            ("operational_kpis", "JSONB"),
        ]
        for col_name, col_type in ins_cols:
            try:
                conn.execute(text(f"ALTER TABLE investor_intelligence_insights ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
                conn.commit()
            except Exception as e:
                print(f"  Note on investor_intelligence_insights.{col_name}: {e}")

        # 4. Create Indexes
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_inv_doc_fy_q ON investor_documents (financial_year, financial_quarter);",
            "CREATE INDEX IF NOT EXISTS idx_inv_doc_content_hash ON investor_documents (content_hash);",
            "CREATE INDEX IF NOT EXISTS idx_inv_doc_dl_status ON investor_documents (download_status);",
            "CREATE INDEX IF NOT EXISTS idx_inv_doc_ai_status ON investor_documents (ai_analysis_status);",
            "CREATE INDEX IF NOT EXISTS idx_inv_ins_thesis_impact ON investor_intelligence_insights (thesis_impact);",
            "CREATE INDEX IF NOT EXISTS idx_mgmt_com_sym_status ON management_commitments (symbol, status);",
            "CREATE INDEX IF NOT EXISTS idx_mgmt_com_deadline ON management_commitments (deadline_year, deadline_quarter);",
        ]
        for idx in indexes:
            try:
                conn.execute(text(idx))
                conn.commit()
            except Exception as e:
                print(f"  Index note: {e}")

    print("[AlphaIndia] Schema migrations applied successfully. Now backfilling existing records...")

    # 5. Backfill existing records with parsed dates, years, quarters, and hashes
    db = SessionLocal()
    try:
        docs = db.query(InvestorDocument).all()
        print(f"[AlphaIndia] Processing {len(docs)} existing documents for backfill...")
        updated_count = 0

        for doc in docs:
            changed = False
            # Normalize fiscal_period and derive fy/quarter
            period_str = (doc.fiscal_period or "").strip()

            # Parse "Q1 FY27", "Q2 FY26", etc.
            m = re.search(r"Q([1-4])\s*(?:FY)?(\d{2,4})", period_str, re.IGNORECASE)
            if m:
                q = int(m.group(1))
                yr_val = int(m.group(2))
                fy = (2000 + yr_val) if yr_val < 100 else yr_val
                if doc.financial_quarter != q or doc.financial_year != fy:
                    doc.financial_quarter = q
                    doc.financial_year = fy
                    changed = True

                # Backfill announcement_date if null
                if not doc.announcement_date:
                    # In Indian FY: Q1 reports in Aug, Q2 in Nov, Q3 in Feb, Q4 in May
                    calendar_year = fy if q == 4 or q == 3 else fy - 1
                    month_map = {1: (8, 10), 2: (11, 10), 3: (2, 10), 4: (5, 15)}
                    cal_month, cal_day = month_map.get(q, (8, 10))
                    doc.announcement_date = datetime.date(calendar_year, cal_month, cal_day)
                    changed = True

            elif period_str == "Current":
                # For recent live wire drops from Oct 2026:
                # Oct 2026 is Q2 FY27 reporting window!
                doc.fiscal_period = "Q2 FY27"
                doc.financial_quarter = 2
                doc.financial_year = 2027
                if not doc.announcement_date:
                    doc.announcement_date = datetime.date(2026, 10, 10)
                changed = True

            # Content hash
            if not doc.content_hash:
                h = hashlib.sha256(f"{doc.symbol}_{doc.fiscal_period}_{doc.doc_type}_{doc.pdf_url}".encode()).hexdigest()
                doc.content_hash = h
                changed = True

            # Sync detailed stage statuses
            st = (doc.status or "PENDING").upper()
            if st == "ANALYZED":
                doc.download_status = "DOWNLOADED"
                doc.extraction_status = "EXTRACTED"
                doc.ai_analysis_status = "ANALYZED"
                if not doc.analysis_completed_at:
                    doc.analysis_completed_at = doc.updated_at or doc.created_at
                changed = True
            elif st == "EXTRACTED":
                doc.download_status = "DOWNLOADED"
                doc.extraction_status = "EXTRACTED"
                doc.ai_analysis_status = "PENDING"
                changed = True
            elif st == "DOWNLOADED":
                doc.download_status = "DOWNLOADED"
                doc.extraction_status = "PENDING"
                doc.ai_analysis_status = "PENDING"
                changed = True
            elif st == "FAILED":
                doc.download_status = "FAILED" if not doc.raw_text_length else "DOWNLOADED"
                doc.extraction_status = "FAILED"
                doc.ai_analysis_status = "FAILED"
                doc.processing_error = doc.error_message
                changed = True
            else:  # PENDING
                doc.download_status = "PENDING"
                doc.extraction_status = "PENDING"
                doc.ai_analysis_status = "PENDING"
                changed = True

            if changed:
                updated_count += 1

        db.commit()
        print(f"[AlphaIndia] Backfilled {updated_count} documents successfully.")

        # Also backfill insights with default thesis impact from stance
        insights = db.query(InvestorIntelligenceInsight).all()
        for ins in insights:
            if not ins.thesis_impact:
                st = (ins.institutional_stance or "").upper()
                if "STRONG" in st or "ACCUMULATE" in st:
                    ins.thesis_impact = "STRENGTHENING"
                elif "AVOID" in st or "HEADWINDS" in st:
                    ins.thesis_impact = "WEAKENING"
                else:
                    ins.thesis_impact = "NEUTRAL"
        db.commit()
        print(f"[AlphaIndia] Synchronized {len(insights)} insight records.")

    except Exception as e:
        db.rollback()
        print(f"[AlphaIndia] Error during backfill: {e}")
        raise
    finally:
        db.close()

    print("[AlphaIndia] Investor Intelligence V2 Migration completed!")


if __name__ == "__main__":
    run_migration()
