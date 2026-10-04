"""
Market Indices Service
Sprint 42 - Institutional Indian Market Indices Radar & Monthly Heatmap Engine
Computes 12-month rolling monthly performance (Green / Red), win rates, and return matrices
across all listed benchmark, sectoral, and thematic indices on NSE & BSE.
"""

import os
import json
import time
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "indices_cache.json")
CACHE_TTL_SECONDS = 3600  # 1 hour cache TTL

# Curated catalog of all major listed Indian Stock Market Indices
INDEX_CATALOG = [
    # ── Broad Market Benchmarks ──
    {
        "symbol": "NIFTY_50",
        "name": "Nifty 50",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": "^NSEI",
        "nifty_name": "Nifty 50",
        "description": "Flagship benchmark index representing 50 large-cap Indian companies."
    },
    {
        "symbol": "SENSEX",
        "name": "BSE Sensex",
        "category": "BROAD",
        "exchange": "BSE",
        "yf_ticker": "^BSESN",
        "nifty_name": None,
        "description": "Benchmark index of the Bombay Stock Exchange (BSE) of 30 well-established firms."
    },
    {
        "symbol": "NIFTY_NEXT_50",
        "name": "Nifty Next 50",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": "^NSMIDCP",
        "nifty_name": "Nifty Next 50",
        "description": "50 companies from Nifty 100 after excluding Nifty 50 (Junior Nifty)."
    },
    {
        "symbol": "NIFTY_100",
        "name": "Nifty 100",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": "^CNX100",
        "nifty_name": "Nifty 100",
        "description": "Top 100 large-cap companies listed on NSE."
    },
    {
        "symbol": "NIFTY_200",
        "name": "Nifty 200",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": "^CNX200",
        "nifty_name": "Nifty 200",
        "description": "Top 200 liquid and large-to-mid capitalisation equities."
    },
    {
        "symbol": "NIFTY_500",
        "name": "Nifty 500",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": "^CRSLDX",
        "nifty_name": "Nifty 500",
        "description": "Broad market index representing ~94% of the free float market capitalization."
    },
    {
        "symbol": "NIFTY_MIDCAP_50",
        "name": "Nifty Midcap 50",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": "^NSEMDCP50",
        "nifty_name": "Nifty Midcap 50",
        "description": "Top 50 midcap companies with high liquidity and market preference."
    },
    {
        "symbol": "NIFTY_MIDCAP_100",
        "name": "Nifty Midcap 100",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Midcap 100",
        "description": "Full mid-cap segment capturing high-growth middle-tier Indian corporations."
    },
    {
        "symbol": "NIFTY_MIDCAP_150",
        "name": "Nifty Midcap 150",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Midcap 150",
        "description": "150 mid-sized companies ranked 101 to 250 in the Nifty 500."
    },
    {
        "symbol": "NIFTY_SMALLCAP_50",
        "name": "Nifty Smallcap 50",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Smallcap 50",
        "description": "Top 50 smallcap equities with high liquidity and turnover."
    },
    {
        "symbol": "NIFTY_SMALLCAP_100",
        "name": "Nifty Smallcap 100",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": "^CNXSC",
        "nifty_name": "Nifty Smallcap 100",
        "description": "Premier small-cap universe representing emerging Indian growth stories."
    },
    {
        "symbol": "NIFTY_SMALLCAP_250",
        "name": "Nifty Smallcap 250",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Smallcap 250",
        "description": "250 smallcap companies ranked 251 to 500 in the Nifty 500."
    },
    {
        "symbol": "BSE_100",
        "name": "BSE 100",
        "category": "BROAD",
        "exchange": "BSE",
        "yf_ticker": "BSE-100.BO",
        "nifty_name": None,
        "description": "BSE top 100 large-cap stocks."
    },
    {
        "symbol": "BSE_500",
        "name": "BSE 500",
        "category": "BROAD",
        "exchange": "BSE",
        "yf_ticker": "BSE-500.BO",
        "nifty_name": None,
        "description": "BSE comprehensive broad market index representing 500 companies."
    },
    {
        "symbol": "INDIA_VIX",
        "name": "India VIX",
        "category": "BROAD",
        "exchange": "NSE",
        "yf_ticker": "^INDIAVIX",
        "nifty_name": "India VIX",
        "description": "Market Volatility & Fear Gauge derived from Nifty option order book."
    },

    # ── Sectoral Indices ──
    {
        "symbol": "NIFTY_BANK",
        "name": "Nifty Bank",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": "^NSEBANK",
        "nifty_name": "Nifty Bank",
        "description": "12 most liquid and large Indian banking stocks (PSU & Private)."
    },
    {
        "symbol": "NIFTY_IT",
        "name": "Nifty IT",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": "^CNXIT",
        "nifty_name": "Nifty IT",
        "description": "Indian Information Technology sector giants including TCS, Infosys, Wipro."
    },
    {
        "symbol": "NIFTY_AUTO",
        "name": "Nifty Auto",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Auto",
        "description": "Automobiles, commercial vehicles, 2-wheelers, auto components and ancillaries."
    },
    {
        "symbol": "NIFTY_PHARMA",
        "name": "Nifty Pharma",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": "^CNXPHARMA",
        "nifty_name": "Nifty Pharma",
        "description": "Top Indian pharmaceutical, formulations, and active pharmaceutical ingredient firms."
    },
    {
        "symbol": "NIFTY_FMCG",
        "name": "Nifty FMCG",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty FMCG",
        "description": "Fast Moving Consumer Goods leaders including ITC, HUL, Nestlé, Britannia."
    },
    {
        "symbol": "NIFTY_METAL",
        "name": "Nifty Metal",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Metal",
        "description": "Ferrous & non-ferrous metals, steel producers, aluminum, mining corporations."
    },
    {
        "symbol": "NIFTY_REALTY",
        "name": "Nifty Realty",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Realty",
        "description": "Real estate developers, residential, commercial infrastructure constructors."
    },
    {
        "symbol": "NIFTY_FIN_SERVICE",
        "name": "Nifty Financial Services",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Fin Service",
        "description": "Banks, NBFCs, housing finance companies, insurance, and asset management."
    },
    {
        "symbol": "NIFTY_PSU_BANK",
        "name": "Nifty PSU Bank",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty PSU Bank",
        "description": "Public Sector Undertaking (State-Owned) banks like SBI, PNB, Bank of Baroda."
    },
    {
        "symbol": "NIFTY_PVT_BANK",
        "name": "Nifty Private Bank",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Pvt Bank",
        "description": "Private sector banks like HDFC Bank, ICICI Bank, Axis Bank, Kotak Bank."
    },
    {
        "symbol": "NIFTY_ENERGY",
        "name": "Nifty Energy",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Energy",
        "description": "Petroleum, gas, power utilities, green energy, oil marketing companies."
    },
    {
        "symbol": "NIFTY_INFRA",
        "name": "Nifty Infrastructure",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Infra",
        "description": "Telecommunications, power, transport, ports, roads, EPC infrastructure."
    },
    {
        "symbol": "NIFTY_HEALTHCARE",
        "name": "Nifty Healthcare",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Healthcare",
        "description": "Hospitals, diagnostic chains, pharma companies, medical equipment."
    },
    {
        "symbol": "NIFTY_CONSR_DURBL",
        "name": "Nifty Consumer Durables",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Consr Durbl",
        "description": "Consumer electronics, home appliances, footwear, air conditioners, watches."
    },
    {
        "symbol": "NIFTY_OIL_GAS",
        "name": "Nifty Oil & Gas",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Oil & Gas",
        "description": "Upstream exploration, downstream refining, city gas distribution networks."
    },
    {
        "symbol": "NIFTY_MEDIA",
        "name": "Nifty Media",
        "category": "SECTORAL",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Media",
        "description": "Broadcasting, entertainment, digital media, print, theater chains."
    },

    # ── Thematic & Strategy Indices ──
    {
        "symbol": "NIFTY_COMMODITIES",
        "name": "Nifty Commodities",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Commodities",
        "description": "Companies engaged in oil, petroleum, chemicals, cement, metals, agriculture."
    },
    {
        "symbol": "NIFTY_CONSUMPTION",
        "name": "Nifty India Consumption",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Consumption",
        "description": "Consumer discretionary, retail, auto, FMCG benefiting from domestic demand."
    },
    {
        "symbol": "NIFTY_CPSE",
        "name": "Nifty CPSE",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty CPSE",
        "description": "Central Public Sector Enterprises under Government of India divestment."
    },
    {
        "symbol": "NIFTY_PSE",
        "name": "Nifty PSE",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty PSE",
        "description": "Public Sector Enterprises where Central/State Government holds >51% equity."
    },
    {
        "symbol": "NIFTY_MNC",
        "name": "Nifty MNC",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty MNC",
        "description": "Multinational Corporations operating in India where foreign promoter >50%."
    },
    {
        "symbol": "NIFTY_INDIA_MFG",
        "name": "Nifty India Manufacturing",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty India Mfg",
        "description": "Make-in-India beneficiaries across engineering, capital goods, defense, auto."
    },
    {
        "symbol": "NIFTY_SERVICES",
        "name": "Nifty Services Sector",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Serv Sector",
        "description": "Services economy including financial services, telecommunication, IT, travel."
    },
    {
        "symbol": "NIFTY_ALPHA_50",
        "name": "Nifty Alpha 50",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Alpha 50",
        "description": "Top 50 high-alpha equities generating excess returns over the market."
    },
    {
        "symbol": "NIFTY_QUALITY_30",
        "name": "Nifty Quality 30",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty100 Qualty30",
        "description": "High return on equity (ROE), low debt-equity, and smooth earnings growth."
    },
    {
        "symbol": "NIFTY_LOW_VOL_50",
        "name": "Nifty Low Volatility 50",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty LowVol50",
        "description": "Least volatile stocks in the top 300 universe over the previous 1 year."
    },
    {
        "symbol": "NIFTY_DIV_OPPS_50",
        "name": "Nifty Dividend Opportunities 50",
        "category": "THEMATIC",
        "exchange": "NSE",
        "yf_ticker": None,
        "nifty_name": "Nifty Div Opps 50",
        "description": "High dividend-yielding companies with stable operational track record."
    }
]


