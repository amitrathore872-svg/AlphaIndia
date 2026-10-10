import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal
from app.models.investor_intelligence import InvestorIntelligenceInsight, InvestorDocument
from app.models.screener_growth_record import ScreenerGrowthRecord
import json

db = SessionLocal()

insights = db.query(InvestorIntelligenceInsight).all()
print(f"Total insights: {len(insights)}")

# Focus on stocks with UPWARD_REVISION or TRANSFORMATIONAL triggers
top_candidates = []

for ins in insights:
    rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == ins.symbol).first()
    cmp = rec.current_price if rec else None
    d50 = rec.dma_50 if rec else None
    d200 = rec.dma_200 if rec else None
    
    stage = "UNKNOWN"
    if cmp and d50 and d200:
        if cmp >= d50 and d50 >= d200:
            stage = "STAGE_2_UPTREND"
        elif cmp < d50 or cmp < d200:
            stage = "STAGE_4_DOWNTREND"
        else:
            stage = "STAGE_1_OR_3_CONSOLIDATION"
            
    # Check criteria: Raised Guidance OR Transformational OR High Conviction
    if ins.guidance_change == "UPWARD_REVISION" or ins.is_transformational_catalyst or (ins.growth_conviction_score and ins.growth_conviction_score >= 80):
        top_candidates.append({
            "symbol": ins.symbol,
            "company_name": ins.company_name,
            "stage": stage,
            "cmp": cmp,
            "dma_50": d50,
            "dma_200": d200,
            "guidance_change": ins.guidance_change,
            "credibility": ins.management_credibility_rating,
            "conviction": ins.growth_conviction_score,
            "sentiment": ins.management_sentiment_score,
            "is_transformational": ins.is_transformational_catalyst,
            "catalyst_category": ins.transformational_category,
            "catalyst_headline": ins.catalyst_headline,
            "capex_guidance": ins.capex_guidance_fy,
            "order_book": ins.executable_order_book_cr,
            "margin_drivers": ins.margin_drivers,
            "direct_quotes": ins.direct_quotes,
            "analyst_grill": ins.analyst_grill_quotes,
            "verdict": (ins.actionable_gameplan or {}).get("verdict"),
            "action": (ins.actionable_gameplan or {}).get("action"),
            "layman_summary": ins.layman_summary
        })

print(f"Filtered {len(top_candidates)} high-potential candidates.")
# Sort: STAGE 2 first, then by conviction
top_candidates.sort(key=lambda x: (x['stage'] == 'STAGE_2_UPTREND', x['guidance_change'] == 'UPWARD_REVISION', x['conviction'] or 0), reverse=True)

with open("top_multibagger_candidates.json", "w", encoding="utf-8") as f:
    json.dump(top_candidates, f, indent=2, ensure_ascii=False)

print("\n--- TOP RANKED CANDIDATES ---")
for c in top_candidates[:12]:
    print(f"[{c['symbol']}] Stage: {c['stage']} | Guidance: {c['guidance_change']} | Trans: {c['is_transformational']} | Conviction: {c['conviction']}/100")
    print(f"   CMP: Rs.{c['cmp']} | 50 DMA: Rs.{c['dma_50']} | 200 DMA: Rs.{c['dma_200']}")
    print(f"   Headline: {c['catalyst_headline']}")
    print(f"   Verdict: {c['verdict']}")
