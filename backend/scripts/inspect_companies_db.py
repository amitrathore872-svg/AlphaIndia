from app.db.database import SessionLocal
from app.models.company import Company
from app.models.company_market_metrics import CompanyMarketMetrics

db = SessionLocal()
syms = ['MTARTECH', 'HFCL', 'KAYNES', 'VIVIANA', 'MARINE', 'WELCORP', 'ORIANA', 'POWERMECH', 'CEIGALL']
for s in syms:
    c = db.query(Company).filter(Company.symbol.ilike(f"%{s}%")).first()
    if c:
        cmm = db.query(CompanyMarketMetrics).filter(CompanyMarketMetrics.company_id == c.id).first()
        mcap = cmm.market_cap if cmm else None
        print(f"SYMBOL: {s} -> CompID: {c.id}, CompSymbol: {c.symbol}, CompanyName: {c.company}, MarketCap: {mcap}, Comp.market_cap: {c.market_cap}")
    else:
        print(f"SYMBOL: {s} -> NOT FOUND in companies")
db.close()
