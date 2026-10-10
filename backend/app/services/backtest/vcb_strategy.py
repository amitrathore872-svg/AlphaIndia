"""
Alpha India - VCB (Volatility Compression Breakout) Strategies
Sprint 43.1 Baseline Quantitative Rule Engine

Implements:
1. VCBBreakoutStrategy: Exact 9-rule Volatility Compression Breakout (5-minute timeframe)
2. VCBEarlyStrategy: Exact 8-rule Pre-Breakout Compression Scanner

Includes independent rule calculation, zero look-ahead bias, and full diagnostic logging.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.services.backtest.strategy_interface import BaseStrategy, StrategySignal

logger = logging.getLogger("alpha_india.backtest.vcb")


class VCBBreakoutStrategy(BaseStrategy):
    """
    Exact 9-Rule Volatility Compression Breakout (5-Minute Timeframe).
    Baseline implementation without rule modification.
    """

    def strategy_metadata(self) -> Dict[str, Any]:
        return {
            "name": "VCB_BREAKOUT",
            "timeframe": "5m",
            "description": "Volatility Compression Breakout (9 Strict Baseline Rules)",
            "rules": [
                "Rule 1: Close > Previous 12-bar High",
                "Rule 2: Current Volume > 2.0x Previous 20-bar Avg Volume (Breakout bar excluded from baseline)",
                "Rule 3: Green Candle (Close > Open)",
                "Rule 4: Close near High (Within top 25% of candle range)",
                "Rule 5: Close > Intraday VWAP",
                "Rule 6: Previous 12-bar Range < 2.0% of Previous Close",
                "Rule 7: Previous ATR(14) < 70% of Previous ATR(14) 50-SMA",
                "Rule 8: Previous 5-bar SMA Volume < 80% of Previous 20-bar SMA Volume",
                "Rule 9: Close < 1.01x Previous Resistance (Don't chase extended)",
            ],
            "default_parameters": {
                "resistance_bars": 12,
                "volume_expansion_factor": 2.0,
                "volume_baseline_bars": 20,
                "close_location_pct": 0.25,
                "compression_range_pct": 0.02,
                "atr_period": 14,
                "atr_sma_period": 50,
                "atr_compression_ratio": 0.70,
                "volume_contraction_ratio": 0.80,
                "max_extension_pct": 0.01,
            },
        }

    def prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        work_df = df.copy()
        col_map = {c: c.capitalize() for c in work_df.columns}
        work_df.rename(columns=col_map, inplace=True)
        if "Datetime" in work_df.columns:
            work_df["Datetime"] = pd.to_datetime(work_df["Datetime"])
            work_df.sort_values(by="Datetime", ascending=True, inplace=True)
            work_df.reset_index(drop=True, inplace=True)
        return work_df

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates all indicators strictly using backwards-looking rolling windows.
        Zero future information leakage.
        """
        data = df.copy()

        # 1. Intraday VWAP (Reset at 09:15 each trading day)
        date_series = data["Datetime"].dt.date
        pv = data["Close"] * data["Volume"]
        cum_pv = pv.groupby(date_series).cumsum()
        cum_vol = data["Volume"].groupby(date_series).cumsum()
        data["VWAP"] = cum_pv / np.maximum(1.0, cum_vol)

        # 2. Previous 12-bar High & Low (Shifted by 1 so current bar is excluded)
        # Shift 1 means bar t-1 is the most recent bar in rolling window
        data["Prev_12_High"] = data["High"].shift(1).rolling(window=12, min_periods=12).max()
        data["Prev_12_Low"] = data["Low"].shift(1).rolling(window=12, min_periods=12).min()

        # 3. Volume Baselines (Shifted by 1 so current bar is excluded)
        data["Prev_Vol_SMA20"] = data["Volume"].shift(1).rolling(window=20, min_periods=20).mean()
        data["Prev_Vol_SMA5"] = data["Volume"].shift(1).rolling(window=5, min_periods=5).mean()

        # 4. True Range & ATR(14)
        prev_close = data["Close"].shift(1)
        tr1 = data["High"] - data["Low"]
        tr2 = (data["High"] - prev_close).abs()
        tr3 = (data["Low"] - prev_close).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        data["ATR14"] = tr.rolling(window=14, min_periods=14).mean()

        # 5. ATR Baseline: 50-period SMA of ATR14 (Shifted by 1 so previous is evaluated)
        data["Prev_ATR14"] = data["ATR14"].shift(1)
        data["Prev_ATR14_SMA50"] = data["ATR14"].shift(1).rolling(window=50, min_periods=50).mean()

        # 6. Previous Close for range compression baseline
        data["Prev_Close"] = data["Close"].shift(1)

        return data

    def generate_signals(self, df: pd.DataFrame, symbol: str) -> List[StrategySignal]:
        prepared_df = self.prepare_data(df)
        ind_df = self.calculate_indicators(prepared_df)

        signals: List[StrategySignal] = []
        n = len(ind_df)
        if n < 65:  # Need at least 50+14 bars for indicator stabilization
            return signals

        # Extract numpy arrays for high-speed deterministic evaluation
        closes = ind_df["Close"].values
        opens = ind_df["Open"].values
        highs = ind_df["High"].values
        lows = ind_df["Low"].values
        volumes = ind_df["Volume"].values
        vwaps = ind_df["VWAP"].values
        timestamps = ind_df["Datetime"]

        prev_12_highs = ind_df["Prev_12_High"].values
        prev_12_lows = ind_df["Prev_12_Low"].values
        prev_vol_sma20 = ind_df["Prev_Vol_SMA20"].values
        prev_vol_sma5 = ind_df["Prev_Vol_SMA5"].values
        prev_atr14 = ind_df["Prev_ATR14"].values
        prev_atr14_sma50 = ind_df["Prev_ATR14_SMA50"].values
        prev_closes = ind_df["Prev_Close"].values

        # Parameters
        vol_expansion_factor = self.parameters.get("volume_expansion_factor", 2.0)
        close_loc_threshold = self.parameters.get("close_location_pct", 0.25)
        compression_range_pct = self.parameters.get("compression_range_pct", 0.02)
        atr_comp_ratio = self.parameters.get("atr_compression_ratio", 0.70)
        vol_contraction_ratio = self.parameters.get("volume_contraction_ratio", 0.80)
        max_extension_pct = self.parameters.get("max_extension_pct", 0.01)

        for i in range(60, n):
            c_close = closes[i]
            c_open = opens[i]
            c_high = highs[i]
            c_low = lows[i]
            c_vol = volumes[i]
            c_vwap = vwaps[i]
            c_range = c_high - c_low

            p_res = prev_12_highs[i]
            p_low12 = prev_12_lows[i]
            p_v20 = prev_vol_sma20[i]
            p_v5 = prev_vol_sma5[i]
            p_atr = prev_atr14[i]
            p_atr_sma = prev_atr14_sma50[i]
            p_close = prev_closes[i]

            # Ensure previous baseline is valid (not NaN)
            if np.isnan(p_res) or np.isnan(p_v20) or np.isnan(p_atr_sma) or p_v20 <= 0 or p_close <= 0:
                continue

            # =========================================================
            # INDEPENDENT 9 RULES EVALUATION
            # =========================================================

            # Rule 1: Breakout
            rule_1 = bool(c_close > p_res)

            # Rule 2: Breakout Volume (2x previous 20-bar avg, breakout bar excluded)
            rule_2 = bool(c_vol > (p_v20 * vol_expansion_factor))

            # Rule 3: Green Candle
            rule_3 = bool(c_close > c_open)

            # Rule 4: Close Near High (Top 25% of candle range)
            if c_range > 0:
                rule_4 = bool((c_high - c_close) < (c_range * close_loc_threshold))
            else:
                rule_4 = False

            # Rule 5: VWAP
            rule_5 = bool(c_close > c_vwap)

            # Rule 6: Previous Range Compression (< 2% of previous close)
            p_12_range = p_res - p_low12
            rule_6 = bool(p_12_range < (p_close * compression_range_pct))

            # Rule 7: Previous ATR Compression (< 70% of 50-SMA)
            rule_7 = bool(p_atr < (p_atr_sma * atr_comp_ratio)) if p_atr_sma > 0 else False

            # Rule 8: Previous Volume Contraction (5-SMA < 80% of 20-SMA)
            rule_8 = bool(p_v5 < (p_v20 * vol_contraction_ratio))

            # Rule 9: Don't Chase Extended Breakout (< 1% above previous resistance)
            rule_9 = bool(c_close < (p_res * (1.0 + max_extension_pct)))

            rule_diagnostics = {
                "rule_1_breakout": rule_1,
                "rule_2_volume": rule_2,
                "rule_3_green": rule_3,
                "rule_4_close_near_high": rule_4,
                "rule_5_vwap": rule_5,
                "rule_6_range_compression": rule_6,
                "rule_7_atr_compression": rule_7,
                "rule_8_volume_contraction": rule_8,
                "rule_9_not_extended": rule_9,
            }

            all_passed = (
                rule_1 and rule_2 and rule_3 and rule_4 and rule_5
                and rule_6 and rule_7 and rule_8 and rule_9
            )

            if all_passed:
                ts = timestamps.iloc[i]
                vol_ratio = float(c_vol / max(1.0, p_v20))
                comp_pct = float((p_12_range / p_close) * 100.0) if p_close > 0 else 0.0
                close_loc = float(((c_close - c_low) / max(0.01, c_range)) * 100.0) if c_range > 0 else 100.0
                ext_pct = float(((c_close - p_res) / max(0.01, p_res)) * 100.0)

                sig = StrategySignal(
                    symbol=symbol,
                    timestamp=ts,
                    strategy="VCB_BREAKOUT",
                    timeframe="5m",
                    signal_type="BREAKOUT",
                    entry_price=float(c_close),
                    resistance=float(p_res),
                    stop_loss=float(p_res),  # Breakout support retest level
                    target_1=float(c_close * 1.01),
                    target_2=float(c_close * 1.02),
                    vwap=float(c_vwap),
                    atr=float(p_atr),
                    volume_ratio=vol_ratio,
                    compression_pct=comp_pct,
                    close_location_pct=close_loc,
                    extension_pct=ext_pct,
                    rule_diagnostics=rule_diagnostics,
                    metadata={"candle_index": int(i)},
                )
                signals.append(sig)

        return signals


