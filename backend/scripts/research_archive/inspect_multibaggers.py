import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal
from app.models.investor_intelligence import InvestorIntelligenceInsight, InvestorDocument
from app.models.screener_growth_record import ScreenerGrowthRecord

db = SessionLocal()
insights = db.query(InvestorIntelligenceInsight).all()
print(f"Total insights in DB: {len(insights)}")

results = []
for ins in insights:
    rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == ins.symbol).first()
    cmp = rec.current_price if rec and rec.current_price else None
    d50 = rec.dma_50 if rec and rec.dma_50 else None
    d200 = rec.dma_200 if rec and rec.dma_200 else None
    
    stage = "UNKNOWN"
    if cmp and d50 and d200:
        if cmp >= d50 and d50 >= d200:
            stage = "STAGE_2_UPTREND"
        elif cmp < d50 or cmp < d200:
            stage = "STAGE_4_DOWNTREND"
        else:
            stage = "CONSOLIDATION_STAGE_1_OR_3"
            
    gameplan = ins.actionable_gameplan or {}
    verdict = gameplan.get("verdict", "N/A")
    action = gameplan.get("action", "")
    
    results.append({
        "symbol": ins.symbol,
        "company_name": ins.company_name,
        "stance": ins.institutional_stance,
        "guidance_change": ins.guidance_change,
        "credibility": ins.management_credibility_rating,
        "sentiment": ins.management_sentiment_score,
        "conviction": ins.growth_conviction_score,
        "is_transformational": ins.is_transformational_catalyst,
        "catalyst_category": ins.transformational_category,
        "catalyst_headline": ins.catalyst_headline,
        "exponential_multiple": ins.exponential_growth_multiple,
        "stage": stage,
        "cmp": cmp,
        "dma_50": d50,
        "dma_200": d200,
        "verdict": verdict,
        "action": action,
        "layman_summary": ins.layman_summary,
        "executive_thesis": ins.executive_thesis,
        "direct_quotes": ins.direct_quotes,
        "capex_guidance": ins.capex_guidance_fy,
        "order_book": ins.executable_order_book_cr
    })

# Filter for Extraordinary Commentary, Raised Guidance, Overdelivering & Ready to Buy
print("\n" + "="*80)
print("ALL ANALYZED STOCKS WITH TECHNICAL STAGE & GUIDANCE SUMMARY:")
print("="*80)
for r in sorted(results, key=lambda x: (x['stage'] == 'STAGE_2_UPTREND', x['is_transformational']), reverse=True):
    print(f"[{r['symbol']}] Stage: {r['stage']} | Guidance: {r['guidance_change']} | Trans: {r['is_transformational']} | Verdict: {r['verdict']}")
    if r['catalyst_headline']:
        print(f"   Catalyst: {r['catalyst_headline']}")
    if r['cmp']:
        print(f"   CMP: Rs.{r['cmp']} (50 DMA: Rs.{r['dma_50']}, 200 DMA: Rs.{r['dma_200']})")
