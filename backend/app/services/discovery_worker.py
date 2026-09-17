"""
Alpha India Historical Filing Discovery Worker
Sprint 34 Production Version
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.filing_registry import FilingRegistry
from app.models.monitoring_heartbeat import MonitoringHeartbeat
from app.collectors.nse.announcements import NSEAnnouncementCollector


class DiscoveryWorker:
    """
    Discovers historical and recent corporate filings for a company using official NSE feeds.
    """

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

            record = FilingRegistry(
                company_id=comp_id,
                symbol=sym,
                exchange=exchange,
                filing_type=filing.get("filing_type") or "Quarterly Financial Results",
                period=filing.get("period") or "Q1 FY26",
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
    def discover_live_market(db: Session):
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
                filing = FilingRegistry(
                    company_id=comp_id,
                    symbol=sym[:20],
                    exchange="NSE",
                    filing_type=(item.get("filing_type") or "Announcement")[:150],
                    period=(item.get("period") or "Current")[:30],
                    announcement_date=item.get("announcement_date"),
                    pdf_url=item.get("pdf_url"),
                    download_status="COMPLETED",
                    parse_status="PARSED",
                    discovered_at=datetime.utcnow(),
                )
                db.add(filing)

            # Check duplicate in Announcement
            exists_ann = db.query(Announcement).filter(
                Announcement.symbol == sym,
                Announcement.announcement_type == (item.get("filing_type") or "")[:100],
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

        # 2. Fetch BSE announcements
        try:
            bse_items = bse_client.announcements()
        except Exception as e:
            print(f"[DiscoveryWorker] BSE fetch warning: {e}")
            bse_items = []

        for b_item in bse_items:
            scrip = str(b_item.get("scrip_code") or "").strip()
            comp_name = b_item.get("company_name", "")
            # Try to resolve symbol from Company master by bse_code or company name
            comp = None
            if scrip:
                comp = db.query(Company).filter(Company.bse_code == scrip).first()
            if not comp and comp_name:
                comp = db.query(Company).filter(Company.company.ilike(f"%{comp_name[:15]}%")).first()

            sym = comp.symbol if comp else f"BSE_{scrip}"
            if not comp:
                comp = Company(
                    symbol=sym[:30],
                    company=(comp_name or sym)[:200],
                    exchange="BSE",
                    bse_code=scrip[:20] if scrip else None,
                    is_provisional=True,
                )
                db.add(comp)
                db.flush()

            comp_id = comp.id
            pdf_url = b_item.get("pdf_url")
            headline = b_item.get("headline", "")
            cat = b_item.get("sub_category") or b_item.get("category") or "Corporate Announcement"


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
                    published_at=datetime.utcnow(),
                    source_url=pdf_url[:500],
                    status="LIVE",
                )
                db.add(ann)

                filing = FilingRegistry(
                    company_id=comp_id,
                    symbol=sym[:20],
                    exchange="BSE",
                    filing_type=cat[:150],
                    period="Current"[:30],
                    announcement_date=datetime.utcnow().date(),
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
                    "date": str(datetime.utcnow().date()),
                })

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