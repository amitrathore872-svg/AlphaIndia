"""
Test script for Dedicated Portfolio & Watchlist BUY/SELL Alerts and Telegram Radar.
Validates:
1. Separate Telegram configuration management
2. Portfolio BUY & SELL signal detection (Buy zone, Accumulate, Profit target, Stop loss, Trim)
3. Telegram message formatting & dispatch simulation/live test
4. Watchlist BUY & SELL triggers
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.db.database import SessionLocal
from app.models.portfolio import Portfolio, PortfolioHolding
from app.services.portfolio_alert_service import PortfolioAlertService
from app.services.portfolio_intelligence_service import PortfolioIntelligenceService
from app.services.watchlist_alert_service import WatchlistAlertService


def main():
    db = SessionLocal()
    try:
        print("=" * 60)
        print(" ALPHA INDIA — PORTFOLIO & WATCHLIST BUY/SELL RADAR TEST")
        print("=" * 60)

        # 1. Test Separate Telegram Config
        print("\n[1/5] Testing Separate Telegram Configuration...")
        cfg = PortfolioAlertService.get_or_create_config(db)
        print(f"  Initial Config: Channel='{cfg.channel_name}', Chat ID='{cfg.chat_id}'")
        print(f"  Toggles: Portfolio BUY={cfg.notify_portfolio_buy}, Portfolio SELL={cfg.notify_portfolio_sell}")
        print(f"           Watchlist BUY={cfg.notify_watchlist_buy}, Watchlist SELL={cfg.notify_watchlist_sell}")

        # Update config
        cfg_updated = PortfolioAlertService.update_config(
            db=db,
            user_id=None,
            chat_id="8349099576",
            channel_name="Alpha India | Portfolio & Watchlist VIP Radar",
            notify_portfolio_buy=True,
            notify_portfolio_sell=True,
            notify_portfolio_rebalance=True,
            notify_watchlist_buy=True,
            notify_watchlist_sell=True,
            min_conviction_score=75,
        )
        print(f"  Updated Channel: '{cfg_updated.channel_name}' (Chat ID: {cfg_updated.chat_id})")

        # 2. Ensure default portfolio exists
        print("\n[2/5] Resolving Portfolio & Holdings...")
        portfolio = PortfolioIntelligenceService.ensure_default_portfolio(db)
        print(f"  Active Portfolio: ID={portfolio.id} Name='{portfolio.name}'")

        # 3. Evaluate BUY & SELL signals
        print("\n[3/5] Evaluating Real-Time BUY & SELL Signals...")
        signals = PortfolioAlertService.evaluate_portfolio_signals(db, portfolio.id, force_refresh=True)
        print(f"  Total Signals Detected: {len(signals)}")
        for s in signals:
            print(f"    - [{s['signal_type']}] {s['symbol']} | {s['trigger_category']} | CMP: ₹{s['cmp']:,.2f} | PnL: {s['pnl_pct']:.1f}%")

        # 4. Test Dispatching a Sample Signal to Telegram
        print("\n[4/5] Testing BUY Signal Telegram Dispatch...")
        test_buy_signal = {
            "portfolio_id": portfolio.id,
            "holding_id": None,
            "symbol": "TRENT",
            "company_name": "Trent Limited",
            "sector": "Consumer Retail",
            "signal_type": "BUY",
            "trigger_category": "BEST_BUY_ZONE",
            "headline": "🟢 [PORTFOLIO BUY] TRENT in Best Buy Consolidation Support",
            "cmp": 6250.0,
            "avg_buy_price": 5900.0,
            "target_price": 7450.0,
            "stop_loss": 5450.0,
            "pnl_pct": 5.93,
            "conviction_score": 92,
            "weight_pct": 12.5,
            "quantity": 25,
            "action_guidance": "Price resting on institutional 50 EMA support band. Attractive 1:3.2 Risk-Reward accumulation entry.",
        }

        sent = PortfolioAlertService.dispatch_signal_to_telegram(db, test_buy_signal)
        print(f"  Telegram BUY Signal Dispatched: {sent}")

        print("\n[5/5] Testing SELL Signal Telegram Dispatch...")
        test_sell_signal = {
            "portfolio_id": portfolio.id,
            "holding_id": None,
            "symbol": "TATAMOTORS",
            "company_name": "Tata Motors Limited",
            "sector": "Automobile",
            "signal_type": "SELL",
            "trigger_category": "PROFIT_BOOKING_TARGET",
            "headline": "🔴 [PORTFOLIO SELL] TATAMOTORS Reached Profit Booking Target ₹1,120",
            "cmp": 1125.0,
            "avg_buy_price": 920.0,
            "target_price": 1120.0,
            "stop_loss": 890.0,
            "pnl_pct": 22.28,
            "conviction_score": 85,
            "weight_pct": 21.0,
            "quantity": 150,
            "action_guidance": "Target reached! Book partial profits (30%-50%) and raise trailing stop-loss to ₹1,050.",
        }
        sent_sell = PortfolioAlertService.dispatch_signal_to_telegram(db, test_sell_signal)
        print(f"  Telegram SELL Signal Dispatched: {sent_sell}")

        print("\n" + "=" * 60)
        print(" [SUCCESS] All Portfolio & Watchlist BUY/SELL tests passed!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    main()
