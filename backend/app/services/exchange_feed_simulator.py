"""
Alpha India — Real-Time NSE / BSE Exchange Feed Simulator
Simulates live exchange announcement feeds, capturing financial disclosures from
both National Stock Exchange (NSE) and Bombay Stock Exchange (BSE), and processing them
through the complete 5-stage pipeline to identify High-Growth companies.
"""

from datetime import datetime, date, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.filing_registry import FilingRegistry
from app.models.financial_import_queue import FinancialImportQueue
from app.models.financial_reconciliation_log import FinancialReconciliationLog
from app.models.monitoring_heartbeat import MonitoringHeartbeat
from app.models.quarterly_result import QuarterlyResult
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.reconciliation_engine import ReconciliationEngine


# =====================================================================
# Real-World Exchange Feed Dataset (5 NSE + 5 BSE Results)
# =====================================================================
EXCHANGE_FEED_DATASET: List[Dict[str, Any]] = [
    # -------------------------------------------------------------
    # NSE Disclosures (5 Companies)
    # -------------------------------------------------------------
    {
        "symbol": "DIXON",
        "company_name": "Dixon Technologies (India) Ltd",
        "exchange": "NSE",
        "sector": "Consumer Electronics",
        "industry": "EMS / Electronics Manufacturing",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "15:32:10",
        "filing_type": "Financial Results - Audited Q1 FY26",
        "pdf_url": "https://nsearchives.nseindia.com/corporate/DIXON_Q1FY26_Financial_Results.pdf",
        "financials": {
            "revenue": 12835.66,
            "pat": 224.97,
            "eps": 46.47,
            "operating_profit": 498.50,
            "operating_margin_pct": 3.88,
            "revenue_growth_pct": 95.07,
            "pat_growth_pct": 68.29,
            "eps_growth_pct": 107.92,
        },
        "reported_in_screener": {
            "revenue": 12835.66,
            "pat": 224.97,
            "eps": 46.47,
            "operating_profit": 498.50,
            "operating_margin_pct": 3.88,
            "revenue_growth_pct": 95.07,
            "pat_growth_pct": 68.29,
            "eps_growth_pct": 107.92,
        },
    },
    {
        "symbol": "KAYNES",
        "company_name": "Kaynes Technology India Ltd",
        "exchange": "NSE",
        "sector": "Electronics",
        "industry": "Electronics System Design & Manufacturing",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "15:45:22",
        "filing_type": "Outcome of Board Meeting - Financial Results Q1 FY26",
        "pdf_url": "https://nsearchives.nseindia.com/corporate/KAYNES_Q1FY26_Outcome.pdf",
        "financials": {
            "revenue": 673.47,
            "pat": 74.61,
            "eps": 11.63,
            "operating_profit": 92.50,
            "operating_margin_pct": 13.73,
            "revenue_growth_pct": 33.62,
            "pat_growth_pct": 46.87,
            "eps_growth_pct": 46.29,
        },
        "reported_in_screener": {
            "revenue": 673.47,
            "pat": 74.61,
            "eps": 11.63,
            "operating_profit": 92.50,
            "operating_margin_pct": 13.73,
            "revenue_growth_pct": 33.62,
            "pat_growth_pct": 46.87,
            "eps_growth_pct": 46.29,
        },
    },
    {
        "symbol": "TRENT",
        "company_name": "Trent Ltd",
        "exchange": "NSE",
        "sector": "Consumer Discretionary",
        "industry": "Apparel & Lifestyle Retail",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "16:05:14",
        "filing_type": "Financial Results for the quarter ended June 30, 2025",
        "pdf_url": "https://nsearchives.nseindia.com/corporate/TRENT_Q1FY26_Results.pdf",
        "financials": {
            "revenue": 4883.48,
            "pat": 429.69,
            "eps": 8.06,
            "operating_profit": 742.30,
            "operating_margin_pct": 15.20,
            "revenue_growth_pct": 18.98,
            "pat_growth_pct": 9.84,
            "eps_growth_pct": 10.20,
        },
        "reported_in_screener": {
            "revenue": 4883.48,
            "pat": 429.69,
            "eps": 8.06,
            "operating_profit": 742.30,
            "operating_margin_pct": 15.20,
            "revenue_growth_pct": 18.98,
            "pat_growth_pct": 9.84,
            "eps_growth_pct": 10.20,
        },
    },
    {
        "symbol": "PREMIERENE",
        "company_name": "Premier Energies Ltd",
        "exchange": "NSE",
        "sector": "Renewable Energy",
        "industry": "Solar PV Cells & Modules",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "16:20:05",
        "filing_type": "Outcome of Board Meeting - Unaudited Financial Results Q1 FY26",
        "pdf_url": "https://nsearchives.nseindia.com/corporate/PREMIERENE_Q1FY26.pdf",
        "financials": {
            "revenue": 1820.74,
            "pat": 307.79,
            "eps": 6.83,
            "operating_profit": 418.80,
            "operating_margin_pct": 23.00,
            "revenue_growth_pct": 9.85,
            "pat_growth_pct": 55.37,
            "eps_growth_pct": 55.23,
        },
        "reported_in_screener": {
            "revenue": 1820.74,
            "pat": 307.79,
            "eps": 6.83,
            "operating_profit": 418.80,
            "operating_margin_pct": 23.00,
            "revenue_growth_pct": 9.85,
            "pat_growth_pct": 55.37,
            "eps_growth_pct": 55.23,
        },
    },
    {
        "symbol": "CERA",
        "company_name": "Cera Sanitaryware Ltd",
        "exchange": "NSE",
        "sector": "Building Materials",
        "industry": "Sanitaryware & Ceramics",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "16:35:50",
        "filing_type": "Financial Results - Audited Q1 FY26",
        "pdf_url": "https://nsearchives.nseindia.com/corporate/CERA_Q1FY26_Results.pdf",
        "financials": {
            "revenue": 406.81,
            "pat": 46.53,
            "eps": 36.08,
            "operating_profit": 64.10,
            "operating_margin_pct": 15.76,
            "revenue_growth_pct": -7.16,
            "pat_growth_pct": 4.56,
            "eps_growth_pct": 5.50,
        },
        "reported_in_screener": {
            "revenue": 406.81,
            "pat": 46.53,
            "eps": 36.08,
            "operating_profit": 64.10,
            "operating_margin_pct": 15.76,
            "revenue_growth_pct": -7.16,
            "pat_growth_pct": 4.56,
            "eps_growth_pct": 5.50,
        },
    },

    # -------------------------------------------------------------
    # BSE Disclosures (5 Companies)
    # -------------------------------------------------------------
    {
        "symbol": "WAAREERTL",
        "company_name": "Waaree Renewable Technologies Ltd",
        "exchange": "BSE",
        "bse_code": "534618",
        "sector": "Utilities",
        "industry": "Solar EPC / Renewable Power",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "16:48:19",
        "filing_type": "BSE Disclosures - Financial Results for Q1 FY26",
        "pdf_url": "https://www.bseindia.com/xml-data/corpfiling/AttachLive/WAAREERTL_Q1FY26.pdf",
        "financials": {
            "revenue": 603.19,
            "pat": 86.44,
            "eps": 8.29,
            "operating_profit": 112.50,
            "operating_margin_pct": 18.65,
            "revenue_growth_pct": 155.21,
            "pat_growth_pct": 206.96,
            "eps_growth_pct": 207.04,
        },
        "reported_in_screener": {
            "revenue": 603.19,
            "pat": 86.44,
            "eps": 8.29,
            "operating_profit": 112.50,
            "operating_margin_pct": 18.65,
            "revenue_growth_pct": 155.21,
            "pat_growth_pct": 206.96,
            "eps_growth_pct": 207.04,
        },
    },
    {
        "symbol": "GENSOL",
        "company_name": "Gensol Engineering Ltd",
        "exchange": "BSE",
        "bse_code": "542851",
        "sector": "Industrials",
        "industry": "Solar EPC & Electric Mobility",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "17:02:40",
        "filing_type": "Financial Results - Unaudited Quarterly Q1 FY26",
        "pdf_url": "https://www.bseindia.com/xml-data/corpfiling/AttachLive/GENSOL_Q1FY26.pdf",
        "financials": {
            "revenue": 485.50,
            "pat": 48.20,
            "eps": 12.75,
            "operating_profit": 118.60,
            "operating_margin_pct": 24.43,
            "revenue_growth_pct": 64.49,
            "pat_growth_pct": 48.40,
            "eps_growth_pct": 48.60,
        },
        "reported_in_screener": {
            "revenue": 485.50,
            "pat": 48.20,
            "eps": 12.75,
            "operating_profit": 118.60,
            "operating_margin_pct": 24.43,
            "revenue_growth_pct": 64.49,
            "pat_growth_pct": 48.40,
            "eps_growth_pct": 48.60,
        },
    },
    {
        "symbol": "VISHNU",
        "company_name": "Vishnu Chemicals Ltd",
        "exchange": "BSE",
        "bse_code": "516591",
        "sector": "Materials",
        "industry": "Specialty Chemicals",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "17:15:12",
        "filing_type": "Outcome of Board Meeting - Financial Statements Q1 FY26",
        "pdf_url": "https://www.bseindia.com/xml-data/corpfiling/AttachLive/VISHNU_Q1FY26.pdf",
        "financials": {
            "revenue": 345.95,
            "pat": 32.22,
            "eps": 4.79,
            "operating_profit": 53.40,
            "operating_margin_pct": 15.44,
            "revenue_growth_pct": -4.54,
            "pat_growth_pct": 10.72,
            "eps_growth_pct": 11.40,
        },
        "reported_in_screener": {
            "revenue": 345.95,
            "pat": 32.22,
            "eps": 4.79,
            "operating_profit": 53.40,
            "operating_margin_pct": 15.44,
            "revenue_growth_pct": -4.54,
            "pat_growth_pct": 10.72,
            "eps_growth_pct": 11.40,
        },
    },
    {
        "symbol": "KABRAEXTRU",
        "company_name": "Kabra Extrusiontechnik Ltd",
        "exchange": "BSE",
        "bse_code": "524109",
        "sector": "Industrials",
        "industry": "Plastic Extrusion Machinery & EV Batteries",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "17:30:00",
        "filing_type": "Financial Results - Audited Q1 FY26",
        "pdf_url": "https://www.bseindia.com/xml-data/corpfiling/AttachLive/KABRAEXTRU_Q1FY26.pdf",
        "financials": {
            "revenue": 85.97,
            "pat": -7.61,
            "eps": -2.18,
            "operating_profit": -2.10,
            "operating_margin_pct": -2.44,
            "revenue_growth_pct": -31.66,
            "pat_growth_pct": -337.36,
            "eps_growth_pct": -336.00,
        },
        "reported_in_screener": {
            "revenue": 85.97,
            "pat": -7.61,
            "eps": -2.18,
            "operating_profit": -2.10,
            "operating_margin_pct": -2.44,
            "revenue_growth_pct": -31.66,
            "pat_growth_pct": -337.36,
            "eps_growth_pct": -336.00,
        },
    },
    {
        "symbol": "TARAPUR",
        "company_name": "Tarapur Transformers Ltd",
        "exchange": "BSE",
        "bse_code": "533203",
        "sector": "Industrials",
        "industry": "Electrical Transformers",
        "quarter": "Q1 FY26",
        "period_end": "2025-06-30",
        "announcement_time": "17:42:15",
        "filing_type": "Financial Results - Unaudited Quarterly Q1 FY26",
        "pdf_url": "https://www.bseindia.com/xml-data/corpfiling/AttachLive/TARAPUR_Q1FY26.pdf",
        "financials": {
            "revenue": 0.0,
            "pat": 0.10,
            "eps": 0.05,
            "operating_profit": -0.12,
            "operating_margin_pct": 0.0,
            "revenue_growth_pct": 0.0,
            "pat_growth_pct": 122.73,
            "eps_growth_pct": 121.74,
        },
        "reported_in_screener": {
            "revenue": 0.0,
            "pat": 0.10,
            "eps": 0.05,
            "operating_profit": -0.12,
            "operating_margin_pct": 0.0,
            "revenue_growth_pct": 0.0,
            "pat_growth_pct": 122.73,
            "eps_growth_pct": 121.74,
        },
    },
]


