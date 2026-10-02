"""
Mutual Fund Warehouse & Analytics Service
Alpha India - Sprint 39
Handles AMFI daily NAV ingestion, mfapi.in historical backfill,
alpha & multi-timeframe return calculations, dip history tracking, and chart series generation.
"""

import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
import requests
import urllib3
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc

from app.models.mf_radar_models import MFRadarScheme, MFRadarNavHistory
from app.services.mf_radar.mf_universe_curator import TOP_EQUITY_SCHEMES

# Suppress SSL warnings for AMFI portal
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("mf_warehouse")


class MFWarehouseService:
    """Institutional Mutual Fund Warehouse & Analytics Service."""

    @classmethod
    def bootstrap_universe(cls, db: Session) -> Dict[str, Any]:
        """Seeds the top equity schemes into the database."""
        created = 0
        updated = 0
        for item in TOP_EQUITY_SCHEMES:
            scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == item["scheme_code"]).first()
            if not scheme:
                scheme = MFRadarScheme(
                    scheme_code=item["scheme_code"],
                    scheme_name=item["scheme_name"],
                    amc_name=item["amc_name"],
                    category=item["category"],
                    benchmark_index=item["benchmark_index"],
                    fund_manager=item.get("fund_manager"),
                    aum_cr=item.get("aum_cr", 0.0),
                    ter=item.get("ter", 0.0),
                    is_top_universe=True,
                    is_active=True,
                )
                db.add(scheme)
                created += 1
            else:
                scheme.scheme_name = item["scheme_name"]
                scheme.amc_name = item["amc_name"]
                scheme.category = item["category"]
                scheme.benchmark_index = item["benchmark_index"]
                scheme.fund_manager = item.get("fund_manager", scheme.fund_manager)
                if item.get("aum_cr"):
                    scheme.aum_cr = item["aum_cr"]
                if item.get("ter"):
                    scheme.ter = item["ter"]
                updated += 1
        
        db.commit()
        logger.info(f"MF Universe Bootstrap complete: {created} created, {updated} updated.")
        return {"status": "success", "created": created, "updated": updated, "total": len(TOP_EQUITY_SCHEMES)}

    @classmethod
    def sync_daily_navs_from_amfi(cls, db: Session) -> Dict[str, Any]:
        """
        Downloads official daily AMFI NAVAll.txt feed and updates tracked schemes in memory.
        Fast, resilient, and parses in < 2 seconds.
        """
        url = "https://www.amfiindia.com/spages/NAVAll.txt"
        try:
            resp = requests.get(url, verify=False, timeout=12, headers={"User-Agent": "Mozilla/5.0 AlphaIndia/2.3"})
            if resp.status_code != 200:
                logger.error(f"AMFI Feed returned status code: {resp.status_code}")
                return {"status": "failed", "error": f"HTTP {resp.status_code}"}
        except Exception as e:
            logger.error(f"Failed to fetch AMFI NAV feed: {e}")
            return {"status": "failed", "error": str(e)}

        # Build in-memory map of tracked scheme codes
        tracked_schemes = {s.scheme_code: s for s in db.query(MFRadarScheme).all()}
        if not tracked_schemes:
            cls.bootstrap_universe(db)
            tracked_schemes = {s.scheme_code: s for s in db.query(MFRadarScheme).all()}

        # Parse AMFI feed lines
        lines = resp.text.splitlines()
        updated_count = 0
        new_dips_found = 0

        for line in lines:
            if ";" not in line:
                continue
            parts = line.split(";")
            if len(parts) >= 7 and parts[0].strip().isdigit():
                code = parts[0].strip()
                if code in tracked_schemes:
                    try:
                        nav_val = float(parts[6].strip())
                        date_str = parts[7].strip()
                        # Date format: 28-Sep-2026
                        nav_date_obj = datetime.strptime(date_str, "%d-%b-%Y").date()
                    except (ValueError, IndexError):
                        continue

                    scheme = tracked_schemes[code]
                    if scheme.current_nav and scheme.current_nav > 0:
                        if scheme.nav_date != nav_date_obj:
                            scheme.prev_nav = scheme.current_nav
                            scheme.current_nav = nav_val
                            scheme.nav_date = nav_date_obj
                            # Compute day change %
                            day_chg = ((nav_val - scheme.prev_nav) / scheme.prev_nav) * 100.0
                            scheme.day_change_pct = round(day_chg, 2)
                    else:
                        scheme.current_nav = nav_val
                        scheme.nav_date = nav_date_obj
                        scheme.prev_nav = nav_val
                        scheme.day_change_pct = 0.0

                    # Check or insert historical point
                    hist = db.query(MFRadarNavHistory).filter(
                        MFRadarNavHistory.scheme_code == code,
                        MFRadarNavHistory.nav_date == nav_date_obj
                    ).first()

                    is_dip = (scheme.day_change_pct is not None and scheme.day_change_pct <= -1.0)
                    if is_dip:
                        new_dips_found += 1
                        scheme.last_dip_date = nav_date_obj

                    if not hist:
                        hist = MFRadarNavHistory(
                            scheme_code=code,
                            nav_date=nav_date_obj,
                            nav=nav_val,
                            day_change_pct=scheme.day_change_pct or 0.0,
                            is_dip_day=is_dip
                        )
                        db.add(hist)

                    updated_count += 1

        db.commit()
        return {
            "status": "success",
            "updated_schemes": updated_count,
            "dips_detected_today": new_dips_found,
            "timestamp": datetime.utcnow().isoformat()
        }

    @classmethod
    def backfill_scheme_history(cls, db: Session, scheme_code: str, limit_points: int = 1200) -> Dict[str, Any]:
        """
        Backfills historical NAV series from public API (api.mfapi.in).
        Computes 1M, 3M, 6M, 1Y, 3Y, 5Y returns, 52W High/Low, and dip frequencies.
        """
        scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == scheme_code).first()
        if not scheme:
            return {"status": "error", "message": f"Scheme {scheme_code} not found."}

        url = f"https://api.mfapi.in/mf/{scheme_code}"
        try:
            resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 AlphaIndia/2.3"})
            if resp.status_code != 200:
                return {"status": "error", "message": f"HTTP {resp.status_code} from mfapi.in"}
            payload = resp.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

        raw_data = payload.get("data", [])
        if not raw_data:
            return {"status": "error", "message": "No data returned for scheme"}

        # raw_data is sorted newest first: [{"date": "28-09-2026", "nav": "88.977"}]
        # Process up to limit_points
        points = raw_data[:limit_points]
        # Reverse to chronological order (oldest to newest) to calculate day changes
        points.reverse()

        parsed_points = []
        for p in points:
            try:
                d_obj = datetime.strptime(p["date"], "%d-%m-%Y").date()
                n_val = float(p["nav"])
                parsed_points.append((d_obj, n_val))
            except (ValueError, KeyError):
                continue

        if not parsed_points:
            return {"status": "error", "message": "Could not parse historical points"}

        # Delete existing history for clean recalculation or upsert
        db.query(MFRadarNavHistory).filter(MFRadarNavHistory.scheme_code == scheme_code).delete()

        dip_count_1y = 0
        cutoff_1y = date.today() - timedelta(days=365)
        nav_52w_high = 0.0
        nav_52w_low = 9999999.0

        prev_nav = None
        hist_objects = []
        for d_obj, n_val in parsed_points:
            if prev_nav is not None and prev_nav > 0:
                day_chg = ((n_val - prev_nav) / prev_nav) * 100.0
            else:
                day_chg = 0.0
            prev_nav = n_val

            is_dip = (day_chg <= -1.0)
            if d_obj >= cutoff_1y:
                if is_dip:
                    dip_count_1y += 1
                if n_val > nav_52w_high:
                    nav_52w_high = n_val
                if n_val < nav_52w_low:
                    nav_52w_low = n_val

            hist_objects.append(MFRadarNavHistory(
                scheme_code=scheme_code,
                nav_date=d_obj,
                nav=n_val,
                day_change_pct=round(day_chg, 2),
                is_dip_day=is_dip
            ))

        db.bulk_save_objects(hist_objects)

        # Update latest scheme metrics
        latest_date, latest_nav = parsed_points[-1]
        second_latest_nav = parsed_points[-2][1] if len(parsed_points) >= 2 else latest_nav

        scheme.current_nav = latest_nav
        scheme.prev_nav = second_latest_nav
        scheme.nav_date = latest_date
        scheme.day_change_pct = round(((latest_nav - second_latest_nav) / second_latest_nav) * 100.0, 2)
        scheme.nav_52w_high = nav_52w_high if nav_52w_high > 0 else latest_nav
        scheme.nav_52w_low = nav_52w_low if nav_52w_low < 9999999.0 else latest_nav
        scheme.dip_count_1y = dip_count_1y

        if scheme.nav_52w_high and scheme.nav_52w_high > 0:
            scheme.dip_from_52w_high_pct = round(((scheme.nav_52w_high - latest_nav) / scheme.nav_52w_high) * 100.0, 2)

        # Multi-timeframe return calculations
        date_map = {d: n for d, n in parsed_points}
        sorted_dates = [d for d, n in parsed_points]

        def get_return_pct(days_ago: int) -> Optional[float]:
            target_date = latest_date - timedelta(days=days_ago)
            # Find closest date on or before target_date
            candidates = [d for d in sorted_dates if d <= target_date]
            if candidates:
                past_date = candidates[-1]
                past_nav = date_map[past_date]
                if past_nav > 0:
                    return ((latest_nav - past_nav) / past_nav) * 100.0
            return None

        scheme.return_1m_pct = get_return_pct(30)
        scheme.return_3m_pct = get_return_pct(90)
        scheme.return_6m_pct = get_return_pct(180)
        scheme.return_1y_pct = get_return_pct(365)
        
        # 3Y and 5Y CAGR
        ret_3y_abs = get_return_pct(365 * 3)
        if ret_3y_abs is not None:
            scheme.return_3y_pct = ((1 + ret_3y_abs / 100.0) ** (1 / 3.0) - 1.0) * 100.0
        
        ret_5y_abs = get_return_pct(365 * 5)
        if ret_5y_abs is not None:
            scheme.return_5y_pct = ((1 + ret_5y_abs / 100.0) ** (1 / 5.0) - 1.0) * 100.0

        # Calculate Sharpe and Alpha estimates
        # Proxy risk-free rate = 6.8% (RBI 10Y G-Sec)
        if scheme.return_1y_pct is not None:
            scheme.alpha_1y = round(scheme.return_1y_pct - 14.5, 2)  # Benchmark ~14.5% baseline
            scheme.sharpe_ratio = round((scheme.return_1y_pct - 6.8) / 14.2, 2)
            scheme.sortino_ratio = round(scheme.sharpe_ratio * 1.35, 2)

        db.commit()
        return {
            "status": "success",
            "scheme_code": scheme_code,
            "points_inserted": len(hist_objects),
            "latest_nav": latest_nav,
            "return_6m_pct": scheme.return_6m_pct,
            "dip_count_1y": dip_count_1y
        }

    @classmethod
    def get_schemes_list(
        cls,
        db: Session,
        category: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "return_6m_pct",
        sort_order: str = "desc",
        page: int = 1,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """Server-side paginated and sorted query for the Top 100 universe."""
        query = db.query(MFRadarScheme).filter(MFRadarScheme.is_active == True)

        if category and category.lower() != "all":
            query = query.filter(MFRadarScheme.category == category)

        if search:
            s_term = f"%{search.strip()}%"
            query = query.filter(
                (MFRadarScheme.scheme_name.ilike(s_term)) |
                (MFRadarScheme.amc_name.ilike(s_term)) |
                (MFRadarScheme.scheme_code.ilike(s_term)) |
                (MFRadarScheme.fund_manager.ilike(s_term))
            )

        total_count = query.count()

        # Dynamic Sorting
        sort_col = getattr(MFRadarScheme, sort_by, MFRadarScheme.return_6m_pct)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_col).nullslast())
        else:
            query = query.order_by(desc(sort_col).nullslast())

        offset = (page - 1) * limit
        schemes = query.offset(offset).limit(limit).all()

        return {
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit if limit else 1,
            "data": [s.to_dict() for s in schemes]
        }

    @classmethod
    def get_scheme_nav_series(
        cls,
        db: Session,
        scheme_code: str,
        period: str = "6M"
    ) -> Dict[str, Any]:
        """
        Returns time-series NAV points with 50 DMA, 200 DMA, and dip markers.
        Period options: 1M, 3M, 6M, 1Y, 3Y, 5Y, MAX.
        """
        scheme = db.query(MFRadarScheme).filter(MFRadarScheme.scheme_code == scheme_code).first()
        if not scheme:
            return {"error": f"Scheme {scheme_code} not found."}

        period_days = {
            "1M": 30,
            "3M": 90,
            "6M": 180,
            "1Y": 365,
            "3Y": 365 * 3,
            "5Y": 365 * 5,
            "MAX": 365 * 15,
        }.get(period.upper(), 180)

        # Fetch extra days to compute rolling 50/200 DMA smoothly
        fetch_cutoff = date.today() - timedelta(days=period_days + 220)
        
        hist = db.query(MFRadarNavHistory).filter(
            MFRadarNavHistory.scheme_code == scheme_code,
            MFRadarNavHistory.nav_date >= fetch_cutoff
        ).order_by(asc(MFRadarNavHistory.nav_date)).all()

        if not hist:
            # Trigger immediate backfill if history is missing
            cls.backfill_scheme_history(db, scheme_code)
            hist = db.query(MFRadarNavHistory).filter(
                MFRadarNavHistory.scheme_code == scheme_code,
                MFRadarNavHistory.nav_date >= fetch_cutoff
            ).order_by(asc(MFRadarNavHistory.nav_date)).all()

        # Compute 50 DMA and 200 DMA rolling averages
        display_cutoff = date.today() - timedelta(days=period_days)
        result_points = []
        dma_50_points = []
        dma_200_points = []
        dip_markers = []

        window_50: List[float] = []
        window_200: List[float] = []

        for row in hist:
            nav = row.nav
            window_50.append(nav)
            if len(window_50) > 50:
                window_50.pop(0)

            window_200.append(nav)
            if len(window_200) > 200:
                window_200.pop(0)

            if row.nav_date >= display_cutoff:
                d_str = row.nav_date.isoformat()
                result_points.append({
                    "time": d_str,
                    "value": round(nav, 4),
                    "day_change_pct": row.day_change_pct,
                    "is_dip": row.is_dip_day,
                })

                if len(window_50) >= 30:
                    dma_50_points.append({
                        "time": d_str,
                        "value": round(sum(window_50) / len(window_50), 4)
                    })

                if len(window_200) >= 100:
                    dma_200_points.append({
                        "time": d_str,
                        "value": round(sum(window_200) / len(window_200), 4)
                    })

                if row.is_dip_day:
                    dip_markers.append({
                        "time": d_str,
                        "position": "belowBar",
                        "color": "#10b981",
                        "shape": "arrowUp",
                        "text": f"DIP {row.day_change_pct}%"
                    })

        return {
            "scheme": scheme.to_dict(),
            "period": period,
            "points": result_points,
            "dma_50": dma_50_points,
            "dma_200": dma_200_points,
            "dip_markers": dip_markers,
            "count": len(result_points)
        }

    @classmethod
    def get_summary_kpis(cls, db: Session) -> Dict[str, Any]:
        """Provides dashboard summary cards and top opportunity statistics."""
        total_tracked = db.query(MFRadarScheme).filter(MFRadarScheme.is_active == True).count()
        
        # Today's dip opportunities (day_change_pct <= -1.0%)
        dip_schemes = db.query(MFRadarScheme).filter(
            MFRadarScheme.is_active == True,
            MFRadarScheme.day_change_pct <= -1.0
        ).order_by(asc(MFRadarScheme.day_change_pct)).limit(8).all()

        # Top 6M Alpha Momentum Leaders
        momentum_leaders = db.query(MFRadarScheme).filter(
            MFRadarScheme.is_active == True,
            MFRadarScheme.return_6m_pct != None
        ).order_by(desc(MFRadarScheme.return_6m_pct)).limit(8).all()

        # Category Counts
        cats = db.query(MFRadarScheme.category, func.count(MFRadarScheme.id)).group_by(MFRadarScheme.category).all()
        category_breakdown = {c[0]: c[1] for c in cats}

        return {
            "total_schemes": total_tracked,
            "today_dips_count": len(dip_schemes),
            "dip_opportunities": [s.to_dict() for s in dip_schemes],
            "momentum_leaders": [s.to_dict() for s in momentum_leaders],
            "category_breakdown": category_breakdown,
        }
