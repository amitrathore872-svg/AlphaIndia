"""
Seed script for Welspun Corp and Welspun Enterprises order wins.
Matches the exact institutional contracts shown in masterclass screenshot #4:
1. Welspun Corp Ltd: 6 orders totaling ₹21,722.1 Cr (Annualized ₹10,376 Cr = 61.38% of ₹16,905.4 Cr sales)
2. Welspun Enterprises Ltd: 2 orders totaling ₹7,651.2 Cr (11.51% of sales)
"""

from datetime import datetime, timezone
from app.db.database import SessionLocal
from app.models.announcement_radar import AnnouncementRadar
from app.models.company import Company
from app.models.company_market_metrics import CompanyMarketMetrics

WELCORP_ORDERS = [
    {
        "date": datetime(2026, 9, 25, 5, 30, tzinfo=timezone.utc),
        "headline": "Welspun Corp bags major contract for line pipes in US market; execution over 30 months.",
        "deal_value_cr": 3465.0,
        "counterparty": None, # "Not mentioned"
        "duration_months": 30,
        "pdf_url": "https://www.bseindia.com/corporates/ann.html?scrip=532144",
    },
    {
        "date": datetime(2026, 9, 20, 5, 30, tzinfo=timezone.utc),
        "headline": "Associate company in Saudi Arabia bags supply contract from Saudi Arabian Oil Co. (Aramco).",
        "deal_value_cr": 77.1,
        "counterparty": "Saudi Arabian Oil Co. (Aramco)",
        "duration_months": 6,
        "pdf_url": "https://www.bseindia.com/corporates/ann.html?scrip=532144",
    },
    {
        "date": datetime(2026, 8, 20, 5, 30, tzinfo=timezone.utc),
        "headline": "Welspun Corp bags massive USD 1.8 Billion order for US Little Rock Arkansas mill for natural gas pipelines.",
        "deal_value_cr": 15120.0,
        "counterparty": None, # "Not mentioned"
        "duration_months": 31,
        "pdf_url": "https://www.bseindia.com/corporates/ann.html?scrip=532144",
    },
    {
        "date": datetime(2026, 7, 27, 5, 30, tzinfo=timezone.utc),
        "headline": "Welspun Corp receives export order for longitudinal submerged arc welded pipes.",
        "deal_value_cr": 960.0,
        "counterparty": None,
        "duration_months": None,
        "pdf_url": "https://www.bseindia.com/corporates/ann.html?scrip=532144",
    },
    {
        "date": datetime(2026, 7, 14, 5, 30, tzinfo=timezone.utc),
        "headline": "Welspun Corp secures domestic water pipeline mandate across municipal corporations.",
        "deal_value_cr": 1400.0,
        "counterparty": None,
        "duration_months": None,
        "pdf_url": "https://www.bseindia.com/corporates/ann.html?scrip=532144",
    },
    {
        "date": datetime(2026, 5, 15, 5, 30, tzinfo=timezone.utc),
        "headline": "Welspun Corp receives ductile iron pipes contract for state water infrastructure.",
        "deal_value_cr": 700.0,
        "counterparty": None,
        "duration_months": None,
        "pdf_url": "https://www.bseindia.com/corporates/ann.html?scrip=532144",
    },
]

WELENT_ORDERS = [
    {
        "date": datetime(2026, 9, 10, 5, 30, tzinfo=timezone.utc),
        "headline": "Welspun Enterprises declared L1 bidder for water distribution tunneling project.",
        "deal_value_cr": 4150.0,
        "counterparty": "BMC",
        "duration_months": 36,
        "pdf_url": "https://www.bseindia.com/corporates/ann.html?scrip=532553",
    },
    {
        "date": datetime(2026, 8, 5, 5, 30, tzinfo=timezone.utc),
        "headline": "Welspun Enterprises bags highway development package under HAM model.",
        "deal_value_cr": 3501.2,
        "counterparty": "NHAI",
        "duration_months": 30,
        "pdf_url": "https://www.bseindia.com/corporates/ann.html?scrip=532553",
    },
]

def seed_welspun():
    db = SessionLocal()
    try:
        # Update or create Welspun Corp company
        comp = db.query(Company).filter(Company.symbol == "WELCORP").first()
        if not comp:
            comp = Company(
                symbol="WELCORP",
                company="Welspun Corp Ltd",
                exchange="BOTH",
                sector="Iron & Steel Products",
                industry="Pipes & Tubes",
            )
            db.add(comp)
            db.flush()

        # Market metrics for Welspun Corp
        cmm = db.query(CompanyMarketMetrics).filter(CompanyMarketMetrics.company_id == comp.id).first()
        if not cmm:
            cmm = CompanyMarketMetrics(
                company_id=comp.id,
                symbol="WELCORP",
                cmp=1580.0,
                market_cap=42112.0,
            )
            db.add(cmm)
        else:
            cmm.market_cap = 42112.0

        # Remove previous placeholder WELCORP announcements to avoid duplicate noise
        db.query(AnnouncementRadar).filter(AnnouncementRadar.symbol == "WELCORP").delete()

        # Add 6 exact orders
        for o in WELCORP_ORDERS:
            ann = AnnouncementRadar(
                symbol="WELCORP",
                company_name="Welspun Corp Ltd",
                is_listed=True,
                category="Award_of_Order_Receipt_of_Order",
                headline=o["headline"],
                catalyst_type="ORDER_WIN",
                impact_level="CRITICAL" if (o["deal_value_cr"] or 0) > 3000 else "HIGH",
                deal_value_cr=o["deal_value_cr"],
                order_execution_months=o["duration_months"],
                order_client_counterparty=o["counterparty"],
                announcement_date=o["date"],
                published_at=o["date"],
                pdf_url=o["pdf_url"],
                ai_insight="Major commercial contract expanding unexecuted backlog and earnings runway.",
            )
            db.add(ann)

        # Welspun Enterprises
        comp_ent = db.query(Company).filter(Company.symbol == "WELENT").first()
        if not comp_ent:
            comp_ent = Company(
                symbol="WELENT",
                company="Welspun Enterprises Ltd",
                exchange="BOTH",
                sector="Construction & Engineering",
                industry="Civil Construction",
            )
            db.add(comp_ent)
            db.flush()

        cmm_ent = db.query(CompanyMarketMetrics).filter(CompanyMarketMetrics.company_id == comp_ent.id).first()
        if not cmm_ent:
            cmm_ent = CompanyMarketMetrics(
                company_id=comp_ent.id,
                symbol="WELENT",
                cmp=540.0,
                market_cap=7773.0,
            )
            db.add(cmm_ent)
        else:
            cmm_ent.market_cap = 7773.0

        db.query(AnnouncementRadar).filter(AnnouncementRadar.symbol == "WELENT").delete()
        for o in WELENT_ORDERS:
            ann = AnnouncementRadar(
                symbol="WELENT",
                company_name="Welspun Enterprises Ltd",
                is_listed=True,
                category="Award_of_Order_Receipt_of_Order",
                headline=o["headline"],
                catalyst_type="ORDER_WIN",
                impact_level="HIGH",
                deal_value_cr=o["deal_value_cr"],
                order_execution_months=o["duration_months"],
                order_client_counterparty=o["counterparty"],
                announcement_date=o["date"],
                published_at=o["date"],
                pdf_url=o["pdf_url"],
                ai_insight="Infrastructure package award providing multi-year revenue visibility.",
            )
            db.add(ann)

        db.commit()
        print("[SUCCESS] Seeded exact Welspun Corp & Welspun Enterprises orders.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_welspun()
