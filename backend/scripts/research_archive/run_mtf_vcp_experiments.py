"""
Alpha India - MTF VCP + 5M VCB Controlled Experiment Execution Runner
Executes the 9 controlled research experiments to determine whether higher-timeframe
VCP, Daily, 15m, RS, Sector, or Market Regime filters improve 5m VCB Breakout expectancy.
"""

import sys
import time
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, "backend")

from app.db.database import SessionLocal
from app.services.backtest.backtest_engine import BacktestEngine


EXPERIMENTS = [
    {
        "id": "EXP_01",
        "name": "Exp 01: Baseline 5M VCB (No Filters)",
        "strategy": "VCB_BREAKOUT",
        "strategy_parameters": {},
    },
    {
        "id": "EXP_02",
        "name": "Exp 02: Weekly VCP + 5M VCB",
        "strategy": "MTF_VCP_VCB",
        "strategy_parameters": {
            "enable_weekly_vcp": True,
            "enable_daily_confirmation": False,
            "enable_15m_confirmation": False,
            "enable_relative_strength": False,
            "enable_sector_strength": False,
            "enable_market_regime": False,
            "min_vcp_score": 60.0,
        },
    },
    {
        "id": "EXP_03",
        "name": "Exp 03: Daily Confirmation + 5M VCB",
        "strategy": "MTF_VCP_VCB",
        "strategy_parameters": {
            "enable_weekly_vcp": False,
            "enable_daily_confirmation": True,
            "enable_15m_confirmation": False,
            "enable_relative_strength": False,
            "enable_sector_strength": False,
            "enable_market_regime": False,
            "min_daily_score": 65.0,
        },
    },
    {
        "id": "EXP_04",
        "name": "Exp 04: Weekly VCP + Daily + 5M VCB",
        "strategy": "MTF_VCP_VCB",
        "strategy_parameters": {
            "enable_weekly_vcp": True,
            "enable_daily_confirmation": True,
            "enable_15m_confirmation": False,
            "enable_relative_strength": False,
            "enable_sector_strength": False,
            "enable_market_regime": False,
            "min_vcp_score": 60.0,
            "min_daily_score": 65.0,
        },
    },
    {
        "id": "EXP_05",
        "name": "Exp 05: Weekly VCP + Daily + 15M + 5M VCB",
        "strategy": "MTF_VCP_VCB",
        "strategy_parameters": {
            "enable_weekly_vcp": True,
            "enable_daily_confirmation": True,
            "enable_15m_confirmation": True,
            "enable_relative_strength": False,
            "enable_sector_strength": False,
            "enable_market_regime": False,
            "min_vcp_score": 60.0,
            "min_daily_score": 65.0,
            "min_15m_score": 60.0,
        },
    },
    {
        "id": "EXP_06",
        "name": "Exp 06: Weekly VCP + Relative Strength + 5M VCB",
        "strategy": "MTF_VCP_VCB",
        "strategy_parameters": {
            "enable_weekly_vcp": True,
            "enable_daily_confirmation": False,
            "enable_15m_confirmation": False,
            "enable_relative_strength": True,
            "enable_sector_strength": False,
            "enable_market_regime": False,
            "min_vcp_score": 60.0,
            "min_rs_score": 60.0,
        },
    },
    {
        "id": "EXP_07",
        "name": "Exp 07: Weekly VCP + Daily + RS + 5M VCB",
        "strategy": "MTF_VCP_VCB",
        "strategy_parameters": {
            "enable_weekly_vcp": True,
            "enable_daily_confirmation": True,
            "enable_15m_confirmation": False,
            "enable_relative_strength": True,
            "enable_sector_strength": False,
            "enable_market_regime": False,
            "min_vcp_score": 60.0,
            "min_daily_score": 65.0,
            "min_rs_score": 60.0,
        },
    },
    {
        "id": "EXP_08",
        "name": "Exp 08: Weekly VCP + Daily + RS + Sector + 5M VCB",
        "strategy": "MTF_VCP_VCB",
        "strategy_parameters": {
            "enable_weekly_vcp": True,
            "enable_daily_confirmation": True,
            "enable_15m_confirmation": False,
            "enable_relative_strength": True,
            "enable_sector_strength": True,
            "enable_market_regime": False,
            "min_vcp_score": 60.0,
            "min_daily_score": 65.0,
            "min_rs_score": 60.0,
            "min_sector_score": 55.0,
        },
    },
    {
        "id": "EXP_09",
        "name": "Exp 09: Full MTF Confluence (All Gates + Regime)",
        "strategy": "MTF_VCP_VCB",
        "strategy_parameters": {
            "enable_weekly_vcp": True,
            "enable_daily_confirmation": True,
            "enable_15m_confirmation": True,
            "enable_relative_strength": True,
            "enable_sector_strength": True,
            "enable_market_regime": True,
            "min_vcp_score": 60.0,
            "min_daily_score": 65.0,
            "min_15m_score": 60.0,
            "min_rs_score": 60.0,
            "min_sector_score": 55.0,
            "min_market_score": 50.0,
        },
    },
]


