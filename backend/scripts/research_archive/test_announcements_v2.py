import urllib.request
import json

try:
    req = urllib.request.Request('http://127.0.0.1:8000/announcements/stats')
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print('STATS:')
        print(json.dumps(data, indent=2))
except Exception as e:
    print('Stats error:', e)

try:
    req2 = urllib.request.Request('http://127.0.0.1:8000/announcements/radar?limit=8')
    with urllib.request.urlopen(req2) as resp:
        radar = json.loads(resp.read().decode())
        print(f'\nRETRIEVED {len(radar)} CARDS:')
        for item in radar:
            print(f"[{item.get('vertical_archetype')}] {item.get('symbol')} ({item.get('company_name')}):")
            print(f"  CMP: Rs {item.get('current_price')} | TP: Rs {item.get('target_price')} (+{item.get('upside_pct')}%) | SL: Rs {item.get('stop_loss')}")
            print(f"  Regime: {item.get('trend_regime')} | Rec: {item.get('recommendation')} | Conviction: {item.get('conviction_score')}%")
            print(f"  Absorption: {item.get('absorption_status')} (Move: +{item.get('realized_move_pct')}%) | Velocity: {item.get('est_velocity_days')}")
            print(f"  Announcement Date: {item.get('announcement_date')} | Rec Date: {item.get('recommendation_date')}")
            print()
except Exception as e:
    print('Radar error:', e)
