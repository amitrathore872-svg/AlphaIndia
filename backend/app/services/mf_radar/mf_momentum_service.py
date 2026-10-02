"""
Mutual Fund 3M / 6M Alpha Momentum & Category Rotation Service
Alpha India - Sprint 39
Computes rolling Relative Strength (RS), category leadership heatmaps,
identifies "Closet Indexers", and alerts on AUM ballooning / size dilution.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
import yfinance as yf

from app.models.mf_radar_models import MFRadarScheme

logger = logging.getLogger("mf_momentum")

# Benchmark return cache (in-memory, refreshed hourly)
_BENCHMARK_RETURNS_CACHE: Dict[str, Dict[str, float]] = {}
_LAST_CACHE_TIME: Optional[datetime] = None


class MFMomentumService:
    """Institutional Momentum & Category Rotation Engine for Mutual Funds."""

    @classmethod
    def get_benchmark_returns(cls) -> Dict[str, Dict[str, float]]:
        """
        Fetches or returns cached 3M and 6M returns for the major category benchmarks.
        """
        global _BENCHMARK_RETURNS_CACHE, _LAST_CACHE_TIME

        now = datetime.utcnow()
        if _LAST_CACHE_TIME and (now - _LAST_CACHE_TIME).total_seconds() < 3600 and _BENCHMARK_RETURNS_CACHE:
            return _BENCHMARK_RETURNS_CACHE

        tickers = {
            "NIFTY 50": "^NSEI",
            "NIFTY 100": "^NSEI",
            "NIFTY 500": "^CRSLDX",
            "NIFTY MIDCAP 150": "^NSEMDCP50",
            "NIFTY MIDCAP 50": "^NSEMDCP50",
            "NIFTY SMALLCAP 250": "^CNXSC",
            "NIFTY SMALLCAP 100": "^CNXSC",
            "NIFTY LARGE MIDCAP 250": "^CRSLDX",
            "NIFTY IT": "^CNXIT",
            "NIFTY BANK": "^NSEBANK",
            "NIFTY PHARMA": "^CNXPHARMA",
            "NIFTY INFRASTRUCTURE": "^CNXINFRA",
        }

        results = {}
        for b_name, ticker in tickers.items():
            try:
                t = yf.Ticker(ticker)
                hist = t.history(period="6mo")
                if len(hist) >= 10:
                    cmp = float(hist["Close"].iloc[-1])
                    c_6m = float(hist["Close"].iloc[0])
                    mid_idx = len(hist) // 2
                    c_3m = float(hist["Close"].iloc[mid_idx])

                    ret_6m = round(((cmp - c_6m) / c_6m) * 100.0, 2)
                    ret_3m = round(((cmp - c_3m) / c_3m) * 100.0, 2)
                    results[b_name] = {"ret_3m": ret_3m, "ret_6m": ret_6m}
                else:
                    results[b_name] = {"ret_3m": -4.5, "ret_6m": 5.2}
            except Exception as e:
                logger.warning(f"Error fetching benchmark {b_name}: {e}")
                results[b_name] = {"ret_3m": -4.5, "ret_6m": 5.2}

        _BENCHMARK_RETURNS_CACHE = results
        _LAST_CACHE_TIME = now
        return results

    @classmethod
    def get_category_rotation_heatmap(cls, db: Session) -> Dict[str, Any]:
        """
        Aggregates category-level performance and institutional rotation signals.
        Shows which styles (Small Cap, Mid Cap, Flexi Cap, Large Cap, Sectoral) are leading.
        """
        schemes = db.query(MFRadarScheme).filter(MFRadarScheme.is_active == True).all()
        categories: Dict[str, List[MFRadarScheme]] = {}
        for s in schemes:
            categories.setdefault(s.category, []).append(s)

        benchmarks = cls.get_benchmark_returns()

        heatmap = []
        for cat_name, cat_schemes in categories.items():
            valid_6m = [s.return_6m_pct for s in cat_schemes if s.return_6m_pct is not None]
            valid_3m = [s.return_3m_pct for s in cat_schemes if s.return_3m_pct is not None]
            valid_1m = [s.return_1m_pct for s in cat_schemes if s.return_1m_pct is not None]
            valid_1y = [s.return_1y_pct for s in cat_schemes if s.return_1y_pct is not None]

            avg_6m = round(sum(valid_6m) / len(valid_6m), 2) if valid_6m else 0.0
            avg_3m = round(sum(valid_3m) / len(valid_3m), 2) if valid_3m else 0.0
            avg_1m = round(sum(valid_1m) / len(valid_1m), 2) if valid_1m else 0.0
            avg_1y = round(sum(valid_1y) / len(valid_1y), 2) if valid_1y else 0.0

            total_aum = sum(s.aum_cr for s in cat_schemes if s.aum_cr)

            # Determine rotation status
            if avg_6m >= 8.0 and avg_3m >= 0:
                regime = "LEADING"
                color = "emerald"
                signal = "Strong Bullish Rotation"
            elif avg_6m > 3.0 and avg_3m < 0:
                regime = "CONSOLIDATING"
                color = "cyan"
                signal = "Healthy Pullback in Uptrend"
            elif avg_6m <= 2.0 and avg_3m < -5.0:
                regime = "LAGGING"
                color = "rose"
                signal = "Underperforming Market"
            else:
                regime = "ACCELERATING"
                color = "amber"
                signal = "Improving Relative Strength"

            # Top performing fund in category
            top_fund = max(cat_schemes, key=lambda x: (x.return_6m_pct or -999)) if cat_schemes else None

            heatmap.append({
                "category": cat_name,
                "fund_count": len(cat_schemes),
                "total_aum_cr": round(total_aum, 1),
                "avg_1m_pct": avg_1m,
                "avg_3m_pct": avg_3m,
                "avg_6m_pct": avg_6m,
                "avg_1y_pct": avg_1y,
                "regime": regime,
                "regime_color": color,
                "signal_message": signal,
                "top_fund_name": top_fund.scheme_name if top_fund else "N/A",
                "top_fund_code": top_fund.scheme_code if top_fund else None,
                "top_fund_6m": top_fund.return_6m_pct if top_fund else None,
            })

        # Sort heatmap by 6M average return
        heatmap.sort(key=lambda x: x["avg_6m_pct"], reverse=True)

        return {
            "status": "success",
            "macro_commentary": cls._generate_macro_commentary(heatmap),
            "heatmap": heatmap,
        }

    @classmethod
    def _generate_macro_commentary(cls, heatmap: List[Dict[str, Any]]) -> str:
        """Generates institutional summary commentary based on the top leading categories."""
        if not heatmap:
            return "Market leadership remains balanced across broad equity styles."
        leaders = [h["category"] for h in heatmap[:2]]
        laggers = [h["category"] for h in heatmap[-2:]]
        return (
            f"Institutional capital rotation shows relative strength concentrated in {', '.join(leaders)}, "
            f"while {', '.join(laggers)} are experiencing momentum drag. "
            f"Consider overweighting fresh allocations to leading styles."
        )

    @classmethod
    def get_scheme_momentum_rankings(
        cls,
        db: Session,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Ranks schemes within each category based on rolling 3M & 6M Relative Strength (RS),
        assigning momentum tiers and flagging candidates for replacement.
        """
        benchmarks = cls.get_benchmark_returns()

        query = db.query(MFRadarScheme).filter(MFRadarScheme.is_active == True)
        if category and category.lower() != "all":
            query = query.filter(MFRadarScheme.category == category)
        schemes = query.all()

        # Group by category for intra-category ranking
        cat_map: Dict[str, List[MFRadarScheme]] = {}
        for s in schemes:
            cat_map.setdefault(s.category, []).append(s)

        ranked_results = []
        for cat_name, cat_schemes in cat_map.items():
            b_info = benchmarks.get(cat_schemes[0].benchmark_index, {"ret_3m": -4.0, "ret_6m": 5.0})
            b_3m = b_info.get("ret_3m", 0.0)
            b_6m = b_info.get("ret_6m", 0.0)

            # Calculate composite momentum score = (0.6 * 6M_Return) + (0.4 * 3M_Return)
            scored = []
            for s in cat_schemes:
                r_6m = s.return_6m_pct or 0.0
                r_3m = s.return_3m_pct or 0.0
                comp_score = round((0.6 * r_6m) + (0.4 * r_3m), 2)
                alpha_6m = round(r_6m - b_6m, 2)
                alpha_3m = round(r_3m - b_3m, 2)

                scored.append({
                    "scheme": s,
                    "comp_score": comp_score,
                    "alpha_6m": alpha_6m,
                    "alpha_3m": alpha_3m,
                })

            # Sort descending by composite score
            scored.sort(key=lambda x: x["comp_score"], reverse=True)
            total_in_cat = len(scored)

            for rank_idx, item in enumerate(scored, start=1):
                s = item["scheme"]
                percentile = round(((total_in_cat - rank_idx + 1) / total_in_cat) * 100.0, 1)

                # Classify Momentum Tier
                if rank_idx <= 2 and item["alpha_6m"] > 0:
                    tier = "ALPHA_LEADER"
                    tier_label = "Alpha Leader"
                    tier_color = "emerald"
                elif percentile >= 70.0 and item["alpha_6m"] >= 0:
                    tier = "OUTPERFORMING"
                    tier_label = "Outperforming"
                    tier_color = "cyan"
                elif percentile <= 25.0 and item["alpha_6m"] < 0:
                    tier = "SWAP_CANDIDATE"
                    tier_label = "Lagging (Swap Candidate)"
                    tier_color = "rose"
                elif percentile <= 40.0:
                    tier = "UNDERPERFORMING"
                    tier_label = "Underperforming"
                    tier_color = "amber"
                else:
                    tier = "NEUTRAL"
                    tier_label = "Neutral"
                    tier_color = "slate"

                # Update category rank on model
                s.category_rank = rank_idx
                s.category_total = total_in_cat

                ranked_results.append({
                    "scheme_code": s.scheme_code,
                    "scheme_name": s.scheme_name,
                    "amc_name": s.amc_name,
                    "category": s.category,
                    "category_rank": rank_idx,
                    "category_total": total_in_cat,
                    "percentile": percentile,
                    "current_nav": s.current_nav,
                    "return_3m_pct": s.return_3m_pct,
                    "return_6m_pct": s.return_6m_pct,
                    "return_1y_pct": s.return_1y_pct,
                    "benchmark_index": s.benchmark_index,
                    "alpha_3m": item["alpha_3m"],
                    "alpha_6m": item["alpha_6m"],
                    "composite_momentum_score": item["comp_score"],
                    "momentum_tier": tier,
                    "tier_label": tier_label,
                    "tier_color": tier_color,
                    "aum_cr": s.aum_cr,
                    "ter": s.ter,
                })

        db.commit()
        # Sort overall list by composite momentum score
        ranked_results.sort(key=lambda x: x["composite_momentum_score"], reverse=True)
        return ranked_results

    @classmethod
    def get_dilution_and_closet_alerts(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Identifies:
        1. "Closet Indexers": Large Cap funds charging high active fees (> 0.7%) but generating negligible alpha.
        2. "Size Curse / AUM Ballooning": Small Cap & Mid Cap funds whose massive AUM hampers agility.
        """
        schemes = db.query(MFRadarScheme).filter(MFRadarScheme.is_active == True).all()
        alerts = []

        for s in schemes:
            # 1. Closet Indexer Check (Large Cap funds with high TER and near-zero alpha)
            if s.category == "Large Cap":
                ter = s.ter or 0.0
                alpha = abs(s.alpha_1y or 0.0)
                if ter >= 0.70 and alpha <= 1.2:
                    alerts.append({
                        "type": "CLOSET_INDEXER",
                        "severity": "WARNING",
                        "scheme_code": s.scheme_code,
                        "scheme_name": s.scheme_name,
                        "category": s.category,
                        "aum_cr": s.aum_cr,
                        "ter": ter,
                        "headline": "Potential Closet Indexer (High Fee Drag)",
                        "reason": (
                            f"Fund charges {ter}% active TER but generates only {s.alpha_1y:+.2f}% 1Y Alpha vs benchmark. "
                            f"Consider switching to a low-cost Nifty 50 Index Fund (0.05% TER) or an unconstrained Flexi Cap fund."
                        ),
                        "suggested_action": "SWAP_TO_INDEX_OR_FLEXI",
                    })

            # 2. AUM Ballooning / Size Curse
            if s.category == "Small Cap" and s.aum_cr and s.aum_cr >= 30000.0:
                alerts.append({
                    "type": "SIZE_DILUTION",
                    "severity": "INFO",
                    "scheme_code": s.scheme_code,
                    "scheme_name": s.scheme_name,
                    "category": s.category,
                    "aum_cr": s.aum_cr,
                    "ter": s.ter,
                    "headline": "AUM Ballooning Alert (Size Curse)",
                    "reason": (
                        f"AUM has reached ₹{s.aum_cr:,.0f} Cr. Fund manager must diversify across 100+ stocks and hold excess cash, "
                        f"limiting micro-cap upside agility. Consider allocating fresh SIPs to agile challenger small-cap funds."
                    ),
                    "suggested_action": "EXPLORE_AGILE_CHALLENGER",
                })

            if s.category == "Mid Cap" and s.aum_cr and s.aum_cr >= 50000.0:
                alerts.append({
                    "type": "SIZE_DILUTION",
                    "severity": "INFO",
                    "scheme_code": s.scheme_code,
                    "scheme_name": s.scheme_name,
                    "category": s.category,
                    "aum_cr": s.aum_cr,
                    "ter": s.ter,
                    "headline": "Mega AUM Mid-Cap Alert",
                    "reason": (
                        f"AUM has swelled to ₹{s.aum_cr:,.0f} Cr. Large fund size requires holding more large-cap proxies "
                        f"to deploy cash inflows."
                    ),
                    "suggested_action": "MONITOR_ALPHA_VELOCITY",
                })

        return alerts
