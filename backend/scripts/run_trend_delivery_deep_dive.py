"""
Follow-up Deep Dive:
1. Impact of Stage 2 Trend (Close > SMA 50 > SMA 200)
2. Cheat Entry (T-1 prior to blast) vs Chasing Blast (T-0)
3. Column correlation matrix before blast
"""
import sys, os, glob, time, datetime
from pathlib import Path
import numpy as np, pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

def parse_file_date(fpath):
    try:
        raw = os.path.basename(fpath).replace("sec_bhavdata_full_", "").replace(".csv", "")
        return datetime.datetime.strptime(raw, "%d%m%Y")
    except Exception:
        return datetime.datetime.min

def run_deep_dive():
    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(list(base_dir.glob("sec_bhavdata_full_*.csv")), key=parse_file_date)[-300:]

    master_path = Path(__file__).resolve().parent.parent / "data" / "nse_companies_master.csv"
    comp_df = pd.read_csv(master_path)
    valid_symbols = set(comp_df["SYMBOL"].dropna().astype(str).str.strip())

    records = []
    for f in files:
        try:
            df = pd.read_csv(f, low_memory=False)
            df.columns = [c.strip() for c in df.columns]
            if "SERIES" in df.columns:
                df = df[df["SERIES"].astype(str).str.strip() == "EQ"]
            df["SYMBOL"] = df["SYMBOL"].astype(str).str.strip()
            df = df[df["SYMBOL"].isin(valid_symbols)]
            
            df["DATE"] = pd.to_datetime(df["DATE1"].astype(str).str.strip(), format="%d-%b-%Y")
            df["OPEN"] = pd.to_numeric(df["OPEN_PRICE"], errors="coerce")
            df["HIGH"] = pd.to_numeric(df["HIGH_PRICE"], errors="coerce")
            df["LOW"] = pd.to_numeric(df["LOW_PRICE"], errors="coerce")
            df["CLOSE"] = pd.to_numeric(df["CLOSE_PRICE"], errors="coerce")
            df["PREV_CLOSE"] = pd.to_numeric(df["PREV_CLOSE"], errors="coerce")
            df["AVG_PRICE"] = pd.to_numeric(df["AVG_PRICE"], errors="coerce")
            df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
            df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
            df["NO_OF_TRADES"] = pd.to_numeric(df["NO_OF_TRADES"], errors="coerce").fillna(1)
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)

            records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "AVG_PRICE", "VOLUME", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue

    all_df = pd.concat(records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    grouped = all_df.groupby("SYMBOL", group_keys=False)

    all_df["DAY_RET"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    all_df["HL_RANGE"] = np.maximum(all_df["HIGH"] - all_df["LOW"], 1e-4)
    all_df["CLOSE_LOC"] = (all_df["CLOSE"] - all_df["LOW"]) / all_df["HL_RANGE"]
    all_df["SMA_20"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).mean())
    all_df["SMA_200"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(200, min_periods=50).mean())
    all_df["HIGH_20"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).max())
    all_df["HIGH_50"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).max())

    all_df["VOL_20_SMA"] = grouped["VOLUME"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)

    # Multi-day delivery clusters
    all_df["IS_D55"] = np.where(all_df["DELIV_PER"] >= 55.0, 1.0, 0.0)
    all_df["DELIV_DAYS_5D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0)
    all_df["DELIV_DAYS_10D"] = grouped["IS_D55"].transform(lambda x: x.shift(1).rolling(10, min_periods=1).sum()).fillna(0)

    # Net delivery flow
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_10 = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    down_10 = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    all_df["DELIV_FLOW_10D"] = np.where(down_10 > 0, up_10 / down_10, 1.0)

    # Supply dry-up in T-1 and Range contraction
    all_df["VOL_DRYUP_T1"] = grouped["VOLUME"].transform(lambda x: x.shift(1)) / np.maximum(1.0, all_df["VOL_20_SMA"])
    range_5 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(5, min_periods=3).mean())
    range_20 = grouped["HL_RANGE"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["RANGE_CONTRACTION"] = np.where(range_20 > 0, range_5 / range_20, 1.0)

    # Forward returns
    for hold in [5, 10, 20]:
        fwd_c = grouped["CLOSE"].shift(-hold)
        all_df[f"FWD_RET_{hold}D"] = ((fwd_c - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    valid_base = (all_df["CLOSE"] >= 40.0) & (all_df["TURNOVER_CR"] >= 2.0)
    is_stage2 = (all_df["CLOSE"] > all_df["SMA_50"]) & (all_df["CLOSE"] > all_df["SMA_20"])

    is_blast = (
        valid_base &
        (all_df["CLOSE"] > all_df["HIGH_20"]) &
        (all_df["DAY_RET"] >= 3.0) &
        (all_df["DELIV_SPIKE"] >= 2.0) &
        (all_df["DELIV_PER"] >= 55.0) &
        (all_df["CLOSE_LOC"] >= 0.65)
    )

    print("="*85)
    print("STAGE 2 TREND FILTERED vs RAW DELIVERY BLASTS")
    print("="*85)

    for name, mask in [
        ("Raw Delivery Blast (No Trend Filter)", is_blast),
        ("Stage 2 Delivery Blast (Close > SMA 50 & SMA 20)", is_blast & is_stage2),
        ("Stage 2 + Multi-Day Delivery (>= 2 days Deliv >= 55% in past 5D)", is_blast & is_stage2 & (all_df["DELIV_DAYS_5D"] >= 2)),
        ("Stage 2 + Heavy Multi-Day Delivery (>= 3 days Deliv >= 55% in past 5D)", is_blast & is_stage2 & (all_df["DELIV_DAYS_5D"] >= 3)),
        ("Stage 2 + Strong Deliv Flow (Up/Down Deliv Flow >= 1.5x)", is_blast & is_stage2 & (all_df["DELIV_FLOW_10D"] >= 1.5)),
        ("Elite Apex Setup: Stage 2 + Multi-Deliv (>=2d) + Up Flow >= 1.5x + Range Cont <= 0.90",
         is_blast & is_stage2 & (all_df["DELIV_DAYS_5D"] >= 2) & (all_df["DELIV_FLOW_10D"] >= 1.5) & (all_df["RANGE_CONTRACTION"] <= 0.90)),
    ]:
        sub = all_df[mask & valid_base]
        n = len(sub)
        if n < 5: continue
        r5 = sub["FWD_RET_5D"].dropna()
        r10 = sub["FWD_RET_10D"].dropna()
        r20 = sub["FWD_RET_20D"].dropna()
        
        wr10 = (r10 > 0).mean() * 100.0
        avg10 = r10.mean()
        med10 = r10.median()
        profit = r10[r10 > 0].sum()
        loss = abs(r10[r10 < 0].sum())
        pf = profit / loss if loss > 0 else 0
        big_win = (r10 >= 10.0).mean() * 100.0

        print(f"\n{name} (N = {n:,} trades):")
        print(f"  Hold 10D: WinRate = {wr10:5.1f}% | AvgRet = {avg10:+5.2f}% | MedRet = {med10:+5.2f}% | ProfitFactor = {pf:4.2f} | >+10% Runner = {big_win:4.1f}%")
        print(f"  Hold  5D: WinRate = {(r5>0).mean()*100:5.1f}% | AvgRet = {r5.mean():+5.2f}%")
        print(f"  Hold 20D: WinRate = {(r20>0).mean()*100:5.1f}% | AvgRet = {r20.mean():+5.2f}%")

if __name__ == "__main__":
    run_deep_dive()
