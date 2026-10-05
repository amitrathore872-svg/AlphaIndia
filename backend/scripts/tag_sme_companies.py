"""
Alpha India - SME Company Identification & Database Tagger
Sprint 42.0 - Flags all BSE SME and NSE Emerge companies as security_type='SME'.
"""

import json
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SME_JSON = DATA_DIR / "sme_companies.json"


def tag_sme_companies():
    print("=" * 60)
    print("ALPHA INDIA: SME COMPANY IDENTIFICATION & DATABASE TAGGER")
    print("=" * 60)

    if not SME_JSON.exists():
        print(f"[ERROR] SME catalog not found at {SME_JSON}")
        return

    with open(SME_JSON, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    sme_symbols = set(s.upper() for s in catalog.get("bse_sme_symbols", []))
    sme_codes = set(str(c) for c in catalog.get("bse_sme_codes", []))
    sme_isins = set(i.upper() for i in catalog.get("bse_sme_isins", []))

    print(f"Loaded SME catalog: {len(sme_symbols)} symbols, {len(sme_codes)} codes, {len(sme_isins)} ISINs")

    db: Session = SessionLocal()
    try:
        companies = db.query(Company).all()
        tagged_count = 0

        for c in companies:
            sym = (c.symbol or "").strip().upper()
            code = str(c.bse_code or "").strip()
            isin = (c.isin or "").strip().upper()
            series = (c.series or "").strip().upper()

            is_sme = False
            if sym in sme_symbols:
                is_sme = True
            elif code and code in sme_codes:
                is_sme = True
            elif isin and isin in sme_isins:
                is_sme = True
            elif series in ("SM", "ST") or sym.endswith(("-SM", "-ST", ".SM", ".ST")):
                is_sme = True

            if is_sme:
                c.security_type = "SME"
                tagged_count += 1

        db.commit()
        print(f"Successfully tagged {tagged_count} companies with security_type='SME' in database.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to tag SME companies: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    tag_sme_companies()
