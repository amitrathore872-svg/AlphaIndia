import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("--- screener_growth_records columns ---")
    cols = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'screener_growth_records';")).fetchall()
    print([c[0] for c in cols if 'dma' in c[0] or 'price' in c[0] or 'stage' in c[0] or 'trend' in c[0]])
    
    print("\n--- Sample row for DIXON, SUZLON, TRENT, KAYNES in screener_growth_records ---")
    rows = conn.execute(text("SELECT symbol, current_price, dma_50, dma_200 FROM screener_growth_records WHERE symbol IN ('DIXON', 'SUZLON', 'TRENT', 'KAYNES', 'PERSISTENT', 'BAJFINANCE', 'M&M', 'DRREDDY');")).fetchall()
    for r in rows:
        print(r)
        
    print("\n--- Check company_market_metrics or other tables with DMAs ---")
    cpr_cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'cpr_scanner_daily';")).fetchall()
    print("cpr_scanner_daily cols:", [c[0] for c in cpr_cols][:15])
    
    swing_cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'swing_stock_profiles';")).fetchall()
    print("swing_stock_profiles cols:", [c[0] for c in swing_cols][:15])
