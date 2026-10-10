"""
Alpha India BSE Client
Connects to BSE India public corporate announcements API.
"""

from datetime import datetime
import requests
from typing import List, Dict, Any


class BSEClient:
    BASE_URL = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w"
    PDF_BASE = "https://www.bseindia.com/xml-data/corpfiling/AttachLive"

    API_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.bseindia.com/",
        "Accept": "application/json, text/plain, */*",
    }

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(self.API_HEADERS)

    def announcements(self, date_str: str = None, category: str = None) -> List[Dict[str, Any]]:
        """
        Fetches corporate announcements for a given date (YYYYMMDD).
        Defaults to current date.
        Queries multiple categories including 'Result' and 'Board Meeting' by default
        to ensure financial results are never missed.
        """
        if not date_str:
            date_str = datetime.now().strftime("%Y%m%d")

        categories_to_query = [category] if category else ["Result", "-1", "Board Meeting"]
        results: List[Dict[str, Any]] = []
        seen_keys = set()

        for cat in categories_to_query:
            params = {
                "strCat": cat,
                "strPrevDate": date_str,
                "strScrip": "",
                "strSearch": "P",
                "strToDate": date_str,
                "strType": "C",
            }

            try:
                response = self.session.get(self.BASE_URL, params=params, timeout=20)
                if response.status_code != 200:
                    continue

                data = response.json()
                raw_table = data.get("Table", [])
                for item in raw_table:
                    attachment = item.get("ATTACHMENTNAME", "").strip()
                    pdf_url = f"{self.PDF_BASE}/{attachment}" if attachment else None

                    # Derive symbol or scrip code
                    scrip_cd = str(item.get("SCRIP_CD", "")).strip()
                    headline = item.get("HEADLINE", "") or item.get("NEWSSUB", "")
                    company_name = item.get("SLONGNAME", "")

                    unique_key = (scrip_cd, attachment) if attachment else (scrip_cd, headline)
                    if unique_key in seen_keys:
                        continue
                    seen_keys.add(unique_key)

                    results.append({
                        "scrip_code": scrip_cd,
                        "company_name": company_name,
                        "headline": headline,
                        "category": item.get("CATEGORYNAME", "General"),
                        "sub_category": item.get("SUBCATNAME", ""),
                        "announcement_time": item.get("NEWS_DT", ""),
                        "pdf_url": pdf_url,
                        "raw": item,
                    })
            except Exception:
                continue

        return results
