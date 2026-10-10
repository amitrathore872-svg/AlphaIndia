from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult

db = SessionLocal()
syms = ['MTARTECH', 'HFCL', 'KAYNES', 'VIVIANA', 'MARINE', 'WELCORP', 'POWERMECH', 'CEIGALL']
for s in syms:
    c = db.query(Company).filter(Company.symbol.ilike(f"%{s}%")).first()
    if c:
        q_rows = db.query(QuarterlyResult).filter(QuarterlyResult.company_id == c.id).order_by(QuarterlyResult.period_end.desc()).limit(4).all()
        revs = [q.revenue for q in q_rows if q.revenue is not None]
        ttm = sum(revs)
        print(f"SYMBOL: {s} -> CompID: {c.id}, Q count: {len(q_rows)}, TTM Rev: {ttm}, Quarters: {[q.fiscal_period for q in q_rows]}")
    else:
        print(f"SYMBOL: {s} -> NOT FOUND")
db.close()
