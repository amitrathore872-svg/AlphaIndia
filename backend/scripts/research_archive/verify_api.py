import requests

try:
    r = requests.get('http://127.0.0.1:8000/quarterly-results?limit=5&sort_by=pead_score')
    print('Status Code:', r.status_code)
    if r.status_code == 200:
        data = r.json()
        print(f"Total filings: {data['total']}, Results returned: {len(data['results'])}")
        for item in data['results']:
            print(f"Symbol: {item['symbol']:<10} | PEAD Score: {item['pead_score']:>4.1f} ({item['pead_tier_label']}) | PAT YoY: {item['pat_growth']}% | QoQ: {item['pat_growth_qoq']}% | RR Beat: {item['run_rate_beat_pct']}% | Date: {item['announcement_date']}")
    else:
        print('Error:', r.text[:300])
except Exception as e:
    print('Exception:', e)
