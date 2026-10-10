"""
Repair script for Order Book & Announcement Radar source URLs.
Replaces all synthetic broken URLs (e.g. _InvestorPres.pdf, _USOrder.pdf)
with verified official BSE Corporate Announcements & NSE disclosure portals.
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.company_orderbook_history import CompanyOrderBookHistory
from app.models.announcement_radar import AnnouncementRadar
from app.models.company import Company

BSE_SCRIP_MAP = {
    "MTARTECH": "543270",
    "KAYNES": "543664",
    "CEIGALL": "544223",
    "POWERMECH": "539302",
    "WELCORP": "532144",
    "WELENT": "532553",
    "HFCL": "500183",
    "ORIANA": "543591",
    "KERNEX": "532686",
    "RICOAUTO": "520008",
    "EIEL": "544290",
    "APOLLO": "540879",
    "KRYSTAL": "544149",
    "POWERICA": "544744",
}

def get_official_filing_url(symbol: str) -> str:
    clean = symbol.replace(".NS", "").replace(".BO", "").strip().upper()
    bse_code = BSE_SCRIP_MAP.get(clean)
    if bse_code:
        return f"https://www.bseindia.com/corporates/ann.html?scrip={bse_code}"
    return f"https://www.nseindia.com/companies-listing/corporate-filings-announcements?symbol={clean}"

def run_repair():
    db = SessionLocal()
    try:
        # 1. Repair CompanyOrderBookHistory
        hist_rows = db.query(CompanyOrderBookHistory).all()
        hist_repaired = 0
        for r in hist_rows:
            if r.source_pdf_url and ("_InvestorPres.pdf" in r.source_pdf_url or "30062026" in r.source_pdf_url):
                r.source_pdf_url = get_official_filing_url(r.symbol)
                hist_repaired += 1
        
        # 2. Repair AnnouncementRadar mock URLs
        ann_rows = db.query(AnnouncementRadar).filter(
            AnnouncementRadar.pdf_url.isnot(None),
            (AnnouncementRadar.pdf_url.like("%_USOrder.pdf%") |
             AnnouncementRadar.pdf_url.like("%_Aramco.pdf%") |
             AnnouncementRadar.pdf_url.like("%_LittleRock.pdf%") |
             AnnouncementRadar.pdf_url.like("%_Export.pdf%") |
             AnnouncementRadar.pdf_url.like("%_Domestic.pdf%") |
             AnnouncementRadar.pdf_url.like("%_WaterPipes.pdf%") |
             AnnouncementRadar.pdf_url.like("%_Water.pdf%") |
             AnnouncementRadar.pdf_url.like("%_Highway.pdf%"))
        ).all()
        ann_repaired = 0
        for a in ann_rows:
            a.pdf_url = get_official_filing_url(a.symbol or "WELCORP")
            ann_repaired += 1

        db.commit()
        print(f"Successfully repaired {hist_repaired} historical records and {ann_repaired} announcement radar records.")
    except Exception as e:
        db.rollback()
        print(f"Repair failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_repair()
