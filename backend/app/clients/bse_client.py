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

    def announcements(self, date_str: str = None) -> List[Dict[str, Any]]:
        """
        Fetches corporate announcements for a given date (YYYYMMDD).
        Defaults to current date.
        """
        if not date_str:
            date_str = datetime.now().strftime("%Y%m%d")

        params = {
            "strCat": "-1",
            "strPrevDate": date_str,
            "strScrip": "",
            "strSearch": "P",
            "strToDate": date_str,
            "strType": "C",
        }

        response = self.session.get(self.BASE_URL, params=params, timeout=20)
        if response.status_code != 200:
            return []

        try:
            data = response.json()
            raw_table = data.get("Table", [])
            results = []
            for item in raw_table:
                attachment = item.get("ATTACHMENTNAME", "").strip()
                pdf_url = f"{self.PDF_BASE}/{attachment}" if attachment else None
                
                # Derive symbol or scrip code
                scrip_cd = str(item.get("SCRIP_CD", "")).strip()
                headline = item.get("HEADLINE", "") or item.get("NEWSSUB", "")
                company_name = item.get("SLONGNAME", "")
                
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
            return results
        except Exception:
            return []
