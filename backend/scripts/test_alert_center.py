"""
Alpha India — Alert Center End-to-End Test Suite
Tests: Telegram connection, broadcast dispatch, VCP alert, PEAD alert, Growth alert
"""
import sys, json, requests

sys.path.insert(0, ".")

BASE = "http://localhost:8000"
RESULTS = []

def check(label, passed, detail=""):
    icon = "PASS" if passed else "FAIL"
    RESULTS.append((icon, label, detail))
    print(f"  [{icon}] {label}")
    if detail:
        print(f"         {detail}")

def sep(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print(f"{'='*55}")


# ── 1. Telegram Connection Test ─────────────────────────────
sep("TEST 1: Telegram Connection & Token Verification")
try:
    r = requests.post(f"{BASE}/alerts/test/telegram", timeout=15)
    d = r.json()
    bot_info = d.get("bot_info", {})
    dispatch = d.get("dispatch_result", {})
    check("Bot token valid",        bot_info.get("valid") == True,  f"@{bot_info.get('bot_username')} id={bot_info.get('bot_id')}")
    check("Test message delivered", dispatch.get("success") == True, f"msg_id={dispatch.get('message_id')} error={dispatch.get('error')}")
    check("API status ok",          d.get("status") == "ok",         f"status={d.get('status')}")
except Exception as e:
    check("Telegram test endpoint", False, str(e))


# ── 2. Manual Broadcast ─────────────────────────────────────
sep("TEST 2: Manual Broadcast Dispatch")
try:
    r = requests.post(f"{BASE}/alerts/dispatch/broadcast", json={
        "channels": ["TELEGRAM"],
        "symbol": "RELIANCE",
        "title": "Test Broadcast Alert",
        "message": (
            "*ALPHA INDIA TEST BROADCAST*\n"
            "-----------------------------------\n"
            "Symbol: RELIANCE\n"
            "Alert: Manual broadcast test\n"
            "Status: Alert Center is OPERATIONAL\n"
            "-----------------------------------\n"
            "Alpha India v2.3.1"
        )
    }, timeout=15)
    d = r.json()
    tg = d.get("results", {}).get("telegram", {})
    check("Broadcast API responded",  r.status_code == 200,          f"HTTP {r.status_code}")
    check("Telegram dispatch success", tg.get("success") == True,    f"msg_id={tg.get('message_id')} error={tg.get('error')}")
    check("Status completed",         d.get("status") == "completed", f"status={d.get('status')}")
except Exception as e:
    check("Broadcast endpoint", False, str(e))


# ── 3. VCP Breakout Alert Generation ────────────────────────
sep("TEST 3: VCP Breakout Alert (Generate Brief)")
try:
    r = requests.post(f"{BASE}/alerts/generate-brief", json={
        "alert_type": "VCP_BREAKOUT",
        "symbol": "HDFCBANK",
        "company_name": "HDFC Bank Ltd",
        "data": {
            "vcp_stage": "3-Stage VCP",
            "pivot_price": 1750.0,
            "cmp": 1748.5,
            "entry_zone": "Rs 1745-1768",
            "stop_loss": 1695.0,
            "target_1": 1890.0,
            "target_2": 2010.0,
            "target_3": 2150.0,
            "reward_risk": 3.2,
            "final_ai_score": 94.5,
            "volume_breakout_ratio": 2.8,
            "volume_dryup_pct": 65,
            "thesis": "Tight 3-stage VCP with institutional volume expansion above pivot."
        }
    }, timeout=15)
    d = r.json()
    check("Brief generated",     r.status_code == 200,              f"HTTP {r.status_code}")
    check("Symbol in response",  d.get("symbol") == "HDFCBANK",     f"symbol={d.get('symbol')}")
    check("Memo text non-empty", len(d.get("memo_text", "")) > 50,   f"len={len(d.get('memo_text',''))}")
    check("WhatsApp URL generated", "wa.me" in d.get("whatsapp_url",""), f"{d.get('whatsapp_url','')[:50]}...")
except Exception as e:
    check("VCP brief endpoint", False, str(e))


# ── 4. PEAD Flash Brief ─────────────────────────────────────
sep("TEST 4: PEAD Flash Alert Brief")
try:
    r = requests.post(f"{BASE}/alerts/generate-brief", json={
        "alert_type": "PEAD",
        "symbol": "GNFC",
        "company_name": "Gujarat Narmada Valley Fertilizers",
        "data": {
            "signal": "BUY",
            "conviction_score": 92,
            "conviction_grade": "AAA",
            "revenue": 3200.0,
            "pat": 480.0,
            "growth_pat": 68.5,
            "upside_pct": 32.0,
            "thesis": "Earnings acceleration with fertilizer margin expansion post results."
        }
    }, timeout=15)
    d = r.json()
    check("PEAD brief generated",   r.status_code == 200, f"HTTP {r.status_code}")
    check("Memo non-empty",         len(d.get("memo_text","")) > 50)
except Exception as e:
    check("PEAD brief endpoint", False, str(e))


# ── 5. Dispatch Logs Audit ───────────────────────────────────
sep("TEST 5: Dispatch Audit Log Verification")
try:
    r = requests.get(f"{BASE}/alerts/logs?channel=TELEGRAM&limit=10", timeout=10)
    d = r.json()
    logs = d.get("logs", [])
    success_logs = [l for l in logs if l["status"] == "SUCCESS"]
    check("Logs endpoint reachable",  r.status_code == 200,   f"HTTP {r.status_code}")
    check("Logs returned",            len(logs) > 0,           f"count={len(logs)}")
    check("At least 1 SUCCESS entry", len(success_logs) > 0,  f"success={len(success_logs)} / total={len(logs)}")
    if success_logs:
        latest = success_logs[0]
        check("Latest SUCCESS recipient", latest.get("recipient") == "8349099576", f"recipient={latest.get('recipient')}")
except Exception as e:
    check("Dispatch logs endpoint", False, str(e))


# ── 6. Channel Config Verification ──────────────────────────
sep("TEST 6: Channel Config State")
try:
    r = requests.get(f"{BASE}/alerts/channels", timeout=10)
    d = r.json()
    tg = d.get("TELEGRAM", {})
    check("Channels endpoint ok",    r.status_code == 200,          f"HTTP {r.status_code}")
    check("TELEGRAM configured",     "TELEGRAM" in d,                "")
    check("TELEGRAM enabled",        tg.get("is_enabled") == True,   "")
    check("chat_id correct",         tg.get("chat_id") == "8349099576", f"chat_id={tg.get('chat_id')}")
    check("bot_token present",       bool(tg.get("bot_token")),      f"token={tg.get('bot_token')}")
except Exception as e:
    check("Channels config endpoint", False, str(e))


# ── Summary ─────────────────────────────────────────────────
sep("FINAL SUMMARY")
passed = sum(1 for r in RESULTS if r[0] == "PASS")
failed = sum(1 for r in RESULTS if r[0] == "FAIL")
total  = len(RESULTS)

print(f"  PASSED : {passed}/{total}")
print(f"  FAILED : {failed}/{total}")
print()

if failed == 0:
    print("  ALL TESTS PASSED - Alert Center is fully operational!")
    print("  Check your Telegram for 2 live messages.")
else:
    print("  FAILURES:")
    for icon, label, detail in RESULTS:
        if icon == "FAIL":
            print(f"    - {label}: {detail}")
print()
