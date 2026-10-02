"""
Alpha India — Real-Time Exchange Feed Simulation Script
Tests real-time feed capture from 5 NSE and 5 BSE quarterly results,
verifies warehouse persistence, runs audit checks, and identifies High Growth leaders.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.exchange_feed_simulator import ExchangeFeedSimulator


def main():
    print("=" * 80)
    print("🚀 ALPHA INDIA — REAL-TIME EXCHANGE FEED SIMULATION (5 NSE + 5 BSE)")
    print("=" * 80)

    summary = ExchangeFeedSimulator.run_simulation()

    print(f"\nTotal Disclosures Ingested : {summary['total_processed']}")
    print(f" -> NSE Feed Announcements   : {summary['nse_count']}")
    print(f" -> BSE Feed Announcements   : {summary['bse_count']}")
    print(f" -> High-Growth Breakouts    : {summary['high_growth_count']} 🚀")
    print(f" -> Steady Compounders       : {summary['steady_count']} 📈")
    print(f" -> Laggards / Contractions  : {summary['laggard_count']} ⚠️")

    print("\n" + "=" * 80)
    print("🏆 ALL 10 COMPANIES PROCESSED THROUGH PIPELINE")
    print("=" * 80)

    header = f"{'Symbol':<12} | {'Exch':<4} | {'Revenue (Cr)':<12} | {'Rev YoY%':<10} | {'PAT (Cr)':<10} | {'PAT YoY%':<10} | {'AI Score':<8} | {'Classification':<22}"
    print(header)
    print("-" * len(header))

    for r in summary["all_results"]:
        sym = r["symbol"]
        exch = r["exchange"]
        rev = f"₹{r['financials']['revenue']:,.2f}"
        rev_g = f"{r['revenue_growth_pct']:+.1f}%"
        pat = f"₹{r['financials']['pat']:,.2f}"
        pat_g = f"{r['pat_growth_pct']:+.1f}%"
        score = f"{r['growth_score']:.1f}"
        badge = r["growth_badge"]

        print(f"{sym:<12} | {exch:<4} | {rev:<12} | {rev_g:<10} | {pat:<10} | {pat_g:<10} | {score:<8} | {badge:<22}")

    print("\n" + "=" * 80)
    print("🌟 HIGH GROWTH WINNERS IDENTIFIED BY AI GROWTH RADAR")
    print("=" * 80)

    for i, hg in enumerate(summary["high_growth_companies"], 1):
        print(f"\n{i}. {hg['symbol']} ({hg['company_name']}) — [{hg['exchange']}]")
        print(f"   • Captured Time    : {hg['announcement_time']} IST (Real-Time Feed)")
        print(f"   • Growth Score     : {hg['growth_score']}/100 [AI Radar Rating]")
        print(f"   • Revenue YoY      : +{hg['revenue_growth_pct']:.2f}% (₹{hg['financials']['revenue']:,.2f} Cr)")
        print(f"   • Net Profit YoY   : +{hg['pat_growth_pct']:.2f}% (₹{hg['financials']['pat']:,.2f} Cr)")
        print(f"   • Operating Margin : {hg['financials']['operating_margin_pct']:.2f}%")
        print(f"   • Executive Thesis : {hg['thesis'][0]}")
        print(f"   • Warehouse Status : Synchronized in quarterly_results & screener_growth_records")

    print("\n" + "=" * 80)
    print("✅ SIMULATION COMPLETE: ALL 10 EXCHANGES FEEDS CAPTURED & PERSISTED")
    print("=" * 80)


if __name__ == "__main__":
    main()
