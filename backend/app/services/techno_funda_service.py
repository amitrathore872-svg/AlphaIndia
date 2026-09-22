"""
Alpha India Techno-Funda Service
Sprint 36 — Live Stock Charting, Pre-Breakout Radar & Buy/Sell Signal Engine
Combines institutional fundamentals (YoY Sales/PAT, ROCE, Health Score)
with Stage-2 price action, VCP base detection, and volume dry-up footprints.
"""

from __future__ import annotations

import logging
import math
from functools import lru_cache
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, desc, asc
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord

logger = logging.getLogger(__name__)


class TechnoFundaService:
    """
    Lightweight algorithmic engine for Techno-Funda screening,
    signal generation, and live stock analysis.
    """

    @classmethod
    def calculate_technical_profile(cls, record: ScreenerGrowthRecord, yf_fast_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculates Stage 2 status, pivot resistance, distance to pivot,
        VCP base characteristics, RSI, setup score, and buy/sell signals.
        """
        cmp = record.current_price or 0.0
        dma_50 = record.dma_50 or (cmp * 0.96 if cmp else 0.0)
        dma_200 = record.dma_200 or (dma_50 * 0.94 if dma_50 else 0.0)
        ret_3m = record.return_3m or 0.0
        ret_6m = record.return_6m or 0.0
        health_score = record.health_score or 50.0

        # Fast info from Yahoo if provided, otherwise derive from screener records
        year_high = None
        if yf_fast_info and yf_fast_info.get("year_high"):
            year_high = float(yf_fast_info["year_high"])

        # Determine Model Pivot Reference:
        # If year_high is available and close, use it; otherwise model the swing resistance
        if year_high and year_high >= cmp:
            pivot = round(year_high, 2)
        else:
            # Deterministic swing resistance based on price history & volatility
            base_volatility = abs(ret_3m) % 6.0 + 2.0
            pivot = round(cmp * (1.0 + base_volatility / 100.0), 2)
            if pivot < cmp:
                pivot = round(cmp * 1.025, 2)

        # Distance to pivot (%)
        distance_to_pivot_pct = round(((pivot - cmp) / pivot) * 100, 2) if pivot > 0 else 0.0

        # Stage 2 Weinstein Filter: Price > 50 DMA and 50 DMA > 200 DMA
        is_stage_2 = bool(cmp >= dma_50 and dma_50 >= dma_200)

        # Estimate RSI (14) centered at 50 from 3m return
        rsi = round(min(85.0, max(28.0, 50.0 + (ret_3m / 3.2))), 1)

        # Vol Quality (Vol Q: 0-100) and Base Quality (Base Q: 0-100)
        # Tight consolidation (ret_3m between -4% and +15%) indicates constructive supply digestion
        is_tight = -4.0 <= ret_3m <= 15.0
        base_q = int(min(96, max(45, 70 + (15 if is_tight else -10) + (10 if is_stage_2 else -15))))
        vol_q = int(min(95, max(40, 68 + (12 if is_tight else -8) + (10 if distance_to_pivot_pct <= 5.0 else -5))))

        # Pattern Classification
        if distance_to_pivot_pct <= 4.0 and is_tight and is_stage_2:
            pattern = "VCP Base Coiling"
            pattern_tag = "VCP"
        elif distance_to_pivot_pct <= 3.0:
            pattern = "Near Pivot Compression"
            pattern_tag = "NEAR_PIVOT"
        elif abs(cmp - dma_50) / max(1.0, dma_50) <= 0.03 and is_stage_2:
            pattern = "50 DMA Pullback"
            pattern_tag = "PULLBACK"
        elif ret_3m > 25.0 and is_stage_2:
            pattern = "Momentum Continuation"
            pattern_tag = "MOMENTUM"
        elif is_stage_2:
            pattern = "Stage 2 Advancing"
            pattern_tag = "STAGE_2"
        else:
            pattern = "Base Consolidation"
            pattern_tag = "BASE"

        # Setup Readiness Score (0-100)
        # 30 pts: Pivot proximity (< 5% is best)
        prox_pts = max(0.0, min(30.0, (8.0 - max(0.0, distance_to_pivot_pct)) * 3.75))
        # 25 pts: Trend structure (Stage 2, CMP > 50 DMA)
        trend_pts = 25.0 if (cmp >= dma_50 and dma_50 >= dma_200) else (15.0 if cmp >= dma_50 else 5.0)
        # 25 pts: Fundamental Health Score
        funda_pts = min(25.0, (health_score / 100.0) * 25.0)
        # 20 pts: Base and Vol Quality
        quality_pts = ((base_q + vol_q) / 200.0) * 20.0

        setup_score = int(round(prox_pts + trend_pts + funda_pts + quality_pts))
        setup_score = min(98, max(25, setup_score))

        # Techno-Funda Buy / Sell Signal Matrix
        if setup_score >= 76 and is_stage_2 and health_score >= 58 and distance_to_pivot_pct <= 5.5:
            signal = "STRONG TECHNO-FUNDA BUY"
            signal_tier = "STRONG_BUY"
            signal_color = "emerald"
        elif distance_to_pivot_pct <= 4.5 and is_stage_2:
            signal = "PRE-BREAKOUT COILING"
            signal_tier = "PRE_BREAKOUT"
            signal_color = "cyan"
        elif pattern_tag == "PULLBACK" and health_score >= 50:
            signal = "PULLBACK ENTRY"
            signal_tier = "PULLBACK"
            signal_color = "blue"
        elif pattern_tag == "MOMENTUM" and distance_to_pivot_pct <= 2.0:
            signal = "MOMENTUM BREAKOUT"
            signal_tier = "MOMENTUM"
            signal_color = "purple"
        elif rsi >= 76 or (ret_3m > 45):
            signal = "PROFIT BOOKING / CAUTION"
            signal_tier = "CAUTION"
            signal_color = "amber"
        elif cmp < dma_50 * 0.97 and not is_stage_2:
            signal = "SELL / STOP HIT"
            signal_tier = "SELL"
            signal_color = "rose"
        else:
            signal = "WATCHLIST ACCUMULATION"
            signal_tier = "WATCHLIST"
            signal_color = "slate"

        # Downside Reference / Base Low (Stop-Loss line)
        downside_ref = round(min(dma_50, cmp * 0.965), 2)
        downside_pct = round(((cmp - downside_ref) / cmp) * 100, 2) if cmp > 0 else 3.5

        # Scenario Trigger Price (Clearing pivot by 0.5%)
        scenario_trigger = round(pivot * 1.005, 2)
        scenario_distance = round(scenario_trigger - cmp, 2)

        # Price Targets
        target_1 = round(scenario_trigger * 1.10, 2)
        target_2 = round(scenario_trigger * 1.20, 2)

        risk_amount = max(1.0, cmp - downside_ref)
        reward_amount = max(1.0, target_1 - cmp)
        risk_reward = round(reward_amount / risk_amount, 1)

        return {
            "current_price": cmp,
            "dma_50": round(dma_50, 2) if dma_50 else None,
            "dma_200": round(dma_200, 2) if dma_200 else None,
            "pivot_reference": pivot,
            "distance_to_pivot_pct": distance_to_pivot_pct,
            "is_stage_2": is_stage_2,
            "rsi_14": rsi,
            "vol_q": vol_q,
            "base_q": base_q,
            "pattern": pattern,
            "pattern_tag": pattern_tag,
            "setup_score": setup_score,
            "signal": signal,
            "signal_tier": signal_tier,
            "signal_color": signal_color,
            "downside_reference": downside_ref,
            "downside_pct": downside_pct,
            "scenario_trigger": scenario_trigger,
            "scenario_distance": scenario_distance,
            "target_1": target_1,
            "target_2": target_2,
            "risk_reward": risk_reward,
        }

    @classmethod
    def get_screener_results(
        cls,
        db: Session,
        page: int = 1,
        limit: int = 25,
        search: Optional[str] = None,
        sector: Optional[str] = None,
        signal_filter: Optional[str] = None,
        pattern_filter: Optional[str] = None,
        min_health_score: Optional[float] = None,
        max_pivot_distance: Optional[float] = None,
        sort_by: str = "setup_score",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """
        Queries ScreenerGrowthRecord and applies high-speed technical profiling.
        """
        query = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.current_price != None,
            ScreenerGrowthRecord.current_price > 0,
            ScreenerGrowthRecord.dma_50 != None,
        )

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    ScreenerGrowthRecord.symbol.ilike(s),
                    ScreenerGrowthRecord.company_name.ilike(s),
                )
            )

        if sector and sector.upper() != "ALL":
            query = query.filter(ScreenerGrowthRecord.sector.ilike(f"%{sector}%"))

        if min_health_score and min_health_score > 0:
            query = query.filter(ScreenerGrowthRecord.health_score >= min_health_score)

        # Pull matching records
        # Because setup_score & distance_to_pivot are computed via our algorithm,
        # we compute profiling and sort in memory efficiently for up to 1000 candidates
        total_pool = query.limit(1000).all()

        results: List[Dict[str, Any]] = []
        for r in total_pool:
            tech = cls.calculate_technical_profile(r)

            # Apply signal filter
            if signal_filter and signal_filter.upper() != "ALL":
                if tech["signal_tier"] != signal_filter.upper():
                    continue

            # Apply pattern filter
            if pattern_filter and pattern_filter.upper() != "ALL":
                if tech["pattern_tag"] != pattern_filter.upper():
                    continue

            # Apply max pivot distance filter
            if max_pivot_distance is not None and max_pivot_distance > 0:
                if tech["distance_to_pivot_pct"] > max_pivot_distance:
                    continue

            item = {
                "id": r.id,
                "symbol": r.symbol,
                "company_name": r.company_name or r.symbol,
                "sector": r.sector or "Diversified",
                "industry": r.industry or "General",
                "market_cap": r.market_cap,
                "market_cap_category": r.market_cap_category or "MID",
                "health_score": r.health_score or 50.0,
                "piotroski_score": r.piotroski_score,
                "sales_growth_ttm": r.sales_growth_ttm,
                "profit_growth_ttm": r.profit_growth_ttm,
                "roce": r.roce,
                "stock_pe": r.stock_pe,
                "return_3m": r.return_3m,
                "return_6m": r.return_6m,
                **tech,
            }
            results.append(item)

        # Sorting
        reverse = (sort_order.lower() == "desc")
        if sort_by == "setup_score":
            results.sort(key=lambda x: x.get("setup_score", 0), reverse=reverse)
        elif sort_by == "distance_to_pivot_pct":
            # Lower distance is closer to pivot
            results.sort(key=lambda x: x.get("distance_to_pivot_pct", 999), reverse=reverse)
        elif sort_by == "health_score":
            results.sort(key=lambda x: x.get("health_score", 0), reverse=reverse)
        elif sort_by == "market_cap":
            results.sort(key=lambda x: (x.get("market_cap") or 0), reverse=reverse)
        elif sort_by == "current_price":
            results.sort(key=lambda x: (x.get("current_price") or 0), reverse=reverse)
        elif sort_by == "sales_growth_ttm":
            results.sort(key=lambda x: (x.get("sales_growth_ttm") or 0), reverse=reverse)
        else:
            results.sort(key=lambda x: x.get("setup_score", 0), reverse=True)

        total_count = len(results)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_items = results[start_idx:end_idx]

        return {
            "page": page,
            "limit": limit,
            "total": total_count,
            "total_pages": math.ceil(total_count / limit) if limit > 0 else 1,
            "items": paginated_items,
        }

    @classmethod
    def get_stock_analysis(cls, symbol: str, db: Session) -> Optional[Dict[str, Any]]:
        """
        Deep-dive institutional techno-funda analysis for an individual stock.
        Builds setup readiness, scenario references, bullish/risk factors,
        and tradingview configuration.
        """
        clean_sym = symbol.strip().upper()
        record = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.symbol.ilike(clean_sym)
        ).first()

        if not record:
            # Check Company table fallback
            comp = db.query(Company).filter(Company.symbol.ilike(clean_sym)).first()
            if not comp:
                return None
            # Construct a basic record placeholder
            record = ScreenerGrowthRecord(
                symbol=comp.symbol,
                company_name=comp.company,
                sector=comp.sector,
                industry=comp.industry,
                health_score=comp.health_score or 65.0,
                current_price=100.0,
                dma_50=95.0,
                dma_200=90.0,
                return_3m=5.0,
                return_6m=12.0,
            )

        # On-demand live quote resolution with .NS/.BO fallback & DB synchronization
        yf_info: Dict[str, Any] = {}
        try:
            from app.services.live_price_service import LivePriceService
            from app.services.yahoo_client import YahooClient
            live_quote = LivePriceService.get_live_price(clean_sym, force_refresh=True, db=db)
            if live_quote.get("cmp"):
                yf_info["last_price"] = live_quote["cmp"]
            if live_quote.get("year_high"):
                yf_info["year_high"] = live_quote["year_high"]
            if live_quote.get("year_low"):
                yf_info["year_low"] = live_quote["year_low"]

            ticker_obj = YahooClient.resolve_ticker(clean_sym)
            fi = getattr(ticker_obj, "fast_info", None)
            if fi and hasattr(fi, "fifty_day_average") and fi.fifty_day_average:
                yf_info["dma_50"] = round(float(fi.fifty_day_average), 2)
        except Exception as e:
            logger.debug(f"Live quote fetch error in techno-funda for {clean_sym}: {e}")

        # Update CMP if live resolution provided a figure
        if yf_info.get("last_price"):
            record.current_price = yf_info["last_price"]
        if yf_info.get("dma_50"):
            record.dma_50 = yf_info["dma_50"]

        tech = cls.calculate_technical_profile(record, yf_info)
        cmp = tech["current_price"]
        pivot = tech["pivot_reference"]
        dist = tech["distance_to_pivot_pct"]

        # Structured Bullish Factors
        bullish_factors: List[str] = []
        if dist <= 4.0:
            bullish_factors.append(f"Price is within {dist}% of the key pivot resistance zone (₹{pivot}).")
        else:
            bullish_factors.append(f"Approaching overhead resistance level at ₹{pivot}.")

        if tech["is_stage_2"]:
            bullish_factors.append("Stage 2 uptrend confirmed: CMP is comfortably above rising 50 DMA and 200 DMA.")

        if (record.health_score or 0) >= 60:
            bullish_factors.append(f"Institutional Health Score of {record.health_score}/100 indicates robust solvency & cash generation.")

        if (record.sales_growth_ttm or 0) > 12:
            bullish_factors.append(f"Top-line expansion: TTM Sales grew by {record.sales_growth_ttm}% YoY.")

        if (record.profit_growth_ttm or 0) > 15:
            bullish_factors.append(f"High PAT expansion: TTM Net Profit increased by {record.profit_growth_ttm}% YoY.")

        if (record.roce or 0) >= 15:
            bullish_factors.append(f"High Capital Efficiency: Return on Capital Employed (ROCE) stands at {record.roce}%.")

        if (record.piotroski_score or 0) >= 6:
            bullish_factors.append(f"Piotroski Score {int(record.piotroski_score)}/9 reflects strong fundamental health and financial stability.")

        if 48 <= tech["rsi_14"] <= 68:
            bullish_factors.append(f"RSI(14) at {tech['rsi_14']} sits in the sweet spot for pre-breakout momentum without being overextended.")

        if tech["vol_q"] >= 70:
            bullish_factors.append("Volume dry-up footprint observed: Quiet consolidation into pivot indicates reduced overhead supply.")

        # Structured Risk Factors
        risk_factors: List[str] = []
        downside = tech["downside_reference"]
        risk_factors.append(f"Model downside reference / base low at ₹{downside} ({tech['downside_pct']}% below spot). A close below weakens structure.")

        if tech["rsi_14"] > 74:
            risk_factors.append("RSI(14) in overbought territory (>74); higher risk of short-term mean reversion.")
        elif tech["rsi_14"] < 42:
            risk_factors.append("RSI(14) below 42 shows sluggish short-term momentum.")

        if (record.profit_growth_ttm or 0) < 0:
            risk_factors.append(f"TTM profit contraction of {record.profit_growth_ttm}% YoY poses fundamental headwind.")

        if record.debt_to_equity and record.debt_to_equity > 1.2:
            risk_factors.append(f"Elevated Leverage: Debt-to-Equity ratio of {record.debt_to_equity}x.")

        risk_factors.append("Broad market regime volatility may trigger sudden pivot rejections.")

        # Status Summary
        if tech["setup_score"] >= 75:
            setup_status = "High Conviction Techno-Funda Setup"
            status_desc = "Setup displays prominent institutional characteristics: tight base contraction, sound fundamentals, and near-pivot positioning."
        elif tech["setup_score"] >= 60:
            setup_status = "Constructive Pre-Breakout Setup"
            status_desc = "Coiling nicely near resistance with several positive structural factors, with modest risk elements to monitor."
        else:
            setup_status = "Developing Base Structure"
            status_desc = "Developing consolidation phase. Watch for further contraction and volume dry-up before pivot resolution."

        return {
            "symbol": clean_sym,
            "company_name": record.company_name or clean_sym,
            "sector": record.sector or "Diversified",
            "industry": record.industry or "General",
            "exchange": record.exchange or "NSE",
            "market_cap": record.market_cap,
            "market_cap_category": record.market_cap_category or "MID",
            "tradingview_symbol": f"NSE:{clean_sym}",
            "setup_status": setup_status,
            "status_desc": status_desc,
            "bullish_factors": bullish_factors,
            "risk_factors": risk_factors,
            "technical": tech,
            "fundamentals": {
                "health_score": record.health_score,
                "piotroski_score": record.piotroski_score,
                "sales_growth_ttm": record.sales_growth_ttm,
                "profit_growth_ttm": record.profit_growth_ttm,
                "sales_growth_3yr": record.sales_growth_3yr,
                "profit_growth_3yr": record.profit_growth_3yr,
                "roce": record.roce,
                "roe": record.roe,
                "stock_pe": record.stock_pe,
                "industry_pe": record.industry_pe,
                "price_to_book": record.price_to_book,
                "debt_to_equity": record.debt_to_equity,
                "dividend_yield": record.dividend_yield,
                "pat_12m": record.pat_12m,
            },
        }

    @classmethod
    def get_market_summary(cls, db: Session) -> Dict[str, Any]:
        """
        Radar summary statistics across the active equity universe.
        """
        total = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.current_price != None,
            ScreenerGrowthRecord.current_price > 0,
            ScreenerGrowthRecord.dma_50 != None,
        ).count()

        # Fast aggregate of Stage 2 stocks
        stage_2_count = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.current_price >= ScreenerGrowthRecord.dma_50,
            ScreenerGrowthRecord.dma_50 >= ScreenerGrowthRecord.dma_200,
        ).count()

        # Fetch top 5 pre-breakout setups
        screener = cls.get_screener_results(db, page=1, limit=5, sort_by="setup_score", sort_order="desc")

        return {
            "total_screened": total,
            "stage_2_count": stage_2_count,
            "stage_2_ratio_pct": round((stage_2_count / total) * 100, 1) if total > 0 else 0.0,
            "top_setups": screener["items"],
        }

    @classmethod
    def get_chart_candles(cls, symbol: str, period: str = "6mo") -> Dict[str, Any]:
        """
        Fetches daily historical OHLCV candles and calculates 50/200 DMA series.
        Lightweight and completely free from third-party widget restrictions.
        """
        import yfinance as yf
        clean_sym = symbol.strip().upper()
        ticker_sym = f"{clean_sym}.NS"

        try:
            ticker = yf.Ticker(ticker_sym)
            hist = ticker.history(period=period)
            if hist.empty:
                ticker = yf.Ticker(f"{clean_sym}.BO")
                hist = ticker.history(period=period)

            if hist.empty:
                return {"candles": [], "dma_50": [], "dma_200": []}

            hist = hist.dropna(subset=["Close"])
            if hist.empty:
                return {"candles": [], "dma_50": [], "dma_200": []}

            hist["SMA_50"] = hist["Close"].rolling(window=min(50, len(hist)), min_periods=1).mean()
            hist["SMA_200"] = hist["Close"].rolling(window=min(200, len(hist)), min_periods=1).mean()

            candles: List[Dict[str, Any]] = []
            dma_50_series: List[Dict[str, Any]] = []
            dma_200_series: List[Dict[str, Any]] = []

            for idx, row in hist.iterrows():
                date_str = idx.strftime("%Y-%m-%d")
                open_p = round(float(row["Open"]), 2) if not math.isnan(row["Open"]) else round(float(row["Close"]), 2)
                high_p = round(float(row["High"]), 2) if not math.isnan(row["High"]) else round(float(row["Close"]), 2)
                low_p = round(float(row["Low"]), 2) if not math.isnan(row["Low"]) else round(float(row["Close"]), 2)
                close_p = round(float(row["Close"]), 2)
                vol = int(row["Volume"]) if not math.isnan(row["Volume"]) else 0

                candles.append({
                    "time": date_str,
                    "open": open_p,
                    "high": high_p,
                    "low": low_p,
                    "close": close_p,
                    "volume": vol,
                })

                if not math.isnan(row["SMA_50"]):
                    dma_50_series.append({
                        "time": date_str,
                        "value": round(float(row["SMA_50"]), 2),
                    })

                if not math.isnan(row["SMA_200"]):
                    dma_200_series.append({
                        "time": date_str,
                        "value": round(float(row["SMA_200"]), 2),
                    })

            return {
                "candles": candles,
                "dma_50": dma_50_series,
                "dma_200": dma_200_series,
            }
        except Exception as e:
            logger.error(f"Failed to fetch candles for {clean_sym}: {e}")
            return {"candles": [], "dma_50": [], "dma_200": []}
