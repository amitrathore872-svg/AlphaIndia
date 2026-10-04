import requests
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=" * 65)
    print("ALPHA INDIA — COMPREHENSIVE ALERT & TELEGRAM TEST RUN")
    print("=" * 65)

    # 1. Telegram Connection & Configuration Test
    print("\n[Step 1] Verifying Telegram Bot API Token & Connectivity...")
    try:
        r1 = requests.post(f"{BASE_URL}/alerts/test/telegram", timeout=15)
        print(f"HTTP Status: {r1.status_code}")
        print("Response:", json.dumps(r1.json(), indent=2))
    except Exception as e:
        print(f"Error testing telegram: {e}")

    # 2. Telegram Auto-Detect Chats
    print("\n[Step 2] Polling Telegram getUpdates (Detect Chat ID)...")
    try:
        r2 = requests.get(f"{BASE_URL}/alerts/test/telegram/detect-chats", timeout=15)
        print(f"HTTP Status: {r2.status_code}")
        print("Response:", json.dumps(r2.json(), indent=2))
    except Exception as e:
        print(f"Error auto-detecting chats: {e}")

    # 3. Fetch Top 5 Sovereign Cockpit Picks
    print("\n[Step 3] Fetching Top 5 Sovereign Cockpit Picks...")
    top_5 = []
    try:
        r3 = requests.get(f"{BASE_URL}/sovereign/cockpit", timeout=10)
        if r3.status_code == 200:
            cockpit = r3.json()
            comp = cockpit.get("chamber_1_compounders", {}).get("candidates", [])
            turn = cockpit.get("chamber_2_turnarounds", {}).get("candidates", [])
            all_picks = sorted(comp + turn, key=lambda x: x.get("conviction_score", 0), reverse=True)
            top_5 = all_picks[:5]
            print(f"Successfully evaluated Sovereign Universe. Found {len(top_5)} Apex Picks:")
            for idx, p in enumerate(top_5, 1):
                print(f"  {idx}. {p.get('symbol')} ({p.get('company_name')}) | CMP: ₹{p.get('cmp')} | Buy Box: {p.get('buy_box_entry')} | Hard Stop: ₹{p.get('hard_stop')} (-3%) | Target 1: ₹{p.get('target_1')} (+14%) | Score: {p.get('conviction_score')}")
        else:
            print(f"Failed to fetch cockpit: {r3.status_code}")
    except Exception as e:
        print(f"Error fetching cockpit: {e}")

    # 4. Dispatch Alert for Top Pick (CENTUM)
    target_symbol = top_5[0]["symbol"] if top_5 else "CENTUM"
    print(f"\n[Step 4] Executing Sovereign Alert Dispatch for Top Pick ({target_symbol})...")
    try:
        payload = {
            "symbol": target_symbol,
            "alert_type": "IGNITION_TRIGGER",
            "custom_note": "Automated verification test run from Alpha India Terminal"
        }
        r4 = requests.post(f"{BASE_URL}/sovereign/dispatch-alert", json=payload, timeout=10)
        print(f"HTTP Status: {r4.status_code}")
        print("Response:", json.dumps(r4.json(), indent=2))
    except Exception as e:
        print(f"Error dispatching sovereign alert: {e}")

    # 5. Check In-App Notification Center
    print("\n[Step 5] Checking In-App Notification Center (GET /api/notifications)...")
    try:
        r5 = requests.get(f"{BASE_URL}/notifications?limit=5", timeout=10)
        if r5.status_code == 200:
            data = r5.json()
            notifs = data.get("notifications", [])
            print(f"Total Notifications: {data.get('total')}. Showing latest {len(notifs)}:")
            for n in notifs[:3]:
                print(f"  - [{n.get('category')}] {n.get('title')}: {n.get('message')[:80]}...")
        else:
            print(f"Failed to fetch notifications: {r5.status_code}")
    except Exception as e:
        print(f"Error checking notifications: {e}")

    # 6. Check Dispatch Audit Logs
    print("\n[Step 6] Inspecting Alert Dispatch Audit Logs (GET /api/alerts/logs)...")
    try:
        r6 = requests.get(f"{BASE_URL}/alerts/logs?limit=5", timeout=10)
        if r6.status_code == 200:
            logs = r6.json().get("logs", [])
            print(f"Latest {len(logs)} Dispatch Logs:")
            for l in logs:
                print(f"  - [{l.get('dispatched_at')}] [{l.get('channel')}] {l.get('symbol')} -> Status: {l.get('status')} | Recipient: {l.get('recipient')} | Error: {l.get('error_message')}")
        else:
            print(f"Failed to fetch logs: {r6.status_code}")
    except Exception as e:
        print(f"Error checking logs: {e}")

    print("\n" + "=" * 65)
    print("TEST RUN COMPLETE")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
