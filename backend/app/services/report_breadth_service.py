"""
Alpha India - Institutional Market Breadth & Research Reports Service
Computes multi-session market breadth indicators from official NSE Bhavcopies:
- 20 DMA (Short-Term Tactical Momentum Breadth)
- 50 DMA (Intermediate-Term Structural Breadth)
- 200 DMA (Long-Term Stage-2 / Macro Bull-Bear Breadth)
- 50% Bullish Green Zone (Expansion) vs Bearish Red Zone (Contraction) regimes
- Dual universe support: All Listed NSE Equities (~2,800+) and Nifty 500 (~500)
- Sectoral breadth matrix for each DMA window based on official NSE classifications
- Persistent JSON caching for sub-10ms query latency
"""

from __future__ import annotations

import datetime
import glob
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

logger = logging.getLogger("alpha_india.report_breadth")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
BHAVCOPY_DIR = DATA_DIR / "nse_delivery"
CACHE_FILE = DATA_DIR / "reports_breadth_cache.json"
NIFTY500_FILE = DATA_DIR / "ind_nifty500list.csv"


class ReportBreadthService:
    """
    Lead institutional service for Market Breadth & Research Reports (20, 50, 200 DMA).
    """
    _memory_cache: Optional[Dict[str, Any]] = None

    @classmethod
    def _load_nifty500_meta(cls) -> Tuple[set, Dict[str, str]]:
        """Returns set of symbols and dict of symbol -> sector/industry."""
        symbols = set()
        sym_to_sector = {}
        if NIFTY500_FILE.exists():
            try:
                df = pd.read_csv(NIFTY500_FILE)
                for _, row in df.iterrows():
                    sym = str(row.get("Symbol", "")).strip().upper()
                    ind = str(row.get("Industry", "General")).strip()
                    if sym:
                        symbols.add(sym)
                        sym_to_sector[sym] = ind
            except Exception as e:
                logger.warning(f"[ReportBreadthService] Error reading Nifty 500 list: {e}")
        return symbols, sym_to_sector

    @classmethod
    def build_breadth_cache(cls, max_sessions: int = 530) -> Dict[str, Any]:
        """
        Calculates 20, 50, and 200 DMA breadth time series across all trading sessions
        and persists the result into `CACHE_FILE`.
        """
        logger.info(f"[ReportBreadthService] Building breadth calculation for up to {max_sessions} sessions...")

        files = glob.glob(str(BHAVCOPY_DIR / "sec_bhavdata_full_*.csv"))
        if not files:
            logger.error(f"[ReportBreadthService] No bhavcopy files found in {BHAVCOPY_DIR}")
            return {"error": "No bhavcopy files found"}

        def parse_file_date(f: str) -> datetime.date:
            try:
                raw = os.path.basename(f).replace("sec_bhavdata_full_", "").replace(".csv", "")
                return datetime.datetime.strptime(raw, "%d%m%Y").date()
            except Exception:
                return datetime.date.min

        files_sorted = sorted(files, key=parse_file_date)
        selected_files = files_sorted[-max_sessions:]

        nifty500_symbols, sym_to_sector = cls._load_nifty500_meta()

        dfs = []
        for fpath in selected_files:
            file_date = parse_file_date(fpath)
            if file_date == datetime.date.min:
                continue
            date_str = file_date.strftime("%Y-%m-%d")

            try:
                df = pd.read_csv(
                    fpath,
                    usecols=lambda c: c.strip().upper() in ["SYMBOL", "SERIES", "CLOSE_PRICE"]
                )
                df.columns = [c.strip().upper() for c in df.columns]
                if "SERIES" in df.columns:
                    df = df[df["SERIES"].astype(str).str.strip().isin(["EQ", "BE"])]
                if "CLOSE_PRICE" in df.columns:
                    df = df[df["CLOSE_PRICE"] > 0]
                df["symbol"] = df["SYMBOL"].astype(str).str.strip().str.upper()
                df["date"] = date_str
                df["close"] = df["CLOSE_PRICE"].astype(float)
                dfs.append(df[["symbol", "date", "close"]])
            except Exception as e:
                logger.debug(f"[ReportBreadthService] Skipping file {fpath}: {e}")

        if not dfs:
            return {"error": "Failed to parse bhavcopies"}

        big_df = pd.concat(dfs, ignore_index=True)
        piv = big_df.pivot(index="date", columns="symbol", values="close")
        piv.sort_index(inplace=True)

        nifty500_cols = [c for c in piv.columns if c in nifty500_symbols]
        dates = list(piv.index)
        latest_date = dates[-1] if dates else ""

        # Calculate rolling moving averages for 20, 50, and 200 sessions
        windows = [20, 50, 200]
        breadth_by_window: Dict[str, Any] = {}

        for w in windows:
            ma = piv.rolling(window=w, min_periods=w).mean()
            above_mask = (piv > ma)

            # 1. Broad Market Breadth
            valid_all = ma.notna().sum(axis=1)
            above_all = (above_mask & ma.notna()).sum(axis=1)
            pct_all = (above_all / valid_all * 100.0).round(2)

            # 2. Nifty 500 Breadth
            valid_n500 = ma[nifty500_cols].notna().sum(axis=1) if nifty500_cols else pd.Series(0, index=piv.index)
            above_n500 = (above_mask[nifty500_cols] & ma[nifty500_cols].notna()).sum(axis=1) if nifty500_cols else pd.Series(0, index=piv.index)
            pct_n500 = (above_n500 / valid_n500 * 100.0).round(2)

            all_series = []
            n500_series = []

            for d in dates:
                tot_a = int(valid_all[d])
                if tot_a < 100:  # Skip warmup
                    continue
                ab_a = int(above_all[d])
                pct_a = float(pct_all[d])
                all_series.append({
                    "date": d,
                    "total_stocks": tot_a,
                    "above_dma": ab_a,
                    "below_dma": tot_a - ab_a,
                    "pct_above_dma": pct_a,
                    "zone": "GREEN" if pct_a >= 50.0 else "RED",
                })

                tot_5 = int(valid_n500[d])
                ab_5 = int(above_n500[d])
                pct_5 = float(pct_n500[d]) if tot_5 > 0 else 0.0
                n500_series.append({
                    "date": d,
                    "total_stocks": tot_5,
                    "above_dma": ab_5,
                    "below_dma": tot_5 - ab_5,
                    "pct_above_dma": pct_5,
                    "zone": "GREEN" if pct_5 >= 50.0 else "RED",
                })

            # Calculate 1-day net changes
            for s in [all_series, n500_series]:
                for i in range(len(s)):
                    if i == 0:
                        s[i]["change_1d"] = 0.0
                    else:
                        s[i]["change_1d"] = round(s[i]["pct_above_dma"] - s[i - 1]["pct_above_dma"], 2)

            # 3. Sectoral Breadth on Latest Session for this DMA window
            sector_breadth = []
            if nifty500_cols and latest_date in piv.index:
                latest_close = piv.loc[latest_date]
                latest_ma = ma.loc[latest_date]
                sector_groups: Dict[str, List[bool]] = {}

                for sym in nifty500_cols:
                    sec = sym_to_sector.get(sym, "General")
                    c_val = latest_close.get(sym)
                    m_val = latest_ma.get(sym)
                    if pd.notna(c_val) and pd.notna(m_val) and m_val > 0:
                        sector_groups.setdefault(sec, []).append(bool(c_val > m_val))

                for sec, bools in sector_groups.items():
                    if len(bools) >= 4:
                        tot = len(bools)
                        ab = sum(bools)
                        pct = round((ab / tot) * 100.0, 1)
                        sector_breadth.append({
                            "sector": sec,
                            "total_stocks": tot,
                            "above_dma": ab,
                            "below_dma": tot - ab,
                            "pct_above_dma": pct,
                            "zone": "GREEN" if pct >= 50.0 else "RED",
                        })

                sector_breadth.sort(key=lambda x: x["pct_above_dma"], reverse=True)

            breadth_by_window[str(w)] = {
                "dma_period": w,
                "all_equities": all_series,
                "nifty_500": n500_series,
                "sector_breadth": sector_breadth,
            }

        # Multi-DMA Alignment Series (dates where 200 DMA is valid)
        series20_map = {item["date"]: item for item in breadth_by_window["20"]["all_equities"]}
        series50_map = {item["date"]: item for item in breadth_by_window["50"]["all_equities"]}
        series200_map = {item["date"]: item for item in breadth_by_window["200"]["all_equities"]}

        common_dates = sorted(list(series200_map.keys()))
        multi_dma_series = []
        for d in common_dates:
            p20 = series20_map.get(d, {}).get("pct_above_dma")
            p50 = series50_map.get(d, {}).get("pct_above_dma")
            p200 = series200_map.get(d, {}).get("pct_above_dma")
            if p20 is not None and p50 is not None and p200 is not None:
                multi_dma_series.append({
                    "date": d,
                    "pct_above_20dma": p20,
                    "pct_above_50dma": p50,
                    "pct_above_200dma": p200,
                    "all_above_50": bool(p20 >= 50.0 and p50 >= 50.0 and p200 >= 50.0),
                    "all_below_50": bool(p20 < 50.0 and p50 < 50.0 and p200 < 50.0),
                })

        payload = {
            "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "latest_session": latest_date,
            "bhavcopy_files_count": len(files),
            "breadth": breadth_by_window,
            "multi_dma_series": multi_dma_series,
            # Backwards compatibility keys for 20 DMA
            "all_equities": [
                {
                    **item,
                    "above_20dma": item["above_dma"],
                    "below_20dma": item["below_dma"],
                    "pct_above_20dma": item["pct_above_dma"],
                }
                for item in breadth_by_window["20"]["all_equities"]
            ],
            "nifty_500": [
                {
                    **item,
                    "above_20dma": item["above_dma"],
                    "below_20dma": item["below_dma"],
                    "pct_above_20dma": item["pct_above_dma"],
                }
                for item in breadth_by_window["20"]["nifty_500"]
            ],
            "sector_breadth": [
                {
                    **item,
                    "above_20dma": item["above_dma"],
                    "below_20dma": item["below_dma"],
                    "pct_above_20dma": item["pct_above_dma"],
                }
                for item in breadth_by_window["20"]["sector_breadth"]
            ],
        }

        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f)
            logger.info(f"[ReportBreadthService] Successfully saved multi-DMA cache to {CACHE_FILE}")
        except Exception as e:
            logger.error(f"[ReportBreadthService] Error writing cache file: {e}")

        cls._memory_cache = payload
        return payload

    @classmethod
    def get_breadth_data(
        cls,
        dma_period: int = 20,  # 20, 50, 200
        universe: str = "all",  # "all" or "nifty500"
        timeframe: str = "1Y",  # "1M", "3M", "6M", "1Y", "ALL"
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Retrieves market breadth time series and KPIs for the requested DMA period (20, 50, 200).
        """
        if dma_period not in (20, 50, 200):
            dma_period = 20

        cache = cls._memory_cache

        if not cache and not force_refresh and CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    cache = json.load(f)
                # Ensure cache has multi-DMA structure
                if "breadth" not in cache:
                    cache = None
                else:
                    cls._memory_cache = cache
            except Exception as e:
                logger.warning(f"[ReportBreadthService] Cache read error: {e}")

        if not cache or force_refresh:
            cache = cls.build_breadth_cache()

        breadth_bucket = cache.get("breadth", {}).get(str(dma_period), {})
        raw_series = breadth_bucket.get("nifty_500" if universe.lower() == "nifty500" else "all_equities", [])

        # Filter by timeframe
        days_map = {
            "1M": 22,
            "3M": 65,
            "6M": 130,
            "1Y": 252,
            "ALL": 999999,
        }
        limit = days_map.get(timeframe.upper(), 252)
        filtered_series = raw_series[-limit:] if len(raw_series) > limit else raw_series

        # Format series with both generic `pct_above_dma` and backward-compatible `pct_above_20dma`
        formatted_series = []
        for item in filtered_series:
            formatted_series.append({
                "date": item["date"],
                "total_stocks": item["total_stocks"],
                "above_dma": item.get("above_dma", item.get("above_20dma", 0)),
                "below_dma": item.get("below_dma", item.get("below_20dma", 0)),
                "pct_above_dma": item.get("pct_above_dma", item.get("pct_above_20dma", 0.0)),
                "above_20dma": item.get("above_dma", item.get("above_20dma", 0)),
                "below_20dma": item.get("below_dma", item.get("below_20dma", 0)),
                "pct_above_20dma": item.get("pct_above_dma", item.get("pct_above_20dma", 0.0)),
                "zone": item["zone"],
                "change_1d": item.get("change_1d", 0.0),
            })

        # Format sector breadth
        raw_sectors = breadth_bucket.get("sector_breadth", [])
        formatted_sectors = []
        for s in raw_sectors:
            formatted_sectors.append({
                "sector": s["sector"],
                "total_stocks": s["total_stocks"],
                "above_dma": s.get("above_dma", s.get("above_20dma", 0)),
                "below_dma": s.get("below_dma", s.get("below_20dma", 0)),
                "pct_above_dma": s.get("pct_above_dma", s.get("pct_above_20dma", 0.0)),
                "above_20dma": s.get("above_dma", s.get("above_20dma", 0)),
                "below_20dma": s.get("below_dma", s.get("below_20dma", 0)),
                "pct_above_20dma": s.get("pct_above_dma", s.get("pct_above_20dma", 0.0)),
                "zone": s["zone"],
            })

        # Compute Institutional KPIs
        if formatted_series:
            latest = formatted_series[-1]
            current_pct = latest["pct_above_dma"]
            current_above = latest["above_dma"]
            total_stocks = latest["total_stocks"]
            current_zone = "GREEN" if current_pct >= 50.0 else "RED"

            change_1d = 0.0
            if len(formatted_series) >= 2:
                change_1d = round(current_pct - formatted_series[-2]["pct_above_dma"], 2)

            change_5d = 0.0
            if len(formatted_series) >= 6:
                change_5d = round(current_pct - formatted_series[-6]["pct_above_dma"], 2)

            change_20d = 0.0
            if len(formatted_series) >= 21:
                change_20d = round(current_pct - formatted_series[-21]["pct_above_dma"], 2)

            pct_list = [p["pct_above_dma"] for p in formatted_series]
            highest_pct = max(pct_list) if pct_list else 0.0
            lowest_pct = min(pct_list) if pct_list else 0.0
            avg_pct = round(sum(pct_list) / len(pct_list), 2) if pct_list else 0.0

            green_days = sum(1 for p in formatted_series if p["pct_above_dma"] >= 50.0)
            red_days = len(formatted_series) - green_days
            green_days_pct = round((green_days / max(1, len(formatted_series))) * 100.0, 1)

            dma_label_map = {
                20: "Short-Term Tactical Momentum",
                50: "Intermediate-Term Trend Health",
                200: "Long-Term Stage-2 Structural Bull/Bear",
            }
            dma_desc = dma_label_map.get(dma_period, "Moving Average")

            regime_label = (
                f"BULLISH EXPANSION REGIME ({dma_period} DMA)"
                if current_pct >= 50.0
                else f"BEARISH CONTRACTION REGIME ({dma_period} DMA)"
            )
            regime_description = (
                f"{dma_desc} is healthy with {current_pct}% of equities holding above their {dma_period} DMA. Breadth favors aggressive trend following and breakout continuation."
                if current_pct >= 50.0
                else f"{dma_desc} is compressed with only {current_pct}% of equities holding above their {dma_period} DMA. Indicates broader market weakness and prompts disciplined risk mitigation."
            )
        else:
            current_pct = 0.0
            current_above = 0
            total_stocks = 0
            current_zone = "RED"
            change_1d = 0.0
            change_5d = 0.0
            change_20d = 0.0
            highest_pct = 0.0
            lowest_pct = 0.0
            avg_pct = 0.0
            green_days = 0
            red_days = 0
            green_days_pct = 0.0
            regime_label = "INSUFFICIENT DATA"
            regime_description = "Awaiting session data."

        return {
            "dma_period": dma_period,
            "dma_title": f"{dma_period} DMA Market Breadth",
            "universe": universe,
            "universe_name": "Nifty 500 Universe" if universe.lower() == "nifty500" else "All Listed NSE Equities",
            "timeframe": timeframe,
            "threshold_line": 50.0,
            "current_metrics": {
                "latest_date": cache.get("latest_session", ""),
                "dma_period": dma_period,
                "current_pct_above_dma": current_pct,
                "current_count_above_dma": current_above,
                # Backwards compatible keys
                "current_pct_above_20dma": current_pct,
                "current_count_above_20dma": current_above,
                "total_universe_count": total_stocks,
                "current_zone": current_zone,
                "regime_label": regime_label,
                "regime_description": regime_description,
                "change_1d": change_1d,
                "change_5d": change_5d,
                "change_20d": change_20d,
                "highest_pct": highest_pct,
                "lowest_pct": lowest_pct,
                "avg_pct": avg_pct,
                "green_days_count": green_days,
                "red_days_count": red_days,
                "green_days_pct": green_days_pct,
            },
            "data_points_count": len(formatted_series),
            "series": formatted_series,
            "sector_breadth": formatted_sectors,
            "multi_dma_latest": {
                "20_dma_pct": cache.get("breadth", {}).get("20", {}).get("all_equities", [{}])[-1].get("pct_above_dma", 0.0) if cache.get("breadth", {}).get("20", {}).get("all_equities") else 0.0,
                "50_dma_pct": cache.get("breadth", {}).get("50", {}).get("all_equities", [{}])[-1].get("pct_above_dma", 0.0) if cache.get("breadth", {}).get("50", {}).get("all_equities") else 0.0,
                "200_dma_pct": cache.get("breadth", {}).get("200", {}).get("all_equities", [{}])[-1].get("pct_above_dma", 0.0) if cache.get("breadth", {}).get("200", {}).get("all_equities") else 0.0,
            },
            "last_updated": cache.get("last_updated", ""),
        }

    @classmethod
    def get_multi_dma_series(
        cls,
        timeframe: str = "1Y",
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """Returns comparison time series for 20, 50, and 200 DMA breadth together."""
        cache = cls._memory_cache
        if not cache and not force_refresh and CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    cache = json.load(f)
                if "multi_dma_series" in cache:
                    cls._memory_cache = cache
                else:
                    cache = None
            except Exception:
                cache = None

        if not cache or force_refresh:
            cache = cls.build_breadth_cache()

        raw_series = cache.get("multi_dma_series", [])
        days_map = {
            "1M": 22,
            "3M": 65,
            "6M": 130,
            "1Y": 252,
            "ALL": 999999,
        }
        limit = days_map.get(timeframe.upper(), 252)
        filtered = raw_series[-limit:] if len(raw_series) > limit else raw_series

        return {
            "timeframe": timeframe,
            "threshold_line": 50.0,
            "series": filtered,
            "latest": filtered[-1] if filtered else {},
            "last_updated": cache.get("last_updated", ""),
        }

    @classmethod
    def get_report_catalog(cls) -> List[Dict[str, Any]]:
        """
        Returns catalog of available and upcoming research & market breadth reports.
        """
        return [
            {
                "id": "breadth-20dma",
                "title": "20 DMA Market Breadth Radar",
                "category": "Tactical Momentum",
                "status": "LIVE",
                "description": "Daily % and count of companies trading above their 20-day moving average. Fast tactical pulse detecting short-term breadth expansions & oversold bounces.",
                "badge": "20 DMA",
                "frequency": "Daily Post-Close (EOD)",
                "key_metrics": ["% Above 20 DMA", "Count Above 20 DMA", "50% Green/Red Regime", "Sector Breakdown"],
            },
            {
                "id": "breadth-50dma",
                "title": "50 DMA Intermediate Market Breadth",
                "category": "Trend Health",
                "status": "LIVE",
                "description": "Daily % and count of companies trading above their 50-day moving average. Core institutional benchmark for swing trading environments and pullback health.",
                "badge": "50 DMA",
                "frequency": "Daily Post-Close (EOD)",
                "key_metrics": ["% Above 50 DMA", "Count Above 50 DMA", "50% Green/Red Regime", "Intermediate Strength"],
            },
            {
                "id": "breadth-200dma",
                "title": "200 DMA Stage-2 Structural Health",
                "category": "Macro Structure",
                "status": "LIVE",
                "description": "Daily % and count of companies trading above their 200-day moving average. Stan Weinstein Stage-2 macro bull/bear line separating secular uptrends from bear markets.",
                "badge": "200 DMA",
                "frequency": "Daily Post-Close (EOD)",
                "key_metrics": ["% Above 200 DMA", "Count Above 200 DMA", "50% Green/Red Regime", "Stage-2 Bull Breadth"],
            },
            {
                "id": "breadth-multi-dma",
                "title": "Multi-DMA Breadth Alignment Comparison",
                "category": "Triple Alignment",
                "status": "LIVE",
                "description": "Triple overlay of 20 DMA, 50 DMA, and 200 DMA breadth. Identifies powerful breadth thrusts when short-term crosses above long-term breadth.",
                "badge": "TRIPLE DMA",
                "frequency": "Daily Post-Close (EOD)",
                "key_metrics": ["20 vs 50 vs 200 DMA", "All Above 50% Confluence", "Breadth Thrusts"],
            },
            {
                "id": "breadth-sector-matrix",
                "title": "Sectoral Moving Average Breadth Matrix",
                "category": "Sector Analysis",
                "status": "LIVE",
                "description": "Comparative breakdown of all key NSE sectors across 20, 50, and 200 DMA breadth to pinpoint leadership rotation.",
                "badge": "SECTORS",
                "frequency": "Daily Post-Close (EOD)",
                "key_metrics": ["Sector Rank", "% Above DMA", "Advancing / Declining Ratio"],
            },
            {
                "id": "advance-decline-volume",
                "title": "Cumulative Advance/Decline Volume Oscillator",
                "category": "Volume Dynamics",
                "status": "PIPELINE",
                "description": "Institutional McClellan-style volume summation index measuring authentic cash market buying vs selling pressure.",
                "badge": "ROADMAP",
                "frequency": "Daily Intraday & EOD",
                "key_metrics": ["Net Delivery Volume", "Up/Down Volume Ratio", "Breadth Thrusts"],
            },
            {
                "id": "new-highs-new-lows",
                "title": "52-Week Highs vs 52-Week Lows Index",
                "category": "Extremes Radar",
                "status": "PIPELINE",
                "description": "Net new 52-week highs minus new lows expansion oscillator. Surfaces market inflection points and distribution warning signals.",
                "badge": "ROADMAP",
                "frequency": "Daily Post-Close (EOD)",
                "key_metrics": ["New 52W Highs", "New 52W Lows", "Net Expansion Ratio"],
            },
        ]
