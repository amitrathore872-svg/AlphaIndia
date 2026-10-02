import concurrent.futures
import requests
import json
import time
from pathlib import Path
import sys

# Ensure backend root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.cpr_engine_service import CPREngineService

db = SessionLocal()

# Load company masters and market caps
companies = {c.symbol.strip().upper(): (c.company or c.symbol, c.sector or 'Equities') for c in db.query(Company.symbol, Company.company, Company.sector).all() if c.symbol}
mcap_map = {r.symbol.strip().upper(): (float(r.market_cap), r.market_cap_category or 'UNKNOWN') for r in db.query(ScreenerGrowthRecord.symbol, ScreenerGrowthRecord.market_cap, ScreenerGrowthRecord.market_cap_category).filter(ScreenerGrowthRecord.market_cap >= 1000).all() if r.symbol}

print(f"Companies: {len(companies)}, M-Cap >= 1000 Cr: {len(mcap_map)}")

dates, hmap = CPREngineService.load_historical_ohlcv(max_sessions=45)

# Test Hourly
top_hourly_symbols = list(mcap_map.keys())[:100]
print(f"Top hourly symbols count: {len(top_hourly_symbols)}")

def fetch_hourly_cpr(sym):
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}.NS?interval=1h&range=5d"
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
        if r.status_code == 200:
            q = r.json()["chart"]["result"][0]["indicators"]["quote"][0]
            val = [i for i in range(len(q["close"])) if q["close"][i] is not None and q["high"][i] is not None and q["low"][i] is not None]
            if len(val) >= 2:
                p_i, c_i = val[-2], val[-1]
                ph, pl, pc = float(q["high"][p_i]), float(q["low"][p_i]), float(q["close"][p_i])
                cmp_p = float(q["close"][c_i])
                vol = float(q["volume"][c_i]) if q["volume"][c_i] is not None else 0.0
                to_cr = round((vol * cmp_p) / 1e7, 2)
                p = round((ph + pl + pc) / 3.0, 2)
                bc = round((ph + pl) / 2.0, 2)
                tc = round((2 * p) - bc, 2)
                cpr_top = max(tc, bc)
                cpr_bot = min(tc, bc)
                w_pct = round(abs(tc - bc) / max(0.01, cmp_p) * 100.0, 3)
                dist = round(min(abs(cmp_p - tc), abs(cmp_p - bc), abs(cmp_p - p)) / max(0.01, cmp_p) * 100.0, 2)
                pos = "INSIDE_CPR" if cpr_bot <= cmp_p <= cpr_top else ("AT_TC" if abs(cmp_p - cpr_top)/cmp_p <= 0.002 else ("AT_BC" if abs(cmp_p - cpr_bot)/cmp_p <= 0.002 else ("ABOVE_CPR" if cmp_p > cpr_top else "BELOW_CPR")))
                c_name, c_sec = companies.get(sym, (sym, "Equities"))
                mc, mc_cat = mcap_map.get(sym, (0.0, "UNKNOWN"))
                return {
                    "symbol": sym,
                    "company_name": c_name,
                    "sector": c_sec,
                    "cmp": cmp_p,
                    "timeframe": "hourly",
                    "pivot": p,
                    "bc": bc,
                    "tc": tc,
                    "cpr_top": cpr_top,
                    "cpr_bottom": cpr_bot,
                    "cpr_width": round(abs(tc - bc), 2),
                    "cpr_width_pct": w_pct,
                    "dist_to_cpr_pct": dist,
                    "cpr_position": pos,
                    "market_cap_cr": mc,
                    "market_cap_category": mc_cat,
                    "turnover_cr": to_cr,
                }
    except Exception:
        pass
    return None

t0 = time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=15) as ex:
    hourly_results = [r for r in ex.map(fetch_hourly_cpr, top_hourly_symbols) if r]
print(f"Fetched {len(hourly_results)} hourly records in {time.time()-t0:.2f}s!")

# Filter for Close CPR (Width <= 0.25%, Dist <= 1.0%)
close_hourly = [r for r in hourly_results if r["cpr_width_pct"] <= 0.25 and r["dist_to_cpr_pct"] <= 1.0]
print(f"Hourly Close CPR count: {len(close_hourly)}")
for r in sorted(close_hourly, key=lambda x: (x["cpr_width_pct"], x["dist_to_cpr_pct"]))[:5]:
    print(f"  {r['symbol']} | CMP: Rs {r['cmp']} | P: {r['pivot']} | BC: {r['bc']} | TC: {r['tc']} | Width%: {r['cpr_width_pct']}% | Dist%: {r['dist_to_cpr_pct']}% | Pos: {r['cpr_position']}")

db.close()
