"""
Alpha India — Investor Document Harvester Service
Continuously discovers, harvests, and indexes Investor Presentations and Concall Transcripts
from NSE, BSE, and Screener corporate document repositories.
"""

import datetime
import hashlib
import logging
import re
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.clients.bse_client import BSEClient
from app.clients.nse_client import NSEClient
from app.models.company import Company
from app.models.investor_intelligence import InvestorDocument
from app.services.pdf_extractor_service import PDFExtractorService

logger = logging.getLogger(__name__)


def resolve_quarter_and_date(
    text_content: str,
    fallback_date: Optional[datetime.date] = None,
) -> Tuple[str, int, int, datetime.date]:
    """
    Intelligently extracts Indian Financial Year and Quarter from text/headline/period,
    distinguishing calendar quarters from financial quarters, and deriving an accurate
    publication/announcement date.
    
    Indian Financial Year (FY) conventions:
    - Q1: Apr - Jun (reported in Jul - Aug)
    - Q2: Jul - Sep (reported in Oct - Nov)
    - Q3: Oct - Dec (reported in Jan - Feb)
    - Q4: Jan - Mar (reported in Apr - May)
    """
    clean = text_content.strip().upper() if text_content else ""

    # 1. Match explicit Q1 FY27, Q2-FY26, Q3/26, Quarter 2, H1 FY27
    m_q = re.search(r"(?:Q|QUARTER\s*)([1-4])\s*(?:-|/|\s)?\s*(?:FY)?\s*(\d{2,4})", clean)
    if m_q:
        q = int(m_q.group(1))
        raw_yr = int(m_q.group(2))
        fy = (2000 + raw_yr) if raw_yr < 100 else raw_yr

        if fallback_date:
            ann_date = fallback_date
        else:
            calendar_year = fy if (q == 3 or q == 4) else fy - 1
            month_map = {1: (8, 10), 2: (11, 10), 3: (2, 10), 4: (5, 15)}
            cal_month, cal_day = month_map.get(q, (8, 10))
            ann_date = datetime.date(calendar_year, cal_month, cal_day)

        return f"Q{q} FY{str(fy)[-2:]}", fy, q, ann_date

    # Match H1 / H2: e.g. H1 FY27 -> Q2 FY27, H2 FY27 -> Q4 FY27
    m_h = re.search(r"(H[1-2])\s*(?:-|/|\s)?\s*(?:FY)?\s*(\d{2,4})", clean)
    if m_h:
        half = m_h.group(1)
        raw_yr = int(m_h.group(2))
        fy = (2000 + raw_yr) if raw_yr < 100 else raw_yr
        q = 2 if half == "H1" else 4
        cal_year = fy - 1 if q == 2 else fy
        ann_date = fallback_date or (datetime.date(cal_year, 11, 10) if q == 2 else datetime.date(cal_year, 5, 15))
        return f"Q{q} FY{str(fy)[-2:]}", fy, q, ann_date

    # 2. Match Month Year: e.g. Aug 2026, Nov 2025
    m_my = re.search(r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})", clean)
    if m_my:
        mon = m_my.group(1)
        yr = int(m_my.group(2))

        # Month reported -> Quarter and FY mapping
        # Jul/Aug/Sep -> Q1 FY(yr + 1)
        # Oct/Nov/Dec -> Q2 FY(yr + 1)
        # Jan/Feb/Mar -> Q3 FY(yr) (reported in Q4 calendar) or Q4 FY(yr)
        # Apr/May/Jun -> Q4 FY(yr)
        month_rules = {
            "JAN": (3, yr, 1, 20),
            "FEB": (3, yr, 2, 10),
            "MAR": (3, yr, 3, 15),
            "APR": (4, yr, 4, 25),
            "MAY": (4, yr, 5, 15),
            "JUN": (4, yr, 6, 10),
            "JUL": (1, yr + 1, 7, 25),
            "AUG": (1, yr + 1, 8, 10),
            "SEP": (1, yr + 1, 9, 15),
            "OCT": (2, yr + 1, 10, 20),
            "NOV": (2, yr + 1, 11, 10),
            "DEC": (2, yr + 1, 12, 10),
        }
        q, fy, m_num, d_num = month_rules.get(mon, (1, yr + 1, 8, 10))
        ann_date = fallback_date or datetime.date(yr, m_num, d_num)
        return f"Q{q} FY{str(fy)[-2:]}", fy, q, ann_date

    # 3. Fallback based on reference date (e.g., today or filing date)
    ref_date = fallback_date or datetime.date.today()
    ref_m = ref_date.month
    ref_y = ref_date.year

    if ref_m in (7, 8, 9):
        q = 1
        fy = ref_y + 1
    elif ref_m in (10, 11, 12):
        q = 2
        fy = ref_y + 1
    elif ref_m in (1, 2, 3):
        q = 3
        fy = ref_y
    else:  # (4, 5, 6)
        q = 4
        fy = ref_y

    return f"Q{q} FY{str(fy)[-2:]}", fy, q, ref_date


