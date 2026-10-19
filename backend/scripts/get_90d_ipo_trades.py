import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
from datetime import date, timedelta
from app.db.database import SessionLocal
from app.services.ipo_radar_service import IPORadarService

def generate_90d_trade_log():
    # 1. Fetch radar candidates from DB & analyze
    radar_data = IPORadarService.scan_all(force_refresh=False)
    candidates = radar_data.get("candidates", [])

    print(f"Total active candidates in radar: {len(candidates)}")

    trade_rows = []
    for c in candidates:
        list_d = c.get("listing_date")
        cmp_val = c.get("cmp", 0.0)
        pivot = c.get("pivot_price", 0.0)
        stop = c.get("stop_loss", 0.0)
        t1 = c.get("target_1", 0.0)
        t2 = c.get("target_2", 0.0)
        days_listed = c.get("days_since_listing", 0)
        bars = c.get("total_trading_bars", 0)
        rvol = c.get("rvol", 1.0)
        score = c.get("conviction_score", 0.0)
        setup = c.get("setup_label", "Setup")
        status = c.get("setup_status", "WATCHING")

        # Focus on listings or triggers in the last 90 days (days_since_listing <= 90 or bars <= 65)
        if days_listed > 90 and bars > 65:
            continue

        # Holding days estimation: bars in trade
        holding_days = max(1, bars - 5) if bars > 5 else bars

        # Calculate P&L from Entry (Pivot) to CMP or Target
        if pivot > 0:
            unrealized_pnl = round(((cmp_val - pivot) / pivot) * 100, 1)
        else:
            unrealized_pnl = round(c.get("return_90d_pct", 0.0), 1)

        # Determine trade outcome
        if cmp_val >= t1 or c.get("distance_to_pivot_pct", 0) >= 15.0:
            outcome = "TARGET 1 HIT (+15% 2R Locked)"
            pnl_val = max(15.0, unrealized_pnl)
        elif status == "TRIGGERED":
            if unrealized_pnl >= 0:
                outcome = "IN PROFIT (Active Breakout)"
                pnl_val = unrealized_pnl
            else:
                outcome = "HOLDING PULLBACK"
                pnl_val = unrealized_pnl
        elif status == "READY":
            outcome = "TRIGGER READY (Testing Pivot)"
            pnl_val = unrealized_pnl
        elif status == "FORMING":
            outcome = "BASE ACCUMULATION (Pre-breakout)"
            pnl_val = unrealized_pnl
        else:
            outcome = "OBSERVING"
            pnl_val = unrealized_pnl

        trade_rows.append({
            "symbol": c["symbol"],
            "company": c["company"],
            "sector": c["sector"],
            "listing_date": list_d,
            "setup": setup,
            "status": status,
            "buy_price": pivot,
            "cmp": cmp_val,
            "stop_loss": stop,
            "risk_pct": c.get("risk_pct", 0.0),
            "target_1": t1,
            "target_2": t2,
            "days_held": holding_days,
            "pnl_pct": pnl_val,
            "outcome": outcome,
            "conviction": score,
            "rvol": rvol
        })

    # Sort by conviction score and P&L
    trade_rows.sort(key=lambda x: (x["conviction"], x["pnl_pct"]), reverse=True)
    return trade_rows

if __name__ == "__main__":
    trades = generate_90d_trade_log()
    print(f"\nExtracted {len(trades)} trades in the last 90 days.")
    df = pd.DataFrame(trades)
    print("\nSAMPLE TRADES:")
    for _, r in df.head(15).iterrows():
        print(f"{r['symbol']} | Listed: {r['listing_date']} | Buy/Pivot: Rs {r['buy_price']} | CMP: Rs {r['cmp']} | Hold: {r['days_held']}d | PnL: {r['pnl_pct']:+.1f}% | {r['outcome']}")
