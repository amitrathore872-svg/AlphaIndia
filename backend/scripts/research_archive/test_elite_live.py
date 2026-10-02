import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.database import SessionLocal
from app.services.cpr_engine_service import CPREngineService

db = SessionLocal()
print("=" * 85)
print("AUDITING LIVE CPR UNIVERSE WITH ALL 8 GAPS FIXED (ELITE INSTITUTIONAL MODE)")
print("=" * 85)

for tf in ["daily", "weekly", "monthly"]:
    elites = CPREngineService.get_cpr_transitions(db, timeframe=tf, min_turnover_cr=0.5, filter_mode="elite_only", limit=10)
    print(f"\n--- {tf.upper()} A+ INSTITUTIONAL BREAKOUTS (Found {len(elites)}) ---")
    for r in elites[:6]:
        sym = r['symbol']
        cmp = r['cmp']
        entry = r['entry_price']
        sl = r['stop_loss']
        t1 = r['target_1']
        t2 = r['target_2']
        rr = r['risk_reward']
        vol = r['volume_ratio_20d']
        val_rel = r['value_relationship']
        runway = "Clear" if r['has_clear_runway'] else "Wall"
        status = r['status']
        print(f"{sym:<10} | CMP: {cmp:>8.2f} | Buy: {entry:>8.2f} | SL(ATR): {sl:>8.2f} | T1: {t1:>8.2f} | T2: {t2:>8.2f} | RR: {rr} | Vol: {vol:>3.1f}x | Val: {val_rel:<12} | Runway: {runway:<5} | Status: {status}")
