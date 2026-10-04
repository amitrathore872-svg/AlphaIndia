import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.database import SessionLocal
from app.services.investor_intelligence_service import InvestorIntelligenceService
from app.services.opportunity_alert_service import OpportunityAlertService
from app.models.notification import SystemNotification

db = SessionLocal()

print("--- Testing InvestorIntelligenceService.get_active_opportunities ---")
opps = InvestorIntelligenceService.get_active_opportunities(db)
print(f"Total Scanned: {opps['total_scanned_symbols']}")
print(f"Ready To Buy (Stage 2): {opps['ready_to_buy_count']}")
for r in opps['ready_to_buy']:
    print(f"  [READY TO BUY] {r['symbol']}: CMP Rs.{r['cmp']} | 50DMA Rs.{r['dma_50']} | 200DMA Rs.{r['dma_200']} | Verdict: {r['verdict']}")

print(f"\nInflection Radar (At Base Support): {opps['inflection_radar_count']}")
for r in opps['inflection_radar']:
    print(f"  [INFLECTION] {r['symbol']}: CMP Rs.{r['cmp']} | 50DMA Rs.{r['dma_50']} | 200DMA Rs.{r['dma_200']} | Verdict: {r['verdict']}")

print(f"\nStage 4 Warnings (Do Not Catch Knife): {opps['stage_4_warning_count']}")
for r in opps['stage_4_watchlist'][:5]:
    print(f"  [STAGE 4 WARNING] {r['symbol']}: CMP Rs.{r['cmp']} | 50DMA Rs.{r['dma_50']} | 200DMA Rs.{r['dma_200']} | Verdict: {r['verdict']}")

print("\n--- Testing OpportunityAlertService.scan_transformational_multibaggers_alerts ---")
rules = OpportunityAlertService.get_opportunity_thresholds(db)
dispatched = OpportunityAlertService.scan_transformational_multibaggers_alerts(db, rules)
print(f"Dispatched alerts count: {len(dispatched)}")
for d in dispatched:
    print(f"  Dispatched: {d['symbol']} -> {d['title']}")

print("\n--- Checking Recent Notifications ---")
notifs = db.query(SystemNotification).filter(SystemNotification.category == "TRANSFORMATIONAL_CATALYST").order_by(SystemNotification.id.desc()).limit(5).all()
print(f"Found {len(notifs)} transformational notifications:")
for n in notifs:
    print(f"  #{n.id} [{n.severity.upper()}] {n.title}")

print("\nSUCCESS: All pipeline connections verified!")
