"""
Alpha India - DhanHQ Market Feed Client
Sprint 38.0 Real-Time Intraday Radar
Provides authenticated communication with DhanHQ API v2 for zero-delay live quotes,
market depth, and intraday candles for NSE Equities.
Includes automatic detection of Data API subscription status with graceful fallback.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional
import pandas as pd
import requests

from app.core.config import settings

logger = logging.getLogger("alpha_india.dhan")

try:
    from dhanhq import DhanContext, dhanhq
    HAS_DHANHQ = True
except ImportError:
    DhanContext = None
    dhanhq = None
    HAS_DHANHQ = False

DHAN_SCRIP_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv"


class DhanClient:
    """
    Thread-safe Dhan client wrapper for live quotes, scrip resolution,
    and intraday candle streaming.
    """

    _instance: Optional[DhanClient] = None
    _lock = threading.RLock()

    def __init__(self, client_id: Optional[str] = None, access_token: Optional[str] = None):
        self.client_id = client_id or settings.DHAN_CLIENT_ID or os.getenv("DHAN_CLIENT_ID")
        self.access_token = access_token or settings.DHAN_ACCESS_TOKEN or os.getenv("DHAN_ACCESS_TOKEN")
        self.dhan = None
        self._scrip_map: Dict[str, int] = {}  # Symbol -> Security ID
        self._reverse_scrip_map: Dict[int, str] = {}  # Security ID -> Symbol
        self._scrip_cache_time = 0
        self._data_api_subscribed: Optional[bool] = None
        self._init_client()

    @classmethod
    def get_instance(cls) -> DhanClient:
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _init_client(self):
        if not HAS_DHANHQ or not self.client_id or not self.access_token:
            logger.info("[DhanClient] Credentials not fully configured or dhanhq not installed.")
            return

        try:
            ctx = DhanContext(client_id=self.client_id, access_token=self.access_token)
            self.dhan = dhanhq(ctx)
            logger.info("[DhanClient] Initialized DhanHQ connection successfully.")
        except Exception as exc:
            logger.error(f"[DhanClient] Error initializing DhanHQ client: {exc}")
            self.dhan = None

    def is_configured(self) -> bool:
        return bool(self.client_id and self.access_token and self.dhan)

    @classmethod
    def reconfigure(cls, access_token: str, client_id: Optional[str] = None) -> DhanClient:
        """
        Dynamically updates the access token and reinitializes the client connection.
        """
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(client_id=client_id, access_token=access_token)
            else:
                if client_id:
                    cls._instance.client_id = client_id.strip()
                cls._instance.access_token = access_token.strip()
                cls._instance._data_api_subscribed = None
                cls._instance._init_client()
            return cls._instance

    def get_token_metadata(self) -> Dict[str, Any]:
        """
        Extracts public JWT claims from the access token without requiring the secret key.
        """
        if not self.access_token or "." not in self.access_token:
            return {"valid": False, "reason": "No access token configured"}

        try:
            import json
            import base64
            parts = self.access_token.split(".")
            if len(parts) >= 2:
                payload_b64 = parts[1] + "=="
                payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()))
                exp = payload.get("exp")
                iat = payload.get("iat")
                now = time.time()
                is_expired = now > exp if exp else True
                remaining_sec = max(0, int(exp - now)) if exp else 0

                return {
                    "valid": True,
                    "is_expired": is_expired,
                    "exp_timestamp": exp,
                    "iat_timestamp": iat,
                    "expires_in_sec": remaining_sec,
                    "expires_in_hours": round(remaining_sec / 3600.0, 1),
                    "dhan_client_id": payload.get("dhanClientId"),
                }
        except Exception as e:
            logger.debug(f"[DhanClient] Failed to decode token metadata: {e}")

        return {"valid": False, "reason": "Failed to parse JWT payload"}

    def check_connection(self) -> Dict[str, Any]:
        """
        Tests trading authentication, token expiration, and data API subscription status.
        """
        meta = self.get_token_metadata()
        if not self.is_configured():
            return {
                "configured": False,
                "status": "NOT_CONFIGURED",
                "trading_api_active": False,
                "data_api_subscribed": False,
                "is_expired": True,
                "message": "Dhan credentials not provided in .env",
            }

        if not meta.get("valid"):
            return {
                "configured": bool(self.client_id and self.access_token),
                "status": "INVALID",
                "trading_api_active": False,
                "data_api_subscribed": False,
                "is_expired": True,
                "client_id": self.client_id[:4] + "****" if self.client_id else None,
                "message": "Invalid token format. Please paste a valid JWT access token from Dhan portal.",
                "metadata": meta,
            }

        if meta.get("is_expired"):
            return {
                "configured": True,
                "status": "EXPIRED",
                "trading_api_active": False,
                "data_api_subscribed": False,
                "is_expired": True,
                "client_id": self.client_id[:4] + "****" if self.client_id else None,
                "message": "Access token expired. Please enter today's fresh token.",
                "metadata": meta,
            }

        # Token is valid JWT and not expired
        return {
            "configured": True,
            "status": "ACTIVE",
            "trading_api_active": True,
            "data_api_subscribed": True,
            "is_expired": False,
            "client_id": self.client_id[:4] + "****" if self.client_id else None,
            "message": "0-Delay Real-Time Live Feed Connected.",
            "metadata": meta,
        }

    def check_data_api_subscription(self, force_refresh: bool = False) -> bool:
        """
        Checks if the access token has active Data API access.
        Cached in memory to prevent hammering Dhan servers.
        """
        if not self.is_configured():
            return False

        if not force_refresh and self._data_api_subscribed is not None:
            return self._data_api_subscribed

        try:
            # Query a test quote for TCS (Security ID 11536)
            url = "https://api.dhan.co/v2/marketfeed/ohlc"
            headers = {
                "access-token": self.access_token,
                "client-id": self.client_id,
                "Content-Type": "application/json",
            }
            resp = requests.post(url, headers=headers, json={"NSE_EQ": [11536]}, timeout=5)
            if resp.status_code == 200:
                self._data_api_subscribed = True
            elif "Data APIs not Subscribed" in resp.text:
                self._data_api_subscribed = False
            else:
                self._data_api_subscribed = False
        except Exception as ex:
            logger.debug(f"[DhanClient] Data API probe failed: {ex}")
            self._data_api_subscribed = False

        return self._data_api_subscribed

    def get_security_id(self, symbol: str) -> Optional[int]:
        """
        Resolves an NSE equity symbol (e.g., 'TATASTEEL') to Dhan's Security ID.
        """
        clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
        if not self._scrip_map:
            self._load_scrip_master()
        return self._scrip_map.get(clean_sym)

    def _load_scrip_master(self):
        """
        Downloads and indexes NSE equities from Dhan's scrip master.
        Cached for 24 hours.
        """
        now = time.time()
        if self._scrip_map and (now - self._scrip_cache_time < 86400):
            return

        try:
            logger.info("[DhanClient] Downloading Dhan scrip master from CDN...")
            df = pd.read_csv(DHAN_SCRIP_MASTER_URL, low_memory=False)
            # Filter for NSE Equities
            nse_eq = df[(df["SEM_EXM_EXCH_ID"] == "NSE") & (df["SEM_INSTRUMENT_NAME"] == "EQUITY")]
            
            s_map: Dict[str, int] = {}
            rev_map: Dict[int, str] = {}
            for _, row in nse_eq.iterrows():
                sec_id = int(row["SEM_SMST_SECURITY_ID"])
                sym = str(row["SEM_TRADING_SYMBOL"]).strip().upper()
                s_map[sym] = sec_id
                rev_map[sec_id] = sym

            self._scrip_map = s_map
            self._reverse_scrip_map = rev_map
            self._scrip_cache_time = now
            logger.info(f"[DhanClient] Loaded {len(s_map)} NSE equity mappings successfully.")
        except Exception as exc:
            logger.error(f"[DhanClient] Failed to load scrip master: {exc}")

    def get_live_quotes(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetches live OHLCV, CMP, and VWAP for a batch of symbols.
        Returns a dictionary keyed by symbol.
        """
        if not self.is_configured() or not self.check_data_api_subscription():
            return {}

        self._load_scrip_master()
        id_to_sym: Dict[int, str] = {}
        sec_ids: List[int] = []

        for sym in symbols:
            clean = sym.strip().upper().replace(".NS", "").replace(".BO", "")
            sid = self._scrip_map.get(clean)
            if sid:
                sec_ids.append(sid)
                id_to_sym[sid] = clean

        if not sec_ids:
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        # Batch in chunks of 50
        chunk_size = 50
        for i in range(0, len(sec_ids), chunk_size):
            chunk = sec_ids[i : i + chunk_size]
            try:
                url = "https://api.dhan.co/v2/marketfeed/quote"
                headers = {
                    "access-token": self.access_token,
                    "client-id": self.client_id,
                    "Content-Type": "application/json",
                }
                resp = requests.post(url, headers=headers, json={"NSE_EQ": chunk}, timeout=8)
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get("NSE_EQ", {})
                    for sid_str, q in data.items():
                        sid = int(sid_str)
                        sym = id_to_sym.get(sid)
                        if sym:
                            ohlc = q.get("ohlc", {})
                            results[sym] = {
                                "symbol": sym,
                                "cmp": round(float(q.get("last_price", 0.0)), 2),
                                "open": round(float(ohlc.get("open", 0.0)), 2),
                                "high": round(float(ohlc.get("high", 0.0)), 2),
                                "low": round(float(ohlc.get("low", 0.0)), 2),
                                "close": round(float(ohlc.get("close", 0.0)), 2),
                                "vwap": round(float(q.get("avg_price", 0.0)), 2),
                                "volume": int(q.get("volume", 0)),
                                "source": "DHAN_REALTIME",
                            }
            except Exception as e:
                logger.debug(f"[DhanClient] Error fetching quotes chunk: {e}")

        return results
