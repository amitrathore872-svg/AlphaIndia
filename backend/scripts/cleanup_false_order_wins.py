"""
Alpha India — Order Wins False Positive Cleaner
Reclassifies non-order announcements (NCLT tribunal orders, fund raising, capex plant implementation, board meetings)
from ORDER_WIN to GENERAL.
"""

import sys
import os
import re

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.announcement_radar import AnnouncementRadar
from app.core.redis_cache import cache

RECLASSIFY_PATTERNS = [
    # NCLT, court, tribunal orders
    r"final\s+order\s+pronounced",
    r"order\s+pronounced",
    r"order\s+(?:passed|issued|pronounced)\s+by",
    r"court\s+order",
    r"nclt\s+order",
    r"hon'?ble\s+(?:tribunal|court|bench|high\s+court|supreme\s+court|nclt)",
    r"\bnclt\b",
    r"\bitat\b",
    r"interim\s+order",
    r"assessment\s+order",
    r"appellate\s+tribunal",
    r"compromise\s+and\s+arrangement",
    # Board meetings, AGM/EGM, secretarial
    r"meeting\s+of\s+(?:the\s+)?board\s+of\s+directors",
    r"outcome\s+of\s+board\s+meeting",
    r"notice\s+of\s+(?:the\s+)?(?:annual|extraordinary|extra[- ]ordinary)\s+general\s+meeting",
    r"voting\s+results",
    r"alter(?:ing)?\s+rights\s+and\s+interests",
    # Fund raising, preference shares, debentures, QIP, debt repayment
    r"raising\s+(?:of\s+)?(?:additional\s+)?(?:funds|capital)",
    r"issue\s+of\s+(?:one\s+or\s+more\s+types\s+of\s+)?(?:securities|equity|shares|warrants|debentures|ncds|preference\s+shares)",
    r"allotment\s+of\s+(?:equity|shares|warrants|debentures|securities)",
    r"preferential\s+allotment",
    r"qualified\s+institutional\s+placement",
    r"\bqip\b",
    r"rights\s+issue",
    r"bonus\s+issue",
    r"inter\s+corporate\s+deposit",
    r"repaid\s+loans?",
    r"repayment\s+of\s+(?:loans?|borrowings?|debt)",
    r"analysts?\s*/\s*institutional\s+investor\s+meet",
    r"earnings\s+conference\s+call",
    r"conference\s+call\s+updates?",
    # Internal capex
    r"implementing\s+(?:the\s+following\s+)?projects",
    r"setting\s+up\s+(?:of\s+)?(?:a\s+)?(?:new\s+)?(?:plant|unit|facility)",
]

def clean_false_positives():
    db = SessionLocal()
    try:
        orders = db.query(AnnouncementRadar).filter(AnnouncementRadar.catalyst_type == "ORDER_WIN").all()
        print(f"Total ORDER_WIN rows before cleanup: {len(orders)}")
        
        reclassified_count = 0
        for o in orders:
            txt = f"{o.category or ''} {o.headline} {o.filing_description or ''}".lower()
            if any(re.search(pat, txt) for pat in RECLASSIFY_PATTERNS):
                o.catalyst_type = "GENERAL"
                # Clear fake deal values if they were fund raising amounts or capex
                if o.deal_value_cr and o.deal_value_cr >= 1000 and any(re.search(p, txt) for p in [r"raising", r"shares", r"debentures", r"securities"]):
                    o.deal_value_cr = None
                reclassified_count += 1
                print(f"Reclassified ID {o.id} ({o.symbol}): {o.headline[:70]}")
        
        db.commit()
        print(f"Successfully reclassified {reclassified_count} false positive order wins.")
        
        # Flush redis and memory orderbook caches
        try:
            cache.clear_prefix_sync("orderbook:")
            print("Flushed orderbook caches.")
        except Exception as e:
            print(f"Cache flush notice: {e}")

    finally:
        db.close()

if __name__ == "__main__":
    clean_false_positives()
