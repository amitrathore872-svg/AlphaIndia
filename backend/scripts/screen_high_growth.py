import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord
from sqlalchemy import text

db = SessionLocal()

# Check top performers in screener_growth_records by health_score, sales_growth, etc.
rows = db.query(ScreenerGrowthRecord).filter(
    ScreenerGrowthRecord.current_price > 0,
    ScreenerGrowthRecord.sales_growth_ttm > 20,
    ScreenerGrowthRecord.profit_growth_ttm > 25,
).order_by(ScreenerGrowthRecord.profit_growth_ttm.desc()).limit(20).all()

print(f"Top Growth Compounding Candidates in DB ({len(rows)}):")
for r in rows:
    stage = "STAGE_2" if (r.dma_50 and r.dma_200 and r.current_price >= r.dma_50 and r.dma_50 >= r.dma_200) else "STAGE_4/CORRECTING"
    print(f"[{r.symbol}] Sales Growth: {r.sales_growth_ttm}% | Profit Growth: {r.profit_growth_ttm}% | CMP: Rs.{r.current_price} | Stage: {stage} | Health: {r.health_score}")
