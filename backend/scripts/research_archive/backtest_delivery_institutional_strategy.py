"""
Alpha India - Comprehensive 2-Year Institutional Delivery Strategy Backtest
Compares:
1. Baseline (Old / Current Delivery Radar)
2. New Institutional Footprint Strategy (Ticket Spike, VWAP hold, Anti-Trap Candle, RS Leader, Structural SL)
3. New Strategy with Buy Corridor / Retest Discipline
"""

import glob
import os
from pathlib import Path
import time
import pandas as pd
import numpy as np

def run_comprehensive_backtest():
    t0 = time.time()
    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(glob.glob(str(base_dir / "sec_bhavdata_full_*.csv")))
    
    print(f"Loading {len(files)} historical NSE delivery bhavcopies...")
    
    import datetime
    def parse_file_date(f):
        try:
            raw = os.path.basename(f).replace("sec_bhavdata_full_", "").replace(".csv", "")
            return datetime.datetime.strptime(raw, "%d%m%Y")
        except Exception:
            return datetime.datetime.min
    files = sorted(files, key=parse_file_date)
    
    master_path = Path(__file__).resolve().parent.parent / "data" / "nse_companies_master.csv"
    valid_symbols = set()
    if master_path.exists():
        comp_df = pd.read_csv(master_path)
        valid_symbols = set(comp_df["SYMBOL"].dropna().str.strip())
    
    records = []
    for f in files:
        try:
            df = pd.read_csv(f)
            df.columns = [c.strip() for c in df.columns]
            if "SERIES" in df.columns:
                df = df[df["SERIES"].str.strip() == "EQ"]
            df["SYMBOL"] = df["SYMBOL"].str.strip()
            if valid_symbols:
                df = df[df["SYMBOL"].isin(valid_symbols)]
            df["DATE"] = pd.to_datetime(df["DATE1"].str.strip(), format="%d-%b-%Y")
            df["OPEN"] = pd.to_numeric(df["OPEN_PRICE"], errors="coerce")
            df["HIGH"] = pd.to_numeric(df["HIGH_PRICE"], errors="coerce")
            df["LOW"] = pd.to_numeric(df["LOW_PRICE"], errors="coerce")
            df["CLOSE"] = pd.to_numeric(df["CLOSE_PRICE"], errors="coerce")
            df["PREV_CLOSE"] = pd.to_numeric(df["PREV_CLOSE"], errors="coerce")
            df["VWAP"] = pd.to_numeric(df["AVG_PRICE"], errors="coerce")
            df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
            df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
            df["NO_OF_TRADES"] = pd.to_numeric(df["NO_OF_TRADES"], errors="coerce").fillna(1)
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)
            records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "VWAP", "VOLUME", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue
            
    all_df = pd.concat(records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    print(f"Total rows parsed: {len(all_df):,} across {all_df['SYMBOL'].nunique()} symbols and {all_df['DATE'].nunique()} trading dates ({time.time()-t0:.1f}s)")
    
    # Feature Engineering
    grouped = all_df.groupby("SYMBOL", group_keys=False)
    
    all_df["DAY_RET"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    hl_range = np.maximum(0.01, all_df["HIGH"] - all_df["LOW"])
    all_df["CLOSE_LOC"] = (all_df["CLOSE"] - all_df["LOW"]) / hl_range
    all_df["UPPER_WICK"] = (all_df["HIGH"] - np.maximum(all_df["OPEN"], all_df["CLOSE"])) / hl_range
    
    # 1. Delivery & Volume Metrics
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)
    
    all_df["VOL_5_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["VOL_DRYUP"] = np.where(all_df["VOL_20_SMA"] > 0, all_df["VOL_5_SMA"] / all_df["VOL_20_SMA"], 1.0)
    
    # 2. Moving Averages & 50-day Pivot
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).mean())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).max())
    
    # 3. ATR-14
    tr1 = all_df["HIGH"] - all_df["LOW"]
    tr2 = (all_df["HIGH"] - all_df["PREV_CLOSE"]).abs()
    tr3 = (all_df["LOW"] - all_df["PREV_CLOSE"]).abs()
    all_df["TR"] = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    all_df["ATR_14"] = grouped["TR"].transform(lambda x: x.shift(1).rolling(14, min_periods=7).mean())
    
    # 4. Institutional Ticket Size Spike (Turnover per Trade)
    all_df["TRADE_SIZE"] = (all_df["TURNOVER_CR"] * 100.0) / np.maximum(1, all_df["NO_OF_TRADES"])
    all_df["AVG_TRADE_SIZE_20"] = grouped["TRADE_SIZE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["TICKET_SPIKE"] = np.where(all_df["AVG_TRADE_SIZE_20"] > 0, all_df["TRADE_SIZE"] / all_df["AVG_TRADE_SIZE_20"], 1.0)
    
    # 5. 20-Day Delivery Accumulation Flow (D-A/D)
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_sum = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    down_sum = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).sum())
    all_df["DELIV_FLOW_20D"] = np.where(down_sum > 0, up_sum / down_sum, 1.0)
    
    # 6. Relative Strength (60-day ROC)
    all_df["ROC_60"] = grouped["CLOSE"].transform(lambda x: (x.shift(1) / x.shift(61) - 1.0) * 100.0)
    
    # 7. Volatility Contraction (5-day range vs 20-day range)
    all_df["HL_DIFF"] = all_df["HIGH"] - all_df["LOW"]
    all_df["RANGE_5D"] = grouped["HL_DIFF"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    all_df["RANGE_20D"] = grouped["HL_DIFF"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["RANGE_CONTRACTION"] = np.where(all_df["RANGE_20D"] > 0, all_df["RANGE_5D"] / all_df["RANGE_20D"], 1.0)
    
    print(f"Features engineered in {time.time()-t0:.1f}s. Preparing simulation lookup map...")
    sym_map = {s: df_s.reset_index(drop=True) for s, df_s in all_df.groupby("SYMBOL")}
    
    # Simulation Engine Function
    def run_simulation(
        mask,
        entry_mode="NEXT_OPEN",  # NEXT_OPEN, CMP, or BUY_CORRIDOR_LIMIT
        sl_type="FIXED",         # FIXED, or STRUCTURAL
        fixed_sl_pct=3.5,
        be_trigger_pct=2.2,
        target_mode="TWO_STAGE", # TWO_STAGE (50% at T1, 50% at T2), or SINGLE_TARGET
        t1_pct=5.5,
        t2_pct=11.0,
        max_hold_days=12,
        slippage_pct=0.15,
        name="Strategy"
    ):
        signals = all_df[mask].copy()
        if len(signals) == 0:
            return {"name": name, "n": 0}
            
        trades = []
        for _, sig in signals.iterrows():
            sym = sig["SYMBOL"]
            sub = sym_map.get(sym)
            if sub is None:
                continue
            idx_list = sub.index[sub["DATE"] == sig["DATE"]].tolist()
            if not idx_list or idx_list[0] + 1 >= len(sub):
                continue
                
            sig_idx = idx_list[0]
            entry_idx = sig_idx + 1
            
            # Entry logic
            if entry_mode == "CMP":
                entry_price = sig["CLOSE"]
            elif entry_mode == "NEXT_OPEN":
                entry_price = sub.loc[entry_idx, "OPEN"]
                if pd.isna(entry_price) or entry_price <= 0:
                    entry_price = sig["CLOSE"]
            elif entry_mode == "BUY_CORRIDOR_LIMIT":
                # Limit order placed at Pivot + 0.8%
                pivot = sig["HIGH_50"]
                limit_price = pivot * 1.008
                # Check if Day + 1 or Day + 2 dipped to limit price
                filled = False
                fill_idx = entry_idx
                for d in range(0, min(3, len(sub) - entry_idx)):
                    cur = entry_idx + d
                    if sub.loc[cur, "LOW"] <= limit_price:
                        entry_price = limit_price
                        filled = True
                        fill_idx = cur
                        break
                if not filled:
                    continue # Order not filled, zero risk
                entry_idx = fill_idx
            else:
                entry_price = sig["CLOSE"]
                
            # Stop loss logic
            if sl_type == "CANDLE_LOW":
                # Real structural invalidation: just below the breakout candle's low
                sl = sig["LOW"] * 0.995
            elif sl_type == "STRUCTURAL":
                bk_low = sig["LOW"] * 0.995
                atr_sl = sig["CLOSE"] - (1.2 * sig["ATR_14"]) if pd.notna(sig["ATR_14"]) else bk_low
                struct_sl = max(entry_price * 0.955, min(entry_price * 0.985, min(bk_low, atr_sl))) # bounded between 1.5% and 4.5%
                sl = struct_sl
            else:
                sl = entry_price * (1.0 - fixed_sl_pct / 100.0)
                
            initial_risk_pct = ((entry_price - sl) / entry_price) * 100.0
            be_level = entry_price * (1.0 + be_trigger_pct / 100.0)
            t1_level = entry_price * (1.0 + t1_pct / 100.0)
            t2_level = entry_price * (1.0 + t2_pct / 100.0)
            
            be_active = False
            t1_active = False
            pnl = 0.0
            exit_reason = "TIME_EXIT"
            hold_days = 0
            
            for d in range(1, max_hold_days + 1):
                cur = entry_idx + d
                if cur >= len(sub):
                    exit_bar = sub.loc[cur - 1]
                    rem_ret = ((exit_bar["CLOSE"] - entry_price) / entry_price) * 100.0
                    pnl += (0.5 * rem_ret) if t1_active else rem_ret
                    break
                    
                bar = sub.loc[cur]
                hold_days = d
                
                # 1. Target 1 Check
                if bar["HIGH"] >= t1_level and not t1_active:
                    t1_active = True
                    pnl += 0.5 * t1_pct
                    # Auto-move stop to Breakeven (+0.4% friction)
                    sl = entry_price * 1.004
                    be_active = True
                    
                # 2. Breakeven Trigger Check
                if bar["HIGH"] >= be_level and not be_active:
                    be_active = True
                    sl = entry_price * 1.004
                    
                # 3. Stop Loss Check
                if bar["LOW"] <= sl:
                    sl_ret = ((sl - entry_price) / entry_price) * 100.0
                    if t1_active:
                        pnl += 0.5 * sl_ret
                        exit_reason = "T1_THEN_BE_STOP" if be_active else "T1_THEN_STOP"
                    else:
                        pnl = sl_ret
                        exit_reason = "BE_SHIELD_SAVED" if be_active else "FULL_STOP_LOSS"
                    break
                    
                # 4. Target 2 Check
                if bar["HIGH"] >= t2_level:
                    if t1_active:
                        pnl += 0.5 * t2_pct
                        exit_reason = "FULL_TARGET_HIT"
                    else:
                        pnl = t2_pct
                        exit_reason = "T2_HIT"
                    break
                    
                if d == max_hold_days:
                    final_ret = ((bar["CLOSE"] - entry_price) / entry_price) * 100.0
                    if t1_active:
                        pnl += 0.5 * final_ret
                        exit_reason = "T1_THEN_TIME_EXIT"
                    else:
                        pnl = final_ret
                        exit_reason = "TIME_EXIT"
                        
            net_pnl = pnl - slippage_pct
            trades.append({
                "pnl": net_pnl,
                "reason": exit_reason,
                "hold": hold_days,
                "t1_hit": t1_active,
                "initial_risk": initial_risk_pct,
            })
            
        tdf = pd.DataFrame(trades)
        wins = tdf[tdf["pnl"] > 0]
        losses = tdf[tdf["pnl"] <= 0]
        pf = wins["pnl"].sum() / abs(losses["pnl"].sum()) if len(losses) > 0 and abs(losses["pnl"].sum()) > 0 else 99.0
        wr = len(wins) / len(tdf) * 100.0
        
        return {
            "name": name,
            "trades": len(tdf),
            "win_rate": round(wr, 1),
            "profit_factor": round(pf, 2),
            "avg_pnl": round(tdf["pnl"].mean(), 2),
            "total_pnl": round(tdf["pnl"].sum(), 1),
            "t1_hit_rate": round((tdf["t1_hit"]).mean() * 100.0, 1),
            "be_saves": round((tdf["reason"] == "BE_SHIELD_SAVED").mean() * 100.0, 1),
            "full_stops": round((tdf["reason"] == "FULL_STOP_LOSS").mean() * 100.0, 1),
            "avg_risk": round(tdf["initial_risk"].mean(), 2),
            "avg_hold_days": round(tdf["hold"].mean(), 1),
        }

    print("\n" + "="*120)
    print("ALPHA INDIA: 2-YEAR EMPIRICAL BACKTEST (525 SESSIONS | 2,290+ NSE EQUITIES)")
    print("="*120)

    # 1. BASELINE (CURRENT DELIVERY RADAR SYSTEM)
    # 55% Deliv, 1.6x Spike, Turnover >= 1.8 Cr, 50D High proximity, Blind -3.5% SL, +5.5% T1, +11% T2
    m_base = (
        (all_df["TURNOVER_CR"] >= 1.8) &
        (all_df["DELIV_PER"] >= 55.0) &
        (all_df["DELIV_SPIKE"] >= 1.6) &
        (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.98) &
        (all_df["CLOSE"] > all_df["SMA_20"])
    )
    r_base = run_simulation(m_base, entry_mode="NEXT_OPEN", sl_type="FIXED", fixed_sl_pct=3.5, be_trigger_pct=2.2, t1_pct=5.5, t2_pct=11.0, name="1. Current Baseline (Blind CMP Chase + Fixed SL)")

    # 2. STRATEGY 2: INSTITUTIONAL FOOTPRINT (Anti-Trap, VWAP Hold, Ticket Spike >= 1.25x, RS Leader, Structural SL)
    m_inst = (
        (all_df["TURNOVER_CR"] >= 4.0) &                    # High liquidity floor (no microcaps)
        (all_df["DELIV_PER"] >= 58.0) &                      # 58%+ Delivery
        (all_df["DELIV_SPIKE"] >= 1.8) &                    # 1.8x Volume Surge
        (all_df["TICKET_SPIKE"] >= 1.25) &                  # Institutional Ticket Size Expansion
        (all_df["CLOSE"] >= all_df["VWAP"]) &               # Buyers control entire day
        (all_df["CLOSE_LOC"] >= 0.70) &                     # Close in upper 30% of day
        (all_df["UPPER_WICK"] <= 0.20) &                    # Minimal rejection wick
        (all_df["CLOSE"] > all_df["SMA_20"]) &
        (all_df["SMA_20"] > all_df["SMA_50"]) &             # Trend alignment
        (all_df["ROC_60"] >= 12.0) &                        # Relative Strength Leader
        (all_df["RANGE_CONTRACTION"] <= 0.95) &             # Base compression before pop
        (all_df["CLOSE"] >= all_df["HIGH_50"] * 0.985)
    )
    r_inst = run_simulation(m_inst, entry_mode="NEXT_OPEN", sl_type="STRUCTURAL", be_trigger_pct=2.0, t1_pct=5.0, t2_pct=10.0, name="2. Institutional Footprint (VWAP + Ticket + RS + Structural SL)")

    # 3. STRATEGY 3: ELITE SNIPER (Buy Corridor / Retest Limit Entry at Pivot + 0.8%)
    r_corridor = run_simulation(m_inst, entry_mode="BUY_CORRIDOR_LIMIT", sl_type="STRUCTURAL", be_trigger_pct=2.0, t1_pct=5.0, t2_pct=10.0, name="3. Elite Sniper (Buy Corridor / Retest Entry at Pivot+0.8%)")

    # 4. STRATEGY 4: APEX CONVICTION (Ticket Spike >= 1.4x, D-A/D Flow >= 1.5x)
    m_apex = m_inst & (all_df["TICKET_SPIKE"] >= 1.40) & (all_df["DELIV_FLOW_20D"] >= 1.40)
    r_apex = run_simulation(m_apex, entry_mode="NEXT_OPEN", sl_type="STRUCTURAL", be_trigger_pct=2.0, t1_pct=5.0, t2_pct=10.0, name="4. Apex Conviction (Flow>=1.4x + Ticket>=1.4x + Next Open)")

    # 5. STRATEGY 5: TRUE STRUCTURAL CANDLE LOW STOP
    r_candle_low = run_simulation(m_inst, entry_mode="NEXT_OPEN", sl_type="CANDLE_LOW", be_trigger_pct=2.0, t1_pct=4.8, t2_pct=9.5, name="5. Candle Low Stop (True Base Support Defense)")

    # 6. STRATEGY 6: APEX REGIME (Candle Low Stop + Market Breadth >= 42%)
    breadth_map = all_df.groupby("DATE").apply(lambda d: (d["CLOSE"] > d["SMA_20"]).mean() * 100.0).to_dict()
    all_df["MARKET_BREADTH"] = all_df["DATE"].map(breadth_map).fillna(50.0)
    m_regime = m_inst & (all_df["MARKET_BREADTH"] >= 42.0)
    r_regime = run_simulation(m_regime, entry_mode="NEXT_OPEN", sl_type="CANDLE_LOW", be_trigger_pct=2.0, t1_pct=4.8, t2_pct=9.5, name="6. Apex Regime Shield (Breadth>=42% + Candle Low Stop)")

    # Print results table
    res_list = [r_base, r_inst, r_corridor, r_apex, r_candle_low, r_regime]
    print(f"\n{'Strategy Model':<55} | {'Trades':<6} | {'Win Rate':<8} | {'PF':<5} | {'Avg PnL':<9} | {'Total PnL':<10} | {'T1 Hit%':<8} | {'BE Saves':<8} | {'Full Stops':<10} | {'Avg Risk':<8}")
    print("-" * 145)
    for r in res_list:
        print(f"{r['name']:<55} | {r['trades']:<6} | {r['win_rate']:<7.1f}% | {r['profit_factor']:<5.2f} | {r['avg_pnl']:+7.2f}% | {r['total_pnl']:+9.1f}% | {r['t1_hit_rate']:<7.1f}% | {r['be_saves']:<7.1f}% | {r['full_stops']:<9.1f}% | {r['avg_risk']:<6.2f}%")

    print("\nExecution finished in {:.1f}s".format(time.time() - t0))

if __name__ == "__main__":
    run_comprehensive_backtest()
