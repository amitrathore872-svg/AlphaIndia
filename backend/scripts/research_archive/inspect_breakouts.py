import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.database import SessionLocal
from app.services.cpr_engine_service import CPREngineService

db = SessionLocal()
for tf in ['daily', 'weekly', 'monthly']:
    res = CPREngineService.get_cpr_transitions(db, timeframe=tf, min_turnover_cr=0.5, filter_mode="breakout_only", limit=10)
    print(f"=== {tf.upper()} CONFIRMED BREAKOUTS ({len(res)}) ===")
    for r in res[:6]:
        sym = r['symbol']
        cmp = r['cmp']
        entry = r['entry_price']
        sl = r['stop_loss']
        t1 = r['target_1']
        t2 = r['target_2']
        rr = r['risk_reward']
        vol = r['volume_ratio_20d']
        grade = r['grade']
        pct = r['breakout_pct']
        spread = r['cpr_spread_pct']
        dist = r['dist_to_cpr_pct']
        print(f"{sym:<10} | CMP: {cmp:>8.2f} | Buy: {entry:>8.2f} (+{pct:>4.2f}%) | SL: {sl:>8.2f} | T1: {t1:>8.2f} | T2: {t2:>8.2f} | RR: {rr} | Vol: {vol}x | Spread: {spread:>5.3f}% | Grade: {grade}")
