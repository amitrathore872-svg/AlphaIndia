"""
Alpha India - Institutional Delivery & Volume Spike Engine
Calculates:
1. Daily Delivery % & Volume Spike Multiplier (Ax) for latest session (18-Sep-2026)
2. Weekly Delivery % & Weekly Volume Spike Multiplier (Ax) for latest complete week (14-18 Sep 2026) vs Prior Weeks
"""

import glob
import os
import pandas as pd
import numpy as np

def run_analysis():
    # 1. Load data files
    files = sorted(glob.glob("data/nse_delivery/sec_bhavdata_full_*.csv"))
    if not files:
        print("No delivery files found in data/nse_delivery!")
        return

    records = []
    for f in files:
        try:
            df = pd.read_csv(f)
            df.columns = [c.strip() for c in df.columns]
            df = df[df["SERIES"].str.strip() == "EQ"].copy()
            df["SYMBOL"] = df["SYMBOL"].str.strip()
            df["DATE1"] = pd.to_datetime(df["DATE1"].str.strip(), format="%d-%b-%Y")
            df["CLOSE_PRICE"] = pd.to_numeric(df["CLOSE_PRICE"], errors="coerce")
            df["PREV_CLOSE"] = pd.to_numeric(df["PREV_CLOSE"], errors="coerce")
            df["TTL_TRD_QNTY"] = pd.to_numeric(df["TTL_TRD_QNTY"], errors="coerce").fillna(0)
            df["TURNOVER_LACS"] = pd.to_numeric(df["TURNOVER_LACS"], errors="coerce").fillna(0)
            df["DELIV_QTY"] = pd.to_numeric(df["DELIV_QTY"], errors="coerce").fillna(0)
            df["DELIV_PER"] = pd.to_numeric(df["DELIV_PER"], errors="coerce").fillna(0)
            records.append(df[["SYMBOL", "DATE1", "PREV_CLOSE", "CLOSE_PRICE", "TTL_TRD_QNTY", "TURNOVER_LACS", "DELIV_QTY", "DELIV_PER"]])
        except Exception as e:
            print(f"Error loading {f}: {e}")

    all_df = pd.concat(records, ignore_index=True)
    all_df = all_df.sort_values(by=["SYMBOL", "DATE1"])

    # Load official company master and strictly retain genuine corporate equities
    comp_map = {}
    valid_symbols = set()
    if os.path.exists("data/nse_companies_master.csv"):
        comp_df = pd.read_csv("data/nse_companies_master.csv")
        comp_map = dict(zip(comp_df["SYMBOL"].str.strip(), comp_df["NAME OF COMPANY"].str.strip()))
        valid_symbols = set(comp_df["SYMBOL"].str.strip())

    if valid_symbols:
        all_df = all_df[all_df["SYMBOL"].isin(valid_symbols)].copy()

    unique_dates = sorted(all_df["DATE1"].unique())
    latest_date = unique_dates[-1]
    prior_dates = unique_dates[:-1]
    prior_10_dates = prior_dates[-10:]

    print(f"Loaded {len(unique_dates)} trading sessions for {all_df['SYMBOL'].nunique()} listed equities. Latest date: {latest_date.strftime('%d-%b-%Y')}")



    # =========================================================================
    # PART 1: DAILY DELIVERY SPIKE ANALYSIS (Latest Trading Day: 18-Sep-2026)
    # =========================================================================
    df_prior_10 = all_df[all_df["DATE1"].isin(prior_10_dates)]
    avg_deliv_10 = df_prior_10.groupby("SYMBOL")["DELIV_QTY"].mean().rename("AVG_DELIV_10D")
    avg_turnover_10 = df_prior_10.groupby("SYMBOL")["TURNOVER_LACS"].mean().rename("AVG_TURNOVER_10D")

    latest_df = all_df[all_df["DATE1"] == latest_date].copy()
    latest_df = latest_df.merge(avg_deliv_10, on="SYMBOL", how="left")
    latest_df = latest_df.merge(avg_turnover_10, on="SYMBOL", how="left")

    latest_df["DELIV_SPIKE_X"] = np.where(
        latest_df["AVG_DELIV_10D"] > 0,
        latest_df["DELIV_QTY"] / latest_df["AVG_DELIV_10D"],
        0.0
    )
    latest_df["PCT_CHG"] = ((latest_df["CLOSE_PRICE"] - latest_df["PREV_CLOSE"]) / latest_df["PREV_CLOSE"]) * 100
    latest_df["COMPANY_NAME"] = latest_df["SYMBOL"].map(comp_map).fillna(latest_df["SYMBOL"])
    latest_df["DELIV_TURNOVER_CR"] = (latest_df["TURNOVER_LACS"] * (latest_df["DELIV_PER"] / 100.0)) / 100.0

    # Minimum liquidity threshold: Turnover >= 2 Crore (200 Lacs) and Delivered Qty >= 25,000 shares
    liquid_daily = latest_df[
        (latest_df["TURNOVER_LACS"] >= 200.0) & 
        (latest_df["DELIV_QTY"] >= 25000) &
        (latest_df["AVG_DELIV_10D"] >= 10000)
    ].copy()

    # Category A: High Delivery % (>= 60%) with Volume Spike (Spike >= 2.0x)
    daily_institutional_accum = liquid_daily[
        (liquid_daily["DELIV_PER"] >= 55.0) & 
        (liquid_daily["DELIV_SPIKE_X"] >= 2.0)
    ].sort_values(by="DELIV_SPIKE_X", ascending=False)

    # Category B: Absolute Highest Delivery % (Delivery % >= 75%) with Liquidity
    daily_highest_deliv_pct = liquid_daily[
        (liquid_daily["DELIV_PER"] >= 70.0) &
        (liquid_daily["DELIV_SPIKE_X"] >= 1.2)
    ].sort_values(by="DELIV_PER", ascending=False)

    # Category C: Massive Volume Surge (Spike >= 3.0x) with Delivery % >= 45%
    daily_surge_leaders = liquid_daily[
        (liquid_daily["DELIV_PER"] >= 45.0) &
        (liquid_daily["DELIV_SPIKE_X"] >= 3.0)
    ].sort_values(by="DELIV_SPIKE_X", ascending=False)

    # =========================================================================
    # PART 2: WEEKLY DELIVERY SPIKE ANALYSIS
    # Current Week: 14-Sep-2026 to 18-Sep-2026 (5 sessions)
    # Prior Week 1: 07-Sep-2026 to 11-Sep-2026 (5 sessions)
    # Prior Week 2: 31-Aug-2026 to 04-Sep-2026 (5 sessions)
    # =========================================================================
    curr_week_dates = unique_dates[-5:]
    prior_week_dates = unique_dates[-10:-5]
    prev2_week_dates = unique_dates[-15:-10]

    df_curr_week = all_df[all_df["DATE1"].isin(curr_week_dates)]
    df_prior_week = all_df[all_df["DATE1"].isin(prior_week_dates)]

    # Weekly aggregates for current week
    curr_w_grp = df_curr_week.groupby("SYMBOL").agg(
        TOT_DELIV_QTY=("DELIV_QTY", "sum"),
        TOT_TRD_QTY=("TTL_TRD_QNTY", "sum"),
        TOT_TURNOVER_CR=("TURNOVER_LACS", lambda x: x.sum() / 100.0),
        DAYS_TRADED=("DATE1", "count"),
        LATEST_CLOSE=("CLOSE_PRICE", "last"),
        FIRST_PREV_CLOSE=("PREV_CLOSE", "first")
    ).reset_index()

    curr_w_grp["WEEKLY_DELIV_PER"] = np.where(
        curr_w_grp["TOT_TRD_QTY"] > 0,
        (curr_w_grp["TOT_DELIV_QTY"] / curr_w_grp["TOT_TRD_QTY"]) * 100.0,
        0.0
    )
    curr_w_grp["WEEKLY_PRICE_CHG"] = np.where(
        curr_w_grp["FIRST_PREV_CLOSE"] > 0,
        ((curr_w_grp["LATEST_CLOSE"] - curr_w_grp["FIRST_PREV_CLOSE"]) / curr_w_grp["FIRST_PREV_CLOSE"]) * 100.0,
        0.0
    )

    # Weekly aggregates for prior week
    prior_w_grp = df_prior_week.groupby("SYMBOL").agg(
        PRIOR_DELIV_QTY=("DELIV_QTY", "sum"),
        PRIOR_TRD_QTY=("TTL_TRD_QNTY", "sum"),
        PRIOR_TURNOVER_CR=("TURNOVER_LACS", lambda x: x.sum() / 100.0),
    ).reset_index()

    weekly_df = curr_w_grp.merge(prior_w_grp, on="SYMBOL", how="left")
    weekly_df["WEEKLY_SPIKE_X"] = np.where(
        weekly_df["PRIOR_DELIV_QTY"] > 0,
        weekly_df["TOT_DELIV_QTY"] / weekly_df["PRIOR_DELIV_QTY"],
        0.0
    )
    weekly_df["COMPANY_NAME"] = weekly_df["SYMBOL"].map(comp_map).fillna(weekly_df["SYMBOL"])

    # Weekly liquidity filter: Total Weekly Turnover >= 10 Crore, traded all 5 days
    liquid_weekly = weekly_df[
        (weekly_df["TOT_TURNOVER_CR"] >= 10.0) &
        (weekly_df["TOT_DELIV_QTY"] >= 100000) &
        (weekly_df["PRIOR_DELIV_QTY"] >= 50000) &
        (weekly_df["DAYS_TRADED"] >= 4)
    ].copy()

    # Category A: High Weekly Delivery % (>= 55%) with Weekly Spike (>= 1.8x)
    weekly_institutional_accum = liquid_weekly[
        (liquid_weekly["WEEKLY_DELIV_PER"] >= 50.0) &
        (liquid_weekly["WEEKLY_SPIKE_X"] >= 1.75)
    ].sort_values(by="WEEKLY_SPIKE_X", ascending=False)

    # Category B: Absolute Highest Weekly Delivery % (>= 65%) with solid volume
    weekly_highest_deliv_pct = liquid_weekly[
        (liquid_weekly["WEEKLY_DELIV_PER"] >= 65.0) &
        (liquid_weekly["WEEKLY_SPIKE_X"] >= 1.1)
    ].sort_values(by="WEEKLY_DELIV_PER", ascending=False)

    # Category C: Massive Weekly Volume Surge (Spike >= 2.5x) with Delivery % >= 45%
    weekly_surge_leaders = liquid_weekly[
        (liquid_weekly["WEEKLY_DELIV_PER"] >= 45.0) &
        (liquid_weekly["WEEKLY_SPIKE_X"] >= 2.2)
    ].sort_values(by="WEEKLY_SPIKE_X", ascending=False)

    # Save results to CSVs for programmatic access
    os.makedirs("data/analysis", exist_ok=True)
    daily_institutional_accum.to_csv("data/analysis/daily_institutional_accum.csv", index=False)
    daily_highest_deliv_pct.to_csv("data/analysis/daily_highest_deliv_pct.csv", index=False)
    daily_surge_leaders.to_csv("data/analysis/daily_surge_leaders.csv", index=False)
    weekly_institutional_accum.to_csv("data/analysis/weekly_institutional_accum.csv", index=False)
    weekly_highest_deliv_pct.to_csv("data/analysis/weekly_highest_deliv_pct.csv", index=False)
    weekly_surge_leaders.to_csv("data/analysis/weekly_surge_leaders.csv", index=False)

    print("\n" + "="*80)
    print(">>> TOP DAILY INSTITUTIONAL ACCUMULATION (DELIVERY % >= 55%, SPIKE >= 2.0x) <<<")
    print("="*80)
    display_cols_daily = ["SYMBOL", "COMPANY_NAME", "CLOSE_PRICE", "PCT_CHG", "DELIV_PER", "DELIV_SPIKE_X", "DELIV_QTY", "AVG_DELIV_10D", "DELIV_TURNOVER_CR"]
    print(daily_institutional_accum[display_cols_daily].head(15).round(2).to_string(index=False))

    print("\n" + "="*80)
    print(">>> TOP DAILY HIGHEST DELIVERY % (DELIV % >= 70%, SPIKE >= 1.2x) <<<")
    print("="*80)
    print(daily_highest_deliv_pct[display_cols_daily].head(15).round(2).to_string(index=False))

    print("\n" + "="*80)
    print(">>> TOP DAILY DELIVERY VOLUME SURGE LEADERS (SPIKE >= 3.0x, DELIV % >= 45%) <<<")
    print("="*80)
    print(daily_surge_leaders[display_cols_daily].head(15).round(2).to_string(index=False))

    print("\n" + "="*80)
    print(">>> TOP WEEKLY INSTITUTIONAL ACCUMULATION (DELIVERY % >= 50%, WEEKLY SPIKE >= 1.75x) <<<")
    print("="*80)
    display_cols_weekly = ["SYMBOL", "COMPANY_NAME", "LATEST_CLOSE", "WEEKLY_PRICE_CHG", "WEEKLY_DELIV_PER", "WEEKLY_SPIKE_X", "TOT_DELIV_QTY", "PRIOR_DELIV_QTY", "TOT_TURNOVER_CR"]
    print(weekly_institutional_accum[display_cols_weekly].head(15).round(2).to_string(index=False))

    print("\n" + "="*80)
    print(">>> TOP WEEKLY HIGHEST DELIVERY % (DELIV % >= 65%, SPIKE >= 1.1x) <<<")
    print("="*80)
    print(weekly_highest_deliv_pct[display_cols_weekly].head(15).round(2).to_string(index=False))

    print("\n" + "="*80)
    print(">>> TOP WEEKLY DELIVERY VOLUME SURGE LEADERS (SPIKE >= 2.2x, DELIV % >= 45%) <<<")
    print("="*80)
    print(weekly_surge_leaders[display_cols_weekly].head(15).round(2).to_string(index=False))

if __name__ == "__main__":
    run_analysis()
