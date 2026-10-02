import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal
from app.services.cpr_engine_service import CPREngineService

cache_p = Path(__file__).resolve().parent.parent / "data" / "cpr_transitions_cache.json"
if cache_p.exists():
    cache_p.unlink()

db = SessionLocal()
CPREngineService._transitions_cache = {}
CPREngineService._transitions_cache_time = 0.0

print("Calculating transitions with Market Cap >= 1000 Cr & Liquidity Filters...")
res_monthly = CPREngineService.get_cpr_transitions(
    db,
    timeframe="monthly",
    min_turnover_cr=1.0,
    min_marketcap_cr=1000.0,
    min_price=30.0,
    filter_mode="all",
    limit=10,
)
print(f"Monthly results count (>= 1000 Cr, >= 30 Rs, >= 1 Cr Turnover): {len(res_monthly)}")
for r in res_monthly[:5]:
    print(f"  {r['symbol']} | CMP: Rs {r['cmp']} | M-Cap: Rs {r.get('market_cap_cr')} Cr ({r.get('market_cap_category')}) | Turnover: Rs {r['turnover_cr']} Cr | Grade: {r['grade']}")

res_weekly = CPREngineService.get_cpr_transitions(
    db,
    timeframe="weekly",
    min_turnover_cr=1.0,
    min_marketcap_cr=1000.0,
    min_price=30.0,
    filter_mode="all",
    limit=10,
)
print(f"Weekly results count: {len(res_weekly)}")
for r in res_weekly[:5]:
    print(f"  {r['symbol']} | CMP: Rs {r['cmp']} | M-Cap: Rs {r.get('market_cap_cr')} Cr ({r.get('market_cap_category')}) | Turnover: Rs {r['turnover_cr']} Cr | Grade: {r['grade']}")

res_elite = CPREngineService.get_cpr_transitions(
    db,
    timeframe="weekly",
    min_turnover_cr=1.0,
    min_marketcap_cr=1000.0,
    min_price=30.0,
    filter_mode="elite_only",
    limit=10,
)
print(f"Weekly A+ Elite Institutional results count: {len(res_elite)}")
for r in res_elite:
    print(f"  ⭐ {r['symbol']} | CMP: Rs {r['cmp']} | M-Cap: Rs {r.get('market_cap_cr')} Cr ({r.get('market_cap_category')}) | Turnover: Rs {r['turnover_cr']} Cr | SL: Rs {r['stop_loss']} | T2: Rs {r['target_2']}")

db.close()
