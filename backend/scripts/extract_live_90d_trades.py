import requests
import json

res = requests.get('http://localhost:8000/api/v1/ipo-radar/setups?limit=150')
data = res.json()
items = data.get('items', [])
print(f"Total active items returned from live API: {len(items)}")

# Filter for listings in the last 90 days (days_since_listing <= 90)
trades_90d = [c for c in items if c.get('days_since_listing', 999) <= 90]
print(f"Total IPO trades in the last 90 days (July 2026 - October 2026): {len(trades_90d)}")

print("\n" + "="*110)
print(f"{'SYMBOL':<12} | {'LISTED':<10} | {'HOLD':<5} | {'BUY/PIVOT':<11} | {'CMP/EXIT':<11} | {'P&L %':<8} | {'STOP LOSS':<11} | {'RISK %':<7} | {'SETUP':<22} | {'STATUS'}")
print("="*110)

winning_trades = 0
total_pnl = 0

for c in trades_90d:
    sym = c['symbol']
    ldate = c['listing_date']
    days = c['days_since_listing']
    bars = c.get('total_trading_bars', days)
    hold_days = max(1, bars - 5) if bars > 5 else bars
    cmp_val = round(c['cmp'], 1)
    pivot = round(c['pivot_price'], 1)
    stop = round(c['stop_loss'], 1)
    risk = c['risk_pct']
    setup = c['setup_label'][:21]
    status = c['setup_status']
    dist = c.get('distance_to_pivot_pct', 0.0)

    # Actual Return % from Buy Price (Pivot) to current market price
    if status == 'TRIGGERED':
        pnl = dist
    else:
        pnl = round(((cmp_val - pivot) / pivot) * 100, 1)

    if pnl > 0:
        winning_trades += 1
    total_pnl += pnl

    pnl_str = f"{pnl:+.1f}%"
    print(f"{sym:<12} | {ldate:<10} | {hold_days:>3}d | Rs {pivot:>8.1f} | Rs {cmp_val:>8.1f} | {pnl_str:>7} | Rs {stop:>8.1f} | {risk:>5.1f}% | {setup:<22} | {status}")

print("="*110)
avg_pnl = total_pnl / len(trades_90d) if trades_90d else 0.0
win_rate = (winning_trades / len(trades_90d)) * 100 if trades_90d else 0.0
print(f"90-Day Summary: {len(trades_90d)} Trades | Win Rate: {win_rate:.1f}% ({winning_trades} / {len(trades_90d)}) | Avg Return: {avg_pnl:+.1f}%")
