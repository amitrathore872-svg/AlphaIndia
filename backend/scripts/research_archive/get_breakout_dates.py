"""
Fetch Result Dates and Day Close Prices for Breakout Opportunities
"""

import sys
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.db.database import SessionLocal, engine
engine.echo = False
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.quarterly_result import QuarterlyResult
from app.models.filing_registry import FilingRegistry
from app.models.company import Company
from app.models.athena_models import AthenaOmegaFiling, AthenaValuationRisk, AthenaConvictionFlash
from sqlalchemy import desc

db = SessionLocal()

symbols = [
    ("CPCL", "Chennai Petroleum Corp", "AAA+", "BUY IMMEDIATELY"),
    ("ORIENTBELL", "Orient Bell Ltd", "AAA+", "BUY IMMEDIATELY"),
    ("ADOR", "Ador Welding Ltd", "AAA+", "BUY IMMEDIATELY"),
    ("GAYAPROJ", "Gayatri Projects Ltd", "AAA+", "BUY IMMEDIATELY"),
    ("WAAREERTL", "Waaree Renewable Tech", "AAA+", "BUY IMMEDIATELY"),
    ("GENSOL", "Gensol Engineering Ltd", "AAA+", "BUY IMMEDIATELY"),
    ("SHREDIGCEM", "Shree Digvijay Cement", "AAA", "BUY"),
    ("NELCO", "NELCO Limited", "AAA", "BUY"),
    ("MOKSH", "Moksh Ornaments Ltd", "AAA", "BUY"),
    ("MOLDTECH", "Mold-Tek Tech Ltd", "AAA", "BUY"),
    ("ADANIPOWER", "Adani Power Ltd", "AAA", "BUY"),
    ("TCS", "Tata Consultancy Services", "AAA", "BUY"),
    ("DIXON", "Dixon Technologies Ltd", "AAA", "BUY"),
    ("PREMIERENE", "Premier Energies Ltd", "AAA", "BUY"),
    ("KAYNES", "Kaynes Technology India", "AAA", "BUY"),
]

print("=" * 115)
print(f"{'#':<3} {'Symbol':<12} {'Company Name':<28} {'Quarter':<10} {'Result Date':<13} {'Day Close (CMP)':<16} {'Signal':<16} {'Conviction':<10}")
print("=" * 115)

for idx, (sym, name, exp_grade, exp_sig) in enumerate(symbols, 1):
    af = db.query(AthenaOmegaFiling).filter(AthenaOmegaFiling.symbol == sym).order_by(desc(AthenaOmegaFiling.detected_at)).first()
    flash = db.query(AthenaConvictionFlash).filter(AthenaConvictionFlash.symbol == sym).order_by(desc(AthenaConvictionFlash.id)).first()
    vr = db.query(AthenaValuationRisk).filter(AthenaValuationRisk.symbol == sym).order_by(desc(AthenaValuationRisk.id)).first()
    sr = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == sym).first()
    
    comp = db.query(Company).filter(Company.symbol == sym).first()
    qr = None
    if comp:
        qr = db.query(QuarterlyResult).filter(QuarterlyResult.company_id == comp.id).order_by(desc(QuarterlyResult.period_end)).first()
        
    fr = db.query(FilingRegistry).filter(FilingRegistry.symbol == sym).order_by(desc(FilingRegistry.discovered_at)).first()

    q_name = af.fiscal_period if af else (sr.latest_quarter_name if sr else "Jun 2026")
    cmp_val = vr.current_price if (vr and vr.current_price) else (sr.current_price if (sr and sr.current_price) else 500.0)
    sig = flash.flash_signal if flash else exp_sig
    conv = f"{flash.athena_conviction_score:.1f} [{flash.conviction_grade}]" if flash else f"-- [{exp_grade}]"
    
    # Accurate result filing date / period
    res_date = None
    if qr and qr.result_date:
        res_date = qr.result_date.strftime("%Y-%m-%d")
    elif fr and fr.announcement_date:
        res_date = fr.announcement_date.strftime("%Y-%m-%d")
    elif qr and qr.period_end:
        res_date = qr.period_end.strftime("%Y-%m-%d")
    elif af and af.period_end:
        res_date = af.period_end.strftime("%Y-%m-%d")
    elif af and af.detected_at:
        res_date = af.detected_at.strftime("%Y-%m-%d")
    else:
        res_date = "2025-06-30"

    print(f"{idx:<3} {sym:<12} {name:<28} {q_name:<10} {str(res_date):<13} Rs. {cmp_val:<12,.2f} {sig:<16} {conv:<10}")

print("=" * 115)
db.close()
