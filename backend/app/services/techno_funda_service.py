"""
Alpha India CANSLIM & Techno-Funda Institutional Engine
Sprint 36 — Institutional Growth Scanner & Trade Execution Engine
Combines William O'Neil CANSLIM principles & Minervini 8-Point Trend Template:
• C: Current Quarterly Earnings (PAT YoY > 25%, Sales YoY > 20%, OPM expansion)
• A: Annual Compounding & Capital Efficiency (ROCE > 18%, 3Y Profit CAGR > 15%)
• N: New Highs & 52-Week Proximity (Trading within 0-15% of 52-Week High)
• S: Supply & Demand / Pristine Balance Sheet (Debt/Equity < 0.8, Piotroski >= 6)
• L: Leader in Stage 2 Uptrend (CMP > 50 DMA > 200 DMA, RS/RSI sweet-spot)
• I: Institutional Sponsorship (FII + DII holding > 15%)
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
    Algorithmic CANSLIM & Techno-Funda screening engine,
    dual-conviction scoring, trade execution level calculation,
    and live stock analysis.
    """

    @classmethod
    def calculate_technical_profile(
        cls,
        record: ScreenerGrowthRecord,
        yf_fast_info: Optional[Dict[str, Any]] = None,
        comp_sector: Optional[str] = None,
        comp_industry: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calculates CANSLIM composite score, institutional fundamental health,
        Minervini 8-point trend template compliance, pivot execution levels,
        and asymmetric trade plans.
        """
        cmp = record.current_price or 0.0
        dma_50 = record.dma_50 or (cmp * 0.96 if cmp else 0.0)
        dma_200 = record.dma_200 or (dma_50 * 0.94 if dma_50 else 0.0)
        
        # Real 52-Week High / Low resolution
        high_52 = record.high_52_week
        if not high_52 and yf_fast_info and yf_fast_info.get("year_high"):
            high_52 = float(yf_fast_info["year_high"])
        if not high_52 or high_52 <= 0:
            high_52 = round(cmp * 1.06, 2)

        low_52 = record.low_52_week
        if not low_52 and yf_fast_info and yf_fast_info.get("year_low"):
            low_52 = float(yf_fast_info["year_low"])
        if not low_52 or low_52 <= 0:
            low_52 = round(cmp * 0.65, 2)

        dist_52w_high_pct = max(0.0, round(((high_52 - cmp) / high_52) * 100, 2)) if high_52 > 0 else 0.0
        gain_from_52w_low_pct = max(0.0, round(((cmp - low_52) / low_52) * 100, 2)) if low_52 > 0 else 0.0

        # Stage 2 Weinstein Filter: CMP >= 50 DMA and 50 DMA >= 200 DMA
        is_stage_2 = bool(cmp >= dma_50 and dma_50 >= dma_200)

        # Real RSI 14
        rsi = round(record.rsi_14, 1) if record.rsi_14 is not None else 50.0

        # Fundamentals extraction
        pat_yoy = record.quarterly_pat_yoy if record.quarterly_pat_yoy is not None else (record.profit_growth_ttm or 0.0)
        sales_yoy = record.quarterly_sales_yoy if record.quarterly_sales_yoy is not None else (record.sales_growth_ttm or 0.0)
        roce = record.roce or 0.0
        roe = record.roe or 0.0
        opm = record.opm_latest if record.opm_latest is not None else (record.opm_ttm or 0.0)
        profit_cagr_3yr = record.profit_growth_3yr if record.profit_growth_3yr is not None else (record.profit_growth_ttm or 0.0)
        debt_to_equity = record.debt_to_equity
        piotroski = record.piotroski_score or 5.0
        fii = record.fii_holding or 0.0
        dii = record.dii_holding or 0.0
        institutional_holding = round(fii + dii, 2)

        # ── 1. CANSLIM DETAILED SCORING (0 to 100) ─────────────────────────
        # C: Current Quarterly Earnings Acceleration (25 pts)
        c_score = 0
        if pat_yoy >= 50.0: c_score += 15
        elif pat_yoy >= 25.0: c_score += 12
        elif pat_yoy >= 15.0: c_score += 8
        elif pat_yoy > 0.0: c_score += 4

        if sales_yoy >= 25.0: c_score += 6
        elif sales_yoy >= 15.0: c_score += 4
        elif sales_yoy > 0.0: c_score += 2

        if opm >= 15.0: c_score += 4
        elif opm >= 10.0: c_score += 2

        # A: Annual Compounding & Capital Efficiency (20 pts)
        a_score = 0
        if roce >= 25.0: a_score += 8
        elif roce >= 18.0: a_score += 6
        elif roce >= 12.0: a_score += 3

        if profit_cagr_3yr >= 25.0: a_score += 7
        elif profit_cagr_3yr >= 15.0: a_score += 4
        elif profit_cagr_3yr > 0.0: a_score += 2

        if roe >= 18.0: a_score += 5
        elif roe >= 12.0: a_score += 3

        # N: New Highs & 52-Week High Proximity (15 pts)
        n_score = 0
        if dist_52w_high_pct <= 4.0: n_score += 15
        elif dist_52w_high_pct <= 10.0: n_score += 12
        elif dist_52w_high_pct <= 18.0: n_score += 8
        elif dist_52w_high_pct <= 25.0: n_score += 4

        # S: Supply & Demand / Sound Balance Sheet (15 pts)
        s_score = 0
        if debt_to_equity is None or debt_to_equity <= 0.3: s_score += 7
        elif debt_to_equity <= 0.8: s_score += 5
        elif debt_to_equity <= 1.2: s_score += 2
        elif debt_to_equity > 1.5: s_score = max(0, s_score - 3)

        if piotroski >= 8.0: s_score += 8
        elif piotroski >= 6.0: s_score += 6
        elif piotroski >= 4.0: s_score += 3

        # L: Leader & Stage-2 Uptrend (15 pts)
        l_score = 0
        if is_stage_2: l_score += 9
        elif cmp >= dma_50: l_score += 5

        if 50.0 <= rsi <= 68.0: l_score += 6
        elif (45.0 <= rsi < 50.0) or (68.0 < rsi <= 74.0): l_score += 3

        # I: Institutional Sponsorship (10 pts)
        i_score = 0
        if institutional_holding >= 25.0: i_score += 10
        elif institutional_holding >= 15.0: i_score += 7
        elif institutional_holding >= 8.0: i_score += 4
        elif institutional_holding > 0.0: i_score += 2

        canslim_total = min(99, max(20, c_score + a_score + n_score + s_score + l_score + i_score))
        funda_score = round((c_score + a_score + s_score + i_score) * (50.0 / 70.0), 1)
        techno_score = round((n_score + l_score) * (50.0 / 30.0), 1)

        # ── 2. MINERVINI 8-POINT TREND TEMPLATE CHECKLIST ──────────────────
        m_crit_1 = bool(cmp >= dma_200)
        m_crit_2 = bool(dma_50 >= dma_200)
        m_crit_3 = bool(dma_200 > 0)
        m_crit_4 = bool(dma_50 >= dma_200)
        m_crit_5 = bool(cmp >= dma_50)
        m_crit_6 = bool(gain_from_52w_low_pct >= 28.0)
        m_crit_7 = bool(dist_52w_high_pct <= 25.0)
        m_crit_8 = bool(48.0 <= rsi <= 72.0)
        minervini_pass_count = sum([m_crit_1, m_crit_2, m_crit_3, m_crit_4, m_crit_5, m_crit_6, m_crit_7, m_crit_8])

        # ── 3. CANSLIM CHECKLIST SUMMARY ──────────────────────────────────
        canslim_checklist = {
            "C": {
                "status": "PASS" if c_score >= 14 else ("WARN" if c_score >= 8 else "FAIL"),
                "title": "Current Qtr Earnings",
                "value": f"+{pat_yoy:.1f}% PAT YoY",
                "detail": f"Sales YoY: +{sales_yoy:.1f}%, OPM: {opm:.1f}%",
                "points": c_score,
                "max_points": 25,
            },
            "A": {
                "status": "PASS" if a_score >= 12 else ("WARN" if a_score >= 6 else "FAIL"),
                "title": "Annual Growth & ROCE",
                "value": f"{roce:.1f}% ROCE",
                "detail": f"3Y CAGR: {profit_cagr_3yr:.1f}%, ROE: {roe:.1f}%",
                "points": a_score,
                "max_points": 20,
            },
            "N": {
                "status": "PASS" if n_score >= 12 else ("WARN" if n_score >= 6 else "FAIL"),
                "title": "New High Proximity",
                "value": f"-{dist_52w_high_pct:.1f}% from 52W High",
                "detail": f"52W High: Rs.{high_52:.1f}, CMP: Rs.{cmp:.1f}",
                "points": n_score,
                "max_points": 15,
            },
            "S": {
                "status": "PASS" if s_score >= 10 else ("WARN" if s_score >= 6 else "FAIL"),
                "title": "Supply & Balance Sheet",
                "value": f"Piotroski {int(piotroski)}/9",
                "detail": f"Debt/Eq: {debt_to_equity if debt_to_equity is not None else 0.0:.2f}x",
                "points": s_score,
                "max_points": 15,
            },
            "L": {
                "status": "PASS" if l_score >= 12 else ("WARN" if l_score >= 6 else "FAIL"),
                "title": "Leader / Stage 2",
                "value": "Stage 2 Confirmed" if is_stage_2 else ("Above 50 DMA" if cmp >= dma_50 else "Lagging"),
                "detail": f"RSI(14): {rsi:.1f}, 50DMA: Rs.{dma_50:.1f}",
                "points": l_score,
                "max_points": 15,
            },
            "I": {
                "status": "PASS" if i_score >= 7 else ("WARN" if i_score >= 4 else "FAIL"),
                "title": "Institutional Sponsorship",
                "value": f"{institutional_holding:.1f}% FII+DII",
                "detail": f"FII: {fii:.1f}%, DII: {dii:.1f}%",
                "points": i_score,
                "max_points": 10,
            },
        }

        # ── 4. CANSLIM ARCHETYPE & SIGNAL DETERMINATION ───────────────────
        if canslim_total >= 82 and is_stage_2 and dist_52w_high_pct <= 15.0:
            archetype = "CANSLIM_TITAN"
            archetype_label = "CANSLIM Super-Stock"
            signal = "CANSLIM ELITE BUY"
            signal_tier = "STRONG_BUY"
            signal_color = "emerald"
        elif c_score >= 18 and is_stage_2:
            archetype = "EARNINGS_ACCELERATOR"
            archetype_label = "Earnings Acceleration"
            signal = "BLOCKBUSTER PAT ACCELERATION"
            signal_tier = "STRONG_BUY"
            signal_color = "cyan"
        elif dist_52w_high_pct <= 5.0 and is_stage_2 and c_score >= 10:
            archetype = "NEW_HIGH_BREAKOUT"
            archetype_label = "52W High Breakout"
            signal = "52W HIGH PIVOT BREAKOUT"
            signal_tier = "PRE_BREAKOUT"
            signal_color = "purple"
        elif i_score >= 7 and a_score >= 12 and is_stage_2:
            archetype = "INSTITUTIONAL_LEADER"
            archetype_label = "Institutional Titan"
            signal = "INSTITUTIONAL SPONSORSHIP"
            signal_tier = "STRONG_BUY"
            signal_color = "blue"
        elif (record.stock_pe and record.stock_pe <= 32) and pat_yoy >= 25 and roce >= 18:
            archetype = "VALUE_GROWTH"
            archetype_label = "Value Growth / PEG"
            signal = "VALUE GROWTH COMPOUNDER"
            signal_tier = "BUY"
            signal_color = "amber"
        elif is_stage_2:
            archetype = "STAGE_2_LEADER"
            archetype_label = "Stage 2 Advancing"
            signal = "STAGE 2 MOMENTUM"
            signal_tier = "BUY"
            signal_color = "teal"
        else:
            archetype = "BASE_BUILDING"
            archetype_label = "Base Accumulation"
            signal = "WATCHLIST ACCUMULATION"
            signal_tier = "WATCHLIST"
            signal_color = "slate"

        # ── 5. ASYMMETRIC TRADE EXECUTION PLAN ────────────────────────────
        pivot_reference = round(high_52 if high_52 >= cmp else cmp * 1.025, 2)
        scenario_trigger = round(pivot_reference * 1.005, 2)
        scenario_distance = round(scenario_trigger - cmp, 2)
        
        # Stop loss anchored to 50 DMA or max 5% below CMP
        stop_loss = round(max(cmp * 0.95, dma_50 if (dma_50 > 0 and dma_50 < cmp) else cmp * 0.95), 2)
        downside_pct = round(((cmp - stop_loss) / cmp) * 100, 2) if cmp > 0 else 4.5
        risk_per_share = max(1.0, scenario_trigger - stop_loss)
        target_1 = round(scenario_trigger + (risk_per_share * 2.0), 2)
        target_2 = round(scenario_trigger + (risk_per_share * 3.0), 2)
        risk_reward = round((target_1 - scenario_trigger) / risk_per_share, 1)

        # ── 6. TOP 1% SNIPER ALPHA CONFLUENCE SCORE (0 to 100) ───────────
        # Confluence weighting: 35% CANSLIM Composite + 25% 52W-High Proximity + 20% Earnings Acceleration + 20% Institutional Backing
        proximity_pts = max(0.0, 25.0 - (dist_52w_high_pct * 4.0))
        pat_pts = min(20.0, (pat_yoy / 5.0)) if pat_yoy > 0 else 0.0
        inst_pts = min(20.0, (institutional_holding / 2.5))
        canslim_pts = (canslim_total / 100.0) * 35.0
        sniper_alpha_score = round(canslim_pts + proximity_pts + pat_pts + inst_pts, 1)

        is_top_1_percent = bool(
            dist_52w_high_pct <= 6.0
            and canslim_total >= 85
            and institutional_holding >= 12.0
            and minervini_pass_count >= 7
            and 45.0 <= rsi <= 72.0
            and (debt_to_equity is None or debt_to_equity <= 0.8)
            and is_stage_2
        )

        return {
            "current_price": cmp,
            "dma_50": round(dma_50, 2) if dma_50 else None,
            "dma_200": round(dma_200, 2) if dma_200 else None,
            "high_52_week": round(high_52, 2),
            "low_52_week": round(low_52, 2),
            "dist_52w_high_pct": dist_52w_high_pct,
            "gain_from_52w_low_pct": gain_from_52w_low_pct,
            "is_stage_2": is_stage_2,
            "rsi_14": rsi,
            "canslim_score": canslim_total,
            "setup_score": canslim_total,  # backward compatibility
            "funda_score": funda_score,
            "techno_score": techno_score,
            "sniper_alpha_score": sniper_alpha_score,
            "is_top_1_percent": is_top_1_percent,
            "c_score": c_score,
            "a_score": a_score,
            "n_score": n_score,
            "s_score": s_score,
            "l_score": l_score,
            "i_score": i_score,
            "canslim_checklist": canslim_checklist,
            "minervini_pass_count": minervini_pass_count,
            "minervini_criteria": {
                "cmp_above_150_200": m_crit_1,
                "dma_50_above_200": m_crit_2,
                "dma_200_rising": m_crit_3,
                "dma_50_above_150_200": m_crit_4,
                "cmp_above_50": m_crit_5,
                "cmp_above_52w_low_30pct": m_crit_6,
                "cmp_within_52w_high_25pct": m_crit_7,
                "rs_momentum_pass": m_crit_8,
            },
            "archetype": archetype,
            "archetype_label": archetype_label,
            "pattern": archetype_label,
            "pattern_tag": archetype,
            "signal": signal,
            "signal_tier": signal_tier,
            "signal_color": signal_color,
            "pivot_reference": pivot_reference,
            "distance_to_pivot_pct": dist_52w_high_pct,
            "downside_reference": stop_loss,
            "downside_pct": downside_pct,
            "scenario_trigger": scenario_trigger,
            "scenario_distance": scenario_distance,
            "target_1": target_1,
            "target_2": target_2,
            "risk_reward": risk_reward,
            "institutional_holding": institutional_holding,
            "fii_holding": fii,
            "dii_holding": dii,
            "quarterly_pat_yoy": pat_yoy,
            "quarterly_sales_yoy": sales_yoy,
            "roce": roce,
            "roe": roe,
        }

    @classmethod
    def get_screener_results(
        cls,
        db: Session,
        page: int = 1,
        limit: int = 25,
        search: Optional[str] = None,
        sector: Optional[str] = None,
        preset: Optional[str] = None,
        signal_filter: Optional[str] = None,
        pattern_filter: Optional[str] = None,
        min_health_score: Optional[float] = None,
        max_pivot_distance: Optional[float] = None,
        min_market_cap: Optional[float] = None,
        sort_by: str = "canslim_score",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """
        Queries ScreenerGrowthRecord joined with Company master, applies CANSLIM
        scoring, filters by institutional strategy presets, and returns rich paginated results.
        """
        query = db.query(
            ScreenerGrowthRecord,
            Company.sector.label("comp_sector"),
            Company.industry.label("comp_industry")
        ).outerjoin(Company, Company.symbol == ScreenerGrowthRecord.symbol).filter(
            ScreenerGrowthRecord.current_price != None,
            ScreenerGrowthRecord.current_price >= 15.0,
            ScreenerGrowthRecord.dma_50 != None,
        )

        effective_min_mcap = min_market_cap if min_market_cap is not None else 150.0
        if effective_min_mcap > 0:
            query = query.filter(
                or_(
                    ScreenerGrowthRecord.market_cap == None,
                    ScreenerGrowthRecord.market_cap >= effective_min_mcap
                )
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
            sec_s = f"%{sector.strip()}%"
            query = query.filter(
                or_(
                    Company.sector.ilike(sec_s),
                    ScreenerGrowthRecord.sector.ilike(sec_s),
                )
            )

        if min_health_score and min_health_score > 0:
            query = query.filter(ScreenerGrowthRecord.health_score >= min_health_score)

        total_pool = query.limit(2500).all()

        results: List[Dict[str, Any]] = []
        for r, comp_sec, comp_ind in total_pool:
            resolved_sector = comp_sec or r.sector or "Diversified"
            resolved_industry = comp_ind or r.industry or "General"

            tech = cls.calculate_technical_profile(
                record=r,
                comp_sector=resolved_sector,
                comp_industry=resolved_industry
            )

            # Strategy Preset Filters
            active_preset = (preset or "").strip().upper()
            if active_preset == "TOP_1_PERCENT_SNIPER":
                if not tech["is_top_1_percent"]:
                    continue
            elif active_preset == "CANSLIM_TITANS":
                if tech["canslim_score"] < 80 or tech["c_score"] < 12 or tech["l_score"] < 9:
                    continue
            elif active_preset == "EARNINGS_ACCELERATORS":
                if tech["quarterly_pat_yoy"] < 35.0:
                    continue
            elif active_preset == "INSTITUTIONAL_FAVORITES":
                if tech["institutional_holding"] < 18.0 or not tech["is_stage_2"]:
                    continue
            elif active_preset == "NEW_HIGHS_52W":
                if tech["dist_to_52w_high_pct"] > 6.0 or not tech["is_stage_2"]:
                    continue
            elif active_preset == "VALUE_GROWTH":
                pe = r.stock_pe or 999.0
                if pe > 35.0 or tech["quarterly_pat_yoy"] < 25.0 or tech["roce"] < 18.0:
                    continue
            elif active_preset == "STAGE_2_LEADERS":
                if not tech["is_stage_2"]:
                    continue

            # Legacy filter compatibility
            if signal_filter and signal_filter.upper() != "ALL":
                if tech["signal_tier"] != signal_filter.upper():
                    continue

            if pattern_filter and pattern_filter.upper() != "ALL":
                tgt = pattern_filter.upper()
                if tech["archetype"] != tgt and tech["pattern_tag"] != tgt:
                    continue

            if max_pivot_distance is not None and max_pivot_distance > 0:
                if tech["dist_to_52w_high_pct"] > max_pivot_distance:
                    continue

            item = {
                "id": r.id,
                "symbol": r.symbol,
                "company_name": r.company_name or r.symbol,
                "sector": resolved_sector,
                "industry": resolved_industry,
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

        # Dynamic Sorting
        reverse = (sort_order.lower() == "desc")
        if active_preset == "TOP_1_PERCENT_SNIPER" and sort_by in ("canslim_score", "setup_score", "sniper_alpha_score", "sniper_score"):
            results.sort(key=lambda x: x.get("sniper_alpha_score", 0), reverse=reverse)
        elif sort_by in ("sniper_alpha_score", "sniper_score"):
            results.sort(key=lambda x: x.get("sniper_alpha_score", 0), reverse=reverse)
        elif sort_by in ("canslim_score", "setup_score"):
            results.sort(key=lambda x: x.get("canslim_score", 0), reverse=reverse)
        elif sort_by == "funda_score":
            results.sort(key=lambda x: x.get("funda_score", 0), reverse=reverse)
        elif sort_by == "techno_score":
            results.sort(key=lambda x: x.get("techno_score", 0), reverse=reverse)
        elif sort_by == "quarterly_pat_yoy":
            results.sort(key=lambda x: x.get("quarterly_pat_yoy", 0), reverse=reverse)
        elif sort_by == "quarterly_sales_yoy":
            results.sort(key=lambda x: x.get("quarterly_sales_yoy", 0), reverse=reverse)
        elif sort_by == "dist_52w_high_pct":
            results.sort(key=lambda x: x.get("dist_52w_high_pct", 999), reverse=reverse)
        elif sort_by == "roce":
            results.sort(key=lambda x: x.get("roce", 0), reverse=reverse)
        elif sort_by == "institutional_holding":
            results.sort(key=lambda x: x.get("institutional_holding", 0), reverse=reverse)
        elif sort_by == "market_cap":
            results.sort(key=lambda x: (x.get("market_cap") or 0), reverse=reverse)
        elif sort_by == "current_price":
            results.sort(key=lambda x: (x.get("current_price") or 0), reverse=reverse)
        else:
            results.sort(key=lambda x: x.get("canslim_score", 0), reverse=True)

        total_count = len(results)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_items = results[start_idx:end_idx]

        try:
            from app.services.stock_trend_enricher import StockTrendEnricher
            StockTrendEnricher.enrich(db, paginated_items, symbol_key="symbol", cmp_key="current_price")
        except Exception as e:
            logger.debug(f"[TechnoFunda] Sparkline enrichment note: {e}")

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
        Deep-dive institutional CANSLIM & techno-funda analysis for an individual stock.
        Builds setup readiness, scenario references, bullish/risk factors,
        and tradingview configuration.
        """
        clean_sym = symbol.strip().upper()
        record = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.symbol.ilike(clean_sym)
        ).first()

        comp = db.query(Company).filter(Company.symbol.ilike(clean_sym)).first()
        comp_sec = comp.sector if comp else None
        comp_ind = comp.industry if comp else None

        if not record:
            if not comp:
                return None
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

        yf_info: Dict[str, Any] = {}
        try:
            from app.services.live_price_service import LivePriceService
            live_quote = LivePriceService.get_live_price(clean_sym, force_refresh=False, db=db)
            if live_quote and live_quote.get("cmp"):
                yf_info["last_price"] = live_quote["cmp"]
            if live_quote and live_quote.get("year_high"):
                yf_info["year_high"] = live_quote["year_high"]
            if live_quote and live_quote.get("year_low"):
                yf_info["year_low"] = live_quote["year_low"]
        except Exception as e:
            logger.debug(f"Live quote fetch note in techno-funda for {clean_sym}: {e}")

        if yf_info.get("last_price"):
            record.current_price = yf_info["last_price"]

        tech = cls.calculate_technical_profile(
            record=record,
            yf_fast_info=yf_info,
            comp_sector=comp_sec,
            comp_industry=comp_ind,
        )

        cmp = tech["current_price"]
        high_52 = tech["high_52_week"]
        dist_52 = tech["dist_52w_high_pct"]
        pat_yoy = tech["quarterly_pat_yoy"]
        roce = tech["roce"]
        inst = tech["institutional_holding"]

        bullish_factors: List[str] = []
        if tech["canslim_score"] >= 80:
            bullish_factors.append(
                f"CANSLIM Elite Super-Stock: Achieved an institutional composite score of {tech['canslim_score']}/100."
            )
        if pat_yoy >= 25.0:
            bullish_factors.append(
                f"C-Factor (Current Earnings): High quarterly earnings acceleration with PAT growing +{pat_yoy:.1f}% YoY."
            )
        if roce >= 18.0:
            bullish_factors.append(
                f"A-Factor (Capital Efficiency): Stellar Return on Capital Employed (ROCE) at {roce:.1f}%."
            )
        if dist_52 <= 10.0:
            bullish_factors.append(
                f"N-Factor (New High Proximity): Trading within {dist_52:.1f}% of its 52-week high (Rs.{high_52:.1f})."
            )
        if inst >= 15.0:
            bullish_factors.append(
                f"I-Factor (Institutional Sponsorship): Strong institutional backing with {inst:.1f}% held by FII & DII funds."
            )
        if tech["is_stage_2"]:
            bullish_factors.append(
                f"L-Factor (Market Leader): Weinstein Stage 2 uptrend confirmed with CMP comfortably above 50 & 200 DMA."
            )
        if tech["minervini_pass_count"] >= 6:
            bullish_factors.append(
                f"Minervini Trend Template: Passed {tech['minervini_pass_count']}/8 criteria for institutional breakout setups."
            )

        risk_factors: List[str] = []
        stop_loss = tech["downside_reference"]
        risk_factors.append(f"Model stop loss at Rs.{stop_loss} ({tech['downside_pct']}% below spot). A break invalidates trade setup.")
        if record.debt_to_equity and record.debt_to_equity > 1.2:
            risk_factors.append(f"Elevated Leverage: Debt-to-Equity stands at {record.debt_to_equity:.2f}x.")
        if tech["rsi_14"] > 74:
            risk_factors.append(f"RSI(14) at {tech['rsi_14']:.1f} is overbought; watch for potential consolidation.")
        elif tech["rsi_14"] < 45:
            risk_factors.append(f"RSI(14) at {tech['rsi_14']:.1f} indicates sluggish near-term momentum.")
        if pat_yoy < 0:
            risk_factors.append(f"Earnings headwind: Quarterly profit contracted by {pat_yoy:.1f}% YoY.")

        status_desc = (
            f"{tech['archetype_label']} scoring {tech['canslim_score']}/100 [F:{tech['funda_score']} | T:{tech['techno_score']}]. "
            f"Trading at Rs.{cmp:.1f} within {dist_52:.1f}% of 52W High with +{pat_yoy:.1f}% PAT growth and {roce:.1f}% ROCE."
        )

        return {
            "symbol": clean_sym,
            "company_name": record.company_name or clean_sym,
            "sector": comp_sec or record.sector or "Diversified",
            "industry": comp_ind or record.industry or "General",
            "exchange": record.exchange or "NSE",
            "market_cap": record.market_cap,
            "market_cap_category": record.market_cap_category or "MID",
            "tradingview_symbol": f"NSE:{clean_sym}",
            "setup_status": tech["archetype_label"],
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
        Radar summary statistics for CANSLIM and High-Growth equities.
        """
        total = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.current_price != None,
            ScreenerGrowthRecord.current_price >= 15.0,
            ScreenerGrowthRecord.dma_50 != None,
        ).count()

        stage_2_count = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.current_price >= ScreenerGrowthRecord.dma_50,
            ScreenerGrowthRecord.dma_50 >= ScreenerGrowthRecord.dma_200,
        ).count()

        earnings_accelerator_count = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.quarterly_pat_yoy >= 30.0,
            ScreenerGrowthRecord.current_price >= ScreenerGrowthRecord.dma_50,
        ).count()

        near_52w_high_count = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.high_52_week != None,
            ScreenerGrowthRecord.current_price != None,
            ScreenerGrowthRecord.current_price >= ScreenerGrowthRecord.high_52_week * 0.94,
        ).count()

        # Fetch top 5 CANSLIM Titans
        screener = cls.get_screener_results(
            db, page=1, limit=5, preset="CANSLIM_TITANS", sort_by="canslim_score", sort_order="desc"
        )
        if not screener["items"]:
            screener = cls.get_screener_results(
                db, page=1, limit=5, sort_by="canslim_score", sort_order="desc"
            )

        return {
            "total_screened": total,
            "stage_2_count": stage_2_count,
            "stage_2_ratio_pct": round((stage_2_count / total) * 100, 1) if total > 0 else 0.0,
            "earnings_accelerator_count": earnings_accelerator_count,
            "near_52w_high_count": near_52w_high_count,
            "top_setups": screener["items"],
        }

    _CANDLE_CACHE: Dict[str, Any] = {}

    @classmethod
    def _fetch_direct_chart_df(cls, clean_sym: str, period: str = "6mo") -> Any:
        """
        Direct, rate-limit immune Yahoo chart API fetcher with browser emulation.
        Bypasses cookie/crumb 429 rate limit issues by querying v8 chart endpoint directly.
        """
        import requests
        import pandas as pd
        import datetime

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }

        # Prioritize primary exchange suffix (.NS) first across endpoints, fallback to .BO
        suffixes = [".NS", ".BO"]
        endpoints = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]

        for suffix in suffixes:
            for endpoint in endpoints:
                try:
                    url = f"{endpoint}/v8/finance/chart/{clean_sym}{suffix}?interval=1d&range={period}"
                    resp = requests.get(url, headers=headers, timeout=4)
                    if resp.status_code == 200:
                        chart_res = resp.json().get("chart", {}).get("result", [])
                        if chart_res and "timestamp" in chart_res[0]:
                            ts = chart_res[0]["timestamp"]
                            indicators = chart_res[0].get("indicators", {})
                            quotes = indicators.get("quote", [{}])[0]

                            opens = quotes.get("open", [])
                            highs = quotes.get("high", [])
                            lows = quotes.get("low", [])
                            closes = quotes.get("close", [])
                            volumes = quotes.get("volume", [])

                            dates = [datetime.date.fromtimestamp(t).strftime("%Y-%m-%d") for t in ts]

                            df = pd.DataFrame({
                                "Open": opens,
                                "High": highs,
                                "Low": lows,
                                "Close": closes,
                                "Volume": volumes,
                            }, index=dates)

                            df = df.dropna(subset=["Close"])
                            if not df.empty:
                                return df
                    elif resp.status_code == 404:
                        # Suffix does not exist for this symbol on Yahoo; move to next suffix immediately
                        break
                except Exception as e:
                    logger.debug(f"Direct chart request failed for {clean_sym}{suffix} on {endpoint}: {e}")

        # Fallback to yfinance if direct requests failed
        try:
            import yfinance as yf
            ticker = yf.Ticker(f"{clean_sym}.NS")
            hist = ticker.history(period=period, timeout=4)
            if hist.empty:
                ticker = yf.Ticker(f"{clean_sym}.BO")
                hist = ticker.history(period=period, timeout=4)
            if not hist.empty:
                hist = hist.dropna(subset=["Close"])
                return hist
        except Exception as e:
            logger.warning(f"yfinance fallback failed for {clean_sym}: {e}")

        import pandas as pd
        return pd.DataFrame()

    @classmethod
    def get_chart_candles(cls, symbol: str, period: str = "6mo") -> Dict[str, Any]:
        """
        Fetches daily historical OHLCV candles and calculates 50/200 DMA series.
        Lightweight, cached, and rate-limit immune.
        """
        import time
        clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "")

        # Check in-memory cache (TTL: 300 seconds / 5 minutes)
        cache_key = f"{clean_sym}_{period}"
        now_ts = time.time()
        if cache_key in cls._CANDLE_CACHE:
            cached_time, cached_val = cls._CANDLE_CACHE[cache_key]
            if now_ts - cached_time < 300:
                return cached_val

        try:
            hist = cls._fetch_direct_chart_df(clean_sym, period)
            if hist.empty:
                logger.warning(f"No chart candles found for {clean_sym} (period={period})")
                return {"candles": [], "dma_50": [], "dma_200": [], "pattern_overlays": []}

            hist["SMA_50"] = hist["Close"].rolling(window=min(50, len(hist)), min_periods=1).mean()
            hist["SMA_200"] = hist["Close"].rolling(window=min(200, len(hist)), min_periods=1).mean()

            candles: List[Dict[str, Any]] = []
            dma_50_series: List[Dict[str, Any]] = []
            dma_200_series: List[Dict[str, Any]] = []

            for idx, row in hist.iterrows():
                date_str = str(idx).split(" ")[0] if not isinstance(idx, str) else idx
                close_p = round(float(row["Close"]), 2)
                open_p = round(float(row["Open"]), 2) if not math.isnan(row["Open"]) else close_p
                high_p = round(float(row["High"]), 2) if not math.isnan(row["High"]) else max(open_p, close_p)
                low_p = round(float(row["Low"]), 2) if not math.isnan(row["Low"]) else min(open_p, close_p)
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

            pattern_overlays = cls._build_pattern_overlays(clean_sym, candles)

            result = {
                "candles": candles,
                "dma_50": dma_50_series,
                "dma_200": dma_200_series,
                "pattern_overlays": pattern_overlays,
            }
            cls._CANDLE_CACHE[cache_key] = (now_ts, result)
            return result
        except Exception as e:
            logger.error(f"Failed to fetch candles for {clean_sym}: {e}", exc_info=True)
            return {"candles": [], "dma_50": [], "dma_200": [], "pattern_overlays": []}

    @classmethod
    def _build_pattern_overlays(cls, clean_sym: str, candles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Builds institutional pattern visualization geometry:
        horizontal resistance/support lines, rising support trendlines,
        pivot points, stop loss, profit targets, and inflection point markers.
        """
        overlays: List[Dict[str, Any]] = []
        if not candles:
            return overlays

        latest_time = candles[-1]["time"]
        latest_close = candles[-1]["close"]

        # 1. Multi-Pattern Engine (Flat Base, Ascending Triangle, Double Bottom, Bull Flag, HTF)
        try:
            from app.services.pattern_engine.pattern_orchestrator import _CACHE as PATTERN_CACHE
            cached_patterns = [p for p in PATTERN_CACHE.get("data", []) if p.get("symbol") == clean_sym]

            for p in cached_patterns:
                pt = p.get("pattern_type")
                m = p.get("pattern_metrics", {})
                pivot = float(p.get("pivot_buy_point") or 0.0)
                stop_loss = float(p.get("stop_loss") or 0.0)
                target_1 = float(p.get("target_1") or 0.0)
                target_2 = float(p.get("target_2") or 0.0)
                score = int(p.get("ai_conviction_score") or 0)
                tier = str(p.get("conviction_tier") or "ACTIVE")
                label = str(p.get("pattern_label") or pt)

                h_lines = []
                t_lines = []
                markers = []

                if pt == "ASCENDING_TRIANGLE":
                    res_lvl = float(m.get("resistance_level") or pivot)
                    h_lines.append({
                        "id": "resistance",
                        "price": res_lvl,
                        "color": "#06b6d4",
                        "lineWidth": 2,
                        "lineStyle": 0,  # Solid
                        "title": f"RESISTANCE (Rs.{res_lvl:.1f})",
                    })
                    if pivot and abs(pivot - res_lvl) > 0.5:
                        h_lines.append({
                            "id": "pivot",
                            "price": pivot,
                            "color": "#10b981",
                            "lineWidth": 2,
                            "lineStyle": 0,
                            "title": f"PIVOT BUY POINT (Rs.{pivot:.1f})",
                        })
                    if stop_loss:
                        h_lines.append({
                            "id": "stop_loss",
                            "price": stop_loss,
                            "color": "#ef4444",
                            "lineWidth": 1,
                            "lineStyle": 2,  # Dashed
                            "title": f"STOP LOSS (Rs.{stop_loss:.1f})",
                        })
                    if target_1:
                        h_lines.append({
                            "id": "target_1",
                            "price": target_1,
                            "color": "#10b981",
                            "lineWidth": 1,
                            "lineStyle": 1,  # Dotted
                            "title": f"TARGET 1 (Rs.{target_1:.1f})",
                        })
                    if target_2:
                        h_lines.append({
                            "id": "target_2",
                            "price": target_2,
                            "color": "#059669",
                            "lineWidth": 1,
                            "lineStyle": 1,
                            "title": f"TARGET 2 (Rs.{target_2:.1f})",
                        })

                    # Construct Rising Support Trendline:
                    window_bars = min(len(candles), max(20, int(p.get("pattern_width_weeks", 6) * 5)))
                    window_candles = candles[-window_bars:]
                    if len(window_candles) >= 10:
                        min_c = min(window_candles, key=lambda c: c["low"])
                        start_time = min_c["time"]
                        start_low = min_c["low"]
                        slope = float(m.get("support_slope", 0.002))
                        bars_elapsed = len(window_candles) - window_candles.index(min_c)
                        proj_support = round(start_low * (1.0 + slope * bars_elapsed), 2)
                        t_lines.append({
                            "id": "rising_support",
                            "title": "RISING SUPPORT",
                            "color": "#10b981",
                            "lineWidth": 2,
                            "lineStyle": 2,  # Dashed
                            "points": [
                                {"time": start_time, "value": start_low},
                                {"time": latest_time, "value": min(proj_support, latest_close * 1.02)},
                            ],
                        })
                        markers.append({
                            "time": start_time,
                            "position": "belowBar",
                            "color": "#10b981",
                            "shape": "arrowUp",
                            "text": f"SUPPORT BASE Rs.{start_low:.1f}",
                        })

                    markers.append({
                        "time": latest_time,
                        "position": "aboveBar",
                        "color": "#06b6d4",
                        "shape": "circle",
                        "text": f"PIVOT Rs.{pivot:.1f}",
                    })

                elif pt == "FLAT_BASE":
                    b_high = float(m.get("base_high") or pivot)
                    b_low = float(m.get("base_low") or stop_loss)
                    h_lines.append({
                        "id": "base_high",
                        "price": b_high,
                        "color": "#06b6d4",
                        "lineWidth": 2,
                        "lineStyle": 0,
                        "title": f"BASE TOP (Rs.{b_high:.1f})",
                    })
                    h_lines.append({
                        "id": "base_low",
                        "price": b_low,
                        "color": "#3b82f6",
                        "lineWidth": 2,
                        "lineStyle": 0,
                        "title": f"BASE SUPPORT (Rs.{b_low:.1f})",
                    })
                    if pivot and abs(pivot - b_high) > 0.5:
                        h_lines.append({
                            "id": "pivot",
                            "price": pivot,
                            "color": "#10b981",
                            "lineWidth": 2,
                            "lineStyle": 0,
                            "title": f"PIVOT BUY (Rs.{pivot:.1f})",
                        })
                    if stop_loss:
                        h_lines.append({
                            "id": "stop_loss",
                            "price": stop_loss,
                            "color": "#ef4444",
                            "lineWidth": 1,
                            "lineStyle": 2,
                            "title": f"STOP (Rs.{stop_loss:.1f})",
                        })
                    if target_1:
                        h_lines.append({
                            "id": "target_1",
                            "price": target_1,
                            "color": "#10b981",
                            "lineWidth": 1,
                            "lineStyle": 1,
                            "title": f"TARGET 1 (Rs.{target_1:.1f})",
                        })

                    markers.append({
                        "time": latest_time,
                        "position": "aboveBar",
                        "color": "#06b6d4",
                        "shape": "arrowDown",
                        "text": f"BASE PIVOT Rs.{pivot:.1f}",
                    })

                elif pt == "DOUBLE_BOTTOM":
                    mid_p = float(m.get("mid_pivot") or pivot)
                    l_low = float(m.get("left_low") or stop_loss)
                    r_low = float(m.get("right_low") or stop_loss)
                    h_lines.append({
                        "id": "mid_pivot",
                        "price": mid_p,
                        "color": "#f59e0b",
                        "lineWidth": 2,
                        "lineStyle": 0,
                        "title": f"W PIVOT (Rs.{mid_p:.1f})",
                    })
                    h_lines.append({
                        "id": "w_lows",
                        "price": min(l_low, r_low),
                        "color": "#10b981",
                        "lineWidth": 1,
                        "lineStyle": 2,
                        "title": f"W-BOTTOM (Rs.{min(l_low, r_low):.1f})",
                    })
                    if stop_loss:
                        h_lines.append({
                            "id": "stop_loss",
                            "price": stop_loss,
                            "color": "#ef4444",
                            "lineWidth": 1,
                            "lineStyle": 2,
                            "title": f"STOP (Rs.{stop_loss:.1f})",
                        })
                    if target_1:
                        h_lines.append({
                            "id": "target_1",
                            "price": target_1,
                            "color": "#10b981",
                            "lineWidth": 1,
                            "lineStyle": 1,
                            "title": f"TARGET 1 (Rs.{target_1:.1f})",
                        })
                    markers.append({
                        "time": latest_time,
                        "position": "aboveBar",
                        "color": "#f59e0b",
                        "shape": "circle",
                        "text": f"W BREAKOUT Rs.{pivot:.1f}",
                    })

                elif pt in ("BULL_FLAG", "HIGH_TIGHT_FLAG"):
                    f_top = float(m.get("flag_top") or pivot)
                    f_bot = float(m.get("flag_bottom") or stop_loss)
                    h_lines.append({
                        "id": "flag_top",
                        "price": f_top,
                        "color": "#f59e0b",
                        "lineWidth": 2,
                        "lineStyle": 0,
                        "title": f"FLAG RESISTANCE (Rs.{f_top:.1f})",
                    })
                    h_lines.append({
                        "id": "flag_bot",
                        "price": f_bot,
                        "color": "#8b5cf6",
                        "lineWidth": 2,
                        "lineStyle": 2,
                        "title": f"FLAG SUPPORT (Rs.{f_bot:.1f})",
                    })
                    if stop_loss:
                        h_lines.append({
                            "id": "stop_loss",
                            "price": stop_loss,
                            "color": "#ef4444",
                            "lineWidth": 1,
                            "lineStyle": 2,
                            "title": f"STOP (Rs.{stop_loss:.1f})",
                        })
                    if target_1:
                        h_lines.append({
                            "id": "target_1",
                            "price": target_1,
                            "color": "#10b981",
                            "lineWidth": 1,
                            "lineStyle": 1,
                            "title": f"TARGET 1 (Rs.{target_1:.1f})",
                        })
                    markers.append({
                        "time": latest_time,
                        "position": "aboveBar",
                        "color": "#f59e0b",
                        "shape": "arrowDown",
                        "text": f"FLAG TRIGGER Rs.{pivot:.1f}",
                    })

                overlays.append({
                    "pattern_type": pt,
                    "pattern_label": label,
                    "score": score,
                    "conviction_tier": tier,
                    "pivot_buy_point": pivot,
                    "stop_loss": stop_loss,
                    "target_1": target_1,
                    "target_2": target_2,
                    "horizontal_lines": h_lines,
                    "trend_lines": t_lines,
                    "markers": markers,
                })
        except Exception as e:
            logger.debug(f"[TechnoFunda] Error extracting pattern engine overlays for {clean_sym}: {e}")

        # 2. Cup & Handle Engine
        try:
            from app.services.cup_handle.cup_handle_orchestrator import _CACHE as CUP_CACHE
            cup_items = [p for p in CUP_CACHE.get("data", []) if p.get("symbol") == clean_sym]
            for p in cup_items:
                cup = p.get("cup") or {}
                handle = p.get("handle") or {}
                pivot = float(p.get("pivot_buy_point") or 0.0)
                rim = float(cup.get("right_rim") or cup.get("prior_high") or pivot)
                cup_low = float(cup.get("cup_low") or 0.0)
                h_high = float(handle.get("handle_high") or pivot)
                h_low = float(handle.get("handle_low") or 0.0)
                stop_loss = float(p.get("stop_loss_tight") or 0.0)
                target_1 = float(p.get("target_1") or 0.0)
                target_2 = float(p.get("target_2") or 0.0)
                score = int(p.get("ai_conviction_score") or 0)
                tier = str(p.get("conviction_tier") or "ACTIVE")

                h_lines = []
                markers = []

                if rim:
                    h_lines.append({
                        "id": "cup_rim",
                        "price": rim,
                        "color": "#06b6d4",
                        "lineWidth": 2,
                        "lineStyle": 0,
                        "title": f"CUP RIM (Rs.{rim:.1f})",
                    })
                if pivot:
                    h_lines.append({
                        "id": "handle_pivot",
                        "price": pivot,
                        "color": "#10b981",
                        "lineWidth": 2,
                        "lineStyle": 0,
                        "title": f"HANDLE PIVOT (Rs.{pivot:.1f})",
                    })
                if cup_low:
                    h_lines.append({
                        "id": "cup_low",
                        "price": cup_low,
                        "color": "#8b5cf6",
                        "lineWidth": 1,
                        "lineStyle": 2,
                        "title": f"CUP BASE (Rs.{cup_low:.1f})",
                    })
                if stop_loss:
                    h_lines.append({
                        "id": "stop_loss",
                        "price": stop_loss,
                        "color": "#ef4444",
                        "lineWidth": 1,
                        "lineStyle": 2,
                        "title": f"STOP (Rs.{stop_loss:.1f})",
                    })
                if target_1:
                    h_lines.append({
                        "id": "target_1",
                        "price": target_1,
                        "color": "#10b981",
                        "lineWidth": 1,
                        "lineStyle": 1,
                        "title": f"TARGET 1 (Rs.{target_1:.1f})",
                    })

                markers.append({
                    "time": latest_time,
                    "position": "aboveBar",
                    "color": "#10b981",
                    "shape": "arrowDown",
                    "text": f"BUY POINT Rs.{pivot:.1f}",
                })

                overlays.append({
                    "pattern_type": "CUP_HANDLE",
                    "pattern_label": "Cup & Handle",
                    "score": score,
                    "conviction_tier": tier,
                    "pivot_buy_point": pivot,
                    "stop_loss": stop_loss,
                    "target_1": target_1,
                    "target_2": target_2,
                    "horizontal_lines": h_lines,
                    "trend_lines": [],
                    "markers": markers,
                })
        except Exception as e:
            logger.debug(f"[TechnoFunda] Error extracting cup_handle overlays for {clean_sym}: {e}")

        from app.services.pattern_engine.pattern_core import sanitize_json
        return [sanitize_json(o) for o in overlays]
