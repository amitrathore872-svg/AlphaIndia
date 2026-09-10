import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.collectors.nse.announcements import NSEAnnouncementCollector

collector = NSEAnnouncementCollector()

filings = collector.fetch_announcements("KTKBANK")

print("=" * 70)
print(f"KTKBANK Financial Filings Found : {len(filings)}")
print("=" * 70)

for filing in filings[:10]:
    print()
    print("Period :", filing["period"])
    print("Type   :", filing["filing_type"])
    print("Date   :", filing["announcement_date"])
    print("PDF    :", filing["pdf_url"])