def run_all_experiments(universe: str = "TEST_10", start_date: str = "2026-07-06", end_date: str = "2026-09-25"):
    db = SessionLocal()
    results = []

    print(f"============================================================")
    print(f"Starting Multi-Timeframe VCP Experiment Matrix ({universe})")
    print(f"Window: {start_date} to {end_date}")
    print(f"============================================================")

    for exp in EXPERIMENTS:
        cfg = {
            "name": f"{exp['name']} ({universe})",
            "strategy": exp["strategy"],
            "universe": universe,
            "timeframe": "5m",
            "start_date": start_date,
            "end_date": end_date,
            "capital": 1000000.0,
            "target_pct": 0.015,
            "stop_pct": 0.010,
            "slippage_pct": 0.05,
            "brokerage_per_order": 20.0,
            "sizing_model": "RISK_BASED",
            "strategy_parameters": exp["strategy_parameters"],
        }

        print(f"\nLaunching {exp['id']}: {exp['name']}...")
        run_id = BacktestEngine.create_run_record(cfg, db)
        t0 = time.time()
        res = BacktestEngine.execute_backtest(run_id, db)
        elapsed = round(time.time() - t0, 2)

        res_summary = {
            "exp_id": exp["id"],
            "name": exp["name"],
            "run_id": run_id,
            "signals": res.get("signals_count", 0),
            "trades": res.get("trades_count", 0),
            "win_rate": res.get("win_rate_pct", 0.0),
            "profit_factor": res.get("profit_factor", 0.0),
            "expectancy": res.get("expectancy_pct", 0.0),
            "net_pnl": res.get("net_pnl", 0.0),
            "max_dd": res.get("max_drawdown_pct", 0.0),
            "elapsed_sec": elapsed,
        }
        results.append(res_summary)

        print(f" -> Completed in {elapsed}s | Trades: {res_summary['trades']} | Win Rate: {res_summary['win_rate']:.1f}% | PF: {res_summary['profit_factor']:.2f} | Expectancy: {res_summary['expectancy']:.2f}% | Net P&L: ₹{res_summary['net_pnl']:,.0f}")

    db.close()
    
    # Print formatted comparative table
    print("\n" + "=" * 95)
    print(f"{'Experiment':<42} | {'Trades':<6} | {'Win Rate':<8} | {'PF':<5} | {'Expectancy':<10} | {'Net P&L (₹)':<12}")
    print("-" * 95)
    for r in results:
        print(f"{r['name'][:42]:<42} | {r['trades']:<6} | {r['win_rate']:<7.1f}% | {r['profit_factor']:<5.2f} | {r['expectancy']:<9.2f}% | {r['net_pnl']:>12,.0f}")
    print("=" * 95)

    return results


if __name__ == "__main__":
    univ = sys.argv[1] if len(sys.argv) > 1 else "TEST_10"
    run_all_experiments(universe=univ)
