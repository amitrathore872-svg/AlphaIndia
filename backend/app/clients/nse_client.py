"""
Alpha India NSE Client
Sprint 37.0 Production Hardening
Uses browser TLS impersonation (curl_cffi chrome120) with graceful fallback to standard requests
to bypass Akamai 403 anti-bot blocks on official NSE corporate announcement endpoints.
"""

import logging
import time
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    from curl_cffi import requests as curl_requests
    HAS_CURL_CFFI = True
except ImportError:
    curl_requests = None
    HAS_CURL_CFFI = False

import requests


class NSEClient:
    BASE = "https://www.nseindia.com"

    BOOTSTRAP_HEADERS = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
    }

    API_HEADERS = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-financial-results",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
    }

    def __init__(self, use_curl_cffi: Optional[bool] = None):
        self.use_curl_cffi = (
            use_curl_cffi if use_curl_cffi is not None
            else (getattr(settings, "NSE_USE_CURL_CFFI", True) and HAS_CURL_CFFI)
        )
        self._init_session()
        self.bootstrap()

    def _init_session(self):
        if self.use_curl_cffi and HAS_CURL_CFFI:
            logger.debug("[NSEClient] Initializing curl_cffi session with chrome120 TLS impersonation.")
            self.session = curl_requests.Session(impersonate="chrome120")
        else:
            logger.debug("[NSEClient] Initializing standard requests.Session.")
            self.session = requests.Session()

    def bootstrap(self) -> bool:
        """
        Visits the NSE home domain to establish session cookies and TLS security context.
        """
        try:
            r = self.session.get(
                self.BASE,
                headers=self.BOOTSTRAP_HEADERS,
                timeout=15,
            )
            logger.debug(f"[NSEClient] Bootstrap response status: {r.status_code}")
            time.sleep(0.5)
            return r.status_code == 200
        except Exception as exc:
            logger.warning(f"[NSEClient] Bootstrap warning (proceeding): {exc}")
            return False

    def get_json(self, endpoint: str, params: Optional[Dict[str, Any]] = None, retries: int = 2) -> Any:
        url = f"{self.BASE}{endpoint}"

        for attempt in range(retries + 1):
            try:
                response = self.session.get(
                    url,
                    headers=self.API_HEADERS,
                    params=params,
                    timeout=20,
                )

                # If session timed out or Akamai blocked, re-bootstrap once
                if response.status_code in (401, 403) and attempt < retries:
                    logger.warning(f"[NSEClient] Received HTTP {response.status_code}. Re-bootstrapping session...")
                    time.sleep(1)
                    self.bootstrap()
                    continue

                if response.status_code != 200:
                    snippet = response.text[:200].replace("\n", " ")
                    raise RuntimeError(f"NSE API error HTTP {response.status_code}: {snippet}")

                content_type = response.headers.get("Content-Type", "")
                if "application/json" not in content_type:
                    if attempt < retries:
                        logger.warning("[NSEClient] Returned non-JSON content. Re-bootstrapping and retrying...")
                        time.sleep(1)
                        self.bootstrap()
                        continue
                    raise RuntimeError(f"NSE returned HTML/non-JSON content instead of expected JSON (Content-Type: {content_type}).")

                return response.json()

            except Exception as exc:
                if attempt >= retries:
                    logger.error(f"[NSEClient] Failed requesting {endpoint} after {retries + 1} attempts: {exc}")
                    raise
                time.sleep(1)

        raise RuntimeError(f"[NSEClient] Max retries exhausted for {endpoint}")

    def announcements(self, symbol: str) -> List[Dict[str, Any]]:
        """
        Fetches corporate announcements for a specific symbol.
        """
        res = self.get_json(
            "/api/corporate-announcements",
            params={
                "index": "equities",
                "symbol": symbol.upper(),
            },
        )
        return res if isinstance(res, list) else []

    def global_announcements(self) -> List[Dict[str, Any]]:
        """
        Fetches the latest real-time corporate announcements across all listed equities.
        """
        res = self.get_json(
            "/api/corporate-announcements",
            params={
                "index": "equities",
            },
        )
        return res if isinstance(res, list) else []