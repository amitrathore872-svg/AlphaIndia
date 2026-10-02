import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.clients.nse_client import NSEClient

client = NSEClient()

try:
    data = client.announcements("KTKBANK")

    print("\n" + "=" * 70)
    print("CONNECTED TO NSE API")
    print("=" * 70)

    print("Returned records:", len(data))

    if data:
        first = data[0]
        print("\nFirst Record\n")
        for k, v in first.items():
            print(f"{k}: {v}")

except Exception as e:
    print("\nNSE API FAILED\n")
    print(e)