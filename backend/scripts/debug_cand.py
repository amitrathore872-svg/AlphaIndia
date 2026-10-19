import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.database import SessionLocal
from app.services.ipo_radar_service import IPORadarService
import yfinance as yf

db = SessionLocal()
cands = IPORadarService.get_mainboard_candidates(db)
db.close()

for c in cands[:5]:
    sym = c['symbol']
    print(f"\n--- Checking {sym} ({c['company']}) listed {c['listing_date']} ---")
    ticker_str = f"{sym}.NS"
    t = yf.Ticker(ticker_str)
    try:
        df = t.history(period="1y")
    except Exception as e:
        print(f"Error fetching {ticker_str}: {e}")
        df = None

    if df is None or df.empty:
        ticker_str = f"{sym}.BO"
        t = yf.Ticker(ticker_str)
        try:
            df = t.history(period="1y")
        except Exception as e:
            print(f"Error fetching {ticker_str}: {e}")
            df = None

    if df is None or df.empty:
        print(f"FAILED: No price history on yfinance for {sym} (.NS or .BO)")
    else:
        print(f"SUCCESS: {len(df)} bars found on {ticker_str}")
