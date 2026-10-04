import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal
from app.models.investor_intelligence import InvestorIntelligenceInsight, InvestorDocument
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.stock_technical_service import StockTechnicalService

db = SessionLocal()

print("--- Step 1: Updating 50 DMA & 200 DMA for target symbols ---")
distinct_symbols = [s[0] for s in db.query(InvestorIntelligenceInsight.symbol).distinct().all()]
print(f"Target symbols count: {len(distinct_symbols)}")

updated_count = 0
for sym in distinct_symbols:
    r = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == sym).first()
    if not r:
        r = ScreenerGrowthRecord(symbol=sym)
        db.add(r)
    try:
        info = StockTechnicalService._fetch_yf_fast_info(sym)
        if info.get("last_price"):
            r.current_price = info["last_price"]
        if info.get("dma_50"):
            r.dma_50 = info["dma_50"]
        if info.get("dma_200"):
            r.dma_200 = info["dma_200"]
        updated_count += 1
        print(f"Updated {sym}: CMP={r.current_price}, 50DMA={r.dma_50}, 200DMA={r.dma_200}")
    except Exception as e:
        print(f"Error {sym}: {e}")

db.commit()
print(f"Updated {updated_count} records.")

# Step 2: Now inspect all insights with updated technical stage
insights = db.query(InvestorIntelligenceInsight).all()
print(f"\nAnalyzing {len(insights)} insight records for Multibaggers & Raised Guidance...")

ready_to_buy_multibaggers = []
watchlist_stage4 = []
other_picks = []

for ins in insights:
    rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == ins.symbol).first()
    cmp = rec.current_price if rec and rec.current_price else None
    d50 = rec.dma_50 if rec and rec.dma_50 else None
    d200 = rec.dma_200 if rec and rec.dma_200 else None
    
    # Calculate stage
    is_stage_2 = False
    is_stage_4 = False
    if cmp and d50:
        if d200:
            if cmp >= d50 and d50 >= d200:
                is_stage_2 = True
            elif cmp < d50 or cmp < d200:
                is_stage_4 = True
        else:
            if cmp >= d50:
                is_stage_2 = True
            else:
                is_stage_4 = True
                
    item = {
        "symbol": ins.symbol,
        "company_name": ins.company_name,
        "guidance": ins.guidance_change,
        "sentiment": ins.management_sentiment_score,
        "credibility": ins.management_credibility_rating,
        "conviction": ins.growth_conviction_score,
        "is_transformational": ins.is_transformational_catalyst,
        "catalyst_category": ins.transformational_category,
        "catalyst_headline": ins.catalyst_headline,
        "exponential_multiple": ins.exponential_growth_multiple,
        "cmp": cmp,
        "dma_50": d50,
        "dma_200": d200,
        "is_stage_2": is_stage_2,
        "is_stage_4": is_stage_4,
        "gameplan": ins.actionable_gameplan or {},
        "layman_summary": ins.layman_summary,
        "direct_quotes": ins.direct_quotes,
        "capex_guidance": ins.capex_guidance_fy,
        "order_book": ins.executable_order_book_cr,
        "margin_drivers": ins.margin_drivers,
        "raw_payload": ins.raw_analyst_payload or {}
    }
    
    # Check if extraordinary commentary / raised guidance / beating commitments
    has_raised_guidance = (ins.guidance_change == "UPWARD_REVISION")
    is_multibagger_trigger = ins.is_transformational_catalyst
    
    if is_stage_2:
        ready_to_buy_multibaggers.append(item)
    elif is_stage_4:
        watchlist_stage4.append(item)
    else:
        other_picks.append(item)

print(f"\nFound {len(ready_to_buy_multibaggers)} STAGE 2 (READY TO BUY) candidates!")
print(f"Found {len(watchlist_stage4)} STAGE 4 (WAIT / DO NOT BUY) candidates.")

# Print top Stage 2 candidates
print("\n" + "="*80)
print("STAGE 2 UPTREND CANDIDATES (READY TO BUY WITH SOLID/RAISED GUIDANCE):")
print("="*80)
for item in sorted(ready_to_buy_multibaggers, key=lambda x: (x['is_transformational'], x['guidance'] == 'UPWARD_REVISION', x['conviction']), reverse=True):
    print(f"\n>>> [{item['symbol']}] {item['company_name']}")
    print(f"    CMP: Rs.{item['cmp']} | 50 DMA: Rs.{item['dma_50']} | 200 DMA: Rs.{item['dma_200']}")
    print(f"    Guidance: {item['guidance']} | Credibility: {item['credibility']} | Conviction: {item['conviction']}/100")
    print(f"    Transformational: {item['is_transformational']} ({item['catalyst_category']})")
    print(f"    Headline: {item['catalyst_headline']}")
    print(f"    Verdict: {item['gameplan'].get('verdict')}")
    print(f"    Layman Summary:\n{item['layman_summary']}")