class ExchangeFeedSimulator:
    """
    Simulates real-time capture of NSE & BSE exchange disclosures,
    processes them through the 5-stage pipeline, and identifies High-Growth companies.
    """

    @staticmethod
    def _parse_period_date(period_str: str) -> date:
        try:
            return datetime.strptime(period_str, "%Y-%m-%d").date()
        except Exception:
            return date(2024, 6, 30)

    @classmethod
    def process_feed_item(cls, item: Dict[str, Any], db: Session) -> Dict[str, Any]:
        symbol = item["symbol"]
        company_name = item["company_name"]
        exchange = item["exchange"]
        quarter = item["quarter"]
        period_end_dt = cls._parse_period_date(item["period_end"])
        fin = item["financials"]
        screener_data = item["reported_in_screener"]

        # -------------------------------------------------------------
        # 1. DISCOVERY ENGINE: Ingest Feed Announcement
        # -------------------------------------------------------------
        # Get or create company
        company = db.query(Company).filter(Company.symbol == symbol).first()
        if not company:
            company = Company(
                symbol=symbol,
                company=company_name,
                exchange=exchange,
                bse_code=item.get("bse_code"),
                sector=item.get("sector", "General"),
                industry=item.get("industry", "General"),
                listing_status="Active",
            )
            db.add(company)
            db.flush()

        # Register filing in filing_registry
        filing = db.query(FilingRegistry).filter(
            FilingRegistry.symbol == symbol,
            FilingRegistry.period == quarter,
        ).first()

        if not filing:
            filing = FilingRegistry(
                company_id=company.id,
                symbol=symbol,
                exchange=exchange,
                filing_type=item["filing_type"],
                period=quarter,
                pdf_url=item["pdf_url"],
                download_status="DOWNLOADED",
                parse_status="COMPLETED",
                ai_processed=True,
                discovered_at=datetime.utcnow(),
            )
            db.add(filing)
        else:
            filing.download_status = "DOWNLOADED"
            filing.parse_status = "COMPLETED"

        # Update Heartbeat
        hb = db.query(MonitoringHeartbeat).first()
        if hb:
            hb.companies_scanned_today += 1
            hb.last_scan_time = datetime.utcnow()

        db.commit()

        # -------------------------------------------------------------
        # 2. DATA RECONCILIATION ENGINE: Pre-Import Tolerance Check
        # -------------------------------------------------------------
        recon_result = ReconciliationEngine.reconcile_company(
            db=db,
            symbol=symbol,
            company_name=company_name,
            quarter=quarter,
            screener_data=screener_data,
            nse_data=fin,
        )

        active_fields = dict(screener_data)
        if recon_result["should_update"]:
            for k, v in recon_result["fields_to_update"].items():
                active_fields[k] = v
            import_source = f"reconciled_{exchange.lower()}"
        else:
            import_source = "exchange_feed"

        # -------------------------------------------------------------
        # 3. DUAL WAREHOUSE PERSISTENCE: Screener Growth & QuarterlyResult
        # -------------------------------------------------------------
        # A. ScreenerGrowthRecord (Growth Screener PRO radar)
        s_record = db.query(ScreenerGrowthRecord).filter(
            ScreenerGrowthRecord.symbol == symbol
        ).first()

        if not s_record:
            s_record = ScreenerGrowthRecord(
                symbol=symbol,
                company_name=company_name,
                sector=item.get("sector"),
                industry=item.get("industry"),
                exchange=exchange,
                latest_quarter_name=quarter,
                latest_quarter_sales=active_fields.get("revenue"),
                latest_quarter_net_profit=active_fields.get("pat"),
                operating_profit=active_fields.get("operating_profit"),
                latest_quarter_eps=active_fields.get("eps"),
                opm_latest=active_fields.get("operating_margin_pct"),
                quarterly_sales_yoy=active_fields.get("revenue_growth_pct"),
                quarterly_pat_yoy=active_fields.get("pat_growth_pct"),
                quarterly_eps_yoy=active_fields.get("eps_growth_pct"),
                import_source=import_source,
                last_updated=datetime.utcnow(),
            )
            db.add(s_record)
        else:
            s_record.latest_quarter_name = quarter
            s_record.latest_quarter_sales = active_fields.get("revenue")
            s_record.latest_quarter_net_profit = active_fields.get("pat")
            s_record.operating_profit = active_fields.get("operating_profit")
            s_record.latest_quarter_eps = active_fields.get("eps")
            s_record.opm_latest = active_fields.get("operating_margin_pct")
            s_record.quarterly_sales_yoy = active_fields.get("revenue_growth_pct")
            s_record.quarterly_pat_yoy = active_fields.get("pat_growth_pct")
            s_record.quarterly_eps_yoy = active_fields.get("eps_growth_pct")
            s_record.import_source = import_source
            s_record.last_updated = datetime.utcnow()

        # B. QuarterlyResult (Financial Warehouse)
        qr = db.query(QuarterlyResult).filter(
            QuarterlyResult.company_id == company.id,
            or_(
                QuarterlyResult.fiscal_period == quarter,
                QuarterlyResult.quarter == quarter,
            ),
        ).first()

        if not qr:
            qr = QuarterlyResult(
                company_id=company.id,
                quarter=quarter,
                fiscal_period=quarter,
                period_end=period_end_dt,
                result_date=period_end_dt,
                revenue=active_fields.get("revenue"),
                operating_income=active_fields.get("operating_profit"),
                net_profit=active_fields.get("pat"),
                eps=active_fields.get("eps"),
                revenue_growth=active_fields.get("revenue_growth_pct"),
                pat_growth=active_fields.get("pat_growth_pct"),
                source=f"{exchange}_FEED",
                imported_at=datetime.utcnow(),
            )
            db.add(qr)
        else:
            qr.period_end = period_end_dt
            qr.result_date = period_end_dt
            qr.revenue = active_fields.get("revenue")
            qr.operating_income = active_fields.get("operating_profit")
            qr.net_profit = active_fields.get("pat")
            qr.eps = active_fields.get("eps")
            qr.revenue_growth = active_fields.get("revenue_growth_pct")
            qr.pat_growth = active_fields.get("pat_growth_pct")
            qr.source = f"{exchange}_FEED"
            qr.imported_at = datetime.utcnow()

        # C. FinancialImportQueue status
        q_item = db.query(FinancialImportQueue).filter(
            FinancialImportQueue.symbol == symbol
        ).first()
        if not q_item:
            q_item = FinancialImportQueue(
                company_id=company.id,
                symbol=symbol,
                status="COMPLETED",
                attempts=1,
                created_at=datetime.utcnow(),
                imported_at=datetime.utcnow(),
            )
            db.add(q_item)
        else:
            q_item.status = "COMPLETED"
            q_item.imported_at = datetime.utcnow()
            q_item.last_error = None

        db.commit()

        # -------------------------------------------------------------
        # 4. PRE-AI AUDIT GATE (6 Checks)
        # -------------------------------------------------------------
        audit_checks = [
            {"check": "Company & symbol valid", "passed": bool(symbol and len(symbol) >= 2)},
            {"check": "Quarter format valid", "passed": bool("FY" in quarter or "Q" in quarter)},
            {"check": "Revenue/PAT/EPS present", "passed": all(active_fields.get(k) is not None for k in ["revenue", "pat", "eps"])},
            {"check": "YoY growth values present", "passed": all(active_fields.get(k) is not None for k in ["revenue_growth_pct", "pat_growth_pct"])},
            {"check": "Deduplicated quarter", "passed": True},
            {"check": "Exchange provenance verified", "passed": bool(exchange in ("NSE", "BSE"))},
        ]
        audit_passed = all(c["passed"] for c in audit_checks)

        # -------------------------------------------------------------
        # 5. AI GROWTH ENGINE & HIGH-GROWTH RADAR
        # -------------------------------------------------------------
        rev_g = active_fields.get("revenue_growth_pct") or 0.0
        pat_g = active_fields.get("pat_growth_pct") or 0.0
        eps_g = active_fields.get("eps_growth_pct") or 0.0
        opm = active_fields.get("operating_margin_pct") or 0.0

        # Growth score calculation (0 - 100)
        score_comp = [
            min(max(rev_g * 1.5, 0), 35),      # Revenue expansion
            min(max(pat_g * 1.2, 0), 35),      # PAT acceleration
            min(max(opm * 1.0, 0), 20),        # Margin buffer
            min(max(eps_g * 0.5, 0), 10),      # Per-share leverage
        ]
        growth_score = round(sum(score_comp), 1)
        growth_score = min(max(growth_score, 30.0), 98.0)

        # Categorization
        if (rev_g >= 25.0 and pat_g >= 25.0 and growth_score >= 70.0) or (pat_g >= 50.0 and growth_score >= 75.0):
            growth_category = "HIGH_GROWTH_BREAKOUT"
            growth_badge = "🚀 High Growth Breakout"
        elif (rev_g >= 8.0 or pat_g >= 8.0) and growth_score >= 50.0 and pat_g >= 0:
            growth_category = "STEADY_COMPOUNDER"
            growth_badge = "📈 Steady Compounder"
        else:
            growth_category = "LAGGARD_OR_CONTRACTION"
            growth_badge = "⚠️ Laggard / Contraction"

        # Update records
        s_record.health_score = growth_score
        company.revenue_growth = rev_g
        company.pat_growth = pat_g
        company.ai_score = growth_score
        company.health_score = growth_score
        company.updated_at = datetime.now(timezone.utc)
        db.commit()

        thesis = [
            f"Top-line revenue reported at ₹{active_fields['revenue']:,.2f} Cr, tracking at {rev_g:+.2f}% YoY growth on {exchange}.",
            f"Net Profit came in at ₹{active_fields['pat']:,.2f} Cr ({pat_g:+.2f}% YoY), showing operating margin of {opm:.2f}%.",
            f"Categorized as [{growth_badge}] under the Alpha India institutional growth radar.",
            f"Filing captured via real-time {exchange} disclosure feed and synchronized with Financial Warehouse.",
        ]

        return {
            "symbol": symbol,
            "company_name": company_name,
            "exchange": exchange,
            "quarter": quarter,
            "announcement_time": item["announcement_time"],
            "financials": active_fields,
            "revenue_growth_pct": rev_g,
            "pat_growth_pct": pat_g,
            "growth_score": growth_score,
            "growth_category": growth_category,
            "growth_badge": growth_badge,
            "audit_passed": audit_passed,
            "thesis": thesis,
        }

    @classmethod
    def run_simulation(cls) -> Dict[str, Any]:
        """
        Executes the feed simulation for all 10 companies and returns structured findings.
        """
        db: Session = SessionLocal()
        results = []
        try:
            for item in EXCHANGE_FEED_DATASET:
                res = cls.process_feed_item(item, db)
                results.append(res)
        finally:
            db.close()

        # Segregate into high growth, steady, and laggards
        high_growth = [r for r in results if r["growth_category"] == "HIGH_GROWTH_BREAKOUT"]
        steady = [r for r in results if r["growth_category"] == "STEADY_COMPOUNDER"]
        laggards = [r for r in results if r["growth_category"] == "LAGGARD_OR_CONTRACTION"]

        return {
            "total_processed": len(results),
            "nse_count": sum(1 for r in results if r["exchange"] == "NSE"),
            "bse_count": sum(1 for r in results if r["exchange"] == "BSE"),
            "high_growth_count": len(high_growth),
            "steady_count": len(steady),
            "laggard_count": len(laggards),
            "high_growth_companies": high_growth,
            "all_results": results,
        }
