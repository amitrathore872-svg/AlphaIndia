import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Check breakout_signals
print("--- breakout_signals schema & sample ---")
cols = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='breakout_signals'")).fetchall()
print("cols:", [c[0] for c in cols])
sample = db.execute(text("SELECT * FROM breakout_signals ORDER BY id DESC LIMIT 3")).fetchall()
print("sample breakout_signals:", sample)

# Check swing_trade_logs
print("--- swing_trade_logs schema & sample ---")
cols = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='swing_trade_logs'")).fetchall()
print("cols:", [c[0] for c in cols])
sample = db.execute(text("SELECT * FROM swing_trade_logs ORDER BY id DESC LIMIT 3")).fetchall()
print("sample swing_trade_logs:", sample)

# Check companies listed between 2026-07-20 and 2026-10-19
print("--- Mainboard listings in last 90 days (2026-07-20 to 2026-10-19) ---")
q = text("""
    SELECT c.symbol, c.company, c.listing_date, c.exchange, c.sector, m.cmp, m.fifty_two_week_high, m.fifty_two_week_low
    FROM companies c
    LEFT JOIN company_market_metrics m ON c.id = m.company_id
    WHERE c.listing_date >= '2026-07-20'
      AND c.listing_date <= '2026-10-19'
      AND c.symbol NOT LIKE '%-RE%' AND c.symbol NOT LIKE '%-BE%' AND c.symbol NOT LIKE '%-SM%' AND c.symbol NOT LIKE '%.%'
      AND (c.series = 'EQ' OR c.series IS NULL OR c.series = 'BSE')
      AND (m.cmp >= 10.0 OR m.cmp IS NULL)
    ORDER BY c.listing_date DESC
""")
recent_ipos = db.execute(q).fetchall()
print(f"Total verified Mainboard IPOs in last 90 days: {len(recent_ipos)}")
for r in recent_ipos[:15]:
    print(r)

db.close()
