"""
Alpha India - 5paisa Xstream Market Feed Client
Provides authenticated communication with 5paisa Xstream API for zero-delay, zero-cost
live quotes, market depth, and ticks for NSE/BSE Equities.
Includes automated morning TOTP authentication via pyotp for zero manual intervention.
"""

from __future__ import annotations

import io
import json
import logging
import os
from pathlib import Path
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import pandas as pd
import requests

from app.core.config import settings

logger = logging.getLogger("alpha_india.fivepaisa")

try:
    import pyotp
    from py5paisa import FivePaisaClient as RawFivePaisaClient
    HAS_FIVEPAISA = True
except ImportError:
    pyotp = None
    RawFivePaisaClient = None
    HAS_FIVEPAISA = False

NSE_EQ_SCRIP_URL = "https://Openapi.5paisa.com/VendorsAPI/Service1.svc/ScripMaster/segment/nse_eq"


class FivePaisaClient:
    """
    Thread-safe 5paisa client wrapper for automated real-time live quotes.
    Automatically logs in via TOTP and caches access tokens for the day.
    """

    _instance: Optional[FivePaisaClient] = None
    _lock = threading.RLock()

    def __init__(self):
        self.app_name = settings.FIVEPAISA_APP_NAME or os.getenv("FIVEPAISA_APP_NAME", "ALPHAINNDIA")
        self.app_source = settings.FIVEPAISA_APP_SOURCE or os.getenv("FIVEPAISA_APP_SOURCE", "28560")
        self.user_id = settings.FIVEPAISA_USER_ID or os.getenv("FIVEPAISA_USER_ID", "bZD8gceTByk")
        self.password = settings.FIVEPAISA_PASSWORD or os.getenv("FIVEPAISA_PASSWORD", "vWECMl60xw8")
        self.user_key = settings.FIVEPAISA_USER_KEY or os.getenv("FIVEPAISA_USER_KEY", "5ELKX2zZFbOTcM0DdSg7Q3QEnjBC8vnO")
        self.encryption_key = settings.FIVEPAISA_ENCRYPTION_KEY or os.getenv("FIVEPAISA_ENCRYPTION_KEY", "lwWrT3inOVnje6YPg6hL0PK4G7KDhYbN")
        self.pin = settings.FIVEPAISA_PIN or os.getenv("FIVEPAISA_PIN", "260416")
        self.client_code = settings.FIVEPAISA_CLIENT_CODE or os.getenv("FIVEPAISA_CLIENT_CODE", "51082938")
        self.totp_key = settings.FIVEPAISA_TOTP_KEY or os.getenv("FIVEPAISA_TOTP_KEY", "GUYTAOBSHEZTQXZVKBDUWRKZ")

        self.client: Optional[RawFivePaisaClient] = None
        self.access_token: Optional[str] = None
        self._token_expires_at: float = 0.0

        self._scrip_map: Dict[str, Dict[str, Any]] = {}  # SYMBOL -> {ScripCode, Exch, ExchType}
        self._scrip_cache_time: float = 0.0

        self._init_client()

    @classmethod
    def get_instance(cls) -> FivePaisaClient:
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _init_client(self):
        if not HAS_FIVEPAISA:
            logger.warning("[FivePaisaClient] py5paisa or pyotp not installed.")
            return

        if not (self.user_key and self.encryption_key and self.user_id and self.password):
            logger.info("[FivePaisaClient] Credentials not configured.")
            return

        try:
            cred = {
                "APP_NAME": self.app_name,
                "APP_SOURCE": self.app_source,
                "USER_ID": self.user_id,
                "PASSWORD": self.password,
                "USER_KEY": self.user_key,
                "ENCRYPTION_KEY": self.encryption_key,
            }
            self.client = RawFivePaisaClient(cred=cred)
            logger.info("[FivePaisaClient] Raw 5paisa client initialized.")
        except Exception as exc:
            logger.error(f"[FivePaisaClient] Failed to instantiate RawFivePaisaClient: {exc}")
            self.client = None

    def is_configured(self) -> bool:
        return bool(
            self.client is not None
            and self.client_code
            and self.pin
            and self.totp_key
        )

    def is_logged_in(self) -> bool:
        if not self.access_token or not self.client:
            return False
        # Buffer of 60 seconds before expiration
        return time.time() < (self._token_expires_at - 60)

    def _get_token_cache_path(self) -> Path:
        cache_dir = Path(__file__).resolve().parent.parent.parent / "data"
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / ".fivepaisa_token_cache.json"

    def _try_load_cached_token(self) -> bool:
        cache_file = self._get_token_cache_path()
        if not cache_file.exists():
            return False
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            token = data.get("access_token")
            exp = float(data.get("expires_at", 0))
            if token and exp > (time.time() + 300):  # At least 5 minutes remaining
                self.access_token = token
                self._token_expires_at = exp
                if self.client:
                    self.client.access_token = token
                    self.client.Jwt_token = token
                    if hasattr(self.client, "jwt_headers"):
                        self.client.jwt_headers["Authorization"] = f"Bearer {token}"
                logger.info(
                    f"[FivePaisaClient] Restored cached token valid until "
                    f"{datetime.fromtimestamp(exp, tz=timezone.utc).isoformat()} UTC."
                )
                return True
        except Exception as e:
            logger.warning(f"[FivePaisaClient] Could not read token cache: {e}")
        return False

    def _save_cached_token(self, token: str, exp: float):
        try:
            cache_file = self._get_token_cache_path()
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump({"access_token": token, "expires_at": exp}, f)
        except Exception as e:
            logger.warning(f"[FivePaisaClient] Could not save token cache: {e}")

    def ensure_authenticated(self, force: bool = False) -> bool:
        """
        Ensures the client has an active, unexpired session.
        If expired or force=True, generates a fresh TOTP and requests a new token.
        Reuses cached tokens across process invocations to avoid TOTP collision.
        """
        with self._lock:
            if not self.is_configured():
                return False

            if not force and self.is_logged_in():
                return True

            if not force and self._try_load_cached_token():
                return True

            logger.info("[FivePaisaClient] Authenticating session with 5paisa via automated TOTP...")
            try:
                totp_gen = pyotp.TOTP(self.totp_key)
                code = totp_gen.now()

                req_token = self.client.get_request_token(self.client_code, code, self.pin)
                if not req_token:
                    logger.error("[FivePaisaClient] get_request_token returned None.")
                    return False

                access_token = self.client.get_access_token(req_token)
                if not access_token:
                    logger.error("[FivePaisaClient] get_access_token returned None.")
                    return False

                self.access_token = access_token
                if self.client:
                    self.client.access_token = access_token
                    if hasattr(self.client, "jwt_headers"):
                        self.client.jwt_headers["Authorization"] = f"Bearer {access_token}"

                # Parse JWT exp claim
                try:
                    payload_part = access_token.split(".")[1]
                    rem = len(payload_part) % 4
                    if rem > 0:
                        payload_part += "=" * (4 - rem)
                    import base64
                    decoded_bytes = base64.urlsafe_b64decode(payload_part)
                    claims = json.loads(decoded_bytes.decode("utf-8"))
                    self._token_expires_at = float(claims.get("exp", time.time() + 43200))
                except Exception as e:
                    logger.warning(f"[FivePaisaClient] Could not parse token exp claim: {e}")
                    self._token_expires_at = time.time() + 43200  # Default 12 hours

                self._save_cached_token(access_token, self._token_expires_at)

                logger.info(
                    f"[FivePaisaClient] Successfully authenticated! Session valid until "
                    f"{datetime.fromtimestamp(self._token_expires_at, tz=timezone.utc).isoformat()} UTC."
                )
                return True
            except Exception as exc:
                logger.error(f"[FivePaisaClient] Authentication failed: {exc}", exc_info=True)
                return False

    def load_scrip_master(self, force_refresh: bool = False):
        """
        Loads the NSE Equity scrip master from 5paisa to map stock symbols to ScripCodes.
        Refreshes once every 24 hours.
        """
        now = time.time()
        if self._scrip_map and not force_refresh and (now - self._scrip_cache_time) < 86400:
            return

        with self._lock:
            if self._scrip_map and not force_refresh and (now - self._scrip_cache_time) < 86400:
                return

            try:
                logger.info("[FivePaisaClient] Fetching NSE Equity Scrip Master...")
                resp = requests.get(NSE_EQ_SCRIP_URL, timeout=15)
                if resp.status_code == 200:
                    df = pd.read_csv(io.StringIO(resp.text))
                    mapping = {}
                    for _, row in df.iterrows():
                        name = str(row.get("Name", "")).strip().upper()
                        scrip_code = row.get("ScripCode")
                        if name and scrip_code is not None:
                            try:
                                mapping[name] = {
                                    "ScripCode": int(scrip_code),
                                    "Exch": str(row.get("Exch", "N")),
                                    "ExchType": str(row.get("ExchType", "C")),
                                }
                            except (ValueError, TypeError):
                                pass

                    self._scrip_map = mapping
                    self._scrip_cache_time = now
                    logger.info(f"[FivePaisaClient] Cached {len(self._scrip_map)} NSE Equity scrips.")
                else:
                    logger.error(f"[FivePaisaClient] Failed to load scrip master: HTTP {resp.status_code}")
            except Exception as e:
                logger.error(f"[FivePaisaClient] Error downloading scrip master: {e}")

    def get_live_quotes(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetches live zero-delay market quotes for given symbols from 5paisa.
        Returns a dictionary keyed by symbol with CMP, close, high, low, day_change, volume.
        """
        results: Dict[str, Dict[str, Any]] = {}
        if not symbols:
            return results

        if not self.ensure_authenticated():
            return results

        self.load_scrip_master()

        # Build request payloads for recognizable scrips
        req_list: List[Dict[str, Any]] = []
        sym_by_code: Dict[int, str] = {}

        for sym in symbols:
            clean = sym.strip().upper().replace(".NS", "").replace(".BO", "")
            scrip_info = self._scrip_map.get(clean)
            if scrip_info:
                code = scrip_info["ScripCode"]
                sym_by_code[code] = clean
                req_list.append({
                    "Exch": scrip_info["Exch"],
                    "ExchType": scrip_info["ExchType"],
                    "Symbol": clean,
                    "ScripCode": code,
                })
            else:
                # Try symbol directly if not in scrip map
                req_list.append({
                    "Exch": "N",
                    "ExchType": "C",
                    "Symbol": clean,
                })

        if not req_list:
            return results

        # Process in batches of 50
        batch_size = 50
        retried_auth = False
        for i in range(0, len(req_list), batch_size):
            batch = req_list[i : i + batch_size]
            try:
                res = self.client.fetch_market_feed(batch)
                if (not res or res.get("Status") != 0) and not retried_auth:
                    logger.warning("[FivePaisaClient] Market feed returned non-zero status, refreshing session...")
                    if self.ensure_authenticated(force=True):
                        retried_auth = True
                        res = self.client.fetch_market_feed(batch)

                if res and res.get("Status") == 0 and res.get("Data"):
                    for item in res["Data"]:
                        code = item.get("Token")
                        item_sym = item.get("Symbol") or sym_by_code.get(code)
                        if not item_sym:
                            continue

                        clean_sym = item_sym.strip().upper()
                        last_rate = item.get("LastRate")
                        if last_rate is None or last_rate <= 0:
                            continue

                        pclose = item.get("PClose") or last_rate
                        chg = item.get("Chg", round(last_rate - pclose, 2))
                        chg_pct = item.get("ChgPcnt")
                        if chg_pct is None and pclose > 0:
                            chg_pct = round((chg / pclose) * 100.0, 2)

                        results[clean_sym] = {
                            "symbol": clean_sym,
                            "cmp": float(last_rate),
                            "close": float(pclose),
                            "high": float(item.get("High", last_rate)),
                            "low": float(item.get("Low", last_rate)),
                            "day_change": float(chg),
                            "day_change_pct": float(chg_pct),
                            "volume": int(item.get("TotalQty", 0)),
                            "source": "FIVEPAISA_REALTIME",
                        }
            except Exception as e:
                logger.error(f"[FivePaisaClient] Error fetching market feed batch: {e}")
                if not retried_auth:
                    try:
                        logger.info("[FivePaisaClient] Retrying batch after force authentication...")
                        if self.ensure_authenticated(force=True):
                            retried_auth = True
                            res = self.client.fetch_market_feed(batch)
                            if res and res.get("Status") == 0 and res.get("Data"):
                                for item in res["Data"]:
                                    code = item.get("Token")
                                    item_sym = item.get("Symbol") or sym_by_code.get(code)
                                    if item_sym and item.get("LastRate"):
                                        c_sym = item_sym.strip().upper()
                                        lr = float(item["LastRate"])
                                        pc = float(item.get("PClose") or lr)
                                        results[c_sym] = {
                                            "symbol": c_sym,
                                            "cmp": lr,
                                            "close": pc,
                                            "high": float(item.get("High", lr)),
                                            "low": float(item.get("Low", lr)),
                                            "day_change": round(lr - pc, 2),
                                            "day_change_pct": round(((lr - pc) / pc) * 100.0, 2) if pc > 0 else 0.0,
                                            "volume": int(item.get("TotalQty", 0)),
                                            "source": "FIVEPAISA_REALTIME",
                                        }
                    except Exception as retry_err:
                        logger.error(f"[FivePaisaClient] Retry also failed: {retry_err}")

        return results

    def get_status_info(self) -> Dict[str, Any]:
        """
        Returns connection status metadata for health dashboards and UI widgets.
        """
        is_cfg = self.is_configured()
        is_active = self.is_logged_in()
        return {
            "broker": "5paisa Xstream",
            "is_configured": is_cfg,
            "is_active": is_active,
            "client_code": self.client_code,
            "cached_scrips": len(self._scrip_map),
            "token_expires_at": (
                datetime.fromtimestamp(self._token_expires_at, tz=timezone.utc).isoformat()
                if self._token_expires_at > 0
                else None
            ),
            "free_tier": True,
            "latency": "0ms (Real-time Exchange Feed)",
        }

    def get_historical_candles(
        self,
        symbol: str,
        timeframe: str = "5m",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Retrieves historical OHLCV candles directly from 5paisa.
        Supported timeframes: '1m', '3m', '5m', '10m', '15m', '30m', '60m', '1d'.
        Returns pd.DataFrame with columns: ['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume'].
        """
        if not self.ensure_authenticated():
            logger.warning("[FivePaisaClient] Cannot fetch historical candles: not authenticated.")
            return pd.DataFrame()

        self.load_scrip_master()
        clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
        scrip_info = self._scrip_map.get(clean_sym)
        if not scrip_info:
            logger.warning(f"[FivePaisaClient] ScripCode not found in master for {clean_sym}")
            return pd.DataFrame()

        # Format dates if not supplied
        now_dt = datetime.now()
        if not to_date:
            to_date = now_dt.strftime("%Y-%m-%d")
        if not from_date:
            # Default to last 30 days
            from_date = (now_dt - pd.Timedelta(days=30)).strftime("%Y-%m-%d")

        # Map timeframe
        tf = timeframe.lower()
        if tf not in ["1m", "3m", "5m", "10m", "15m", "30m", "60m", "1d"]:
            tf = "5m"

        try:
            # Ensure JWT headers in raw client
            if hasattr(self.client, "jwt_headers"):
                self.client.jwt_headers["Authorization"] = f"Bearer {self.access_token}"
            if hasattr(self.client, "access_token"):
                self.client.access_token = self.access_token

            df = self.client.historical_data(
                scrip_info["Exch"],
                scrip_info["ExchType"],
                scrip_info["ScripCode"],
                tf,
                from_date,
                to_date,
            )

            if isinstance(df, pd.DataFrame) and not df.empty:
                # Standardize columns
                col_map = {c: c.capitalize() for c in df.columns}
                df.rename(columns=col_map, inplace=True)
                df["Datetime"] = pd.to_datetime(df["Datetime"])
                return df
            else:
                logger.info(f"[FivePaisaClient] No historical data returned for {clean_sym}: {df}")
                return pd.DataFrame()
        except Exception as e:
            logger.error(f"[FivePaisaClient] Failed to fetch historical candles for {clean_sym}: {e}")
            return pd.DataFrame()

