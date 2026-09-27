import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.pead_engine import PEADEngine

def run_backtest():
    db: Session = SessionLocal()
    
    # Query equities that have reported quarterly results and have forward price drift data
    records = (
        db.query(ScreenerGrowthRecord)
        .filter(
            ScreenerGrowthRecord.return_3m.isnot(None),
            ScreenerGrowthRecord.quarterly_pat_yoy.isnot(None),
            ScreenerGrowthRecord.current_price.isnot(None),
            ScreenerGrowthRecord.current_price >= 5.0,  # Filter out extreme illiquid penny stocks < ₹5
        )
        .all()
    )
    
    print(f"Total Validated Companies in Post-Earnings Backtest: {len(records):,}")
    
    data = []
    for r in records:
        res = PEADEngine.evaluate(
            revenue_growth_yoy=r.quarterly_sales_yoy,
            pat_growth_yoy=r.quarterly_pat_yoy,
            roce=r.roce,
            opm=r.opm_latest,
            current_price=r.current_price,
            dma_50=r.dma_50,
            debt_to_equity=r.debt_to_equity,
            revenue_growth_qoq=r.quarterly_sales_qoq,
            pat_growth_qoq=r.quarterly_pat_qoq,
            eps=r.latest_quarter_eps,
            symbol=r.symbol,
            latest_quarter_net_profit=r.latest_quarter_net_profit,
            pat_12m=r.pat_12m,
            profit_growth_ttm=r.profit_growth_ttm,
        )
        
        data.append({
            "symbol": r.symbol,
            "company": r.company_name or r.symbol,
            "score": res["pead_score"],
            "tier": res["pead_tier"],
            "tier_label": res["pead_tier_label"],
            "ret_3m": r.return_3m,
            "ret_6m": r.return_6m,
            "sales_yoy": r.quarterly_sales_yoy,
            "sales_qoq": r.quarterly_sales_qoq,
            "pat_yoy": r.quarterly_pat_yoy,
            "pat_qoq": r.quarterly_pat_qoq,
            "opm": r.opm_latest,
            "roce": r.roce,
            "cmp": r.current_price,
            "pillars": res["pillar_breakdown"],
        })
        
    elite = [x for x in data if x["score"] >= 85.0]
    strong = [x for x in data if 70.0 <= x["score"] < 85.0]
    moderate = [x for x in data if 55.0 <= x["score"] < 70.0]
    neutral = [x for x in data if x["score"] < 55.0]
    
    print("\n" + "=" * 80)
    print("🎯 ELITE PEAD BREAKOUT (SCORE >= 85.0) — DETAILED PERFORMANCE AUDIT")
    print("=" * 80)
    
    elite_rets = [x["ret_3m"] for x in elite]
    pos_moves = [r for r in elite_rets if r > 0]
    neg_moves = [r for r in elite_rets if r < 0]
    zero_moves = [r for r in elite_rets if r == 0]
    
    total_elite = len(elite)
    total_pos = len(pos_moves)
    total_fails = len(neg_moves)
    
    win_rate = (total_pos / total_elite * 100) if total_elite > 0 else 0
    fail_rate = (total_fails / total_elite * 100) if total_elite > 0 else 0
    
    avg_up_move = np.mean(pos_moves) if pos_moves else 0.0
    median_up_move = np.median(pos_moves) if pos_moves else 0.0
    
    avg_fail_move = np.mean(neg_moves) if neg_moves else 0.0
    median_fail_move = np.median(neg_moves) if neg_moves else 0.0
    
    overall_avg_move = np.mean(elite_rets) if elite_rets else 0.0
    overall_median_move = np.median(elite_rets) if elite_rets else 0.0
    
    max_move = max(elite_rets) if elite_rets else 0.0
    min_move = min(elite_rets) if elite_rets else 0.0
    
    # Gain thresholds
    gain_20 = [r for r in elite_rets if r >= 20.0]
    gain_35 = [r for r in elite_rets if r >= 35.0]
    gain_50 = [r for r in elite_rets if r >= 50.0]
    gain_100 = [r for r in elite_rets if r >= 100.0]
    severe_loss = [r for r in elite_rets if r <= -15.0]
    
    print(f"Total Elite PEAD Breakouts Identified : {total_elite}")
    print(f"Positive Moves (Wins)                 : {total_pos} ({win_rate:.1f}%)")
    print(f"Negative Moves (Fails)                : {total_fails} ({fail_rate:.1f}%)")
    print(f"Neutral Moves (0.0%)                  : {len(zero_moves)}")
    print("-" * 80)
    print(f"Average UP Move (Positive Stocks)     : +{avg_up_move:.2f}%")
    print(f"Median UP Move (Positive Stocks)      : +{median_up_move:.2f}%")
    print(f"Average DOWN Move (Failing Stocks)    : {avg_fail_move:.2f}%")
    print(f"Median DOWN Move (Failing Stocks)     : {median_fail_move:.2f}%")
    print(f"OVERALL Average Move (All Elite)      : {overall_avg_move:+.2f}%")
    print(f"OVERALL Median Move (All Elite)       : {overall_median_move:+.2f}%")
    print(f"MAXIMUM Move (Biggest Winner)         : +{max_move:.2f}%")
    print(f"MINIMUM Move (Worst Drawdown)         : {min_move:.2f}%")
    print("-" * 80)
    print("Magnitude Distribution in Elite Tier:")
    print(f"  • Gain >= +20% (Big Movers)         : {len(gain_20)} stocks ({len(gain_20)/total_elite*100:.1f}%)")
    print(f"  • Gain >= +35% (Strong Momentum)    : {len(gain_35)} stocks ({len(gain_35)/total_elite*100:.1f}%)")
    print(f"  • Gain >= +50% (Multi-Baggers)      : {len(gain_50)} stocks ({len(gain_50)/total_elite*100:.1f}%)")
    print(f"  • Gain >= +100% (Doublers)          : {len(gain_100)} stocks ({len(gain_100)/total_elite*100:.1f}%)")
    print(f"  • Severe Drawdown (Loss <= -15%)    : {len(severe_loss)} stocks ({len(severe_loss)/total_elite*100:.1f}%)")
    
    print("\n" + "=" * 80)
    print("📊 COMPARATIVE SUMMARY ACROSS ALL 4 TIERS")
    print("=" * 80)
    print(f"{'Tier Name':<28} {'Count':<7} {'Win Rate':<10} {'Avg Ret':<10} {'Med Ret':<10} {'>=+20%':<9} {'Max Move':<10} {'Min Move':<10}")
    print("-" * 95)
    
    def print_tier(name, items):
        rets = [x["ret_3m"] for x in items]
        if not rets: return
        pos = len([r for r in rets if r > 0])
        wr = (pos / len(rets)) * 100
        avg_r = np.mean(rets)
        med_r = np.median(rets)
        g20 = (len([r for r in rets if r >= 20.0]) / len(rets)) * 100
        mx = max(rets)
        mn = min(rets)
        print(f"{name:<28} {len(items):<7} {wr:5.1f}%    {avg_r:+6.2f}%    {med_r:+6.2f}%    {g20:5.1f}%    {mx:+7.1f}%   {mn:+6.1f}%")
        
    print_tier("1. Elite PEAD (85-100)", elite)
    print_tier("2. Strong PEAD (70-84.9)", strong)
    print_tier("3. Moderate PEAD (55-69.9)", moderate)
    print_tier("4. Neutral / Watch (<55)", neutral)
    
    print("\n" + "=" * 80)
    print("🏆 TOP 10 BEST PERFORMING ELITE PEAD STOCKS (MAX UP MOVES)")
    print("=" * 80)
    elite_sorted = sorted(elite, key=lambda x: x["ret_3m"], reverse=True)
    print(f"{'Symbol':<12} {'Company':<22} {'Score':<7} {'3M Move':<10} {'Sales YoY':<11} {'Sales QoQ':<11} {'PAT YoY':<10} {'PAT QoQ':<10}")
    print("-" * 95)
    for s in elite_sorted[:10]:
        cname = s["company"][:20]
        print(f"{s['symbol']:<12} {cname:<22} {s['score']:<7.1f} {s['ret_3m']:+7.2f}%   {s['sales_yoy'] or 0.0:+7.1f}%    {s['sales_qoq'] or 0.0:+7.1f}%    {s['pat_yoy'] or 0.0:+7.1f}%   {s['pat_qoq'] or 0.0:+7.1f}%")
        
    print("\n" + "=" * 80)
    print("⚠️ FAILED ELITE PEAD STOCKS (WORST DRAWDOWN CASE AUDIT)")
    print("=" * 80)
    fails_sorted = sorted([x for x in elite if x["ret_3m"] < 0], key=lambda x: x["ret_3m"])
    print(f"{'Symbol':<12} {'Company':<22} {'Score':<7} {'3M Move':<10} {'Sales YoY':<11} {'Sales QoQ':<11} {'PAT YoY':<10} {'PAT QoQ':<10}")
    print("-" * 95)
    for s in fails_sorted[:8]:
        cname = s["company"][:20]
        print(f"{s['symbol']:<12} {cname:<22} {s['score']:<7.1f} {s['ret_3m']:+7.2f}%   {s['sales_yoy'] or 0.0:+7.1f}%    {s['sales_qoq'] or 0.0:+7.1f}%    {s['pat_yoy'] or 0.0:+7.1f}%   {s['pat_qoq'] or 0.0:+7.1f}%")

if __name__ == "__main__":
    run_backtest()
