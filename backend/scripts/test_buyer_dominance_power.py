"""
Test impact of Buyer vs Seller Dominance on Free Float Delivery Setups
"""
import sys, os, glob, time, datetime
from pathlib import Path
import numpy as np, pandas as pd

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db.database import SessionLocal
from app.models.screener_growth_record import ScreenerGrowthRecord

def parse_file_date(fpath):
    try:
        raw = os.path.basename(fpath).replace("sec_bhavdata_full_", "").replace(".csv", "")
        return datetime.datetime.strptime(raw, "%d%m%Y")
    except Exception:
        return datetime.datetime.min

def run_test():
    db = SessionLocal()
    records = db.query(ScreenerGrowthRecord.symbol, ScreenerGrowthRecord.market_cap, ScreenerGrowthRecord.promoter_holding).all()
    db.close()

    meta_df = pd.DataFrame(records, columns=['symbol', 'market_cap', 'promoter_holding'])
    meta_df['symbol'] = meta_df['symbol'].astype(str).str.strip()
    meta_df['promoter_holding'] = pd.to_numeric(meta_df['promoter_holding'], errors='coerce').fillna(50.0)
    meta_df['market_cap'] = pd.to_numeric(meta_df['market_cap'], errors='coerce')
    meta_df['free_float_pct'] = np.clip(100.0 - meta_df['promoter_holding'], 5.0, 95.0)
    meta_df['free_float_mcap_cr'] = meta_df['market_cap'] * (meta_df['free_float_pct'] / 100.0)
    valid_symbols = set(meta_df.dropna(subset=['market_cap'])['symbol'].unique())

    base_dir = Path(__file__).resolve().parent.parent / "data" / "nse_delivery"
    files = sorted(list(base_dir.glob("sec_bhavdata_full_*.csv")), key=parse_file_date)[-300:]

    bhav_records = []
    for f in files:
        try:
            df = pd.read_csv(f, low_memory=False)
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
            df["VOLUME"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
            df["TURNOVER_CR"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0) / 100.0
            df["NO_OF_TRADES"] = pd.to_numeric(df["NO_OF_TRADES"], errors="coerce").fillna(1)
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)
            bhav_records.append(df[["SYMBOL", "DATE", "OPEN", "HIGH", "LOW", "CLOSE", "PREV_CLOSE", "VOLUME", "TURNOVER_CR", "NO_OF_TRADES", "DELIV_QTY", "DELIV_PER"]])
        except Exception:
            continue

    all_df = pd.concat(bhav_records, ignore_index=True).drop_duplicates(subset=["SYMBOL", "DATE"]).sort_values(by=["SYMBOL", "DATE"]).reset_index(drop=True)
    all_df = all_df.merge(meta_df[['symbol', 'market_cap', 'free_float_mcap_cr']], left_on='SYMBOL', right_on='symbol', how='inner')

    grouped = all_df.groupby("SYMBOL", group_keys=False)
    all_df["DAY_RET"] = ((all_df["CLOSE"] - all_df["PREV_CLOSE"]) / all_df["PREV_CLOSE"]) * 100.0
    all_df["HL_RANGE"] = np.maximum(all_df["HIGH"] - all_df["LOW"], 1e-4)
    all_df["CLOSE_LOC"] = (all_df["CLOSE"] - all_df["LOW"]) / all_df["HL_RANGE"]

    all_df["SMA_50"] = grouped["CLOSE"].transform(lambda x: x.shift(1).rolling(50, min_periods=20).mean())
    all_df["HIGH_20"] = grouped["HIGH"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).max())
    all_df["DELIV_10_SMA"] = grouped["DELIV_QTY"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    all_df["DELIV_SPIKE"] = np.where(all_df["DELIV_10_SMA"] > 0, all_df["DELIV_QTY"] / all_df["DELIV_10_SMA"], 0.0)

    # Ticket spike
    all_df["TICKET_LACS"] = (all_df["TURNOVER_CR"] * 100.0) / np.maximum(1, all_df["NO_OF_TRADES"])
    all_df["TICKET_20_SMA"] = grouped["TICKET_LACS"].transform(lambda x: x.shift(1).rolling(20, min_periods=10).mean())
    all_df["TICKET_SPIKE"] = np.where(all_df["TICKET_20_SMA"] > 0, all_df["TICKET_LACS"] / all_df["TICKET_20_SMA"], 1.0)

    # Up/Down delivery flow
    all_df["DELIV_UP"] = np.where(all_df["DAY_RET"] > 0, all_df["DELIV_QTY"], 0.0)
    all_df["DELIV_DOWN"] = np.where(all_df["DAY_RET"] < 0, all_df["DELIV_QTY"], 0.0)
    up_10 = grouped["DELIV_UP"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    down_10 = grouped["DELIV_DOWN"].transform(lambda x: x.shift(1).rolling(10, min_periods=5).sum())
    tot_flow = up_10 + down_10
    up_ratio = np.where(tot_flow > 0, up_10 / tot_flow, 0.5)

    # COMPOSITE BUYER DEMAND RATIO
    ticket_factor = np.clip((all_df["TICKET_SPIKE"] - 0.8) / 1.2, 0.0, 1.0)
    loc_factor = np.clip(all_df["CLOSE_LOC"], 0.0, 1.0)
    deliv_factor = np.clip(all_df["DELIV_PER"] / 100.0, 0.0, 1.0)
    all_df["BUYER_DEMAND_RATIO"] = np.round((0.35 * up_ratio + 0.25 * loc_factor + 0.20 * deliv_factor + 0.20 * ticket_factor) * 100.0, 1)

    # Free Float Delivery metrics
    all_df["DELIV_CR"] = (all_df["TURNOVER_CR"] * all_df["DELIV_PER"]) / 100.0
    deliv_5d = grouped["DELIV_CR"].transform(lambda x: x.shift(1).rolling(5, min_periods=1).sum()).fillna(0.0)
    all_df["FLOAT_ABSORB_5D"] = np.where(all_df["free_float_mcap_cr"] > 0, (deliv_5d / all_df["free_float_mcap_cr"]) * 100.0, 0.0)

    # Forward returns
    for hold in [5, 10, 20]:
        fwd_c = grouped["CLOSE"].shift(-hold)
        all_df[f"FWD_RET_{hold}D"] = ((fwd_c - all_df["CLOSE"]) / all_df["CLOSE"]) * 100.0

    valid_base = (all_df["CLOSE"] >= 35.0) & (all_df["TURNOVER_CR"] >= 1.5) & (all_df["free_float_mcap_cr"] >= 800.0)
    is_blast = (
        valid_base &
        (all_df["CLOSE"] > all_df["SMA_50"]) &
        (all_df["CLOSE"] > all_df["HIGH_20"]) &
        (all_df["DELIV_SPIKE"] >= 1.8) &
        (all_df["DELIV_PER"] >= 50.0)
    )

    print("\n" + "="*85)
    print("EMPIRICAL TEST: DOES BUYER DEMAND RATIO SUPERCHARGE FREE FLOAT SETUPS?")
    print("="*85)

    base_setup = is_blast & (all_df["FLOAT_ABSORB_5D"] >= 1.5)

    for name, mask in [
        ("Base Float Absorption Alone (No Buyer Dominance filter)", base_setup),
        ("Base Float Absorption + Buyer Demand >= 65%", base_setup & (all_df["BUYER_DEMAND_RATIO"] >= 65.0)),
        ("Base Float Absorption + Buyer Demand >= 72% (Strong Buyer Dominance)", base_setup & (all_df["BUYER_DEMAND_RATIO"] >= 72.0)),
        ("Base Float Absorption + Buyer Demand >= 78% (Extreme Buyer Dominance)", base_setup & (all_df["BUYER_DEMAND_RATIO"] >= 78.0)),
    ]:
        sub = all_df[mask & valid_base]
        n = len(sub)
        if n < 5: continue
        r5 = sub["FWD_RET_5D"].dropna()
        r10 = sub["FWD_RET_10D"].dropna()
        r20 = sub["FWD_RET_20D"].dropna()

        wr10 = (r10 > 0).mean() * 100.0
        avg10 = r10.mean()
        profit = r10[r10 > 0].sum()
        loss = abs(r10[r10 < 0].sum())
        pf10 = profit / loss if loss > 0 else 99.0
        r20_avg = r20.mean()
        r20_pf = r20[r20 > 0].sum() / max(1e-4, abs(r20[r20 < 0].sum()))
        big_win = (r10 >= 10.0).mean() * 100.0

        print(f"\n{name} (N = {n:,} trades):")
        print(f"  Hold 10D: WinRate = {wr10:5.1f}% | AvgRet = {avg10:+5.2f}% | ProfitFactor = {pf10:4.2f} | >+10% Runner = {big_win:4.1f}%")
        print(f"  Hold  5D: WinRate = {(r5>0).mean()*100:5.1f}% | AvgRet = {r5.mean():+5.2f}%")
        print(f"  Hold 20D: WinRate = {(r20>0).mean()*100:5.1f}% | AvgRet = {r20_avg:+5.2f}% | ProfitFactor = {r20_pf:4.2f}")

if __name__ == "__main__":
    run_test()
