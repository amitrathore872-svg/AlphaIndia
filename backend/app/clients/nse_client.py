"""
Alpha India NSE Client
Sprint 28.5.1 Recovery
Uses a browser-like session bootstrap that works with NSE APIs.
"""

import time
import requests


class NSEClient:
    BASE = "https://www.nseindia.com"

    API_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/140.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-financial-results",
        "X-Requested-With": "XMLHttpRequest",
    }

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(self.API_HEADERS)
        self.bootstrap()

    def bootstrap(self):
        """
        First request obtains cookies from NSE.
        Do NOT fail immediately if cookies cannot be fetched.
        """

        try:
            r = self.session.get(
                self.BASE,
                timeout=20,
                allow_redirects=True,
            )

            print(f"NSE Bootstrap Status: {r.status_code}")

            if r.status_code != 200:
                print("Bootstrap did not return 200, continuing anyway...")

            time.sleep(1)

        except Exception as e:
            print("Bootstrap warning:", e)

    def get_json(self, endpoint, params=None):
        url = f"{self.BASE}{endpoint}"

        response = self.session.get(
            url,
            params=params,
            timeout=30,
        )

        print("API Status:", response.status_code)
        print("Content-Type:", response.headers.get("Content-Type"))

        if response.status_code != 200:
            raise Exception(response.text[:300])

        if "application/json" not in response.headers.get("Content-Type", ""):
            raise Exception("NSE returned HTML instead of JSON.")

        return response.json()

    def announcements(self, symbol):
        return self.get_json(
            "/api/corporate-announcements",
            params={
                "index": "equities",
                "symbol": symbol.upper(),
            },
        )