class MarketIndicesService:
    """Service to scan, compute and serve Indian Index 12-month performance."""

    _cache_lock = threading.Lock()
    _memory_cache: Optional[Dict[str, Any]] = None
    _cache_time: float = 0.0

    @classmethod
    def _create_http_session(cls) -> requests.Session:
        s = requests.Session()
        s.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Content-Type": "application/json; charset=utf-8",
            "Referer": "https://www.niftyindices.com/reports/historical-data",
            "Accept": "application/json, text/plain, */*"
        })
        return s

    @classmethod
    def get_live_index_quotes(cls) -> Dict[str, Dict[str, Any]]:
        """
        Fetches real-time intraday quotes for all indices from liveindexsa.niftyindices.com.
        """
        quotes: Dict[str, Dict[str, Any]] = {}
        try:
            s = cls._create_http_session()
            url = "https://liveindexsa.niftyindices.com/jsonfiles/LiveIndicesWatch.json"
            r = s.get(url, timeout=5)
            if r.status_code == 200:
                data = r.json()
                items = data.get("data", [])
                for item in items:
                    name = (item.get("indexName") or item.get("index", "")).strip().upper()
                    quotes[name] = {
                        "last": float(item.get("last", 0) or 0),
                        "open": float(item.get("open", 0) or 0),
                        "high": float(item.get("high", 0) or 0),
                        "low": float(item.get("low", 0) or 0),
                        "previousClose": float(item.get("previousClose", 0) or 0),
                        "change": float(item.get("last", 0) or 0) - float(item.get("previousClose", 0) or 0),
                        "percentChange": float(item.get("percChange", 0) or 0),
                        "yearHigh": float(item.get("yearHigh", 0) or 0),
                        "yearLow": float(item.get("yearLow", 0) or 0),
                        "timeVal": item.get("timeVal", ""),
                    }
        except Exception as exc:
            logger.warning(f"[MarketIndicesService] Live index watch warning: {exc}")

        return quotes

    @classmethod
    def _fetch_nifty_history(cls, session: requests.Session, nifty_name: str) -> Optional[pd.DataFrame]:
        """
        Fetches 1 year of daily historical closes from official niftyindices.com API.
        """
        # Calculate date range for past ~400 days
        now = datetime.now()
        start_date = (now - timedelta(days=400)).strftime("01-%b-%Y")
        end_date = now.strftime("%d-%b-%Y")

        payload = {
            "cinfo": json.dumps({
                "name": nifty_name.upper(),
                "startDate": start_date,
                "endDate": end_date,
                "indexName": nifty_name
            })
        }

        url = "https://www.niftyindices.com/BackPage/getHistoricaldatatabletoString"
        for attempt in range(2):
            try:
                r = session.post(url, json=payload, timeout=8)
                if r.status_code == 200:
                    records = r.json()
                    if isinstance(records, list) and len(records) > 0:
                        df = pd.DataFrame(records)
                        if "CLOSE" in df.columns and "HistoricalDate" in df.columns:
                            df["CLOSE"] = pd.to_numeric(df["CLOSE"], errors="coerce")
                            df["Date"] = pd.to_datetime(df["HistoricalDate"], format="%d %b %Y", errors="coerce")
                            df = df.dropna(subset=["CLOSE", "Date"]).sort_values("Date")
                            return df
            except Exception as e:
                logger.debug(f"[MarketIndicesService] Nifty history attempt {attempt} failed for {nifty_name}: {e}")
                time.sleep(0.3)
        return None

    @classmethod
    def _fetch_yf_history(cls, yf_ticker: str) -> Optional[pd.DataFrame]:
        """
        Fetches historical data via Yahoo Finance fallback.
        """
        try:
            t = yf.Ticker(yf_ticker)
            hist = t.history(period="2y", interval="1d")
            if not hist.empty and len(hist) > 10:
                df = hist[["Close"]].copy().reset_index()
                df.rename(columns={"Close": "CLOSE"}, inplace=True)
                df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
                return df
        except Exception as e:
            logger.debug(f"[MarketIndicesService] YF history failed for {yf_ticker}: {e}")
        return None

    @classmethod
    def _compute_12_month_performance(cls, df: pd.DataFrame, live_quote: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Computes 12 rolling monthly returns, green/red status, and key performance stats.
        """
        if df.empty or len(df) < 5:
            return {
                "months": [],
                "green_count": 0,
                "red_count": 0,
                "win_rate_pct": 0.0,
                "return_1m": 0.0,
                "return_3m": 0.0,
                "return_6m": 0.0,
                "return_12m": 0.0,
                "return_ytd": 0.0,
                "best_month": None,
                "worst_month": None,
                "streak": "N/A"
            }

        # Set date index and resample to month end
        df_monthly = df.set_index("Date").sort_index()
        monthly_series = df_monthly["CLOSE"].resample("ME").last().dropna()

        # If live quote is present and newer, replace/append latest month price
        if live_quote and live_quote.get("last", 0) > 0:
            now = datetime.now()
            latest_idx = monthly_series.index[-1]
            if latest_idx.year == now.year and latest_idx.month == now.month:
                monthly_series.iloc[-1] = live_quote["last"]
            elif now > latest_idx:
                monthly_series.loc[pd.Timestamp(now)] = live_quote["last"]

        # Calculate monthly percentage return
        monthly_ret = monthly_series.pct_change() * 100.0

        # We take the last 12 available monthly return periods
        recent_returns = monthly_ret.dropna().tail(12)
        months_list: List[Dict[str, Any]] = []

        total_months = len(recent_returns)
        for i, (dt, ret) in enumerate(recent_returns.items(), start=1):
            val = round(float(ret), 2)
            is_green = val >= 0
            
            # Color intensity classification
            if val >= 5.0:
                intensity = "deep-green"
            elif val > 0:
                intensity = "soft-green"
            elif val > -5.0:
                intensity = "soft-red"
            else:
                intensity = "deep-red"

            close_p = round(float(monthly_series.loc[dt]), 2)
            month_label = dt.strftime("%b %Y")
            # If current active month, mark as MTD
            if dt.year == datetime.now().year and dt.month == datetime.now().month:
                month_label += " (MTD)"

            months_list.append({
                "month_index": i,
                "month_label": month_label,
                "month_short": dt.strftime("%b %y"),
                "year": dt.year,
                "month_num": dt.month,
                "return_pct": val,
                "is_green": is_green,
                "color_intensity": intensity,
                "close_price": close_p
            })

        green_count = sum(1 for m in months_list if m["is_green"])
        red_count = total_months - green_count
        win_rate = round((green_count / total_months * 100.0), 1) if total_months > 0 else 0.0

        # Best & worst month
        best = max(months_list, key=lambda x: x["return_pct"]) if months_list else None
        worst = min(months_list, key=lambda x: x["return_pct"]) if months_list else None

        # Cumulative Multi-period Returns
        latest_close = monthly_series.iloc[-1]
        
        # 1 Month return
        ret_1m = round(float(months_list[-1]["return_pct"]), 2) if months_list else 0.0
        
        # 3 Month return
        if len(monthly_series) >= 4:
            p3 = monthly_series.iloc[-4]
            ret_3m = round(((latest_close - p3) / p3) * 100.0, 2)
        else:
            ret_3m = ret_1m

        # 6 Month return
        if len(monthly_series) >= 7:
            p6 = monthly_series.iloc[-7]
            ret_6m = round(((latest_close - p6) / p6) * 100.0, 2)
        else:
            ret_6m = ret_3m

        # 12 Month return
        if len(monthly_series) >= 13:
            p12 = monthly_series.iloc[-13]
            ret_12m = round(((latest_close - p12) / p12) * 100.0, 2)
        elif len(monthly_series) >= 2:
            p_first = monthly_series.iloc[0]
            ret_12m = round(((latest_close - p_first) / p_first) * 100.0, 2)
        else:
            ret_12m = 0.0

        # YTD Return (from December close of previous year)
        current_year = datetime.now().year
        prev_dec = [dt for dt in monthly_series.index if dt.year == (current_year - 1) and dt.month == 12]
        if prev_dec:
            dec_close = monthly_series.loc[prev_dec[-1]]
            ret_ytd = round(((latest_close - dec_close) / dec_close) * 100.0, 2)
        else:
            ret_ytd = ret_1m

        # Compute Streak (e.g. 3M Green or 2M Red)
        streak_dir = None
        streak_len = 0
        for m in reversed(months_list):
            if streak_dir is None:
                streak_dir = "Green" if m["is_green"] else "Red"
                streak_len = 1
            elif (streak_dir == "Green" and m["is_green"]) or (streak_dir == "Red" and not m["is_green"]):
                streak_len += 1
            else:
                break
        streak_str = f"{streak_len}M {streak_dir}" if streak_dir else "Neutral"

        return {
            "months": months_list,
            "green_count": green_count,
            "red_count": red_count,
            "win_rate_pct": win_rate,
            "return_1m": ret_1m,
            "return_3m": ret_3m,
            "return_6m": ret_6m,
            "return_12m": ret_12m,
            "return_ytd": ret_ytd,
            "best_month": {"month": best["month_short"], "return_pct": best["return_pct"]} if best else None,
            "worst_month": {"month": worst["month_short"], "return_pct": worst["return_pct"]} if worst else None,
            "streak": streak_str
        }

    @classmethod
    def scan_all_indices(cls, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Primary execution method: Returns full universe of Indian indices with 12-month performance.
        Leverages in-memory cache and persistent JSON storage.
        """
        now = time.time()
        with cls._cache_lock:
            # Check in-memory cache
            if not force_refresh and cls._memory_cache is not None and (now - cls._cache_time) < CACHE_TTL_SECONDS:
                return cls._memory_cache

            # Check disk cache
            if not force_refresh and os.path.exists(CACHE_FILE):
                try:
                    with open(CACHE_FILE, "r", encoding="utf-8") as f:
                        disk_data = json.load(f)
                    cache_ts = disk_data.get("timestamp_epoch", 0)
                    if (now - cache_ts) < CACHE_TTL_SECONDS:
                        cls._memory_cache = disk_data
                        cls._cache_time = cache_ts
                        return disk_data
                except Exception as e:
                    logger.debug(f"[MarketIndicesService] Could not read disk cache: {e}")

        # Compute fresh data
        logger.info("[MarketIndicesService] Fetching fresh Indian Market Indices data...")
        t_start = time.time()

        # Step 1: Live quotes from Nifty Indices
        live_quotes = cls.get_live_index_quotes()

        # Step 2: Fetch historical data concurrently
        results: List[Dict[str, Any]] = []
        http_session = cls._create_http_session()

        def process_index(cat_item: Dict[str, Any]) -> Dict[str, Any]:
            sym = cat_item["symbol"]
            name = cat_item["name"]
            nifty_name = cat_item.get("nifty_name")
            yf_ticker = cat_item.get("yf_ticker")
            category = cat_item["category"]
            exchange = cat_item["exchange"]

            # Match live quote
            quote = None
            if nifty_name:
                quote = live_quotes.get(nifty_name.upper()) or live_quotes.get(name.upper())
            if not quote and name:
                quote = live_quotes.get(name.upper())

            # Fetch history
            df: Optional[pd.DataFrame] = None
            if nifty_name:
                df = cls._fetch_nifty_history(http_session, nifty_name)

            if (df is None or df.empty) and yf_ticker:
                df = cls._fetch_yf_history(yf_ticker)

            # Performance calculation
            perf = cls._compute_12_month_performance(df if df is not None else pd.DataFrame(), quote)

            # Pricing attributes
            cmp_val = quote["last"] if quote and quote["last"] > 0 else (
                float(df["CLOSE"].iloc[-1]) if df is not None and not df.empty else 0.0
            )
            change_1d = quote["change"] if quote else 0.0
            change_pct_1d = quote["percentChange"] if quote else 0.0
            year_high = quote["yearHigh"] if quote and quote["yearHigh"] > 0 else (
                float(df["CLOSE"].max()) if df is not None and not df.empty else cmp_val
            )
            year_low = quote["yearLow"] if quote and quote["yearLow"] > 0 else (
                float(df["CLOSE"].min()) if df is not None and not df.empty else cmp_val
            )

            pct_off_high = round(((cmp_val - year_high) / year_high) * 100.0, 2) if year_high > 0 else 0.0

            return {
                "symbol": sym,
                "name": name,
                "nifty_name": nifty_name,
                "category": category,
                "exchange": exchange,
                "description": cat_item["description"],
                "cmp": round(cmp_val, 2),
                "change_1d": round(change_1d, 2),
                "change_pct_1d": round(change_pct_1d, 2),
                "year_high": round(year_high, 2),
                "year_low": round(year_low, 2),
                "pct_off_high": pct_off_high,
                **perf
            }

        # Multi-threaded execution across catalog
        with ThreadPoolExecutor(max_workers=8) as executor:
            future_to_index = {executor.submit(process_index, item): item for item in INDEX_CATALOG}
            for future in as_completed(future_to_index):
                try:
                    res = future.result()
                    results.append(res)
                except Exception as exc:
                    item = future_to_index[future]
                    logger.error(f"[MarketIndicesService] Error processing {item.get('name')}: {exc}")

        # Sort indices: broad benchmarks first, then sectoral, then thematic
        category_order = {"BROAD": 1, "SECTORAL": 2, "THEMATIC": 3}
        results.sort(key=lambda x: (category_order.get(x["category"], 99), -x["cmp"]))

        # Universe KPIs
        total_indices = len(results)
        green_1d_count = sum(1 for r in results if r["change_pct_1d"] >= 0)
        red_1d_count = total_indices - green_1d_count
        avg_12m_return = round(float(sum(r["return_12m"] for r in results) / max(total_indices, 1)), 2)
        top_12m_winner = max(results, key=lambda x: x["return_12m"]) if results else None
        top_1m_winner = max(results, key=lambda x: x["return_1m"]) if results else None
        most_consistent = max(results, key=lambda x: x["win_rate_pct"]) if results else None

        # Build column headers for monthly grid
        month_headers: List[str] = []
        if results and results[0]["months"]:
            month_headers = [m["month_short"] for m in results[0]["months"]]

        output = {
            "status": "success",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
            "timestamp_epoch": time.time(),
            "duration_seconds": round(time.time() - t_start, 2),
            "summary": {
                "total_indices": total_indices,
                "broad_count": sum(1 for r in results if r["category"] == "BROAD"),
                "sectoral_count": sum(1 for r in results if r["category"] == "SECTORAL"),
                "thematic_count": sum(1 for r in results if r["category"] == "THEMATIC"),
                "green_1d_count": green_1d_count,
                "red_1d_count": red_1d_count,
                "avg_12m_return": avg_12m_return,
                "top_12m_leader": {
                    "name": top_12m_winner["name"] if top_12m_winner else "-",
                    "return_12m": float(top_12m_winner["return_12m"]) if top_12m_winner else 0.0
                },
                "top_1m_leader": {
                    "name": top_1m_winner["name"] if top_1m_winner else "-",
                    "return_1m": float(top_1m_winner["return_1m"]) if top_1m_winner else 0.0
                },
                "most_consistent": {
                    "name": most_consistent["name"] if most_consistent else "-",
                    "win_rate_pct": float(most_consistent["win_rate_pct"]) if most_consistent else 0.0,
                    "green_months": int(most_consistent["green_count"]) if most_consistent else 0
                }
            },
            "month_headers": month_headers,
            "indices": results
        }


        # Save to memory and disk cache
        with cls._cache_lock:
            cls._memory_cache = output
            cls._cache_time = time.time()
            try:
                os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
                with open(CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(output, f, indent=2)
            except Exception as e:
                logger.warning(f"[MarketIndicesService] Failed to persist disk cache: {e}")

        logger.info(f"[MarketIndicesService] Completed index scan for {total_indices} indices in {output['duration_seconds']}s")
        return output

    @classmethod
    def get_index_chart_series(cls, symbol: str, period: str = "1Y") -> Dict[str, Any]:
        """
        Returns OHLC candlestick series, moving averages (50 DMA, 200 DMA), and info for an index.
        """
        sym_clean = symbol.strip().upper()
        # Find index in catalog
        item = next((x for x in INDEX_CATALOG if x["symbol"].upper() == sym_clean or x["name"].upper() == sym_clean), None)
        if not item:
            item = next((x for x in INDEX_CATALOG if sym_clean in x["symbol"].upper() or sym_clean in x["name"].upper()), None)

        if not item:
            return {"error": f"Index '{symbol}' not found in catalog"}

        nifty_name = item.get("nifty_name")
        yf_ticker = item.get("yf_ticker")

        session = cls._create_http_session()
        df: Optional[pd.DataFrame] = None
        if nifty_name:
            df = cls._fetch_nifty_history(session, nifty_name)
        if (df is None or df.empty) and yf_ticker:
            df = cls._fetch_yf_history(yf_ticker)

        if df is None or df.empty:
            return {"error": f"No chart data available for '{item['name']}'"}

        # Ensure OHLC columns
        for col in ["OPEN", "HIGH", "LOW", "CLOSE"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            elif col.lower() in df.columns:
                df[col] = pd.to_numeric(df[col.lower()], errors="coerce")
            else:
                df[col] = df["CLOSE"] if "CLOSE" in df.columns else 0.0

        df = df.dropna(subset=["Date", "CLOSE"]).sort_values("Date")

        # Moving averages
        df["DMA_50"] = df["CLOSE"].rolling(window=50, min_periods=5).mean()
        df["DMA_200"] = df["CLOSE"].rolling(window=200, min_periods=10).mean()

        # Filter by timeframe
        now = datetime.now()
        period_upper = period.upper()
        if period_upper == "1M":
            cutoff = now - timedelta(days=35)
        elif period_upper == "3M":
            cutoff = now - timedelta(days=95)
        elif period_upper == "6M":
            cutoff = now - timedelta(days=185)
        elif period_upper == "1Y":
            cutoff = now - timedelta(days=370)
        else:
            cutoff = now - timedelta(days=370)

        df_filtered = df[df["Date"] >= cutoff]
        if df_filtered.empty or len(df_filtered) < 5:
            df_filtered = df.tail(60)

        candles: List[Dict[str, Any]] = []
        line_data: List[Dict[str, Any]] = []
        dma50_data: List[Dict[str, Any]] = []
        dma200_data: List[Dict[str, Any]] = []

        for _, row in df_filtered.iterrows():
            t_str = row["Date"].strftime("%Y-%m-%d")
            c = round(float(row["CLOSE"]), 2)
            o = round(float(row["OPEN"]), 2) if "OPEN" in row and not pd.isna(row["OPEN"]) else c
            h = round(float(row["HIGH"]), 2) if "HIGH" in row and not pd.isna(row["HIGH"]) else max(o, c)
            l = round(float(row["LOW"]), 2) if "LOW" in row and not pd.isna(row["LOW"]) else min(o, c)

            candles.append({
                "time": t_str,
                "open": o,
                "high": h,
                "low": l,
                "close": c
            })
            line_data.append({
                "time": t_str,
                "value": c
            })
            if not pd.isna(row.get("DMA_50")):
                dma50_data.append({
                    "time": t_str,
                    "value": round(float(row["DMA_50"]), 2)
                })
            if not pd.isna(row.get("DMA_200")):
                dma200_data.append({
                    "time": t_str,
                    "value": round(float(row["DMA_200"]), 2)
                })

        latest_c = candles[-1]["close"] if candles else 0.0
        first_c = candles[0]["open"] if candles else latest_c
        period_change_pct = round(((latest_c - first_c) / max(first_c, 1e-6)) * 100.0, 2)

        return {
            "symbol": item["symbol"],
            "name": item["name"],
            "category": item["category"],
            "exchange": item["exchange"],
            "description": item["description"],
            "period": period_upper,
            "period_change_pct": period_change_pct,
            "latest_close": latest_c,
            "candles": candles,
            "line_data": line_data,
            "dma_50": dma50_data,
            "dma_200": dma200_data,
            "total_bars": len(candles)
        }

