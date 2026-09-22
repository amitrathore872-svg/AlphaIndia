"""
Alpha India - 2-Year NSE Delivery Bhavcopy Ingestion Engine
Downloads official daily security-wise delivery bhavcopies for the last 2 years (~500 trading sessions)
"""

import os
import datetime
import concurrent.futures
from curl_cffi import requests

def download_2y_data():
    os.makedirs("data/nse_delivery", exist_ok=True)
    base = datetime.date(2026, 9, 20)
    # 740 calendar days covers 2 full years
    all_dates = [base - datetime.timedelta(days=i) for i in range(1, 740)]
    trading_days = [d for d in all_dates if d.weekday() < 5]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*",
    }

    print(f"Targeting {len(trading_days)} weekdays over 2 full years (Sep 2024 - Sep 2026)...")

    def fetch_date(d):
        d_str = d.strftime("%d%m%Y")
        cache_file = f"data/nse_delivery/sec_bhavdata_full_{d_str}.csv"
        if os.path.exists(cache_file) and os.path.getsize(cache_file) > 10000:
            return d_str, True, "cached"

        url = f"https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{d_str}.csv"
        s = requests.Session(impersonate="chrome124")
        try:
            r = s.get(url, headers=headers, timeout=12)
            if r.status_code == 200 and len(r.content) > 10000:
                with open(cache_file, "wb") as f:
                    f.write(r.content)
                return d_str, True, len(r.content)
            return d_str, False, r.status_code
        except Exception as e:
            return d_str, False, str(e)

    # Use 12 threads for high-speed parallel retrieval
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        results = list(executor.map(fetch_date, trading_days))

    success = [r for r in results if r[1]]
    print(f"Total available trading days downloaded/cached: {len(success)} out of {len(trading_days)}")
    return len(success)

if __name__ == "__main__":
    download_2y_data()