class VCBEarlyStrategy(BaseStrategy):
    """
    Exact 8-Rule Pre-Breakout VCB Early Compression Scanner.
    Detects equities preparing for expansion before breakout occurs.
    """

    def strategy_metadata(self) -> Dict[str, Any]:
        return {
            "name": "VCB_EARLY",
            "timeframe": "5m",
            "description": "Pre-Breakout Coiling Scanner (8 Strict Rules)",
            "rules": [
                "Rule 1: Previous 12-bar range < 2% of current close",
                "Rule 2: ATR(14) < SMA(ATR14, 50) * 0.70",
                "Rule 3: SMA(volume, 5) < SMA(volume, 20) * 0.80",
                "Rule 4: Current close is in upper 40% of 12-bar range",
                "Rule 5: Current close within 0.3% of previous 12-bar resistance",
                "Rule 6: Current close remains below previous resistance",
                "Rule 7: Current close > VWAP",
                "Rule 8: Average 20-bar traded value > ₹500,000",
            ],
            "default_parameters": {
                "resistance_bars": 12,
                "compression_range_pct": 0.02,
                "atr_comp_ratio": 0.70,
                "volume_contraction_ratio": 0.80,
                "upper_range_pct": 0.40,
                "proximity_pct": 0.003,
                "min_traded_value_inr": 500000.0,
            },
        }

    def prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        work_df = df.copy()
        col_map = {c: c.capitalize() for c in work_df.columns}
        work_df.rename(columns=col_map, inplace=True)
        if "Datetime" in work_df.columns:
            work_df["Datetime"] = pd.to_datetime(work_df["Datetime"])
            work_df.sort_values(by="Datetime", ascending=True, inplace=True)
            work_df.reset_index(drop=True, inplace=True)
        return work_df

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        data = df.copy()
        date_series = data["Datetime"].dt.date
        pv = data["Close"] * data["Volume"]
        cum_pv = pv.groupby(date_series).cumsum()
        cum_vol = data["Volume"].groupby(date_series).cumsum()
        data["VWAP"] = cum_pv / np.maximum(1.0, cum_vol)

        data["Prev_12_High"] = data["High"].shift(1).rolling(window=12, min_periods=12).max()
        data["Prev_12_Low"] = data["Low"].shift(1).rolling(window=12, min_periods=12).min()

        data["Vol_SMA20"] = data["Volume"].shift(1).rolling(window=20, min_periods=20).mean()
        data["Vol_SMA5"] = data["Volume"].shift(1).rolling(window=5, min_periods=5).mean()

        # Traded Value SMA20
        traded_val = data["Close"] * data["Volume"]
        data["Traded_Val_SMA20"] = traded_val.shift(1).rolling(window=20, min_periods=20).mean()

        prev_close = data["Close"].shift(1)
        tr1 = data["High"] - data["Low"]
        tr2 = (data["High"] - prev_close).abs()
        tr3 = (data["Low"] - prev_close).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        data["ATR14"] = tr.rolling(window=14, min_periods=14).mean()
        data["ATR14_SMA50"] = data["ATR14"].shift(1).rolling(window=50, min_periods=50).mean()
        data["Prev_ATR14"] = data["ATR14"].shift(1)

        return data

    def generate_signals(self, df: pd.DataFrame, symbol: str) -> List[StrategySignal]:
        prepared_df = self.prepare_data(df)
        ind_df = self.calculate_indicators(prepared_df)

        signals: List[StrategySignal] = []
        n = len(ind_df)
        if n < 65:
            return signals

        closes = ind_df["Close"].values
        vwaps = ind_df["VWAP"].values
        timestamps = ind_df["Datetime"]
        prev_12_highs = ind_df["Prev_12_High"].values
        prev_12_lows = ind_df["Prev_12_Low"].values
        prev_v20 = ind_df["Vol_SMA20"].values
        prev_v5 = ind_df["Vol_SMA5"].values
        traded_vals = ind_df["Traded_Val_SMA20"].values
        prev_atr = ind_df["Prev_ATR14"].values
        prev_atr_sma = ind_df["ATR14_SMA50"].values

        min_val = self.parameters.get("min_traded_value_inr", 500000.0)

        for i in range(60, n):
            c_close = closes[i]
            c_vwap = vwaps[i]
            p_res = prev_12_highs[i]
            p_low = prev_12_lows[i]
            p_v_20 = prev_v20[i]
            p_v_5 = prev_v5[i]
            p_tv = traded_vals[i]
            p_at = prev_atr[i]
            p_at_sma = prev_atr_sma[i]

            if np.isnan(p_res) or np.isnan(p_at_sma) or p_res <= 0:
                continue

            range_12 = p_res - p_low

            # Rule 1: 12-bar range < 2% of current close
            rule_1 = bool(range_12 < (c_close * 0.02))

            # Rule 2: ATR(14) < SMA(ATR14, 50) * 0.70
            rule_2 = bool(p_at < (p_at_sma * 0.70)) if p_at_sma > 0 else False

            # Rule 3: SMA(volume, 5) < SMA(volume, 20) * 0.80
            rule_3 = bool(p_v_5 < (p_v_20 * 0.80)) if p_v_20 > 0 else False

            # Rule 4: Current close is in upper 40% of 12-bar range
            # (i.e. distance from 12-bar high is <= 40% of range)
            if range_12 > 0:
                rule_4 = bool((p_res - c_close) <= (range_12 * 0.40))
            else:
                rule_4 = False

            # Rule 5: Current close within 0.3% of previous 12-bar resistance
            dist_to_res = p_res - c_close
            rule_5 = bool(0 <= dist_to_res <= (p_res * 0.003))

            # Rule 6: Current close remains below previous resistance
            rule_6 = bool(c_close < p_res)

            # Rule 7: Current close > VWAP
            rule_7 = bool(c_close > c_vwap)

            # Rule 8: Average 20-bar traded value > ₹500,000
            rule_8 = bool(p_tv >= min_val)

            rule_diagnostics = {
                "rule_1_range_compression": rule_1,
                "rule_2_atr_compression": rule_2,
                "rule_3_volume_contraction": rule_3,
                "rule_4_upper_range": rule_4,
                "rule_5_proximity_resistance": rule_5,
                "rule_6_below_resistance": rule_6,
                "rule_7_vwap": rule_7,
                "rule_8_liquidity_value": rule_8,
            }

            all_passed = (
                rule_1 and rule_2 and rule_3 and rule_4 and
                rule_5 and rule_6 and rule_7 and rule_8
            )

            if all_passed:
                ts = timestamps.iloc[i]
                signals.append(
                    StrategySignal(
                        symbol=symbol,
                        timestamp=ts,
                        strategy="VCB_EARLY",
                        timeframe="5m",
                        signal_type="EARLY_COMPRESSION",
                        entry_price=float(c_close),
                        resistance=float(p_res),
                        stop_loss=float(p_low),
                        target_1=float(p_res * 1.01),
                        target_2=float(p_res * 1.02),
                        vwap=float(c_vwap),
                        atr=float(p_at),
                        volume_ratio=float(p_v_5 / max(1.0, p_v_20)),
                        compression_pct=float((range_12 / c_close) * 100.0),
                        close_location_pct=float(((c_close - p_low) / max(0.01, range_12)) * 100.0),
                        extension_pct=0.0,
                        rule_diagnostics=rule_diagnostics,
                        metadata={"candle_index": int(i)},
                    )
                )

        return signals
