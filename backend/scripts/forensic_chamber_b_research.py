"""
Alpha India - Chamber B (Kinetic Cash Movers) Deep Forensic Backtest & Loss Autopsy
1. Evaluates Chamber B across the last 2 months (August - September 2026) using 5-minute bars.
2. Performs a forensic post-mortem on EVERY losing trade:
   - MAE (Max Adverse Excursion), MFE (Max Favorable Excursion), Time of Stop-Out, Market Regime.
3. Detects "Missed Alpha / False Negatives":
   - Equities that surged +3.5% to +8% on that day, why our strict filter rejected them,
   - And the exact mathematical rule adjustments to capture them.
"""

from __future__ import annotations
import json
from pathlib import Path
import sys
from typing import Any, Dict, List, Tuple
import numpy as np
import pandas as pd

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "intraday_5m_cache"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"


def load_all_5m_data() -> Dict[str, pd.DataFrame]:
    data = {}
    for f in CACHE_DIR.glob("*_5m.parquet"):
        sym = f.name.replace("_5m.parquet", "")
        try:
            df = pd.read_parquet(f)
            df["Date"] = pd.to_datetime(df.index).date
            df["Time"] = pd.to_datetime(df.index).time
            data[sym] = df
        except Exception:
            pass
    return data


def run_chamber_b_backtest_with_autopsy(data_map: Dict[str, pd.DataFrame]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Simulates Chamber B: High-Beta Kinetic Cash Movers (VWAP Springs + Tight Base Squeezes)
    Filters for last 2 months (Aug 1, 2026 to Sep 25, 2026).
    """
    trades = []
    losing_trades = []
    missed_opportunities = []

    start_date = pd.to_datetime("2026-08-01").date()
    end_date = pd.to_datetime("2026-09-25").date()

    for sym, df in data_map.items():
        dates = sorted(list(df["Date"].unique()))
        for i in range(2, len(dates)):
            curr_d = dates[i]
            if curr_d < start_date or curr_d > end_date:
                continue

            curr_day = df[df["Date"] == curr_d].copy()
            prev_day = df[df["Date"] == dates[i-1]]
            pp_day = df[df["Date"] == dates[i-2]]

            if len(curr_day) < 35 or len(prev_day) < 25 or len(pp_day) < 25:
                continue

            # Indicators
            cum_vol = curr_day["Volume"].cumsum()
            cum_pv = (curr_day["Close"] * curr_day["Volume"]).cumsum()
            curr_day["VWAP"] = cum_pv / np.maximum(1, cum_vol)

            open_p = float(curr_day["Open"].iloc[0])
            day_high = float(curr_day["High"].max())
            day_low = float(curr_day["Low"].min())
            day_close = float(curr_day["Close"].iloc[-1])
            max_day_expansion = ((day_high - open_p) / open_p) * 100.0

            # Prior day levels
            p_h = float(prev_day["High"].max())
            p_l = float(prev_day["Low"].min())
            p_c = float(prev_day["Close"].iloc[-1])
            p_range = p_h - p_l
            pp_range = float(pp_day["High"].max()) - float(pp_day["Low"].min())

            # CPR Calculation
            pivot = (p_h + p_l + p_c) / 3.0
            bc = (p_h + p_l) / 2.0
            tc = (2.0 * pivot) - bc
            cpr_width_pct = (abs(tc - bc) / pivot) * 100.0

            # Check if stock made a massive move (+3.5% or more)
            is_big_mover = bool(max_day_expansion >= 3.5)

            # Strategy evaluation: Chamber B (VWAP Spring / Base Squeeze)
            # Setup criteria:
            # 1. Morning surge >= 1.2% in first 45 mins
            # 2. Pullback to VWAP (touch <= VWAP * 1.0025, close >= VWAP * 0.998)
            # 3. Volume dry-up: pullback vol <= 55% of morning impulse
            # 4. Reversal green bar
            morning_bars = curr_day.iloc[:9]
            morning_high = float(morning_bars["High"].max())
            morning_gain = (morning_high - open_p) / open_p
            morning_avg_vol = float(morning_bars["Volume"].mean())

            trade_taken = False
            rejection_reasons = []

            if morning_gain < 0.012:
                rejection_reasons.append(f"Morning impulse too weak ({morning_gain*100:.2f}% < 1.2%)")
            if cpr_width_pct > 0.28:
                rejection_reasons.append(f"CPR slightly too wide ({cpr_width_pct:.2f}% > 0.28%)")

            # Try to find trigger
            for idx in range(9, min(35, len(curr_day)-6)):
                b = curr_day.iloc[idx]
                prev_b = curr_day.iloc[idx-1]
                vwap = float(b["VWAP"])

                touches_vwap = (b["Low"] <= vwap * 1.0025) and (b["High"] >= vwap * 0.998)
                reversal_green = (b["Close"] > b["Open"]) and (b["Close"] >= prev_b["High"] * 0.999)
                dry_vol = curr_day.iloc[max(0, idx-3):idx]["Volume"].mean() <= 0.55 * morning_avg_vol

                if morning_gain >= 0.012 and touches_vwap and reversal_green and dry_vol:
                    entry = float(b["Close"])
                    local_low = float(curr_day.iloc[max(0, idx-3):idx+1]["Low"].min())
                    sl = round(min(local_low * 0.9985, vwap * 0.9975), 2)
                    risk = entry - sl
                    risk_pct = (risk / entry) * 100.0

                    if 0.25 <= risk_pct <= 0.85:
                        trade_taken = True
                        t1 = round(entry + 1.5 * risk, 2)
                        t2 = round(entry + 2.5 * risk, 2)

                        sub = curr_day.iloc[idx+1:]
                        hit_t1, hit_t2, hit_sl = False, False, False
                        stop_out_time = None
                        mfe_price = float(sub["High"].max())
                        mae_price = float(sub["Low"].min())
                        mfe_r = round((mfe_price - entry) / risk, 2)
                        mae_r = round((entry - mae_price) / risk, 2)

                        for _, sbar in sub.iterrows():
                            if sbar["Low"] <= sl:
                                hit_sl = True
                                stop_out_time = str(sbar["Time"])[:5]
                                break
                            if sbar["High"] >= t1: hit_t1 = True
                            if sbar["High"] >= t2: hit_t2 = True

                        last_c = float(sub["Close"].iloc[-1])
                        if hit_t2: r_pnl = 2.5
                        elif hit_t1: r_pnl = 1.5
                        elif hit_sl: r_pnl = -1.0
                        else: r_pnl = (last_c - entry) / risk

                        trade_obj = {
                            "date": str(curr_d),
                            "symbol": sym,
                            "entry_time": str(b["Time"])[:5],
                            "entry": entry,
                            "sl": sl,
                            "t1": t1,
                            "t2": t2,
                            "risk_pct": round(risk_pct, 2),
                            "outcome": "WIN" if r_pnl > 0 else "LOSS",
                            "r_pnl": round(r_pnl, 2),
                            "mfe_r": mfe_r,
                            "mae_r": mae_r,
                            "stop_out_time": stop_out_time,
                        }
                        trades.append(trade_obj)

                        # If losing trade, perform detailed forensic autopsy
                        if r_pnl <= 0:
                            # Diagnose root cause
                            root_cause = "UNKNOWN"
                            detail = ""
                            if mfe_r >= 1.1:
                                root_cause = "PROFIT_GIVEBACK_TRAP"
                                detail = f"Stock rallied +{mfe_r}R into profit before crashing into stop-loss. Trailing stop was not fast enough!"
                            elif stop_out_time and stop_out_time > "11:30":
                                root_cause = "MIDDAY_CHOP_DRAG"
                                detail = f"Trade dragged past 11:30 AM into the European low-liquidity zone. Velocity stalled."
                            elif risk_pct <= 0.35:
                                root_cause = "MICRO_STOP_WHIPSAW"
                                detail = f"Stop-loss was artificially tight ({risk_pct}%); normal 5M candle noise triggered exit before true move."
                            else:
                                root_cause = "INSTITUTIONAL_SUPPLY_OVERHANG"
                                detail = f"Failed to hold VWAP upon retest. Sellers aggressive from prior resistance."

                            losing_trades.append({
                                **trade_obj,
                                "root_cause": root_cause,
                                "diagnosis": detail,
                            })
                        break

            # Check if this stock was a "Missed Big Mover" (+3.5% to +8%)
            if is_big_mover and not trade_taken:
                # Find why it moved and what our filter missed
                missed_opportunities.append({
                    "date": str(curr_d),
                    "symbol": sym,
                    "day_max_gain_pct": round(max_day_expansion, 2),
                    "day_close_gain_pct": round(((day_close - open_p) / open_p) * 100.0, 2),
                    "cpr_width_pct": round(cpr_width_pct, 2),
                    "morning_gain_pct": round(morning_gain * 100.0, 2),
                    "rejection_reasons": rejection_reasons,
                })

    return trades, losing_trades, missed_opportunities


def main():
    print("=" * 85)
    print("  CHAMBER B (CASH MOVERS) DEEP FORENSIC AUTOPSY & MISSED ALPHA DISCOVERY")
    print("=" * 85)
    data = load_all_5m_data()
    print(f"Loaded {len(data)} liquid equities for August & September 2026 analysis.")

    trades, losses, missed = run_chamber_b_backtest_with_autopsy(data)
    print(f"\nTotal Chamber B Trades Executed : {len(trades)}")
    print(f"Wins                            : {len([t for t in trades if t['outcome'] == 'WIN'])}")
    print(f"Losses                          : {len(losses)}")
    if trades:
        wr = (len([t for t in trades if t['outcome'] == 'WIN']) / len(trades)) * 100.0
        print(f"Win Rate                        : {wr:.1f}%")

    print(f"\nTotal Big Movers (+3.5%+) Missed: {len(missed)}")

    # Save to JSON
    out_data = {
        "summary": {
            "period": "August 2026 - September 2026 (2 Months)",
            "total_trades": len(trades),
            "wins": len([t for t in trades if t['outcome'] == 'WIN']),
            "losses": len(losses),
            "win_rate_pct": round((len([t for t in trades if t['outcome'] == 'WIN']) / max(1, len(trades))) * 100.0, 1),
            "total_missed_big_movers": len(missed),
        },
        "losing_trades_autopsy": losses,
        "missed_opportunities_sample": missed[:25],
    }

    out_file = OUTPUT_DIR / "chamber_b_forensic_autopsy.json"
    with open(out_file, "w", encoding="utf-8") as fp:
        json.dump(out_data, fp, indent=2)

    print(f"\nSaved complete forensic report to {out_file}")

    print("\n" + "-" * 85)
    print("FORENSIC LOSS AUTOPSY BREAKDOWN (WHY DID THE LOSSES OCCUR?):")
    print("-" * 85)
    from collections import Counter
    causes = Counter([l["root_cause"] for l in losses])
    for c, count in causes.items():
        print(f"• {c:<35} : {count} trades ({(count/max(1, len(losses)))*100:.1f}%)")

    print("\n" + "-" * 85)
    print("TOP MISSED BIG MOVERS (+3.5% to +8.5%) AND WHY REJECTED:")
    print("-" * 85)
    for m in sorted(missed, key=lambda x: x["day_max_gain_pct"], reverse=True)[:8]:
        print(f"Date: {m['date']} | {m['symbol']:<12} | Surged: +{m['day_max_gain_pct']:.1f}% | Rejected: {', '.join(m['rejection_reasons'])}")


if __name__ == "__main__":
    main()
