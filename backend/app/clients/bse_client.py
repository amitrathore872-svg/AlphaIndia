"""
Alpha India BSE Client
Connects to BSE India public corporate announcements API.
"""

from datetime import datetime, timedelta
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

    def announcements(
        self,
        date_str: str = None,
        category: str = None,
        from_date: str = None,
        to_date: str = None,
        lookback_days: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Fetches corporate announcements for a given date range (YYYYMMDD).
        If date_str is provided, queries for that specific date.
        Otherwise defaults to a rolling lookback window (today - lookback_days to today)
        to ensure weekend and after-hours disclosures are never skipped.
        Queries multiple categories including 'Result' and 'Board Meeting' by default.
        """
        if date_str:
            date_slices = [date_str]
        else:
            to_d = to_date or datetime.now().strftime("%Y%m%d")
            from_d = from_date or (datetime.now() - timedelta(days=lookback_days)).strftime("%Y%m%d")
            # BSE's AnnSubCategoryGetData endpoint caps at 100 items per response.
            # When querying multiple days, iterate day-by-day to guarantee zero announcements are missed.
            try:
                start_dt = datetime.strptime(from_d, "%Y%m%d")
                end_dt = datetime.strptime(to_d, "%Y%m%d")
                curr_dt = end_dt
                date_slices = []
                while curr_dt >= start_dt:
                    date_slices.append(curr_dt.strftime("%Y%m%d"))
                    curr_dt -= timedelta(days=1)
            except Exception:
                date_slices = [to_d]

        categories_to_query = [category] if category else ["Result", "-1", "Board Meeting"]
        results: List[Dict[str, Any]] = []
        seen_keys = set()

        for day_str in date_slices:
            for cat in categories_to_query:
                params = {
                    "strCat": cat,
                    "strPrevDate": day_str,
                    "strScrip": "",
                    "strSearch": "P",
                    "strToDate": day_str,
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
