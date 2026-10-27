"""
Alpha India - 30-Day Delivery & Drawdown Tree Service
Extracts hierarchical Month -> Week -> Day delivery accumulation,
peak-to-trough drawdown, and institutional blast profiles.
"""

from __future__ import annotations

import glob
import logging
import os
from pathlib import Path
import threading
import time
import datetime
from typing import Any, Dict, List, Optional
import pandas as pd
import numpy as np

from app.core.redis_cache import cache

logger = logging.getLogger(__name__)

BHAVCOPY_DIR = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
if not BHAVCOPY_DIR.exists():
    BHAVCOPY_DIR = Path(__file__).resolve().parent.parent.parent / "backend" / "data" / "nse_delivery"
if not BHAVCOPY_DIR.exists():
    BHAVCOPY_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "nse_delivery"


class DeliveryTreeService:
    _lock = threading.Lock()
    _cached_universe_df: Optional[pd.DataFrame] = None
    _cached_symbol_map: Dict[str, pd.DataFrame] = {}
    _cached_timestamp: float = 0
    _cached_files_hash: str = ""

    @staticmethod
    def _parse_file_date(filepath: str) -> datetime.datetime:
        try:
            raw = os.path.basename(filepath).replace("sec_bhavdata_full_", "").replace(".csv", "")
            return datetime.datetime.strptime(raw, "%d%m%Y")
        except Exception:
            return datetime.datetime.min

    @classmethod
    def clear_cache(cls) -> None:
        with cls._lock:
            cls._cached_universe_df = None
            cls._cached_symbol_map = {}
            cls._cached_timestamp = 0
            cls._cached_files_hash = ""
            parquet_cache = BHAVCOPY_DIR.parent / "recent_universe.parquet"
            if parquet_cache.exists():
                try:
                    parquet_cache.unlink()
                except Exception:
                    pass

    @classmethod
    def _load_recent_universe(cls, lookback_sessions: int = 40) -> Optional[pd.DataFrame]:
        """Loads and caches the last N sessions in memory for ultra-fast tree slicing (< 5ms)."""
        now = time.time()

        files = sorted(glob.glob(str(BHAVCOPY_DIR / "sec_bhavdata_full_*.csv")), key=cls._parse_file_date)
        if not files:
            files = sorted(glob.glob("data/nse_delivery/sec_bhavdata_full_*.csv"), key=cls._parse_file_date)
            if not files:
                files = sorted(glob.glob("backend/data/nse_delivery/sec_bhavdata_full_*.csv"), key=cls._parse_file_date)

        if not files:
            logger.warning("[DeliveryTreeService] No bhavcopy files found.")
            return None

        latest_file = files[-1]
        latest_file_mtime = os.path.getmtime(latest_file)
        latest_file_date = cls._parse_file_date(latest_file)

        # Check in-memory cache: must be newer than the latest downloaded bhavcopy file
        if cls._cached_universe_df is not None and cls._cached_timestamp >= latest_file_mtime and (now - cls._cached_timestamp) < 43200:
            return cls._cached_universe_df

        parquet_cache = BHAVCOPY_DIR.parent / "recent_universe.parquet"

        # 1. Fast Parquet binary cache: must be newer than the latest downloaded bhavcopy file and contain latest file date
        if parquet_cache.exists() and (now - parquet_cache.stat().st_mtime) < 43200:
            try:
                universe = pd.read_parquet(parquet_cache)
                parquet_max_date = pd.to_datetime(universe["DATE"]).max()
                if parquet_max_date >= latest_file_date:
                    with cls._lock:
                        cls._cached_universe_df = universe
                        cls._cached_symbol_map = {sym: df.reset_index(drop=True) for sym, df in universe.groupby("SYMBOL")}
                        cls._cached_timestamp = now
                    return universe
            except Exception as e:
                logger.warning(f"[DeliveryTreeService] Parquet read error: {e}")

        recent_files = files[-lookback_sessions:]
        cols_needed = {
            "SYMBOL", "SERIES", "DATE1", "OPEN_PRICE", "HIGH_PRICE", "LOW_PRICE",
            "CLOSE_PRICE", "PREV_CLOSE", "TTL_TRD_QNTY", "TURNOVER_LACS", "NO_OF_TRADES",
            "DELIV_QTY", "DELIV_PER"
        }

        records = []
        for f in recent_files:
            try:
                df = pd.read_csv(f, usecols=lambda c: c.strip() in cols_needed)
                df.columns = [c.strip() for c in df.columns]
                if "SERIES" in df.columns:
                    df = df[df["SERIES"].str.strip() == "EQ"]
                df["SYMBOL"] = df["SYMBOL"].str.strip()
                df["DATE"] = pd.to_datetime(df["DATE1"].str.strip(), format="%d-%b-%Y")
                df["OPEN"] = pd.to_numeric(df["OPEN_PRICE"], errors="coerce")
                df["HIGH"] = pd.to_numeric(df["HIGH_PRICE"], errors="coerce")
                df["LOW"] = pd.to_numeric(df["LOW_PRICE"], errors="coerce")
                df["CLOSE"] = pd.to_numeric(df["CLOSE_PRICE"], errors="coerce")
                df["PREV_CLOSE"] = pd.to_numeric(df["PREV_CLOSE"], errors="coerce")
                df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
                df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
                df["NO_OF_TRADES"] = pd.to_numeric(df.get("NO_OF_TRADES", 1), errors="coerce").fillna(1)
                df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
                df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)

                records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "VOLUME", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
            except Exception as e:
                logger.error(f"[DeliveryTreeService] Error reading {f}: {e}")
                continue

        if not records:
            return None

        universe = pd.concat(records, ignore_index=True)
        universe = universe.drop_duplicates(subset=["SYMBOL", "DATE"], keep="first").sort_values(["SYMBOL", "DATE"]).reset_index(drop=True)

        try:
            universe.to_parquet(parquet_cache)
        except Exception:
            pass

        with cls._lock:
            cls._cached_universe_df = universe
            cls._cached_symbol_map = {sym: df.reset_index(drop=True) for sym, df in universe.groupby("SYMBOL")}
            cls._cached_timestamp = now

        return universe

    @classmethod
    def get_symbol_tree_breakdown(cls, symbol: str, lookback_sessions: int = 30) -> Dict[str, Any]:
        """
        Builds a full Month -> Week -> Day tree breakdown with drawdown analysis
        and institutional delivery accumulation metrics for a single stock.
        """
        clean_sym = symbol.replace(".NS", "").replace(".BO", "").strip().upper()
        cache_key = f"delivery:tree:{clean_sym}:{lookback_sessions}"

        # 1. Check Redis / Memory cache
        cached = cache.get_json_sync(cache_key)
        if cached:
            return cached

        universe = cls._load_recent_universe(lookback_sessions=max(40, lookback_sessions + 10))
        if universe is None or universe.empty:
            return {"error": "Bhavcopy delivery data is unavailable."}

        # O(1) indexed symbol map lookup
        sym_df = cls._cached_symbol_map.get(clean_sym)
        if sym_df is None or sym_df.empty:
            sym_df = universe[universe["SYMBOL"] == clean_sym]
        if sym_df is None or sym_df.empty:
            return {"error": f"Symbol {clean_sym} not found in recent delivery records."}
        sym_df = sym_df.copy()

        sym_df = sym_df.sort_values("DATE").reset_index(drop=True)
        if len(sym_df) > lookback_sessions:
            sym_df = sym_df.iloc[-lookback_sessions:].reset_index(drop=True)

        # Derived calculations
        sym_df["DELIV_CR"] = (sym_df["TURNOVER_CR"] * sym_df["DELIV_PER"]) / 100.0
        sym_df["DAY_RET_PCT"] = ((sym_df["CLOSE"] - sym_df["PREV_CLOSE"]) / sym_df["PREV_CLOSE"]) * 100.0

        # Running 10-day Deliv SMA for daily spike calculation
        sym_df["DELIV_SMA10"] = sym_df["DELIV_QTY"].shift(1).rolling(10, min_periods=3).mean()
        sym_df["DELIV_SPIKE_X"] = np.where(sym_df["DELIV_SMA10"] > 0, sym_df["DELIV_QTY"] / sym_df["DELIV_SMA10"], 1.0)

        # Drawdown calculations
        sym_df["RUNNING_PEAK"] = sym_df["HIGH"].cummax()
        sym_df["DRAWDOWN_FROM_PEAK_PCT"] = ((sym_df["CLOSE"] - sym_df["RUNNING_PEAK"]) / sym_df["RUNNING_PEAK"]) * 100.0

        month_peak = float(sym_df["HIGH"].max())
        month_trough = float(sym_df["LOW"].min())
        month_start_price = float(sym_df["PREV_CLOSE"].iloc[0]) if pd.notna(sym_df["PREV_CLOSE"].iloc[0]) else float(sym_df["OPEN"].iloc[0])
        month_end_price = float(sym_df["CLOSE"].iloc[-1])
        month_return_pct = round(((month_end_price - month_start_price) / month_start_price) * 100.0, 2)
        month_max_dd_pct = round(((month_trough - month_peak) / month_peak) * 100.0, 2)
        current_dd_from_peak = round(((month_end_price - month_peak) / month_peak) * 100.0, 2)

        # Delivery Flow Imbalance (Green days delivery vs Red days delivery)
        green_mask = sym_df["DAY_RET_PCT"] > 0
        red_mask = sym_df["DAY_RET_PCT"] < 0
        up_deliv = float(sym_df.loc[green_mask, "DELIV_QTY"].sum())
        down_deliv = float(sym_df.loc[red_mask, "DELIV_QTY"].sum())
        flow_ratio = round(up_deliv / max(1.0, down_deliv), 2)

        total_deliv_cr = round(float(sym_df["DELIV_CR"].sum()), 2)
        avg_deliv_per = round(float(sym_df["DELIV_PER"].mean()), 1)
        clusters_55 = int((sym_df["DELIV_PER"] >= 55.0).sum())

        # Volatility Squeeze (Range 5D vs Range 30D)
        sym_df["HL_DIFF"] = sym_df["HIGH"] - sym_df["LOW"]
        r5 = float(sym_df["HL_DIFF"].iloc[-5:].mean()) if len(sym_df) >= 5 else 1.0
        r30 = float(sym_df["HL_DIFF"].mean())
        range_squeeze = round(r5 / max(0.01, r30), 2)

        # Blast Setup Diagnosis
        latest_spike = float(sym_df["DELIV_SPIKE_X"].iloc[-1])
        latest_deliv_per = float(sym_df["DELIV_PER"].iloc[-1])

        if latest_spike >= 2.5 and latest_deliv_per >= 60.0 and month_return_pct >= 0:
            blast_status = "IGNITION_DAY_ONE"
            blast_badge = "🚀 Blast Ignition Active"
            blast_desc = "Explosive volume + high delivery surge clearing overhead resistance."
        elif flow_ratio >= 1.7 and range_squeeze <= 0.75 and abs(current_dd_from_peak) <= 3.5:
            blast_status = "SPRING_COIL_BLAST"
            blast_badge = "⚡ Coiled Spring: Imminent Blast"
            blast_desc = "Float locked up with tight range contraction; primed for explosive expansion."
        elif clusters_55 >= 8 and flow_ratio >= 1.4:
            blast_status = "FLOAT_LOCKUP"
            blast_badge = "💎 Multi-Week Float Lockup"
            blast_desc = "Consistent institutional demat absorption across multiple weeks."
        else:
            blast_status = "BASE_ACCUMULATION"
            blast_badge = "📊 Base Accumulation"
            blast_desc = "Constructive baseline support with active institutional participation."

        # Group into calendar weeks (Monday - Friday)
        sym_df["CAL_WEEK"] = sym_df["DATE"].dt.strftime("%Y-W%W")
        unique_weeks = sym_df["CAL_WEEK"].unique()

        weeks_list = []
        for idx, (week_key, wdf) in enumerate(sym_df.groupby("CAL_WEEK", sort=False)):
            w_start_d = wdf["DATE"].min().strftime("%d %b")
            w_end_d = wdf["DATE"].max().strftime("%d %b")
            w_open = float(wdf["OPEN"].iloc[0])
            w_close = float(wdf["CLOSE"].iloc[-1])
            w_high = float(wdf["HIGH"].max())
            w_low = float(wdf["LOW"].min())
            w_prev = float(wdf["PREV_CLOSE"].iloc[0]) if pd.notna(wdf["PREV_CLOSE"].iloc[0]) else w_open
            w_ret = round(((w_close - w_prev) / w_prev) * 100.0, 2)
            w_dd = round(((w_low - w_high) / w_high) * 100.0, 2)
            w_avg_del = round(float(wdf["DELIV_PER"].mean()), 1)
            w_del_cr = round(float(wdf["DELIV_CR"].sum()), 2)
            w_green_count = int((wdf["DAY_RET_PCT"] > 0).sum())
            w_red_count = int((wdf["DAY_RET_PCT"] < 0).sum())

            # Days in this week
            days_list = []
            for _, drow in wdf.iterrows():
                dt = pd.to_datetime(drow["DATE"])
                c = float(drow["CLOSE"])
                o = float(drow["OPEN"])
                h = float(drow["HIGH"])
                l = float(drow["LOW"])
                ret = round(float(drow["DAY_RET_PCT"]), 2)
                d_per = round(float(drow["DELIV_PER"]), 1)
                d_qty = int(drow["DELIV_QTY"])
                d_spike = round(float(drow["DELIV_SPIKE_X"]), 2)
                to_cr = round(float(drow["TURNOVER_CR"]), 2)
                d_cr = round(float(drow["DELIV_CR"]), 2)
                dd_month = round(float(drow["DRAWDOWN_FROM_PEAK_PCT"]), 2)
                dd_week = round(((c - w_high) / w_high) * 100.0, 2)
                is_grn = ret >= 0

                # Determine daily classification
                if d_spike >= 2.0 and d_per >= 60.0 and is_grn:
                    candle_type = "BLAST_EXPANSION"
                    candle_label = "🚀 Blast Surge"
                    candle_color = "emerald"
                elif d_per >= 58.0 and is_grn:
                    candle_type = "HIGH_ACCUMULATION"
                    candle_label = "🟢 High Absorption"
                    candle_color = "teal"
                elif not is_grn and d_per <= 45.0 and d_spike <= 0.8:
                    candle_type = "CONTROLLED_DIP"
                    candle_label = "🟡 Supply Dry-Up"
                    candle_color = "amber"
                elif abs(ret) <= 0.6 and d_spike <= 0.85:
                    candle_type = "BASE_COIL"
                    candle_label = "⚪ Squeeze Coil"
                    candle_color = "slate"
                elif not is_grn and d_spike >= 1.5:
                    candle_type = "DISTRIBUTION_PULLBACK"
                    candle_label = "🔴 Shakeout Pullback"
                    candle_color = "rose"
                else:
                    candle_type = "NORMAL_SESSION"
                    candle_label = "🔵 Steady Order Flow"
                    candle_color = "cyan"

                days_list.append({
                    "date": dt.strftime("%Y-%m-%d"),
                    "day_label": dt.strftime("%a, %d %b"),
                    "day_name": dt.strftime("%A"),
                    "open": round(o, 2),
                    "high": round(h, 2),
                    "low": round(l, 2),
                    "close": round(c, 2),
                    "return_pct": ret,
                    "drawdown_from_month_peak_pct": dd_month,
                    "drawdown_from_week_high_pct": dd_week,
                    "delivery_per": d_per,
                    "delivery_qty": d_qty,
                    "delivery_spike_x": d_spike,
                    "turnover_cr": to_cr,
                    "delivery_turnover_cr": d_cr,
                    "is_green": is_grn,
                    "candle_type": candle_type,
                    "candle_label": candle_label,
                    "candle_color": candle_color,
                })

            # Sort days descending so the most recent trading session in the week is first
            days_list.reverse()

            weeks_list.append({
                "week_index": idx + 1,
                "week_key": week_key,
                "week_label": f"Week {idx + 1} ({w_start_d} – {w_end_d})",
                "start_date": w_start_d,
                "end_date": w_end_d,
                "week_open": round(w_open, 2),
                "week_close": round(w_close, 2),
                "week_high": round(w_high, 2),
                "week_low": round(w_low, 2),
                "week_return_pct": w_ret,
                "week_drawdown_pct": w_dd,
                "avg_delivery_per": w_avg_del,
                "total_delivery_cr": w_del_cr,
                "green_days_count": w_green_count,
                "red_days_count": w_red_count,
                "net_flow_bias": "ACCUMULATION" if w_green_count >= w_red_count else "CONSOLIDATION",
                "days": days_list,
            })

        # Reverse weeks so most recent week is first
        weeks_list.reverse()

        result = {
            "symbol": clean_sym,
            "lookback_sessions": len(sym_df),
            "month_summary": {
                "start_date": sym_df["DATE"].min().strftime("%d %b %Y"),
                "end_date": sym_df["DATE"].max().strftime("%d %b %Y"),
                "start_price": round(month_start_price, 2),
                "end_price": round(month_end_price, 2),
                "month_peak_price": round(month_peak, 2),
                "month_trough_price": round(month_trough, 2),
                "month_return_pct": month_return_pct,
                "month_max_drawdown_pct": month_max_dd_pct,
                "current_drawdown_from_peak_pct": current_dd_from_peak,
                "total_delivery_cr": total_deliv_cr,
                "avg_delivery_per": avg_deliv_per,
                "delivery_clusters_55_count": clusters_55,
                "green_days_count": int(green_mask.sum()),
                "red_days_count": int(red_mask.sum()),
                "delivery_flow_imbalance_ratio": flow_ratio,
                "range_squeeze_ratio": range_squeeze,
                "blast_status": blast_status,
                "blast_badge": blast_badge,
                "blast_description": blast_desc,
            },
            "weeks": weeks_list,
        }

        # Cache for 10 minutes
        cache.set_json_sync(cache_key, result, expire_seconds=600)
        return result
