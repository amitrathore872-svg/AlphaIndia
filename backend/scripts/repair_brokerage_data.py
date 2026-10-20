"""
Alpha India — Brokerage Data Repair and Normalization Script
1. Backfills company_id for unlinked BrokerageReport records
2. Creates any missing Company entities (ZOMATO, TATAMOTORS alias)
3. Sanitizes HTML entities (&nbsp;, &amp;, etc.) from headlines and theses
4. Re-synchronizes market caps from Company records
"""

import sys
import html
import re
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.brokerage_intelligence import BrokerageReport
from app.models.screener_growth_record import ScreenerGrowthRecord

def repair_brokerage_data():
    db = SessionLocal()
    try:
        print("[Repair] Starting Brokerage Data Audit & Repair...")

        # 1. Ensure Missing Companies Exist
        # Check ZOMATO
        zomato = db.query(Company).filter(Company.symbol == "ZOMATO").first()
        if not zomato:
            print("[Repair] Creating Company record for ZOMATO...")
            zomato = Company(
                symbol="ZOMATO",
                company="Zomato Limited",
                series="EQ",
                listing_status="Active",
                security_type="EQUITY",
                sector="Consumer Services",
                industry="E-Commerce / Food Delivery",
            )
            db.add(zomato)
            db.flush()

        # Check TATAMOTORS (often listed as TMCV or TMPV on NSE)
        tatamotors = db.query(Company).filter(Company.symbol == "TATAMOTORS").first()
        if not tatamotors:
            tmcv = db.query(Company).filter(Company.symbol.in_(["TMCV", "TMPV"])).first()
            if tmcv:
                print(f"[Repair] Found Tata Motors under symbol {tmcv.symbol} (ID: {tmcv.id})")
                tatamotors = tmcv
            else:
                print("[Repair] Creating Company record for TATAMOTORS...")
                tatamotors = Company(
                    symbol="TATAMOTORS",
                    company="Tata Motors Limited",
                    series="EQ",
                    listing_status="Active",
                    security_type="EQUITY",
                    sector="Automobile and Auto Components",
                    industry="Automobiles",
                )
                db.add(tatamotors)
                db.flush()

        # 2. Backfill unlinked company_id on BrokerageReport
        unlinked = db.query(BrokerageReport).filter(BrokerageReport.company_id.is_(None)).all()
        print(f"[Repair] Found {len(unlinked)} reports with company_id == NULL")

        fixed_count = 0
        for rep in unlinked:
            sym = rep.symbol.strip().upper()
            if sym == "TATAMOTORS" and tatamotors:
                rep.company_id = tatamotors.id
                fixed_count += 1
                continue
            if sym == "ZOMATO" and zomato:
                rep.company_id = zomato.id
                fixed_count += 1
                continue

            comp = db.query(Company).filter(Company.symbol == sym).first()
            if comp:
                rep.company_id = comp.id
                fixed_count += 1
            else:
                # Try finding by name substring
                comp_by_name = db.query(Company).filter(Company.company.ilike(f"%{rep.company_name[:10]}%")).first()
                if comp_by_name:
                    rep.company_id = comp_by_name.id
                    fixed_count += 1
                    print(f"  Linked {sym} by name to {comp_by_name.symbol} (ID {comp_by_name.id})")

        print(f"[Repair] Successfully linked {fixed_count} reports to their Company records.")

        # 3. Clean up HTML Entities & News Outlets in Headlines and Theses
        all_reports = db.query(BrokerageReport).all()
        clean_count = 0
        for rep in all_reports:
            changed = False

            # Clean Headline
            if rep.headline:
                orig_head = rep.headline
                # Decode HTML entities
                h = html.unescape(orig_head)
                # Replace non-breaking spaces
                h = h.replace("\xa0", " ").replace("&nbsp;", " ")
                # Strip HTML tags
                h = re.sub(r"<[^>]+>", "", h)
                # Normalize multiple spaces
                h = re.sub(r"\s+", " ", h).strip()
                if h != orig_head:
                    rep.headline = h
                    changed = True

            # Clean Investment Thesis
            if rep.investment_thesis:
                orig_th = rep.investment_thesis
                t = html.unescape(orig_th)
                t = t.replace("\xa0", " ").replace("&nbsp;", " ")
                t = re.sub(r"<[^>]+>", "", t)
                t = re.sub(r"\s+", " ", t).strip()
                if t != orig_th:
                    rep.investment_thesis = t
                    changed = True

            if changed:
                clean_count += 1

        print(f"[Repair] Sanitized HTML entities in {clean_count} reports.")

        # 4. Market Cap & CMP Normalization from ScreenerGrowthRecord / Company
        for rep in all_reports:
            if rep.market_cap is None or rep.market_cap <= 0:
                s_rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == rep.symbol).first()
                if s_rec and s_rec.market_cap and s_rec.market_cap > 0:
                    rep.market_cap = round(float(s_rec.market_cap), 1)

        db.commit()
        print("[Repair] Database repair and normalization completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[Repair ERROR] {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    repair_brokerage_data()