class InvestorDocumentHarvester:
    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )

    @staticmethod
    def resolve_quarter_and_date(
        text_content: str,
        fallback_date: Optional[datetime.date] = None,
    ) -> Tuple[str, int, int, datetime.date]:
        return resolve_quarter_and_date(text_content, fallback_date)

    @staticmethod
    def compute_content_hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    # -------------------------------------------------------------------------
    # 1. Harvest Full History from Curated Screener Documents
    # -------------------------------------------------------------------------
    @classmethod
    def harvest_for_symbol(cls, db: Session, symbol: str) -> Dict[str, Any]:
        """
        Discovers and registers all Concall Transcripts and Investor Presentations
        for a stock symbol with stable quarter resolution and deduplication.
        """
        sym = symbol.strip().upper()
        comp = db.query(Company).filter(Company.symbol == sym).first()
        comp_id = comp.id if comp else None
        comp_name = comp.company if comp else sym

        url = f"https://www.screener.in/company/{sym}/consolidated/"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": cls.USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
        except Exception as exc:
            try:
                fallback_url = f"https://www.screener.in/company/{sym}/"
                f_req = urllib.request.Request(fallback_url, headers={"User-Agent": cls.USER_AGENT})
                with urllib.request.urlopen(f_req, timeout=15) as f_resp:
                    html = f_resp.read().decode("utf-8", errors="ignore")
            except Exception as f_exc:
                logger.error(f"Failed to fetch document page for {sym}: {exc} / {f_exc}")
                return {"symbol": sym, "discovered": 0, "error": str(exc)}

        soup = BeautifulSoup(html, "lxml")
        discovered_count = 0

        # Scan for Concalls & Presentations section
        for h3 in soup.find_all(["h3", "h4"]):
            if "concall" in h3.get_text().lower():
                ul = h3.find_next("ul")
                if not ul:
                    continue

                for li in ul.find_all("li"):
                    raw_text = li.get_text(" ", strip=True)
                    period_match = re.search(r"([A-Za-z]{3}\s+\d{4})", raw_text)
                    period_raw = period_match.group(1) if period_match else ""

                    fiscal_period, fy, q, ann_date = resolve_quarter_and_date(period_raw)

                    # Links inside this row: Transcript, PPT, REC
                    for a in li.find_all("a"):
                        link_text = a.get_text(strip=True).upper()
                        link_url = a.get("href")
                        if not link_url or not link_url.startswith("http"):
                            continue

                        doc_type = None
                        if "TRANSCRIPT" in link_text or "TRANSCRIPT" in link_url.upper():
                            doc_type = "CONCALL_TRANSCRIPT"
                        elif "PPT" in link_text or "PRESENTATION" in link_url.upper() or "INVESTOR" in link_url.upper():
                            doc_type = "INVESTOR_PRESENTATION"

                        if not doc_type:
                            continue

                        # Content Hash for stable deduplication
                        content_hash = hashlib.sha256(f"{sym}_{fy}_{q}_{doc_type}".encode()).hexdigest()

                        # Deduplication check: by stable canonical identity OR exact URL
                        exists = (
                            db.query(InvestorDocument)
                            .filter(
                                InvestorDocument.symbol == sym,
                                (
                                    (InvestorDocument.financial_year == fy)
                                    & (InvestorDocument.financial_quarter == q)
                                    & (InvestorDocument.doc_type == doc_type)
                                )
                                | (InvestorDocument.pdf_url == link_url),
                            )
                            .first()
                        )
                        if exists:
                            # If existing record lacks PDF URL or is pending, update it
                            if not exists.pdf_url and link_url:
                                exists.pdf_url = link_url
                                exists.source_url = url
                            continue

                        # Create new record
                        doc = InvestorDocument(
                            company_id=comp_id,
                            symbol=sym,
                            company_name=comp_name,
                            exchange="SCREENER",
                            doc_type=doc_type,
                            fiscal_period=fiscal_period,
                            financial_year=fy,
                            financial_quarter=q,
                            announcement_date=ann_date,
                            headline=f"{sym} {doc_type.replace('_', ' ')} - {fiscal_period}",
                            source_url=url,
                            pdf_url=link_url,
                            content_hash=content_hash,
                            status="PENDING",
                            download_status="PENDING",
                            extraction_status="PENDING",
                            ai_analysis_status="PENDING",
                        )
                        db.add(doc)
                        discovered_count += 1

        db.commit()
        return {
            "symbol": sym,
            "discovered": discovered_count,
            "status": "SUCCESS",
        }

    # -------------------------------------------------------------------------
    # 2. Harvest from Live NSE & BSE Exchange Wire (Real-time Drops)
    # -------------------------------------------------------------------------
    @classmethod
    def harvest_from_exchange_wires(cls, db: Session) -> Dict[str, Any]:
        """
        Polls official NSE and BSE corporate announcement endpoints in real time,
        filtering specifically for newly dropped Investor Presentations & Concall Transcripts.
        Accurately assigns financial quarters, hashes content, and prevents cross-exchange duplicates.
        """
        discovered = 0
        nse_client = NSEClient()
        bse_client = BSEClient()

        # 1. Scan NSE global announcements
        try:
            nse_announcements = nse_client.global_announcements()
            for ann in nse_announcements:
                desc = (ann.get("desc") or "").upper()
                text = (ann.get("attchmntText") or "").upper()
                combined = f"{desc} {text}"
                pdf_url = ann.get("attchmntFile")
                sym = (ann.get("symbol") or "").strip().upper()

                if not sym or not pdf_url or not pdf_url.startswith("http"):
                    continue

                doc_type = None
                if any(k in combined for k in ["TRANSCRIPT", "EARNINGS CALL TRANSCRIPT", "CONCALL TRANSCRIPT", "AUDIO RECORDING"]):
                    doc_type = "CONCALL_TRANSCRIPT"
                elif any(k in combined for k in ["INVESTOR PRESENTATION", "EARNINGS PPT", "ANALYST PRESENTATION", "INVESTOR UPDATE", "EARNINGS PRESENTATION"]):
                    doc_type = "INVESTOR_PRESENTATION"

                if not doc_type:
                    continue

                comp = db.query(Company).filter(Company.symbol == sym).first()
                comp_id = comp.id if comp else None
                comp_name = comp.company if comp else (ann.get("sm_name") or sym)

                # Parse publication date
                ann_date = datetime.date.today()
                if ann.get("sort_date"):
                    try:
                        ann_date = datetime.datetime.fromisoformat(ann["sort_date"]).date()
                    except Exception:
                        pass

                fiscal_period, fy, q, ann_date = resolve_quarter_and_date(combined, fallback_date=ann_date)
                content_hash = hashlib.sha256(f"{sym}_{fy}_{q}_{doc_type}".encode()).hexdigest()

                # Deduplication across exchanges
                exists = (
                    db.query(InvestorDocument)
                    .filter(
                        InvestorDocument.symbol == sym,
                        (
                            (InvestorDocument.financial_year == fy)
                            & (InvestorDocument.financial_quarter == q)
                            & (InvestorDocument.doc_type == doc_type)
                        )
                        | (InvestorDocument.pdf_url == pdf_url),
                    )
                    .first()
                )
                if exists:
                    continue

                doc = InvestorDocument(
                    company_id=comp_id,
                    symbol=sym,
                    company_name=comp_name,
                    exchange="NSE",
                    doc_type=doc_type,
                    fiscal_period=fiscal_period,
                    financial_year=fy,
                    financial_quarter=q,
                    announcement_date=ann_date,
                    headline=desc[:200] or f"{sym} {doc_type} - {fiscal_period}",
                    source_url="https://www.nseindia.com",
                    pdf_url=pdf_url,
                    content_hash=content_hash,
                    status="PENDING",
                    download_status="PENDING",
                    extraction_status="PENDING",
                    ai_analysis_status="PENDING",
                )
                db.add(doc)
                discovered += 1

        except Exception as nse_err:
            logger.warning(f"NSE Wire harvest warning: {nse_err}")

        # 2. Scan BSE announcements
        try:
            bse_announcements = bse_client.announcements()
            for b_item in bse_announcements:
                headline = (b_item.get("headline") or "").upper()
                cat = (b_item.get("category") or "").upper()
                subcat = (b_item.get("sub_category") or "").upper()
                combined = f"{headline} {cat} {subcat}"
                pdf_url = b_item.get("pdf_url")
                scrip = str(b_item.get("scrip_code") or "").strip()

                if not pdf_url or not pdf_url.startswith("http"):
                    continue

                doc_type = None
                if any(k in combined for k in ["TRANSCRIPT", "EARNINGS CALL TRANSCRIPT", "CON. CALL"]):
                    doc_type = "CONCALL_TRANSCRIPT"
                elif any(k in combined for k in ["INVESTOR PRESENTATION", "ANALYST PRESENTATION", "INVESTOR MEET", "EARNINGS PRESENTATION"]):
                    doc_type = "INVESTOR_PRESENTATION"

                if not doc_type:
                    continue

                comp = None
                if scrip:
                    comp = db.query(Company).filter(Company.bse_code == scrip).first()
                if not comp and b_item.get("company_name"):
                    comp = db.query(Company).filter(Company.company.ilike(f"%{b_item['company_name'][:15]}%")).first()

                sym = comp.symbol if comp else f"BSE_{scrip}"
                comp_id = comp.id if comp else None
                comp_name = comp.company if comp else (b_item.get("company_name") or sym)

                ann_date = datetime.date.today()
                fiscal_period, fy, q, ann_date = resolve_quarter_and_date(combined, fallback_date=ann_date)
                content_hash = hashlib.sha256(f"{sym}_{fy}_{q}_{doc_type}".encode()).hexdigest()

                # Deduplication across exchanges
                exists = (
                    db.query(InvestorDocument)
                    .filter(
                        InvestorDocument.symbol == sym,
                        (
                            (InvestorDocument.financial_year == fy)
                            & (InvestorDocument.financial_quarter == q)
                            & (InvestorDocument.doc_type == doc_type)
                        )
                        | (InvestorDocument.pdf_url == pdf_url),
                    )
                    .first()
                )
                if exists:
                    continue

                doc = InvestorDocument(
                    company_id=comp_id,
                    symbol=sym,
                    company_name=comp_name,
                    exchange="BSE",
                    doc_type=doc_type,
                    fiscal_period=fiscal_period,
                    financial_year=fy,
                    financial_quarter=q,
                    announcement_date=ann_date,
                    headline=headline[:200] or f"{sym} {doc_type} - {fiscal_period}",
                    source_url="https://www.bseindia.com",
                    pdf_url=pdf_url,
                    content_hash=content_hash,
                    status="PENDING",
                    download_status="PENDING",
                    extraction_status="PENDING",
                    ai_analysis_status="PENDING",
                )
                db.add(doc)
                discovered += 1

        except Exception as bse_err:
            logger.warning(f"BSE Wire harvest warning: {bse_err}")

        db.commit()
        return {"discovered": discovered}

    # -------------------------------------------------------------------------
    # 3. Synchronize & Extract Text from Pending Documents
    # -------------------------------------------------------------------------
    @classmethod
    def extract_pending_documents(cls, db: Session, limit: int = 5) -> List[InvestorDocument]:
        """
        Finds pending investor documents, downloads their PDFs, and extracts text segments.
        Updates granular stage statuses (`download_status`, `extraction_status`).
        """
        pending_docs = (
            db.query(InvestorDocument)
            .filter(InvestorDocument.extraction_status == "PENDING", InvestorDocument.pdf_url.isnot(None))
            .order_by(InvestorDocument.id.desc())
            .limit(limit)
            .all()
        )

        extracted_docs = []
        for doc in pending_docs:
            try:
                res = PDFExtractorService.process_document_url(
                    pdf_url=doc.pdf_url,
                    symbol=doc.symbol,
                    doc_type=doc.doc_type,
                    doc_name=f"{doc.symbol}_{doc.fiscal_period}_{doc.doc_type}_{doc.id}",
                )

                if res["success"]:
                    doc.raw_text_length = len(res["raw_text"])
                    doc.parsed_text = res["raw_text"][:45000]
                    doc.management_speech_text = res["management_speech"]
                    doc.analyst_qa_text = res["analyst_qa"]
                    doc.download_status = "DOWNLOADED"
                    doc.extraction_status = "EXTRACTED"
                    doc.status = "EXTRACTED"
                    doc.error_message = None
                    doc.processing_error = None
                    extracted_docs.append(doc)
                else:
                    doc.download_status = "FAILED" if not res.get("raw_text") else "DOWNLOADED"
                    doc.extraction_status = "FAILED"
                    doc.status = "FAILED"
                    err = res.get("error", "Unknown extraction error")
                    doc.error_message = err
                    doc.processing_error = err

            except Exception as e:
                logger.error(f"Error extracting document {doc.id} ({doc.symbol}): {e}")
                doc.extraction_status = "FAILED"
                doc.status = "FAILED"
                doc.error_message = str(e)
                doc.processing_error = str(e)

            db.commit()

        return extracted_docs
