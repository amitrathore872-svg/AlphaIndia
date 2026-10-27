"""
Alpha India - Delivery Radar 2.0 Institutional Engine
======================================================
Focuses on:
1. Free Float Stratification (Real Float Market Cap & Promoter Holding %)
2. Multi-Day (5 to 10 Days) Cumulative Float Absorption (% of non-promoter float accumulated)
3. 10-Day Institutional Net Inflow Ratio (Green-day vs Red-day Delivery)
4. Buyer vs Seller Dominance Sweet-Spot (70% - 76% optimal execution)
5. Pre-Spike Supply Dry-Up Coil & Volatility Compression (Range 5D / 20D <= 0.88)
6. Climax Distribution Shield (Flags single-day >= 2.0% float shocks as exhaustion traps)
"""

from __future__ import annotations

import glob
import json
import logging
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.core.redis_cache import cache
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord

logger = logging.getLogger("alpha_india.delivery_radar_v2")

DISK_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "delivery_radar_v2_cache.json"
CACHE_KEY = "screener:delivery_v2:universe"


class DeliveryRadarV2Service:
    _cached_results: Optional[List[Dict[str, Any]]] = None
    _last_scan_time: float = 0
    _scan_metadata: Dict[str, Any] = {}
    _scan_in_progress: bool = False
    _scan_lock = threading.Lock()

    @classmethod
    def _load_disk_cache(cls) -> bool:
        """Loads cached Radar 2.0 opportunities from Redis with disk fallback."""
        try:
            cached_data = cache.get_json_sync(CACHE_KEY)
            if cached_data and isinstance(cached_data, dict) and "opportunities" in cached_data:
                cls._last_scan_time = cached_data.get("timestamp", 0)
                cls._cached_results = cached_data.get("opportunities", [])
                cls._scan_metadata = cached_data.get("metadata", {})
                logger.info(f"[DeliveryRadarV2] Restored {len(cls._cached_results)} setups from Redis.")
                return True

            if DISK_CACHE_PATH.exists():
                with open(DISK_CACHE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "opportunities" in data:
                        cls._last_scan_time = data.get("timestamp", 0)
                        cls._cached_results = data.get("opportunities", [])
                        cls._scan_metadata = data.get("metadata", {})
                        logger.info(f"[DeliveryRadarV2] Restored {len(cls._cached_results)} setups from disk cache.")
                        return True
        except Exception as e:
            logger.error(f"[DeliveryRadarV2] Error loading cache: {e}")
        return False

    @classmethod
    def _save_disk_cache(cls, payload: Dict[str, Any]) -> None:
        try:
            DISK_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = DISK_CACHE_PATH.with_suffix(".tmp")
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, default=str)
            tmp_path.replace(DISK_CACHE_PATH)
            cache.set_json_sync(CACHE_KEY, payload, expire_seconds=600)
        except Exception as e:
            logger.error(f"[DeliveryRadarV2] Error saving cache: {e}")

    @classmethod
    def trigger_background_scan(
        cls,
        min_float_mcap: float = 500.0,
        min_float_absorb_5d: float = 1.0,
        lookback_sessions: int = 25,
    ) -> None:
        """Launches a non-blocking background thread to refresh Radar 2.0 cache."""
        if cls._scan_in_progress:
            return

        def _worker():
            try:
                cls._execute_full_scan(
                    min_float_mcap=min_float_mcap,
                    min_float_absorb_5d=min_float_absorb_5d,
                    lookback_sessions=lookback_sessions,
                )
            except Exception as e:
                logger.error(f"[DeliveryRadarV2] Background scan failed: {e}")

        thread = threading.Thread(target=_worker, daemon=True, name="DeliveryRadarV2ScanWorker")
        thread.start()

    @classmethod
    def scan_opportunities(
        cls,
        force_refresh: bool = False,
        min_float_mcap: float = 500.0,
        min_float_absorb_5d: float = 1.0,
        lookback_sessions: int = 25,
    ) -> Dict[str, Any]:
        """
        Returns cached Radar 2.0 results instantaneously (< 5ms).
        Uses stale-while-revalidate pattern so HTTP requests NEVER time out.
        """
        if cls._cached_results is None:
            cls._load_disk_cache()

        now = time.time()
        has_cache = cls._cached_results is not None and isinstance(cls._cached_results, list)
        is_stale = (now - cls._last_scan_time) >= 300

        if has_cache:
            if is_stale or force_refresh:
                cls.trigger_background_scan(
                    min_float_mcap=min_float_mcap,
                    min_float_absorb_5d=min_float_absorb_5d,
                    lookback_sessions=lookback_sessions,
                )
            return {
                "timestamp": cls._last_scan_time,
                "metadata": cls._scan_metadata,
                "opportunities": cls._cached_results,
            }

        with cls._scan_lock:
            if cls._cached_results is not None:
                return {
                    "timestamp": cls._last_scan_time,
                    "metadata": cls._scan_metadata,
                    "opportunities": cls._cached_results,
                }
            return cls._execute_full_scan(
                min_float_mcap=min_float_mcap,
                min_float_absorb_5d=min_float_absorb_5d,
                lookback_sessions=lookback_sessions,
            )

    @classmethod
    def _calculate_ignition_profile(cls, sym_df: Optional[pd.DataFrame], cmp: float, ema_20: float) -> Dict[str, Any]:
        """
        Analyzes the initial ignition / price discovery point to evaluate:
        1. When and at what price the surge was first discovered.
        2. Was the trade structurally worth taking at that initial discovery price (risk vs reward).
        3. Is the trade worth taking right now at CMP, or is downside risk excessive.
        """
        if sym_df is None or sym_df.empty or len(sym_df) < 2:
            return {
                "ignition_date": "",
                "ignition_price": cmp,
                "move_since_ignition_pct": 0.0,
                "worth_taking_at_discovery": True,
                "discovery_rr_ratio": "2.8:1",
                "worth_taking_now": "YES_PRIME",
                "viability_label": "🟢 PRIME IGNITION (WORTH TRADING)",
                "viability_badge_color": "emerald",
                "viability_score": 85,
                "viability_analysis": "Freshly discovered near baseline with favorable risk-to-reward ratio."
            }

        sdf = sym_df.sort_values(by="DATE").reset_index(drop=True)
        n = len(sdf)
        ignition_idx = n - 1

        # Walk backwards up to 8 sessions while previous sessions also exhibited volume/turnover expansion
        for i in range(n - 2, max(-1, n - 9), -1):
            prev_row = sdf.iloc[i]
            to_exp = float(prev_row.get("TURNOVER_EXPANSION_3D", 1.0))
            vol_exp = float(prev_row.get("VOL_EXPANSION_3D", 1.0))
            deliv_spike = float(prev_row.get("DELIV_SPIKE", 1.0))
            deliv_cr = float(prev_row.get("DELIV_CR", 0.0))
            ret_pct = float(prev_row.get("DAY_RET_PCT", 0.0))
            float_1d = float(prev_row.get("FLOAT_ABSORB_1D", 0.0))

            is_surge = (
                (to_exp >= 1.8 or vol_exp >= 1.8 or deliv_spike >= 1.8 or deliv_cr >= 20.0 or float_1d >= 1.2) and
                (ret_pct >= 0.8 or deliv_cr >= 25.0)
            )
            if is_surge:
                ignition_idx = i
            else:
                break

        ign_row = sdf.iloc[ignition_idx]
        ign_date_str = pd.to_datetime(ign_row["DATE"]).strftime("%d-%b-%Y") if pd.notna(ign_row.get("DATE")) else ""
        ign_open = float(ign_row.get("OPEN", cmp))
        ign_close = float(ign_row.get("CLOSE", cmp))
        ign_deliv_per = float(ign_row.get("DELIV_PER", 0.0))
        ign_deliv_cr = float(ign_row.get("DELIV_CR", 0.0))
        ign_ret = float(ign_row.get("DAY_RET_PCT", 0.0))

        ign_price = round(ign_open if ign_open > 0 else ign_close, 2)
        move_since_ign = round(((cmp - ign_price) / max(0.01, ign_price)) * 100.0, 1)
        dist_to_ema20 = round(((cmp - ema_20) / max(0.01, ema_20)) * 100.0, 1) if ema_20 > 0 else 0.0

        worth_at_discovery = bool(ign_deliv_per >= 30.0 or ign_deliv_cr >= 15.0)
        discovery_rr = "2.8:1" if ign_ret <= 8.0 else "1.8:1"

        if move_since_ign <= 4.0 and dist_to_ema20 <= 4.5:
            worth_now = "YES_PRIME"
            label = "🟢 PRIME IGNITION (WORTH TRADING)"
            color = "emerald"
            score = 90
            analysis = (
                f"Discovered at ignition on {ign_date_str} near ₹{ign_price} "
                f"({move_since_ign:+.1f}% from ignition, {dist_to_ema20:+.1f}% vs 20-EMA). "
                f"Tight base support limits downside to -3.5%. Highly worth taking (R:R ~{discovery_rr})."
            )
        elif move_since_ign <= 8.0 and dist_to_ema20 < 7.0:
            worth_now = "CAUTION_EXTENDED"
            label = "🟡 EXTENDED (REDUCED SIZE)"
            color = "amber"
            score = 65
            analysis = (
                f"Ignition began {ign_date_str} at ₹{ign_price} (was worth taking with {discovery_rr} R:R). "
                f"Stock has already moved +{move_since_ign:.1f}% from ignition ({dist_to_ema20:+.1f}% vs 20-EMA). "
                f"Downside risk to base is widened (-6% to -8%). Cut position size by 50% if taking trade."
            )
        else:
            worth_now = "NO_UNVIABLE"
            label = "🔴 LATE / UNVIABLE (DO NOT CHASE)"
            color = "rose"
            score = 30
            analysis = (
                f"At discovery on {ign_date_str} at ₹{ign_price}, setup was worth taking ({discovery_rr} R:R with ₹{ign_deliv_cr:.1f} Cr delivery). "
                f"However, at current price (₹{cmp}), the stock has already rallied +{move_since_ign:.1f}% and is extended +{dist_to_ema20:.1f}% above 20-EMA. "
                f"Downside retest risk is -{dist_to_ema20:.1f}%. Risk-reward is inverted (< 0.6:1); NOT worth taking fresh trade at CMP."
            )

        return {
            "ignition_date": ign_date_str,
            "ignition_price": ign_price,
            "move_since_ignition_pct": move_since_ign,
            "worth_taking_at_discovery": worth_at_discovery,
            "discovery_rr_ratio": discovery_rr,
            "worth_taking_now": worth_now,
            "viability_label": label,
            "viability_badge_color": color,
            "viability_score": score,
            "viability_analysis": analysis
        }

    @classmethod
    def _execute_full_scan(
        cls,
        min_float_mcap: float = 500.0,
        min_float_absorb_5d: float = 1.0,
        lookback_sessions: int = 25,
    ) -> Dict[str, Any]:
        now = time.time()
        cls._scan_in_progress = True
        t0 = time.time()

        try:
            # 1. Load Free Float Metadata from ScreenerGrowthRecord
            db: Session = SessionLocal()
            records = db.query(
                ScreenerGrowthRecord.symbol,
                ScreenerGrowthRecord.company_name,
                ScreenerGrowthRecord.sector,
                ScreenerGrowthRecord.market_cap,
                ScreenerGrowthRecord.promoter_holding,
                ScreenerGrowthRecord.fii_holding,
                ScreenerGrowthRecord.dii_holding,
                ScreenerGrowthRecord.public_holding,
            ).all()
            db.close()

            meta_df = pd.DataFrame(
                records,
                columns=[
                    "symbol", "company_name", "sector", "market_cap",
                    "promoter_holding", "fii_holding", "dii_holding", "public_holding"
                ]
            )
            meta_df["symbol"] = meta_df["symbol"].astype(str).str.strip()
            meta_df["promoter_holding"] = pd.to_numeric(meta_df["promoter_holding"], errors="coerce").fillna(50.0)
            meta_df["market_cap"] = pd.to_numeric(meta_df["market_cap"], errors="coerce")
            meta_df["free_float_pct"] = np.clip(100.0 - meta_df["promoter_holding"], 5.0, 95.0)
            meta_df["free_float_mcap_cr"] = meta_df["market_cap"] * (meta_df["free_float_pct"] / 100.0)

            valid_symbols = set(meta_df.dropna(subset=["market_cap"])["symbol"].unique())

            # 2. Load NSE Delivery Bhavcopy Files (rolling lookback)
            base_dir = Path(__file__).resolve().parent.parent.parent / "data" / "nse_delivery"
            def parse_date(f):
                try:
                    raw = os.path.basename(f).replace("sec_bhavdata_full_", "").replace(".csv", "")
                    return datetime.strptime(raw, "%d%m%Y")
                except Exception:
                    return datetime.min

            files = sorted(list(base_dir.glob("sec_bhavdata_full_*.csv")), key=parse_date)
            if not files:
                return {"timestamp": now, "metadata": {"error": "NO_DELIVERY_DATA"}, "opportunities": []}

            selected_files = files[-max(25, min(lookback_sessions, 35)):]
            bhav_records = []

            for fpath in selected_files:
                try:
                    df = pd.read_csv(fpath, low_memory=False)
                    df.columns = [c.strip() for c in df.columns]
                    if "SERIES" in df.columns:
                        df = df[df["SERIES"].astype(str).str.strip() == "EQ"]
                    df["SYMBOL"] = df["SYMBOL"].astype(str).str.strip()
                    df = df[df["SYMBOL"].isin(valid_symbols)]

                    df["DATE"] = pd.to_datetime(df["DATE1"].astype(str).str.strip(), format="%d-%b-%Y")
                    df["CLOSE"] = pd.to_numeric(df["CLOSE_PRICE"], errors="coerce")
                    df["PREV_CLOSE"] = pd.to_numeric(df["PREV_CLOSE"], errors="coerce")
                    df["OPEN"] = pd.to_numeric(df["OPEN_PRICE"], errors="coerce")
                    df["HIGH"] = pd.to_numeric(df["HIGH_PRICE"], errors="coerce")
                    df["LOW"] = pd.to_numeric(df["LOW_PRICE"], errors="coerce")
                    df["AVG_PRICE"] = pd.to_numeric(df["AVG_PRICE"], errors="coerce")
                    df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
                    df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
                    df["NO_OF_TRADES"] = pd.to_numeric(df["NO_OF_TRADES"], errors="coerce").fillna(1)
                    df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
                    df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)

                    bhav_records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "AVG_PRICE", "VOLUME", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
                except Exception:
                    continue

            if not bhav_records:
                return {"timestamp": now, "metadata": {"error": "EMPTY_RECORDS"}, "opportunities": []}

            all_df = pd.concat(bhav_records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
            all_df = all_df.merge(meta_df, left_on="SYMBOL", right_on="symbol", how="inner")

            # Technical & Delivery Engineering
            grouped = all_df.groupby("SYMBOL", group_keys=False)
            all_df["DAY_RET_PCT"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
            all_df["HL_RANGE"] = np.maximum(all_df["HIGH"] - all_df["LOW"], 1e-4)
            all_df["CLOSE_LOCATION"] = (all_df["CLOSE"] - all_df["LOW"]) / all_df["HL_RANGE"]
            all_df["UPPER_WICK_PCT"] = (all_df["HIGH"] - np.maximum(all_df["OPEN"], all_df["CLOSE"])) / all_df["HL_RANGE"]

            all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
            all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).mean())
            all_df["EMA_20"] = grouped["CLOSE"].transform(lambda x: x.ewm(span=20).mean())
            all_df["DIST_TO_EMA20_PCT"] = ((all_df["CLOSE"] - all_df["EMA_20"]) / all_df["EMA_20"]) * 100.0
            all_df["HIGH_20"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).max())
            all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).max())
            all_df["PEAK_DD_20D"] = np.where(all_df["HIGH_20"] > 0, ((all_df["CLOSE"] - all_df["HIGH_20"]) / all_df["HIGH_20"]) * 100.0, 0.0)

            # Market Breadth calculation (% of universe > 20 SMA)
            breadth_map = all_df.groupby("DATE").apply(lambda d: (d["CLOSE"] > d["SMA_20"]).mean() * 100.0).to_dict()
            all_df["MARKET_BREADTH"] = all_df["DATE"].map(breadth_map).fillna(50.0)

            all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
            all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
            all_df["DELIV_SPIKE"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)

            # Institutional Ticket Size Expansion
            all_df["TICKET_LACS"] = (all_df["TURNOVER_CR"] * 100.0) / np.maximum(1, all_df["NO_OF_TRADES"])
            all_df["TICKET_20_SMA"] = grouped["TICKET_LACS"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
            all_df["TICKET_SPIKE"] = np.where(all_df["TICKET_20_SMA"] > 0, all_df["TICKET_LACS"] / all_df["TICKET_20_SMA"], 1.0)

            # Up/Down Delivery Flow (10-Day Ratio)
            all_df["DELIV_UP"] = np.where(all_df["DAY_RET_PCT"] > 0, all_df["DELIV_QTY"], 0.0)
            all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET_PCT"] < 0, all_df["DELIV_QTY"], 0.0)
            up_10 = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
            down_10 = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
            all_df["DELIV_FLOW_10D"] = np.where(down_10 > 0, up_10 / down_10, 1.0)

            # Multi-Day Traded Volume & Turnover Expansion Dynamics (3D / 5D vs 20D Baseline)
            all_df["VOL_3D_MEAN"] = grouped["VOLUME"].transform(lambda x: x.rolling(3, min_periods=1).mean())
            all_df["VOL_5D_MEAN"] = grouped["VOLUME"].transform(lambda x: x.rolling(5, min_periods=1).mean())
            all_df["VOL_20D_MEAN"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=5).mean())
            all_df["VOL_EXPANSION_3D"] = np.where(all_df["VOL_20D_MEAN"] > 0, all_df["VOL_3D_MEAN"] / all_df["VOL_20D_MEAN"], 1.0)
            all_df["VOL_EXPANSION_5D"] = np.where(all_df["VOL_20D_MEAN"] > 0, all_df["VOL_5D_MEAN"] / all_df["VOL_20D_MEAN"], 1.0)

            all_df["TURNOVER_3D_MEAN"] = grouped["TURNOVER_CR"].transform(lambda x: x.rolling(3, min_periods=1).mean())
            all_df["TURNOVER_5D_MEAN"] = grouped["TURNOVER_CR"].transform(lambda x: x.rolling(5, min_periods=1).mean())
            all_df["TURNOVER_20D_MEAN"] = grouped["TURNOVER_CR"].transform(lambda x: x.shift(1).rolling(20, min_periods=5).mean())
            all_df["TURNOVER_EXPANSION_3D"] = np.where(all_df["TURNOVER_20D_MEAN"] > 0, all_df["TURNOVER_3D_MEAN"] / all_df["TURNOVER_20D_MEAN"], 1.0)
            all_df["TURNOVER_EXPANSION_5D"] = np.where(all_df["TURNOVER_20D_MEAN"] > 0, all_df["TURNOVER_5D_MEAN"] / all_df["TURNOVER_20D_MEAN"], 1.0)

            # Multi-Day Price Return Retention (Laddering & Trend Confirmation)
            all_df["RET_3D"] = grouped["CLOSE"].transform(lambda x: ((x - x.shift(3)) / np.maximum(1e-4, x.shift(3))) * 100.0).fillna(0.0)
            all_df["RET_5D"] = grouped["CLOSE"].transform(lambda x: ((x - x.shift(5)) / np.maximum(1e-4, x.shift(5))) * 100.0).fillna(0.0)

            # Free Float Delivery Inflow (Crores)
            all_df["DELIV_CR"] = (all_df["TURNOVER_CR"] * all_df["DELIV_PER"]) / 100.0
            all_df["NET_DELIV_CR_5D"] = grouped["DELIV_CR"].transform(lambda x: x.rolling(5, min_periods=1).sum())
            all_df["NET_DELIV_CR_10D"] = grouped["DELIV_CR"].transform(lambda x: x.rolling(10, min_periods=1).sum())

            # % of Total Free Float Absorbed
            all_df["FLOAT_ABSORB_1D"] = np.where(all_df["free_float_mcap_cr"] > 0, (all_df["DELIV_CR"] / all_df["free_float_mcap_cr"]) * 100.0, 0.0)
            all_df["FLOAT_ABSORB_5D"] = np.where(all_df["free_float_mcap_cr"] > 0, (all_df["NET_DELIV_CR_5D"] / all_df["free_float_mcap_cr"]) * 100.0, 0.0)
            all_df["FLOAT_ABSORB_10D"] = np.where(all_df["free_float_mcap_cr"] > 0, (all_df["NET_DELIV_CR_10D"] / all_df["free_float_mcap_cr"]) * 100.0, 0.0)

            # Multi-Day Delivery Clustering
            all_df["IS_D55"] = np.where(all_df["DELIV_PER"] >= 55.0, 1.0, 0.0)
            all_df["DELIV_DAYS_5D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0)
            all_df["DELIV_DAYS_10D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(10, min_periods=1).sum()).fillna(0)

            # Supply Dry-Up & Volatility Compression
            all_df["VOL_DRYUP_RATIO"] = np.where(all_df["VOL_20_SMA"] > 0, grouped["VOLUME"].transform(lambda x: x.shift(1)) / all_df["VOL_20_SMA"], 1.0)
            range_5 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
            range_20 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
            all_df["RANGE_CONTRACTION"] = np.where(range_20 > 0, range_5 / range_20, 1.0)

            # Distance to 20-Day Pivot
            all_df["PIVOT_DIST_PCT"] = np.where(all_df["HIGH_20"] > 0, ((all_df["HIGH_20"] - all_df["CLOSE"]) / all_df["HIGH_20"]) * 100.0, 0.0)

            # Composite Buyer Demand Ratio
            tot_flow_10 = up_10 + down_10
            up_ratio_10 = np.where(tot_flow_10 > 0, up_10 / tot_flow_10, 0.5)
            ticket_factor = np.clip((all_df["TICKET_SPIKE"] - 0.8) / 1.2, 0.0, 1.0)
            loc_factor = np.clip(all_df["CLOSE_LOCATION"], 0.0, 1.0)
            deliv_factor = np.clip(all_df["DELIV_PER"] / 100.0, 0.0, 1.0)
            all_df["BUYER_DEMAND_RATIO"] = np.round((0.35 * up_ratio_10 + 0.25 * loc_factor + 0.20 * deliv_factor + 0.20 * ticket_factor) * 100.0, 1)

            # Take the latest session date
            latest_date = all_df["DATE"].max()
            latest_df = all_df[all_df["DATE"] == latest_date].copy()

            # Basic Institutional Floors: includes stocks expanding volume/traded value across recent sessions
            candidates = latest_df[
                (latest_df["CLOSE"] >= 35.0) &
                (latest_df["TURNOVER_CR"] >= 1.5) &
                (latest_df["free_float_mcap_cr"] >= min_float_mcap) &
                (
                    (latest_df["FLOAT_ABSORB_5D"] >= min_float_absorb_5d) |
                    (latest_df["DELIV_DAYS_5D"] >= 2) |
                    (latest_df["DELIV_SPIKE"] >= 1.8) |
                    (latest_df["TURNOVER_EXPANSION_3D"] >= 1.8) |
                    (latest_df["VOL_EXPANSION_3D"] >= 1.8)
                )
            ].copy()

            candidate_syms = set(candidates["SYMBOL"].unique())
            sub_all_df = all_df[all_df["SYMBOL"].isin(candidate_syms)]
            sym_history_map = {s: grp for s, grp in sub_all_df.groupby("SYMBOL")}

            opportunities = []
            for _, row in candidates.iterrows():
                sym = str(row["SYMBOL"])
                cmp = float(row["CLOSE"])
                prev_c = float(row["PREV_CLOSE"]) if pd.notna(row.get("PREV_CLOSE")) else cmp
                ret_pct = round(float(row["DAY_RET_PCT"]), 2)
                mcap_cr = round(float(row["market_cap"]), 1)
                ff_pct = round(float(row["free_float_pct"]), 1)
                ff_mcap_cr = round(float(row["free_float_mcap_cr"]), 1)
                promoter_h = round(float(row["promoter_holding"]), 1)

                float_1d = round(float(row["FLOAT_ABSORB_1D"]), 2)
                float_5d = round(float(row["FLOAT_ABSORB_5D"]), 2)
                float_10d = round(float(row["FLOAT_ABSORB_10D"]), 2)
                deliv_cr_5d = round(float(row["NET_DELIV_CR_5D"]), 2)
                deliv_cr_10d = round(float(row["NET_DELIV_CR_10D"]), 2)

                deliv_per = round(float(row["DELIV_PER"]), 1)
                deliv_spike = round(float(row["DELIV_SPIKE"]), 2)
                deliv_flow_10d = round(float(row["DELIV_FLOW_10D"]), 2)
                deliv_days_5d = int(row["DELIV_DAYS_5D"])
                deliv_days_10d = int(row["DELIV_DAYS_10D"])

                vol_exp_3d = round(float(row.get("VOL_EXPANSION_3D", 1.0)), 2)
                vol_exp_5d = round(float(row.get("VOL_EXPANSION_5D", 1.0)), 2)
                to_exp_3d = round(float(row.get("TURNOVER_EXPANSION_3D", 1.0)), 2)
                to_exp_5d = round(float(row.get("TURNOVER_EXPANSION_5D", 1.0)), 2)
                ret_3d = round(float(row.get("RET_3D", 0.0)), 2)
                ret_5d = round(float(row.get("RET_5D", 0.0)), 2)

                buyer_ratio = round(float(row["BUYER_DEMAND_RATIO"]), 1)
                vdu_ratio = round(float(row["VOL_DRYUP_RATIO"]), 2)
                range_cont = round(float(row["RANGE_CONTRACTION"]), 2)
                ticket_spike = round(float(row["TICKET_SPIKE"]), 2)
                pivot_dist = round(float(row["PIVOT_DIST_PCT"]), 2)

                dist_to_ema20 = round(float(row.get("DIST_TO_EMA20_PCT", 0)), 2)
                peak_dd = round(float(row.get("PEAK_DD_20D", 0)), 2)
                ema_20_val = round(float(row.get("EMA_20", cmp)), 2)
                sma_50_val = round(float(row.get("SMA_50", cmp)), 2)

                upper_wick = float(row.get("UPPER_WICK_PCT", 0))
                close_loc = float(row.get("CLOSE_LOCATION", 0.5))

                sym_hist = sym_history_map.get(sym)
                ign_profile = cls._calculate_ignition_profile(sym_hist, cmp, ema_20_val)

                # Multi-Day Institutional Volume & Traded Value Expansion:
                # Stock is aggressively voluming up over recent 3-5 sessions, with heavy net delivery absorption
                # and price retention (stepping higher or respecting trend).
                is_multi_day_expansion = bool(
                    (to_exp_3d >= 2.0 or vol_exp_3d >= 2.0 or to_exp_5d >= 1.75) and
                    (deliv_cr_5d >= 25.0 or float_5d >= 2.0) and
                    (deliv_flow_10d >= 1.3) and
                    (ret_3d >= -2.0 or cmp >= sma_50_val * 0.98) and
                    (ret_pct >= -1.5)
                )

                # Climax Shock is an isolated exhaustion blow-off / distribution trap,
                # characterized by heavy single-day volume with NET DISTRIBUTION (closing deeply red, breaking trend, or negative flow)
                is_climax_shock = bool(
                    not is_multi_day_expansion and (
                        (float_1d >= 2.5 and (ret_pct < -1.0 or deliv_flow_10d < 1.1 or (upper_wick >= 0.45 and close_loc <= 0.35))) or
                        (buyer_ratio >= 80.0 and upper_wick >= 0.45 and ret_pct < 0.0)
                    )
                )
                is_sweetspot_demand = bool(70.0 <= buyer_ratio <= 76.5)

                # ⚡ 20-EMA Asymmetric Cheat Coil (Sweet Spot Setup: Low Downside Risk + High Upside Potential)
                is_asymmetric_coil = bool(
                    (-1.2 <= dist_to_ema20 <= 2.5) and
                    (peak_dd >= -7.5) and
                    (range_cont <= 0.90 or vdu_ratio <= 0.85) and
                    (deliv_days_10d >= 4 or float_10d >= 2.0) and
                    (abs(pivot_dist) <= 6.5) and
                    (cmp >= sma_50_val * 0.97)
                )

                is_breakout = bool(cmp > float(row["HIGH_20"]) and ret_pct >= 2.5 and deliv_spike >= 1.8)
                is_coil = bool(range_cont <= 0.88 and vdu_ratio <= 0.75 and abs(pivot_dist) <= 3.5)
                is_float_lock = bool(float_5d >= 2.5 and deliv_flow_10d >= 1.4 and range_cont <= 0.90)

                high_20_val = float(row.get("HIGH_20", cmp))
                is_extended = bool(dist_to_ema20 >= 7.0 or (cmp >= high_20_val * 1.05 and dist_to_ema20 >= 5.0))

                if is_climax_shock:
                    archetype = "CLIMAX_SHOCK_WARNING"
                    archetype_label = "⚠️ Climax Shock Trap (Avoid)"
                    verdict = f"High Climax Risk: Day-1 delivery absorbed {float_1d:.2f}% of float with high wick rejection ({upper_wick*100:.0f}%). Beware of exhaustion peak."
                    badge_color = "rose"
                    trigger_status = "CLIMAX_AVOID"
                    trigger_status_label = "⚠️ AVOID TRAP"
                    status_badge_color = "rose"
                elif is_multi_day_expansion:
                    archetype = "VOLUME_EXPANSION_SURGE"
                    archetype_label = "🔥 Multi-Day Volume & Capital Expansion"
                    badge_color = "emerald"
                    if is_extended:
                        trigger_status = "PULLBACK_WATCH"
                        trigger_status_label = "🎯 PULLBACK ENTRY (WAIT)"
                        status_badge_color = "amber"
                        verdict = f"Sustained Institutional Surge: 3-Day turnover running {to_exp_3d:.1f}x baseline with ₹{deliv_cr_5d:.1f} Cr absorbed ({float_5d:.2f}% of float). Stock is currently extended (+{dist_to_ema20:.1f}% vs 20-EMA); wait for pullback to avoid chasing."
                    else:
                        trigger_status = "EXPANSION_BUY"
                        trigger_status_label = "🔥 FRESH PIVOT BUY"
                        status_badge_color = "emerald"
                        verdict = f"Sustained Institutional Surge: 3-Day turnover running {to_exp_3d:.1f}x baseline with ₹{deliv_cr_5d:.1f} Cr absorbed ({float_5d:.2f}% of free float) and net inflow ratio {deliv_flow_10d:.2f}x."
                elif is_asymmetric_coil:
                    archetype = "ASYMMETRIC_COIL"
                    archetype_label = "⚡ 20-EMA Cheat Coil"
                    verdict = f"Asymmetric Sweet Spot: Trading {dist_to_ema20:+.1f}% vs 20-EMA with ₹{deliv_cr_10d:.1f} Cr absorbed ({float_10d:.2f}% float). Drawdown capped at {peak_dd:.1f}% with range squeeze {range_cont:.2f}x. Low downside risk."
                    badge_color = "cyan"
                    trigger_status = "ASYMMETRIC_BUY"
                    trigger_status_label = "🟢 CHEAT ENTRY"
                    status_badge_color = "emerald"
                elif is_breakout:
                    archetype = "BREAKOUT_EXPANSION"
                    archetype_label = "🚀 Breakout Expansion"
                    verdict = f"Ignition: Cross of 20-day high on {deliv_spike:.2f}x delivery spike with {buyer_ratio:.1f}% buyer dominance."
                    badge_color = "cyan"
                    trigger_status = "BUY_TRIGGERED"
                    trigger_status_label = "🟢 BUY TRIGGERED"
                    status_badge_color = "emerald"
                elif is_float_lock:
                    archetype = "STEALTH_FLOAT_LOCK"
                    archetype_label = "🔒 Stealth Float Lock"
                    verdict = f"Stealth Lock: Absorbed {float_5d:.2f}% of free float (₹{deliv_cr_5d:.1f} Cr) over 5 sessions. Range compressed {range_cont:.2f}x near resistance."
                    badge_color = "emerald"
                    trigger_status = "COILING_WATCHLIST"
                    trigger_status_label = "🟡 COILING (WATCH)"
                    status_badge_color = "amber"
                elif is_coil:
                    archetype = "COIL_SUPPLY_EXHAUSTION"
                    archetype_label = "🟡 Supply Dry-Up Coil"
                    verdict = f"Supply Exhaustion: Volume dried up to {vdu_ratio:.2f}x 20-DMA inside a {range_cont:.2f}x range squeeze with {deliv_days_5d}/5 days sticky delivery."
                    badge_color = "amber"
                    trigger_status = "COILING_WATCHLIST"
                    trigger_status_label = "🟡 COILING (WATCH)"
                    status_badge_color = "amber"
                else:
                    archetype = "MULTI_DAY_ACCUMULATION"
                    archetype_label = "📦 Multi-Day Accumulation"
                    verdict = f"Multi-Day Accumulation: {deliv_days_5d}/5 days > 55% delivery. Inflow ratio {deliv_flow_10d:.2f}x with {float_5d:.2f}% float absorption."
                    badge_color = "slate"
                    trigger_status = "COILING_WATCHLIST"
                    trigger_status_label = "🟡 COILING (WATCH)"
                    status_badge_color = "amber"

                # 100-Point Conviction Scoring
                pts_float = min(30.0, float_5d * 7.5)
                if is_sweetspot_demand:
                    pts_buyer = 25.0
                elif buyer_ratio >= 65.0:
                    pts_buyer = 18.0
                elif buyer_ratio >= 55.0:
                    pts_buyer = 12.0
                else:
                    pts_buyer = 5.0
                pts_multi = min(20.0, deliv_days_5d * 4.0 + (deliv_flow_10d - 1.0) * 4.0)
                pts_squeeze = 15.0 if range_cont <= 0.85 else (10.0 if range_cont <= 0.92 else 5.0)
                pts_qual = min(10.0, (ticket_spike - 1.0) * 4.0 + (4.0 if 1000.0 <= ff_mcap_cr <= 5000.0 else 2.0))
                pts_asymm = 12.0 if is_asymmetric_coil else 0.0
                pts_expansion = min(25.0, (to_exp_3d - 1.0) * 5.0 + (vol_exp_3d - 1.0) * 3.0) if is_multi_day_expansion else 0.0

                score = round(max(0.0, min(100.0, pts_float + pts_buyer + pts_multi + pts_squeeze + pts_qual + pts_asymm + pts_expansion)), 1)
                if is_climax_shock:
                    score = min(score, 45.0)

                # Mechanical Trade Blueprint (Dynamic Downside Risk Protection)
                if is_extended:
                    # Stock is extended far above moving averages — calculate Pullback Retest Corridor
                    entry_mode = "PULLBACK_RETEST"
                    e_min = round(max(high_20_val * 0.99, ema_20_val * 1.02), 2)
                    e_max = round(min(cmp * 0.96, max(high_20_val * 1.03, ema_20_val * 1.06)), 2)
                    if e_max < e_min:
                        e_min = round(ema_20_val * 1.02, 2)
                        e_max = round(ema_20_val * 1.06, 2)
                    entry_min = e_min
                    entry_max = e_max
                    rec_buy_price = round((entry_min + entry_max) / 2.0, 2)
                    sl_price = round(min(entry_min * 0.965, ema_20_val * 0.97), 2)
                    risk_pct = round(((rec_buy_price - sl_price) / rec_buy_price) * 100.0, 1)
                    be_price = round(rec_buy_price * 1.035, 2)
                    t1_price = round(rec_buy_price * 1.10, 2)
                    t2_price = round(rec_buy_price * 1.18, 2)
                    exec_protocol = f"⚠️ DO NOT CHASE AT CMP (Extended {dist_to_ema20:+.1f}% vs 20-EMA). Downside risk to 20-EMA is -{dist_to_ema20:.1f}%. Place GTT Buy Limit order in pullback corridor ₹{entry_min} - ₹{entry_max} (Breakout Retest / 20-EMA zone). Set SL at ₹{sl_price} (-{risk_pct}%)."
                else:
                    # Stock is near key pivot or tight base — normal entry corridor
                    entry_mode = "PIVOT_BUY" if (is_breakout or is_multi_day_expansion) else "COIL_ENTRY"
                    entry_min = round(min(cmp, ema_20_val if ema_20_val > 0 else cmp), 2)
                    entry_max = round(cmp * 1.012, 2)
                    rec_buy_price = round(cmp, 2)
                    sl_price = round(cmp * (1 - 0.035), 2)
                    risk_pct = 3.5
                    be_price = round(cmp * (1 + 0.035), 2)
                    t1_price = round(cmp * (1 + 0.10), 2)
                    t2_price = round(cmp * (1 + 0.16), 2)
                    exec_protocol = f"Enter in corridor near 20-EMA (₹{entry_min} - ₹{entry_max}). Set -3.5% GTT SL. When +3.5% hit, ratchet SL to Cost. Sell 50% at +10% (₹{t1_price}), trail 50% on 20-EMA."

                blueprint = {
                    "entry_corridor_min": entry_min,
                    "entry_corridor_max": entry_max,
                    "recommended_buy_price": rec_buy_price,
                    "entry_mode": entry_mode,
                    "is_extended": is_extended,
                    "downside_to_ema20_pct": dist_to_ema20,
                    "stop_loss": sl_price,
                    "risk_pct": risk_pct,
                    "breakeven_trigger": be_price,
                    "breakeven_gain_pct": 3.5,
                    "target_1": t1_price,
                    "target_1_gain_pct": round(((t1_price - rec_buy_price) / rec_buy_price) * 100.0, 1),
                    "target_2": t2_price,
                    "target_2_gain_pct": round(((t2_price - rec_buy_price) / rec_buy_price) * 100.0, 1),
                    "rr_ratio": f"1:{round(10.0 / max(0.1, risk_pct), 1)}",
                    "suggested_holding_days": "10 - 18 Sessions",
                    "execution_protocol": exec_protocol,
                    "ignition_date": ign_profile["ignition_date"],
                    "ignition_price": ign_profile["ignition_price"],
                    "move_since_ignition_pct": ign_profile["move_since_ignition_pct"],
                    "worth_taking_at_discovery": ign_profile["worth_taking_at_discovery"],
                    "discovery_rr_ratio": ign_profile["discovery_rr_ratio"],
                    "worth_taking_now": ign_profile["worth_taking_now"],
                    "viability_label": ign_profile["viability_label"],
                    "viability_badge_color": ign_profile["viability_badge_color"],
                    "viability_score": ign_profile["viability_score"],
                    "viability_analysis": ign_profile["viability_analysis"],
                }

                opportunities.append({
                    "symbol": sym,
                    "company_name": str(row.get("company_name", sym)),
                    "sector": str(row.get("sector", "Equity / Diversified")),
                    "current_price": cmp,
                    "day_change_pct": ret_pct,
                    "market_cap_cr": mcap_cr,
                    "free_float_pct": ff_pct,
                    "free_float_mcap_cr": ff_mcap_cr,
                    "promoter_holding": promoter_h,
                    "float_absorb_1d_pct": float_1d,
                    "float_absorb_5d_pct": float_5d,
                    "float_absorb_10d_pct": float_10d,
                    "net_deliv_cr_5d": deliv_cr_5d,
                    "net_deliv_cr_10d": deliv_cr_10d,
                    "delivery_per": deliv_per,
                    "delivery_spike_x": deliv_spike,
                    "deliv_days_5d": deliv_days_5d,
                    "deliv_days_10d": deliv_days_10d,
                    "deliv_flow_10d": deliv_flow_10d,
                    "vol_expansion_3d": vol_exp_3d,
                    "vol_expansion_5d": vol_exp_5d,
                    "turnover_expansion_3d": to_exp_3d,
                    "turnover_expansion_5d": to_exp_5d,
                    "return_3d_pct": ret_3d,
                    "return_5d_pct": ret_5d,
                    "buyer_demand_ratio": buyer_ratio,
                    "vol_dryup_ratio": vdu_ratio,
                    "range_contraction": range_cont,
                    "ticket_spike": ticket_spike,
                    "pivot_distance_pct": pivot_dist,
                    "dist_to_ema20_pct": dist_to_ema20,
                    "downside_to_ema20_pct": dist_to_ema20,
                    "peak_drawdown_20d": peak_dd,
                    "ema_20": ema_20_val,
                    "recommended_buy_price": rec_buy_price,
                    "is_extended": is_extended,
                    "ignition_date": ign_profile["ignition_date"],
                    "ignition_price": ign_profile["ignition_price"],
                    "move_since_ignition_pct": ign_profile["move_since_ignition_pct"],
                    "worth_taking_at_discovery": ign_profile["worth_taking_at_discovery"],
                    "discovery_rr_ratio": ign_profile["discovery_rr_ratio"],
                    "worth_taking_now": ign_profile["worth_taking_now"],
                    "viability_label": ign_profile["viability_label"],
                    "viability_badge_color": ign_profile["viability_badge_color"],
                    "viability_score": ign_profile["viability_score"],
                    "viability_analysis": ign_profile["viability_analysis"],
                    "archetype": archetype,
                    "archetype_label": archetype_label,
                    "badge_color": badge_color,
                    "trigger_status": trigger_status,
                    "trigger_status_label": trigger_status_label,
                    "status_badge_color": status_badge_color,
                    "institutional_verdict": verdict,
                    "conviction_score": score,
                    "is_climax_shock": is_climax_shock,
                    "is_sweetspot_demand": is_sweetspot_demand,
                    "is_asymmetric_coil": is_asymmetric_coil,
                    "is_multi_day_expansion": is_multi_day_expansion,
                    "blueprint": blueprint,
                })

            opportunities.sort(key=lambda x: x["conviction_score"], reverse=True)

            latest_breadth = float(latest_df["MARKET_BREADTH"].iloc[0]) if not latest_df.empty and "MARKET_BREADTH" in latest_df.columns else 50.0
            regime_status = "BULLISH" if latest_breadth >= 45.0 else "DEFENSIVE"
            market_regime = {
                "status": regime_status,
                "label": "🟢 GREEN LIGHT (Risk-On)" if regime_status == "BULLISH" else "🔴 CAUTION (Defensive)",
                "breadth_pct": round(latest_breadth, 1),
                "recommendation": "Full position size allowed on 20-EMA Cheat Coils" if regime_status == "BULLISH" else "Market breadth weak (<45% above 20-SMA). Half position size or wait for ignition.",
            }

            metadata = {
                "latest_session_date": latest_date.strftime("%Y-%m-%d"),
                "total_scanned_symbols": len(candidates),
                "qualifying_setups_count": len(opportunities),
                "asymmetric_coil_count": sum(1 for o in opportunities if o["archetype"] == "ASYMMETRIC_COIL"),
                "volume_expansion_count": sum(1 for o in opportunities if o["archetype"] == "VOLUME_EXPANSION_SURGE"),
                "pullback_watch_count": sum(1 for o in opportunities if o["trigger_status"] == "PULLBACK_WATCH"),
                "buy_triggered_count": sum(1 for o in opportunities if o["trigger_status"] in ("BUY_TRIGGERED", "ASYMMETRIC_BUY", "EXPANSION_BUY")),
                "coiling_count": sum(1 for o in opportunities if o["trigger_status"] in ("COILING_WATCHLIST", "PULLBACK_WATCH")),
                "climax_avoid_count": sum(1 for o in opportunities if o["trigger_status"] == "CLIMAX_AVOID"),
                "stealth_lock_count": sum(1 for o in opportunities if o["archetype"] == "STEALTH_FLOAT_LOCK"),
                "coil_dryup_count": sum(1 for o in opportunities if o["archetype"] == "COIL_SUPPLY_EXHAUSTION"),
                "breakout_expansion_count": sum(1 for o in opportunities if o["archetype"] == "BREAKOUT_EXPANSION"),
                "climax_warnings_count": sum(1 for o in opportunities if o["is_climax_shock"]),
                "sweetspot_demand_count": sum(1 for o in opportunities if o["is_sweetspot_demand"]),
                "market_regime": market_regime,
                "scan_duration_seconds": round(time.time() - t0, 2),
                "algorithm_version": "2.3.0-RISK-MANAGED",
            }

            result = {
                "timestamp": now,
                "metadata": metadata,
                "opportunities": opportunities,
            }

            cls._cached_results = opportunities
            cls._last_scan_time = now
            cls._scan_metadata = metadata
            cls._save_disk_cache(result)
            return result

        finally:
            cls._scan_in_progress = False

    @classmethod
    def get_radar_stats(cls) -> Dict[str, Any]:
        if cls._cached_results is None:
            cls._load_disk_cache()
        if cls._cached_results is None:
            return cls.scan_opportunities()
        return {
            "timestamp": cls._last_scan_time,
            "metadata": cls._scan_metadata,
            "total_opportunities": len(cls._cached_results),
        }
