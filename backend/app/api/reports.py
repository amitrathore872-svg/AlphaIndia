"""
Alpha India - Institutional Research & Market Reports API Router
Provides endpoints for:
- 20 DMA Market Breadth Radar (% and count of companies above 20 DMA with 50% Green/Red regime zones)
- 50 DMA Intermediate Market Breadth Radar (% and count of companies above 50 DMA)
- 200 DMA Stage-2 Macro Structural Breadth Radar (% and count of companies above 200 DMA)
- Multi-DMA Comparison / Triple Alignment Series (20, 50, 200 DMA)
- Sectoral Breadth Distributions
- Institutional Report Catalog
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from fastapi import APIRouter, Query, HTTPException

from app.services.report_breadth_service import ReportBreadthService

logger = logging.getLogger("alpha_india.api.reports")

router = APIRouter(prefix="/reports", tags=["Research & Market Reports"])


@router.get("/breadth")
def get_breadth_report(
    dma: int = Query(20, description="DMA period: 20, 50, or 200"),
    universe: str = Query("all", description="Equities universe: 'all' (all NSE listed) or 'nifty500' (Nifty 500)"),
    timeframe: str = Query("1Y", description="Timeframe period: '1M', '3M', '6M', '1Y', 'ALL'"),
    refresh: bool = Query(False, description="Force recompute and rebuild cache"),
) -> Dict[str, Any]:
    """
    Returns time series of percentage and count of companies trading above the specified DMA (20, 50, or 200).
    Includes the 50% Green Zone vs Red Zone threshold, momentum shifts, and sectoral breadth rankings.
    """
    try:
        data = ReportBreadthService.get_breadth_data(
            dma_period=dma,
            universe=universe,
            timeframe=timeframe,
            force_refresh=refresh,
        )
        return {
            "status": "success",
            "data": data,
        }
    except Exception as e:
        logger.error(f"[ReportsAPI] Error retrieving {dma} DMA breadth: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/breadth/20-dma")
def get_20dma_breadth_report(
    universe: str = Query("all", description="Equities universe: 'all' or 'nifty500'"),
    timeframe: str = Query("1Y", description="Timeframe period: '1M', '3M', '6M', '1Y', 'ALL'"),
    refresh: bool = Query(False, description="Force recompute and rebuild cache"),
) -> Dict[str, Any]:
    """Dedicated endpoint for 20 DMA tactical momentum breadth."""
    return get_breadth_report(dma=20, universe=universe, timeframe=timeframe, refresh=refresh)


@router.get("/breadth/50-dma")
def get_50dma_breadth_report(
    universe: str = Query("all", description="Equities universe: 'all' or 'nifty500'"),
    timeframe: str = Query("1Y", description="Timeframe period: '1M', '3M', '6M', '1Y', 'ALL'"),
    refresh: bool = Query(False, description="Force recompute and rebuild cache"),
) -> Dict[str, Any]:
    """Dedicated endpoint for 50 DMA intermediate trend health breadth."""
    return get_breadth_report(dma=50, universe=universe, timeframe=timeframe, refresh=refresh)


@router.get("/breadth/200-dma")
def get_200dma_breadth_report(
    universe: str = Query("all", description="Equities universe: 'all' or 'nifty500'"),
    timeframe: str = Query("1Y", description="Timeframe period: '1M', '3M', '6M', '1Y', 'ALL'"),
    refresh: bool = Query(False, description="Force recompute and rebuild cache"),
) -> Dict[str, Any]:
    """Dedicated endpoint for 200 DMA Stage-2 macro bull/bear structural breadth."""
    return get_breadth_report(dma=200, universe=universe, timeframe=timeframe, refresh=refresh)


@router.get("/breadth/multi-dma")
def get_multi_dma_breadth_report(
    timeframe: str = Query("1Y", description="Timeframe period: '1M', '3M', '6M', '1Y', 'ALL'"),
    refresh: bool = Query(False, description="Force recompute and rebuild cache"),
) -> Dict[str, Any]:
    """
    Returns triple overlay time series comparing 20 DMA, 50 DMA, and 200 DMA breadth simultaneously.
    """
    try:
        data = ReportBreadthService.get_multi_dma_series(timeframe=timeframe, force_refresh=refresh)
        return {
            "status": "success",
            "data": data,
        }
    except Exception as e:
        logger.error(f"[ReportsAPI] Error retrieving multi-DMA breadth: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/catalog")
def get_reports_catalog() -> Dict[str, Any]:
    """
    Returns catalog of available and upcoming research & market breadth reports in the dashboard.
    """
    try:
        catalog = ReportBreadthService.get_report_catalog()
        return {
            "status": "success",
            "total_reports": len(catalog),
            "reports": catalog,
        }
    except Exception as e:
        logger.error(f"[ReportsAPI] Error retrieving reports catalog: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/breadth/refresh")
def refresh_breadth_cache() -> Dict[str, Any]:
    """
    Forces immediate re-indexing and calculation of 20, 50, and 200 DMA breadth data across all bhavcopies.
    Automatically downloads any newly published bhavcopies from NSE first.
    """
    try:
        new_downloads = ReportBreadthService.sync_exchange_bhavcopies(days_back=15)
        cache = ReportBreadthService.build_breadth_cache(max_sessions=530)
        return {
            "status": "success",
            "message": "Successfully refreshed multi-DMA market breadth cache (20, 50, 200 DMA)",
            "new_bhavcopies_downloaded": new_downloads,
            "latest_session": cache.get("latest_session"),
            "data_points_20dma": len(cache.get("breadth", {}).get("20", {}).get("all_equities", [])),
            "data_points_50dma": len(cache.get("breadth", {}).get("50", {}).get("all_equities", [])),
            "data_points_200dma": len(cache.get("breadth", {}).get("200", {}).get("all_equities", [])),
        }
    except Exception as e:
        logger.error(f"[ReportsAPI] Error refreshing breadth cache: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
