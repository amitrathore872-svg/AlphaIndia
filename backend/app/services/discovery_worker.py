"""
Alpha India Historical Filing Discovery Worker
Sprint 34 Production Version
"""

from datetime import datetime
from typing import Optional, Any
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.filing_registry import FilingRegistry
from app.models.monitoring_heartbeat import MonitoringHeartbeat
from app.collectors.nse.announcements import NSEAnnouncementCollector


class DiscoveryWorker:
    """
    Discovers historical and recent corporate filings for a company using official NSE & BSE feeds.
    Includes automated institutional identity resolution and auto-enrichment pipelines.
    """

    @staticmethod
    def _resolve_period_helper(period_val: Optional[str] = None, dt: Optional[Any] = None) -> str:
        if period_val and period_val.strip() and period_val.strip().lower() not in ("current", "unknown", "live_wire", "none", "null"):
            return period_val.strip()
        filing_dt = dt or datetime.utcnow().date()
        m, y = filing_dt.month, filing_dt.year
        if m in (10, 11, 12):
            return f"Q2 FY{str(y + 1)[-2:]}"
        elif m in (7, 8, 9):
            return f"Q1 FY{str(y + 1)[-2:]}"
        elif m in (4, 5, 6):
            return f"Q4 FY{str(y)[-2:]}"
        else:
            return f"Q3 FY{str(y)[-2:]}"

    @staticmethod
    def _resolve_canonical_company(db: Session, scrip: str, comp_name: str) -> Company:
        """
        Institutional entity resolver: prevents numeric BSE_5449xx shells by:
        1. Querying Company by bse_code.
        2. Querying Company by fuzzy name match.
        3. Querying Screener autocomplete API to find the real ticker (e.g. KARAMTARA for 544917).
        """
        comp = None
        if scrip:
            comp = db.query(Company).filter(Company.bse_code == scrip).first()
        if not comp and comp_name:
            comp = db.query(Company).filter(Company.company.ilike(f"%{comp_name[:15]}%")).first()

        if not comp and scrip:
            try:
                from app.services.screener_client import ScreenerClient
                url, resolved_name = ScreenerClient.resolve_canonical_url(scrip)
                if url:
                    parts = [p for p in url.strip("/").split("/") if p]
                    extracted_sym = parts[-2] if parts[-1].lower() == "consolidated" else parts[-1]
                    if extracted_sym and not extracted_sym.isdigit():
                        comp = db.query(Company).filter(Company.symbol == extracted_sym.upper()).first()
                        if comp:
                            comp.bse_code = scrip
                            db.flush()
            except Exception:
                pass

        if not comp:
            sym = f"BSE_{scrip}" if scrip else "UNKNOWN"
            comp = Company(
                symbol=sym[:30],
                company=(comp_name or sym)[:200],
                exchange="BSE",
                bse_code=scrip[:20] if scrip else None,
                is_provisional=True,
            )
            db.add(comp)
            db.flush()

        return comp

    @staticmethod
    def _auto_enrich_filing_company(db: Session, company: Company):
        """
        Ensures newly dropped financial results never have missing CMP, Market Cap, or YoY Growth:
        1. Backfills Screener historical statements if < 2 quarters exist.
        2. Computes and persists YoY growth across quarters.
        3. Enriches CMP and Market Cap via LivePriceService / Yahoo fallback.
        """
        try:
            from app.models.quarterly_result import QuarterlyResult
            from app.models.screener_growth_record import ScreenerGrowthRecord
            from scripts.backfill_screener_quarters import backfill_company_quarters
            from app.services.live_price_service import LivePriceService

            qr_count = db.query(QuarterlyResult).filter(QuarterlyResult.company_id == company.id).count()
            if qr_count < 2:
                backfill_company_quarters(db, company.symbol)

            # Re-fetch quarters to compute and persist YoY
            qrs = db.query(QuarterlyResult).filter(QuarterlyResult.company_id == company.id).order_by(QuarterlyResult.period_end.desc()).all()
            for q in qrs:
                if q.revenue_growth is None or q.pat_growth is None:
                    py_q = None
                    if q.period_end:
                        for cand in qrs:
                            if cand.id != q.id and cand.period_end:
                                diff = abs((q.period_end - cand.period_end).days - 365)
                                if diff <= 60:
                                    py_q = cand
                                    break
                    if py_q is None and q.fiscal_period:
                        q_pfx = q.fiscal_period[:2]
                        for cand in qrs:
                            if cand.id != q.id and cand.fiscal_period and cand.fiscal_period.startswith(q_pfx):
                                if (q.period_end and cand.period_end and cand.period_end < q.period_end) or not q.period_end:
                                    py_q = cand
                                    break
                    if py_q:
                        if q.revenue_growth is None and q.revenue is not None and py_q.revenue is not None and py_q.revenue != 0:
                            q.revenue_growth = round(((q.revenue - py_q.revenue) / abs(py_q.revenue)) * 100.0, 1)
                        if q.pat_growth is None and q.net_profit is not None and py_q.net_profit is not None and py_q.net_profit != 0:
                            q.pat_growth = round(((q.net_profit - py_q.net_profit) / abs(py_q.net_profit)) * 100.0, 1)

            # Check if CMP or Market Cap is missing
            scr = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == company.symbol).first()
            if not scr or not scr.current_price or not scr.market_cap:
                quote = LivePriceService.resolve_single_quote(company.symbol, exchange=company.exchange or "NSE")
                if quote.get("cmp") or quote.get("market_cap"):
                    if not scr:
                        scr = ScreenerGrowthRecord(
                            symbol=company.symbol,
                            company_name=company.company,
                            current_price=quote.get("cmp"),
                            market_cap=quote.get("market_cap"),
                            exchange=company.exchange or "NSE",
                            last_updated=datetime.utcnow(),
                        )
                        db.add(scr)
                    else:
                        if not scr.current_price and quote.get("cmp"):
                            scr.current_price = quote.get("cmp")
                        if not scr.market_cap and quote.get("market_cap"):
                            scr.market_cap = quote.get("market_cap")
        except Exception as e:
            print(f"[DiscoveryWorker] Auto-enrichment warning for {company.symbol}: {e}")

    @staticmethod
    def discover_company(db: Session, symbol: str, exchange: str = "NSE"):
        sym = symbol.strip().upper()
        collector = NSEAnnouncementCollector()
        discovered = 0

        # Ensure company master exists
        comp = db.query(Company).filter(Company.symbol == sym).first()
        comp_id = comp.id if comp else None

        try:
            filings = collector.fetch_announcements(sym)
        except Exception as e:
            filings = []

        for filing in filings:
            exists = (
                db.query(FilingRegistry)
                .filter(
                    FilingRegistry.symbol == sym,
                    FilingRegistry.period == filing.get("period"),
                    FilingRegistry.announcement_date == filing.get("announcement_date"),
                )
                .first()
            )

            if exists:
                continue

            f_period = DiscoveryWorker._resolve_period_helper(filing.get("period"), filing.get("announcement_date"))
            record = FilingRegistry(
                company_id=comp_id,
                symbol=sym,
                exchange=exchange,
                filing_type=filing.get("filing_type") or "Quarterly Financial Results",
                period=f_period,
                announcement_date=filing.get("announcement_date"),
                pdf_url=filing.get("pdf_url"),
                download_status="COMPLETED" if filing.get("pdf_url") else "PENDING",
                parse_status="PARSED",
                discovered_at=datetime.utcnow(),
            )

            db.add(record)
            discovered += 1

        heartbeat = db.query(MonitoringHeartbeat).first()
        if heartbeat:
            heartbeat.results_found_today += discovered
            heartbeat.last_scan_time = datetime.utcnow()

        db.commit()

        return {
            "symbol": sym,
            "exchange": exchange,
            "filings_discovered": discovered,
        }

    @staticmethod
    def discover_live_market(db: Session, date_str: str = None):
        """
        Polls live market-wide announcements across both NSE and BSE.
        Ingests disclosures into Announcement and FilingRegistry.
        """
        from app.clients.bse_client import BSEClient
        from app.models.announcement import Announcement

        nse_collector = NSEAnnouncementCollector()
        bse_client = BSEClient()

        total_discovered = 0
        new_filings = []

        # 1. Fetch NSE global announcements
        try:
            nse_items = nse_collector.fetch_global_announcements()
        except Exception as e:
            print(f"[DiscoveryWorker] NSE global fetch warning: {e}")
            nse_items = []

        for item in nse_items:
            sym = item["symbol"].strip().upper()
            comp = db.query(Company).filter(Company.symbol == sym).first()
            if not comp:
                comp = Company(
                    symbol=sym[:30],
                    company=(item.get("company_name") or sym)[:200],
                    exchange="NSE",
                    is_provisional=True,
                )
                db.add(comp)
                db.flush()

            comp_id = comp.id
            comp_name = comp.company

            # Check duplicate in FilingRegistry
            exists_filing = db.query(FilingRegistry).filter(
                FilingRegistry.symbol == sym,
                FilingRegistry.pdf_url == item.get("pdf_url"),
            ).first()

            if not exists_filing and item.get("pdf_url"):
                f_period = DiscoveryWorker._resolve_period_helper(item.get("period"), item.get("announcement_date"))
                filing = FilingRegistry(
                    company_id=comp_id,
                    symbol=sym[:20],
                    exchange="NSE",
                    filing_type=(item.get("filing_type") or "Announcement")[:150],
                    period=f_period[:30],
                    announcement_date=item.get("announcement_date"),
                    pdf_url=item.get("pdf_url"),
                    download_status="COMPLETED",
                    parse_status="PARSED",
                    discovered_at=datetime.utcnow(),
                )
                db.add(filing)
                db.flush()

                is_financial = any(k in (item.get("filing_type") or "").lower() for k in ["result", "financial", "outcome", "statement"])
                if is_financial:
                    try:
                        from app.services.earnings_calendar_service import EarningsCalendarService
                        recon_res = EarningsCalendarService.reconcile_incoming_filing(
                            db=db,
                            symbol=sym,
                            filing_type=filing.filing_type,
                            filing_id=filing.id,
                            period=f_period,
                        )
                        logger.info(f"[DiscoveryWorker] Calendar reconciliation for {sym}: {recon_res.get('reconciliation_type')}")
                    except Exception as ex_recon:
                        logger.warning(f"[DiscoveryWorker] Calendar reconciliation warning: {ex_recon}")

            # Check duplicate in Announcement
            exists_ann = db.query(Announcement).filter(
                Announcement.symbol == sym,
                Announcement.source_url == item.get("pdf_url"),
            ).first()

            if not exists_ann:
                ann = Announcement(
                    symbol=sym[:30],
                    company=(comp_name or sym)[:200],
                    announcement_type=(item.get("filing_type") or "Announcement")[:100],
                    quarter=(item.get("period") or "Current")[:20],
                    published_at=datetime.combine(item.get("announcement_date"), datetime.min.time()) if item.get("announcement_date") else datetime.utcnow(),
                    source_url=(item.get("pdf_url") or "")[:500],
                    status="LIVE",
                )
                db.add(ann)
                total_discovered += 1
                new_filings.append({
                    "symbol": sym,
                    "company": comp_name,
                    "exchange": "NSE",
                    "type": item.get("filing_type"),
                    "title": item.get("title"),
                    "pdf_url": item.get("pdf_url"),
                    "date": str(item.get("announcement_date")),
                })

                # Auto-enrich newly discovered financial results
                f_type_str = (item.get("filing_type") or "").lower()
                if "result" in f_type_str or "financial" in f_type_str:
                    DiscoveryWorker._auto_enrich_filing_company(db, comp)

        # 2. Fetch BSE announcements (including Result and Board Meeting categories)
        try:
            bse_items = bse_client.announcements(date_str=date_str)
        except Exception as e:
            print(f"[DiscoveryWorker] BSE fetch warning: {e}")
            bse_items = []

        for b_item in bse_items:
            scrip = str(b_item.get("scrip_code") or "").strip()
            comp_name = b_item.get("company_name", "")
            
            # Use institutional entity resolver to prevent BSE_5449xx numeric shells
            comp = DiscoveryWorker._resolve_canonical_company(db, scrip, comp_name)
            sym = comp.symbol
            comp_id = comp.id
            pdf_url = b_item.get("pdf_url")
            headline = b_item.get("headline", "")
            cat = b_item.get("sub_category") or b_item.get("category") or "Corporate Announcement"

            # Parse accurate announcement timestamp if available
            ann_dt = None
            if b_item.get("announcement_time"):
                try:
                    ann_dt = datetime.fromisoformat(b_item["announcement_time"][:19])
                except Exception:
                    pass
            filing_date = ann_dt.date() if ann_dt else datetime.utcnow().date()
            published_at = ann_dt if ann_dt else datetime.utcnow()

            # Check duplicate in Announcement
            exists_ann = db.query(Announcement).filter(
                Announcement.symbol == sym,
                Announcement.source_url == pdf_url,
            ).first()

            if not exists_ann and pdf_url:
                ann = Announcement(
                    symbol=sym[:30],
                    company=(comp_name or sym)[:200],
                    announcement_type=cat[:100],
                    quarter="Current"[:20],
                    published_at=published_at,
                    source_url=pdf_url[:500],
                    status="LIVE",
                )
                db.add(ann)

                f_period = DiscoveryWorker._resolve_period_helper(None, filing_date)
                filing = FilingRegistry(
                    company_id=comp_id,
                    symbol=sym[:20],
                    exchange="BSE",
                    filing_type=cat[:150],
                    period=f_period[:30],
                    announcement_date=filing_date,
                    pdf_url=pdf_url,
                    download_status="COMPLETED",
                    parse_status="PARSED",
                    discovered_at=datetime.utcnow(),
                )
                db.add(filing)

                total_discovered += 1
                new_filings.append({
                    "symbol": sym,
                    "company": comp_name,
                    "exchange": "BSE",
                    "type": cat,
                    "title": headline,
                    "pdf_url": pdf_url,
                    "date": str(filing_date),
                })

                # Auto-enrich newly discovered financial results
                cat_str = cat.lower()
                if "result" in cat_str or "financial" in cat_str:
                    DiscoveryWorker._auto_enrich_filing_company(db, comp)

        db.commit()

        # Update monitoring heartbeat
        heartbeat = db.query(MonitoringHeartbeat).first()
        if heartbeat:
            heartbeat.results_found_today += total_discovered
            heartbeat.companies_scanned_today += len(nse_items) + len(bse_items)
            heartbeat.last_scan_time = datetime.utcnow()
            db.commit()

        return {
            "status": "SUCCESS",
            "total_scanned": len(nse_items) + len(bse_items),
            "new_entries_discovered": total_discovered,
            "filings": new_filings,
        }