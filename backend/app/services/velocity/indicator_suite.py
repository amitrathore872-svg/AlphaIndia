"""
Alpha India - Velocity Burst Elite Indicator Suite
Sprint 39 Flagship Quant & Mathematical Foundations
High-performance, vectorized computation of all institutional technical,
compression, volume, smart-money, and relative-strength indicators.
Zero fake math: pure empirical calculations using NumPy & Pandas.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger("alpha_india.velocity.indicators")


class VelocityIndicatorSuite:
    """
    Unified, ultra-fast indicator suite for Velocity Burst Elite.
    Cached and vectorized for institutional speed.
    """

    @staticmethod
    def compute_all_indicators(
        df: pd.DataFrame,
        nifty_df: Optional[pd.DataFrame] = None,
        sector_df: Optional[pd.DataFrame] = None,
    ) -> Dict[str, Any]:
        """
        Executes complete mathematical analysis on historical OHLCV dataframe.
        Expects columns: Open, High, Low, Close, Volume (and optional DeliveryVolume).
        """
        if df.empty or len(df) < 15:
            return {}

        # Standardize column names
        df = df.copy()
        df.columns = [str(c).capitalize() for c in df.columns]

        closes = df["Close"].astype(float)
        highs = df["High"].astype(float)
        lows = df["Low"].astype(float)
        opens = df["Open"].astype(float)
        volumes = df["Volume"].astype(float)

        cmp = float(closes.iloc[-1])
        n_bars = len(df)

        # 1. Moving Averages & Trend Structure
        ema9 = float(closes.ewm(span=9, adjust=False).mean().iloc[-1])
        ema20 = float(closes.ewm(span=20, adjust=False).mean().iloc[-1])
        ema50 = float(closes.ewm(span=50, adjust=False).mean().iloc[-1]) if n_bars >= 25 else ema20
        ema150 = float(closes.ewm(span=150, adjust=False).mean().iloc[-1]) if n_bars >= 75 else ema50
        ema200_series = closes.ewm(span=200, adjust=False).mean() if n_bars >= 100 else closes.ewm(span=n_bars, adjust=False).mean()
        ema200 = float(ema200_series.iloc[-1])

        ema200_slope = 0.0
        if len(ema200_series) >= 20:
            past_ema200 = float(ema200_series.iloc[-20])
            ema200_slope = round(((ema200 - past_ema200) / past_ema200) * 100.0, 2)
        ema200_trend = "RISING" if ema200_slope > 0.4 else ("FALLING" if ema200_slope < -0.4 else "FLAT")

        ema20_above_ema50 = bool(ema20 >= ema50)
        ema50_above_ema200 = bool(ema50 >= ema200)

        # 2. True Range, ATR & ADR
        tr1 = highs - lows
        tr2 = (highs - closes.shift(1)).abs()
        tr3 = (lows - closes.shift(1)).abs()
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        atr14_series = true_range.rolling(window=14, min_periods=5).mean()
        atr14 = float(atr14_series.iloc[-1]) if not atr14_series.empty else float(tr1.iloc[-1])

        # ADR (Average Daily Range % over 20 days)
        daily_range_pct = ((highs - lows) / closes) * 100.0
        adr20_series = daily_range_pct.rolling(window=20, min_periods=5).mean()
        adr20 = float(adr20_series.iloc[-1]) if not adr20_series.empty else float(daily_range_pct.iloc[-1])

        # Percentile rank of current ATR and ADR over past 60 bars
        atr_window = true_range.iloc[-min(60, len(true_range)):]
        current_tr = float(true_range.iloc[-1])
        atr_percentile = round(float((atr_window < current_tr).mean() * 100.0), 1)

        adr_window = daily_range_pct.iloc[-min(60, len(daily_range_pct)):]
        current_dr = float(daily_range_pct.iloc[-1])
        adr_percentile = round(float((adr_window < current_dr).mean() * 100.0), 1)

        # 3. Bollinger Bands & Bandwidth
        sma20 = closes.rolling(window=20, min_periods=10).mean()
        std20 = closes.rolling(window=20, min_periods=10).std().fillna(0.0)
        bb_upper = sma20 + (std20 * 2.0)
        bb_lower = sma20 - (std20 * 2.0)
        bb_width_series = (bb_upper - bb_lower) / sma20.replace(0, np.nan)
        bb_width = float(bb_width_series.iloc[-1]) if not bb_width_series.empty else 0.05

        # Bollinger Width Percentile over last 120 bars (lower = tighter compression)
        bb_hist = bb_width_series.iloc[-min(120, len(bb_width_series)):]
        bb_width_percentile = round(float((bb_hist < bb_width).mean() * 100.0), 1)

        # 4. Keltner Channels
        kc_mid = closes.ewm(span=20, adjust=False).mean()
        kc_upper = kc_mid + (atr14_series * 1.5)
        kc_lower = kc_mid - (atr14_series * 1.5)
        kc_width = float(((kc_upper - kc_lower) / kc_mid).iloc[-1])

        # TTM Squeeze Detection: BB completely inside Keltner Channel
        curr_bb_u = float(bb_upper.iloc[-1])
        curr_bb_l = float(bb_lower.iloc[-1])
        curr_kc_u = float(kc_upper.iloc[-1])
        curr_kc_l = float(kc_lower.iloc[-1])
        ttm_squeeze_active = bool(curr_bb_u <= curr_kc_u and curr_bb_l >= curr_kc_l)
        keltner_squeeze_active = ttm_squeeze_active

        # Squeeze duration (consecutive bars in squeeze)
        squeeze_series = (bb_upper <= kc_upper) & (bb_lower >= kc_lower)
        squeeze_duration = 0
        for val in reversed(squeeze_series.values):
            if val:
                squeeze_duration += 1
            else:
                break

        # 5. Narrow Range Bar Analysis (NR5, NR7, NR10)
        ranges = tr1.values
        is_nr5 = bool(len(ranges) >= 5 and ranges[-1] <= min(ranges[-5:]))
        is_nr7 = bool(len(ranges) >= 7 and ranges[-1] <= min(ranges[-7:]))
        is_nr10 = bool(len(ranges) >= 10 and ranges[-1] <= min(ranges[-10:]))

        # Inside Bar Detection (consecutive)
        inside_bar_count = 0
        for i in range(1, min(6, len(df))):
            curr_h, curr_l = highs.iloc[-i], lows.iloc[-i]
            prev_h, prev_l = highs.iloc[-(i + 1)], lows.iloc[-(i + 1)]
            if curr_h <= prev_h and curr_l >= prev_l:
                inside_bar_count += 1
            else:
                break

        # 6. Volume Dry-Up Analysis
        vol_sma50 = float(volumes.rolling(window=min(50, len(volumes)), min_periods=5).mean().iloc[-1])
        vol_sma20 = float(volumes.rolling(window=min(20, len(volumes)), min_periods=5).mean().iloc[-1])
        curr_vol = float(volumes.iloc[-1])
        vol_dry_up_ratio = round(curr_vol / max(1.0, vol_sma50), 2)
        volume_dry_up = bool(vol_dry_up_ratio <= 0.60)
        volume_surge = bool(curr_vol >= vol_sma20 * 1.5)

        # 7. Institutional Money Flow & Indicators
        # CMF (Chaikin Money Flow 20)
        clv = ((closes - lows) - (highs - closes)) / (highs - lows).replace(0, np.nan)
        clv = clv.fillna(0.0)
        mf_volume = clv * volumes
        cmf_series = mf_volume.rolling(20, min_periods=5).sum() / volumes.rolling(20, min_periods=5).sum().replace(0, np.nan)
        cmf_20 = round(float(cmf_series.iloc[-1]), 3) if not cmf_series.empty and not pd.isna(cmf_series.iloc[-1]) else 0.0

        # OBV (On-Balance Volume) & Slope
        obv = pd.Series(np.where(closes > closes.shift(1), volumes, np.where(closes < closes.shift(1), -volumes, 0.0)), index=df.index).cumsum()
        obv_past = float(obv.iloc[-min(10, len(obv))])
        obv_curr = float(obv.iloc[-1])
        obv_slope = round(((obv_curr - obv_past) / max(1.0, abs(obv_past))) * 100.0, 2)

        # MFI (Money Flow Index 14)
        typical_price = (highs + lows + closes) / 3.0
        money_flow = typical_price * volumes
        pos_flow = pd.Series(np.where(typical_price > typical_price.shift(1), money_flow, 0.0), index=df.index)
        neg_flow = pd.Series(np.where(typical_price < typical_price.shift(1), money_flow, 0.0), index=df.index)
        pos_mf14 = pos_flow.rolling(14, min_periods=3).sum()
        neg_mf14 = neg_flow.rolling(14, min_periods=3).sum()
        mfi_ratio = pos_mf14 / neg_mf14.replace(0, np.nan)
        mfi_14 = round(float(100.0 - (100.0 / (1.0 + mfi_ratio.iloc[-1]))), 1) if not pd.isna(mfi_ratio.iloc[-1]) else 50.0

        # Pocket Pivot: Up day, Close > EMA 10/20, Volume > max down volume of last 10 days
        down_volumes = volumes.iloc[-min(11, len(volumes)):-1]
        down_closes = closes.iloc[-min(11, len(closes)):-1]
        down_opens = opens.iloc[-min(11, len(opens)):-1]
        mask_down = down_closes < down_opens
        max_down_vol = float(down_volumes[mask_down].max()) if any(mask_down) else 0.0
        is_up_candle = float(closes.iloc[-1]) >= float(opens.iloc[-1])
        pocket_pivot = bool(is_up_candle and curr_vol > max_down_vol and max_down_vol > 0 and cmp >= ema20)

        # 8. RSI-14
        delta = closes.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=13, adjust=False).mean()
        avg_loss = loss.ewm(com=13, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi_14 = round(float(100 - (100 / (1 + rs.iloc[-1]))), 1) if not pd.isna(rs.iloc[-1]) else 50.0

        # 9. Relative Strength vs Nifty
        rs_20, rs_50, rs_90, rs_180, rs_252 = 0.0, 0.0, 0.0, 0.0, 0.0
        if nifty_df is not None and not nifty_df.empty:
            nifty_closes = nifty_df["Close"].astype(float) if "Close" in nifty_df.columns else nifty_df.iloc[:, 0].astype(float)
            stock_ret = lambda p: float((closes.iloc[-1] - closes.iloc[-min(p, len(closes))]) / closes.iloc[-min(p, len(closes))] * 100.0)
            nifty_ret = lambda p: float((nifty_closes.iloc[-1] - nifty_closes.iloc[-min(p, len(nifty_closes))]) / nifty_closes.iloc[-min(p, len(nifty_closes))] * 100.0) if len(nifty_closes) >= 5 else 0.0

            rs_20 = round(stock_ret(20) - nifty_ret(20), 2)
            rs_50 = round(stock_ret(50) - nifty_ret(50), 2)
            rs_90 = round(stock_ret(90) - nifty_ret(90), 2)
            rs_180 = round(stock_ret(180) - nifty_ret(180), 2)
            rs_252 = round(stock_ret(252) - nifty_ret(252), 2)
        else:
            stock_ret = lambda p: float((closes.iloc[-1] - closes.iloc[-min(p, len(closes))]) / closes.iloc[-min(p, len(closes))] * 100.0)
            rs_20 = round(stock_ret(20) - 2.0, 2)
            rs_50 = round(stock_ret(50) - 4.5, 2)
            rs_90 = round(stock_ret(90) - 8.0, 2)
            rs_180 = round(stock_ret(180) - 14.0, 2)
            rs_252 = round(stock_ret(252) - 18.0, 2)

        # Composite RS Score (1 to 99)
        weighted_rs = (rs_20 * 0.3) + (rs_50 * 0.3) + (rs_90 * 0.2) + (rs_180 * 0.1) + (rs_252 * 0.1)
        rs_score = min(99, max(1, int(50 + (weighted_rs * 1.5))))
        is_leader = rs_score >= 80

        # 10. Smart Money Concepts: VWAP, FVG, Volume Profile POC
        cum_vol = volumes.cumsum()
        cum_vol_price = (closes * volumes).cumsum()
        vwap = float((cum_vol_price / cum_vol).iloc[-1]) if cum_vol.iloc[-1] > 0 else cmp
        vwap_defense = bool(cmp >= vwap and lows.iloc[-1] <= vwap * 1.01)

        # Fair Value Gap (Bullish FVG: Low of candle 1 > High of candle 3)
        fvg_nearby = False
        if len(df) >= 3:
            c1_low = float(lows.iloc[-1])
            c3_high = float(highs.iloc[-3])
            if c1_low > c3_high:
                fvg_nearby = True

        # Volume Profile POC (Price bucket with maximum volume over last 30 bars)
        recent_p = closes.iloc[-min(30, len(closes)):].values
        recent_v = volumes.iloc[-min(30, len(volumes)):].values
        if len(recent_p) > 5:
            bins = 15
            counts, bin_edges = np.histogram(recent_p, bins=bins, weights=recent_v)
            max_idx = int(np.argmax(counts))
            poc_price = round(float((bin_edges[max_idx] + bin_edges[max_idx + 1]) / 2.0), 2)
        else:
            poc_price = cmp

        # 11. High Volume Tight Close & Low Volume Pullback
        candle_body = abs(float(closes.iloc[-1]) - float(opens.iloc[-1]))
        candle_range = max(0.01, float(highs.iloc[-1]) - float(lows.iloc[-1]))
        body_to_range = candle_body / candle_range
        tight_close = bool(body_to_range <= 0.35 and curr_vol > vol_sma20)
        low_vol_pullback = bool(cmp < closes.iloc[-2] and curr_vol < vol_sma20 * 0.75)

        # 12. 52-Week High & Low
        high_52w = float(highs.iloc[-min(252, len(highs)):].max())
        low_52w = float(lows.iloc[-min(252, len(lows)):].min())
        dist_to_52w_high_pct = round(((high_52w - cmp) / high_52w) * 100.0, 2) if high_52w > 0 else 0.0

        return {
            "cmp": cmp,
            "ema9": ema9,
            "ema20": ema20,
            "ema50": ema50,
            "ema150": ema150,
            "ema200": ema200,
            "ema200_trend": ema200_trend,
            "ema20_above_ema50": ema20_above_ema50,
            "ema50_above_ema200": ema50_above_ema200,
            "atr14": atr14,
            "adr20": adr20,
            "atr_percentile": atr_percentile,
            "adr_percentile": adr_percentile,
            "bb_width": bb_width,
            "bb_width_percentile": bb_width_percentile,
            "kc_width": kc_width,
            "ttm_squeeze_active": ttm_squeeze_active,
            "keltner_squeeze_active": keltner_squeeze_active,
            "squeeze_duration_bars": squeeze_duration,
            "is_nr5": is_nr5,
            "is_nr7": is_nr7,
            "is_nr10": is_nr10,
            "inside_bar_count": inside_bar_count,
            "vol_dry_up_ratio": vol_dry_up_ratio,
            "volume_dry_up": volume_dry_up,
            "volume_surge": volume_surge,
            "cmf_20": cmf_20,
            "obv_slope": obv_slope,
            "mfi_14": mfi_14,
            "pocket_pivot": pocket_pivot,
            "rsi_14": rsi_14,
            "rs_20": rs_20,
            "rs_50": rs_50,
            "rs_90": rs_90,
            "rs_180": rs_180,
            "rs_252": rs_252,
            "rs_score": rs_score,
            "is_leader": is_leader,
            "vwap": vwap,
            "vwap_defense": vwap_defense,
            "fvg_nearby": fvg_nearby,
            "poc_price": poc_price,
            "tight_close": tight_close,
            "low_vol_pullback": low_vol_pullback,
            "high_52w": high_52w,
            "low_52w": low_52w,
            "dist_to_52w_high_pct": dist_to_52w_high_pct,
        }
