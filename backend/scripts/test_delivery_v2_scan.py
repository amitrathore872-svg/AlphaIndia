import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.delivery_radar_v2_service import DeliveryRadarV2Service

t0 = DeliveryRadarV2Service.scan_opportunities(force_refresh=True)
print("Metadata:", t0["metadata"])
print("Total opportunities in Radar 2.0:", len(t0["opportunities"]))
print("\nTop 8 Opportunities in Radar 2.0:")
for o in t0["opportunities"][:8]:
    print(f"  {o['symbol']:<12} | Score: {o['conviction_score']} | Archetype: {o['archetype_label']} | CMP: Rs {o['current_price']} | 5D Float Absorb: {o['float_absorb_5d_pct']}% | Free Float MCap: Rs {o['free_float_mcap_cr']} Cr | 10D Deliv Flow: {o['deliv_flow_10d']}x | Buyer Demand: {o['buyer_demand_ratio']}%")
