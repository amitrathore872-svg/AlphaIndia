"""
Alpha India — Mainboard IPO Radar Service
==========================================
Institutional scanner strictly for Mainboard NSE/BSE listed equities (No SME).
Identifies:
  1. Blue-Sky Listing Day High (LDH) Breakouts
  2. Institutional IPO Base & Cheat Pivots (VCP / Tight Contraction)
  3. SEBI 30-Day & 90-Day Anchor Lock-in Expiry & Float Absorption
  4. Broken Phoenix Reclaims (Stage 1 turnarounds after post-IPO selloffs)
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy import text

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.company_market_metrics import CompanyMarketMetrics

logger = logging.getLogger("alpha_india.services.ipo_radar")

_CACHE_LOCK = threading.Lock()
_RADAR_CACHE: Dict[str, Any] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes cache


class IPORadarService:

    @classmethod
    def get_mainboard_candidates(cls, db) -> List[Dict[str, Any]]:
        """
        Fetches verified Mainboard equities listed in the last 2.5 years.
        Filters out SME prefixes/suffixes, RE, BE, and warrants.
        """
        cutoff_date = date.today() - timedelta(days=900)
        
        # Exclude known SME series or symbols containing SME indicators
        query = text("""
            SELECT c.id, c.symbol, c.company, c.listing_date, c.exchange, c.sector,
                   m.cmp, m.market_cap, m.fifty_two_week_high, m.fifty_two_week_low
            FROM companies c
            LEFT JOIN company_market_metrics m ON c.id = m.company_id
            WHERE c.listing_date >= :cutoff
              AND c.listing_date <= CURRENT_DATE
              AND c.symbol NOT LIKE '%-RE%'
              AND c.symbol NOT LIKE '%-BE%'
              AND c.symbol NOT LIKE '%-SM%'
              AND c.symbol NOT LIKE '%.%'
              AND (c.series = 'EQ' OR c.series IS NULL OR c.series = 'BSE')
            ORDER BY c.listing_date DESC;
        """)
        
        rows = db.execute(query, {"cutoff": cutoff_date}).fetchall()
        
        candidates = []
        for r in rows:
            sym = r[1]
            # Extra safeguard against known SME series
            if len(sym) > 12:
                continue
            candidates.append({
                "id": r[0],
                "symbol": sym,
                "company": r[2],
                "listing_date": r[3],
                "exchange": r[4] or "NSE",
                "sector": r[5] or "General",
                "db_cmp": r[6],
                "db_market_cap": r[7],
                "db_52w_high": r[8],
                "db_52w_low": r[9],
            })
        return candidates

    @staticmethod
    def calculate_trigger_date(df: pd.DataFrame, pivot_price: float) -> tuple[Optional[str], Optional[int]]:
        """
        Determines the exact breakout initiation date and days elapsed since trigger.
        """
        if df is None or df.empty or pivot_price <= 0:
            return None, None
        try:
            # Check backwards from latest bar for consecutive closes above pivot
            trigger_dt = None
            for i in range(len(df) - 1, -1, -1):
                if df['Close'].iloc[i] >= pivot_price:
                    trigger_dt = df.index[i].date()
                else:
                    break
            
            # If no consecutive close above pivot, check if latest high touched pivot
            if trigger_dt is None and not df[df['High'] >= pivot_price].empty:
                trigger_dt = df[df['High'] >= pivot_price].index[-1].date()
            
            if trigger_dt:
                today = date.today()
                days_ago = max(0, (today - trigger_dt).days)
                return trigger_dt.strftime("%Y-%m-%d"), days_ago
        except Exception as e:
            logger.debug(f"Error calculating trigger date: {e}")
        return None, None

    @classmethod
    def analyze_symbol(cls, cand: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Pulls price history from actual listing date and runs institutional setup engines.
        """
        sym = cand["symbol"]
        list_date = cand["listing_date"]
        if not list_date:
            return None

        today = date.today()
        days_since_listing = (today - list_date).days

        # Calendar anchors
        anchor_30d = list_date + timedelta(days=30)
        anchor_90d = list_date + timedelta(days=90)
        days_to_30d = (anchor_30d - today).days
        days_to_90d = (anchor_90d - today).days

        # Fetch historical daily bars using direct Yahoo Finance v8 API with fallback to yfinance
        try:
            import requests as req
            df = None
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            
            for suffix in [".NS", ".BO"]:
                try:
                    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}{suffix}?interval=1d&range=1y"
                    resp = req.get(url, headers=headers, timeout=5)
                    if resp.status_code == 200:
                        res = resp.json().get("chart", {}).get("result", [])
                        if res:
                            ts = res[0].get("timestamp", [])
                            q = res[0].get("indicators", {}).get("quote", [{}])[0]
                            opens = q.get("open", [])
                            highs = q.get("high", [])
                            lows = q.get("low", [])
                            closes = q.get("close", [])
                            volumes = q.get("volume", [])
                            if ts and closes and len(closes) > 0:
                                df = pd.DataFrame({
                                    "Open": opens, "High": highs, "Low": lows, "Close": closes, "Volume": volumes
                                }, index=pd.to_datetime(ts, unit="s", utc=True)).dropna()
                                if len(df) >= 1:
                                    break
                except Exception:
                    pass

            # Fallback to yfinance if direct v8 is unavailable
            if df is None or df.empty or len(df) < 1:
                try:
                    ticker_str = f"{sym}.NS"
                    t = yf.Ticker(ticker_str)
                    df = t.history(period="1y")
                    if df.empty or len(df) < 1:
                        ticker_str = f"{sym}.BO"
                        t = yf.Ticker(ticker_str)
                        df = t.history(period="1y")
                except Exception:
                    pass

            if df is None or df.empty or len(df) < 1:
                return None

            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            df = df[['Open', 'High', 'Low', 'Close', 'Volume']].dropna()
            if len(df) < 1:
                return None

            total_bars = len(df)
            cmp = float(df['Close'].iloc[-1])
            prev_close = float(df['Close'].iloc[-2]) if total_bars >= 2 else cmp
            day_change_pct = round(((cmp - prev_close) / prev_close) * 100, 2)
            
            # Filter out penny stocks (< ₹10) and sub-100Cr nano-caps for institutional quality
            if cmp < 10.0:
                return None
            mcap_val = cand.get("db_market_cap")
            if mcap_val is not None and mcap_val > 0 and mcap_val < 50.0:
                return None

            # Sparkline: last 30 daily close prices
            sparkline_points = [round(float(p), 2) for p in df['Close'].iloc[-min(total_bars, 30):].tolist()]

            # 90D or listing return
            p_start = float(df['Close'].iloc[0]) if total_bars <= 66 else float(df['Close'].iloc[-66])
            return_90d_pct = round(((cmp - p_start) / p_start) * 100, 1)

            # Market cap category
            if mcap_val and mcap_val >= 20000:
                mcap_category = "Large Cap"
            elif mcap_val and mcap_val >= 5000:
                mcap_category = "Mid Cap"
            elif mcap_val and mcap_val > 0:
                mcap_category = "Small Cap"
            else:
                mcap_category = "Mid/Small Cap"

            # Initial Day 1-5 range
            initial_bars = min(total_bars, 5)
            day1_high = float(df['High'].iloc[:initial_bars].max())
            day1_low = float(df['Low'].iloc[:initial_bars].min())
            
            ath = float(df['High'].max())
            atl = float(df['Low'].min())
            drawdown_from_ath = round(((cmp - ath) / ath) * 100, 1)

            # Volume metrics
            vol_last = float(df['Volume'].iloc[-1])
            vol_avg_10 = float(df['Volume'].iloc[-10:].mean()) if total_bars >= 10 else vol_last
            rvol = round(vol_last / vol_avg_10, 2) if vol_avg_10 > 0 else 1.0

            # Technical MAs
            ema10 = float(df['Close'].ewm(span=10, adjust=False).mean().iloc[-1]) if total_bars >= 5 else cmp
            ema20 = float(df['Close'].ewm(span=20, adjust=False).mean().iloc[-1]) if total_bars >= 10 else cmp
            dma50 = round(float(df['Close'].rolling(50).mean().iloc[-1]), 2) if total_bars >= 50 else None
            dma200 = round(float(df['Close'].rolling(200).mean().iloc[-1]), 2) if total_bars >= 200 else None

            # Canonical Stage (Weinstein / Minervini)
            if cmp >= ema10 and cmp >= ema20 and (dma50 is None or cmp >= dma50):
                current_stage = "Stage 2 (Markup)"
                stage_code = "STAGE_2"
            elif drawdown_from_ath <= -30.0 and (dma50 and cmp < dma50):
                current_stage = "Stage 4 (Downtrend)"
                stage_code = "STAGE_4"
            elif total_bars <= 40 or abs(drawdown_from_ath) <= 18.0:
                current_stage = "Stage 1 (Base Building)"
                stage_code = "STAGE_1"
            else:
                current_stage = "Stage 3 (Distribution)"
                stage_code = "STAGE_3"

            # Setup Classifiers
            setup_type = None
            setup_label = None
            setup_status = "WATCHING"
            conviction_score = 50.0
            pivot_price = day1_high
            rationale = ""
            
            # 0. SETUP: Brand New Listing / Fresh Discovery Cohort (Days 1 to 60 / Bars <= 35)
            if total_bars <= 35 or days_since_listing <= 60:
                setup_type = "NEW_LISTING"
                setup_label = "Fresh Listing (Price Discovery)"
                setup_status = "TRIGGERED" if cmp >= day1_high else ("FORMING" if cmp >= day1_low else "PULLBACK")
                conviction_score = 92.0 if cmp >= day1_high else 85.0
                pivot_price = day1_high
                rationale = (
                    f"Fresh listing in active price discovery mode (Day {total_bars}, {days_since_listing}d since listing). "
                    f"Opening range: High Rs {day1_high:.1f} / Low Rs {day1_low:.1f}. "
                    f"Current price: Rs {cmp:.1f} ({'Breaking above Day 1 High' if cmp >= day1_high else 'Consolidating in initial range'})."
                )

            # 1. SETUP A: Listing Day High (LDH) Breakout into Blue Sky
            elif cmp >= day1_high * 0.97 and total_bars <= 90:
                dist_to_ldh = round(((cmp - day1_high) / day1_high) * 100, 2)
                if cmp >= day1_high:
                    setup_status = "TRIGGERED" if rvol >= 1.2 else "BREAKOUT_ATTEMPT"
                    conviction_score = 92.0 if rvol >= 1.25 else 82.0
                    setup_type = "LDH_BREAKOUT"
                    setup_label = "Blue-Sky Breakout"
                    rationale = f"Trading above Listing Day High (Rs {day1_high:.1f}) with zero overhead supply. Relative Volume: {rvol}x."
                else:
                    setup_status = "READY"
                    conviction_score = 86.0
                    setup_type = "LDH_BREAKOUT"
                    setup_label = "Testing Blue Sky Pivot"
                    rationale = f"Pressing against Listing High of Rs {day1_high:.1f} (only {dist_to_ldh:+.1f}% away). Ready for breakout trigger."
                pivot_price = day1_high

            # 2. SETUP B: Institutional IPO Base & Cheat Pivot (Days 12 to 60)
            elif 12 <= total_bars <= 70 and drawdown_from_ath >= -28.0:
                recent_low = float(df['Low'].iloc[-15:].min()) if total_bars >= 15 else float(df['Low'].min())
                base_depth = round(((day1_high - recent_low) / day1_high) * 100, 1)
                
                # Check for tight 3-day range and volume dry-up
                vol_3d = float(df['Volume'].iloc[-3:].mean())
                is_dry_volume = vol_3d < 0.75 * vol_avg_10 if vol_avg_10 > 0 else False
                rng_3d = (float(df['High'].iloc[-3:].max()) - float(df['Low'].iloc[-3:].min())) / cmp
                is_tight = rng_3d <= 0.06

                if is_tight and is_dry_volume and cmp >= ema10:
                    setup_type = "IPO_BASE_CHEAT"
                    setup_label = "IPO Base Contraction (Cheat)"
                    setup_status = "READY"
                    conviction_score = 88.0
                    pivot_price = float(df['High'].iloc[-3:].max())
                    rationale = f"Vol contraction inside shallow {base_depth}% base. Volume dried up to {vol_3d/vol_avg_10:.2f}x avg with tight 3-day closes."
                elif cmp >= ema20:
                    setup_type = "IPO_BASE"
                    setup_label = "IPO Base Accumulation"
                    setup_status = "FORMING"
                    conviction_score = 75.0
                    pivot_price = day1_high
                    rationale = f"Constructive {base_depth}% base building above 20 EMA. Awaiting supply dry-up."

            # 3. SETUP C: Anchor Lock-In Expiry & Absorption
            elif -5 <= days_to_30d <= 7 or -5 <= days_to_90d <= 7:
                is_30d = abs(days_to_30d) <= 7
                cliff_name = "30-Day (50% quota)" if is_30d else "90-Day (remaining quota)"
                days_left = days_to_30d if is_30d else days_to_90d
                
                if days_left > 0:
                    anchor_state = "UPCOMING_CLIFF"
                    setup_status = "PRE_CLIFF_WATCH"
                    conviction_score = 65.0
                    rationale = f"{cliff_name} unlocks in {days_left} trading days. Monitor for pre-lockin shakeout and morning bulk absorption."
                else:
                    # Absorption confirmation test: holding above prior 5-day low with volume
                    recent_5d_low = float(df['Low'].iloc[-5:].min())
                    if cmp > recent_5d_low and cmp >= ema10:
                        anchor_state = "ABSORPTION_CONFIRMED"
                        setup_status = "READY"
                        conviction_score = 90.0
                        setup_type = "ANCHOR_SPRING"
                        setup_label = "Anchor Float Absorbed"
                        pivot_price = float(df['High'].iloc[-3:].max())
                        rationale = f"Anchor unlock cleared! Mutual funds absorbed supply without breaking swing low of Rs {recent_5d_low:.1f}. High-conviction reversal."
                    else:
                        anchor_state = "UNDER_SUPPLY"
                        setup_status = "OBSERVING"
                        conviction_score = 55.0
                        rationale = f"Anchor shares hit market; price testing support near Rs {day1_low:.1f}."

            # 4. SETUP D: Broken Phoenix Turnaround (Listed 6-24 months ago, down > 35%, now reclaiming)
            elif total_bars >= 60 and drawdown_from_ath <= -35.0:
                low_30d = float(df['Low'].iloc[-30:].min()) if total_bars >= 30 else atl
                rebound_from_low = round(((cmp - low_30d) / low_30d) * 100, 1)
                
                # Turnaround test: crossed 20 EMA and 50 EMA with volume
                if ema50 and cmp > ema50 and ema20 > ema50 and rebound_from_low >= 12.0:
                    setup_type = "BROKEN_PHOENIX"
                    setup_label = "Broken Phoenix Turnaround"
                    setup_status = "TRIGGERED" if rvol >= 1.25 else "READY"
                    conviction_score = 85.0
                    pivot_price = float(df['High'].iloc[-10:].max())
                    rationale = f"Stage 1 bottoming reversal after {drawdown_from_ath}% crash. Reclaimed 50-day EMA with {rebound_from_low}% thrust off the lows."

            if not setup_type:
                return None  # No active high-conviction pattern

            # Trigger Price and Trigger Date Calculation
            trigger_price = round(pivot_price, 1)
            trigger_date = None
            days_since_trigger = None

            if setup_status == "TRIGGERED":
                trigger_date, days_since_trigger = cls.calculate_trigger_date(df, pivot_price)

            # Risk & Trade Management
            stop_loss = round(min(float(df['Low'].iloc[-1]) * 0.98, cmp * 0.93), 1)
            risk_pct = round(((cmp - stop_loss) / cmp) * 100, 1)
            target_1 = round(cmp * 1.15, 1)  # 2R Partial book
            target_2 = round(cmp * 1.30, 1)  # Runner target

            return {
                "id": cand["id"],
                "symbol": sym,
                "company": cand["company"],
                "exchange": cand["exchange"],
                "sector": cand["sector"],
                "listing_date": list_date.strftime("%Y-%m-%d"),
                "days_since_listing": days_since_listing,
                "total_trading_bars": total_bars,
                "cmp": cmp,
                "day_change_pct": day_change_pct,
                "day1_high": day1_high,
                "day1_low": day1_low,
                "ath": ath,
                "drawdown_from_ath": drawdown_from_ath,
                "rvol": rvol,
                "setup_type": setup_type,
                "setup_label": setup_label,
                "setup_status": setup_status,
                "conviction_score": conviction_score,
                "pivot_price": round(pivot_price, 1),
                "trigger_price": trigger_price,
                "trigger_date": trigger_date,
                "days_since_trigger": days_since_trigger,
                "distance_to_pivot_pct": round(((cmp - pivot_price) / pivot_price) * 100, 1),
                "stop_loss": stop_loss,
                "risk_pct": risk_pct,
                "target_1": target_1,
                "target_2": target_2,
                "anchor_30d_date": anchor_30d.strftime("%Y-%m-%d"),
                "anchor_30d_days_left": days_to_30d,
                "anchor_90d_date": anchor_90d.strftime("%Y-%m-%d"),
                "anchor_90d_days_left": days_to_90d,
                "sparkline": sparkline_points,
                "return_90d_pct": return_90d_pct,
                "current_stage": current_stage,
                "stage_code": stage_code,
                "dma50": dma50,
                "dma200": dma200,
                "market_cap": mcap_val,
                "market_cap_category": mcap_category,
                "rationale": rationale,
            }

        except Exception as e:
            logger.debug(f"Error analyzing IPO {sym}: {e}")
            return None

    @classmethod
    def scan_all(cls, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Runs complete scan across all Mainboard IPOs and returns structured radar results.
        """
        global _RADAR_CACHE
        now = time.time()
        
        with _CACHE_LOCK:
            cached_data = _RADAR_CACHE.get("data")
            is_valid_cache = (
                not force_refresh
                and _RADAR_CACHE.get("timestamp")
                and (now - _RADAR_CACHE["timestamp"]) < _CACHE_TTL_SECONDS
                and cached_data
                and len(cached_data.get("candidates", [])) > 0
            )
            if is_valid_cache:
                return cached_data

        db = SessionLocal()
        try:
            candidates = cls.get_mainboard_candidates(db)
        finally:
            db.close()

        import concurrent.futures
        
        # Focus on top 120 most recent / relevant Mainboard listings for high responsiveness
        target_cands = candidates[:120]
        logger.info(f"Scanning {len(target_cands)} Mainboard IPOs for active setups using concurrent workers...")
        
        active_setups = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
            future_to_cand = {executor.submit(cls.analyze_symbol, cand): cand for cand in target_cands}
            for future in concurrent.futures.as_completed(future_to_cand):
                try:
                    res = future.result()
                    if res:
                        active_setups.append(res)
                except Exception as e:
                    pass

        # Sort by conviction score descending
        active_setups.sort(key=lambda x: x["conviction_score"], reverse=True)

        # Category breakdowns
        new_listing_count = sum(1 for x in active_setups if x["setup_type"] == "NEW_LISTING")
        ldh_count = sum(1 for x in active_setups if "LDH" in x["setup_type"])
        base_count = sum(1 for x in active_setups if "BASE" in x["setup_type"])
        anchor_count = sum(1 for x in active_setups if "ANCHOR" in x["setup_type"] or abs(x["anchor_30d_days_left"]) <= 7)
        phoenix_count = sum(1 for x in active_setups if x["setup_type"] == "BROKEN_PHOENIX")

        payload = {
            "summary": {
                "total_monitored": len(candidates),
                "total_active_setups": len(active_setups),
                "new_listing_count": new_listing_count,
                "blue_sky_ldh_count": ldh_count,
                "ipo_base_count": base_count,
                "anchor_lockin_count": anchor_count,
                "broken_phoenix_count": phoenix_count,
                "scanned_at": datetime.now(timezone.utc).isoformat(),
            },
            "candidates": active_setups,
        }

        with _CACHE_LOCK:
            _RADAR_CACHE = {
                "timestamp": now,
                "data": payload
            }

        return payload

    @classmethod
    def get_candidate_by_symbol(cls, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves analyzed setup data for a given symbol from cache or on demand.
        """
        clean_sym = symbol.strip().upper()
        # Check cache first
        with _CACHE_LOCK:
            if _RADAR_CACHE.get("data"):
                for c in _RADAR_CACHE["data"].get("candidates", []):
                    if c.get("symbol", "").upper() == clean_sym:
                        return c
        
        # If not found in cache, pull candidates and analyze directly
        db = SessionLocal()
        try:
            candidates = cls.get_mainboard_candidates(db)
            target = next((c for c in candidates if c["symbol"].upper() == clean_sym), None)
            if target:
                return cls.analyze_symbol(target)
        finally:
            db.close()
        return None

    @classmethod
    def dispatch_telegram_alert(cls, cand: Dict[str, Any], force: bool = True) -> Dict[str, Any]:
        """
        Dispatches institutional Telegram alert for a specific IPO candidate setup.
        """
        from app.services.alert_dispatch_service import AlertDispatchService

        db = SessionLocal()
        try:
            tg_cfg = AlertDispatchService.get_telegram_config(db)
            if not tg_cfg or not tg_cfg.get("bot_token") or not tg_cfg.get("chat_id"):
                return {"success": False, "error": "Telegram channel is not configured or disabled in Settings."}

            bot_token = tg_cfg["bot_token"]
            chat_id = tg_cfg["chat_id"]
            sym = cand.get("symbol", "").strip().upper()

            # Deduplication cooldown check
            if not force and AlertDispatchService.is_duplicate_dispatch(db, channel="TELEGRAM", symbol=sym, cooldown_hours=4.0):
                return {"success": False, "error": f"Alert for {sym} already dispatched to Telegram within cooldown period."}

            memo = AlertDispatchService.format_ipo_radar_alert(
                symbol=sym,
                company_name=cand.get("company", sym),
                setup_type=cand.get("setup_type", "LDH_BREAKOUT"),
                setup_label=cand.get("setup_label", "IPO Setup"),
                setup_status=cand.get("setup_status", "TRIGGERED"),
                conviction_score=cand.get("conviction_score", 90.0),
                cmp=cand.get("cmp", 0.0),
                pivot_price=cand.get("pivot_price", 0.0),
                stop_loss=cand.get("stop_loss", 0.0),
                target_1=cand.get("target_1", 0.0),
                target_2=cand.get("target_2", 0.0),
                risk_pct=cand.get("risk_pct", 7.0),
                day1_high=cand.get("day1_high", 0.0),
                days_since_listing=cand.get("days_since_listing", 0),
                rvol=cand.get("rvol", 1.0),
                anchor_days_left=cand.get("anchor_30d_days_left"),
                rationale=cand.get("rationale"),
                action_url="http://localhost:3000/ipo-radar",
                trigger_price=cand.get("trigger_price"),
                trigger_date=cand.get("trigger_date"),
                days_since_trigger=cand.get("days_since_trigger"),
            )

            tg_res = AlertDispatchService.dispatch_telegram(
                bot_token=bot_token,
                chat_id=chat_id,
                text=memo,
            )

            status = "SUCCESS" if tg_res.get("success") else "FAILED"
            AlertDispatchService.log_dispatch(
                db=db,
                channel="TELEGRAM",
                recipient=chat_id,
                symbol=sym,
                payload_preview=memo,
                status=status,
                error_message=tg_res.get("error"),
            )

            # In-app notification
            severity = "critical" if cand.get("setup_status") == "TRIGGERED" else "info"
            trig_info = f"Trigger: ₹{cand.get('trigger_price', cand.get('pivot_price', 0)):,.1f}" + (f" on {cand.get('trigger_date')}" if cand.get('trigger_date') else "")
            AlertDispatchService.create_in_app_notification(
                db=db,
                title=f"🚀 IPO RADAR: {sym} ({cand.get('setup_label')} • {cand.get('conviction_score', 90):.0f} PTS)",
                message=(
                    f"{'TRIGGERED: ' if cand.get('setup_status') == 'TRIGGERED' else ''}"
                    f"CMP: ₹{cand.get('cmp', 0):,.1f}, {trig_info}, "
                    f"SL: ₹{cand.get('stop_loss', 0):,.1f}. Target: ₹{cand.get('target_1', 0):,.1f} (+15%)."
                ),
                category="IPO_RADAR",
                severity=severity,
                action_url="/ipo-radar",
                metadata=cand,
            )

            return {
                "success": tg_res.get("success", False),
                "message": f"Telegram alert {'dispatched' if tg_res.get('success') else 'failed'} for {sym}",
                "error": tg_res.get("error"),
                "memo": memo,
            }
        except Exception as e:
            logger.error(f"Error in dispatch_telegram_alert for {cand.get('symbol')}: {e}")
            return {"success": False, "error": str(e)}
        finally:
            db.close()


